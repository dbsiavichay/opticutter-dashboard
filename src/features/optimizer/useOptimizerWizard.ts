import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { MaterialInput, PackingStrategy, RequirementInput } from './types'

// The wizard's current step lives in a SEARCH PARAM, not a sub-route. `AppContent` keys its
// ErrorBoundary on `location.pathname`, so a path change would remount this page and destroy the
// whole workspace — pieces, undo history, the optimize result (a mutation, not a cached query) and
// fullscreen. A search param leaves `pathname` untouched, so back/forward walk the steps while the
// component stays mounted, and `fluid` + the breadcrumb keep matching `/optimizer`.
//
// The param and its values are English like the rest of the code; only `label` is user-facing.

export const STEP_PARAM = 'step'

export const STEP_IDS = ['pieces', 'costs', 'quote'] as const
export type StepId = (typeof STEP_IDS)[number]

// There used to be an `Optimización` step between Despiece and Costos, showing four geometry KPIs
// and the sheets inline. It was a step you crossed on the way to the prices and never came back to,
// so it folded into Costos: the run now fires on ENTERING Costos, and the plan is one summary line
// with a fullscreen diagram behind it (`CutLayoutDiagram`, the same one the pre-order page uses).
// Old links and history entries still carry `?step=layout`; see LEGACY_STEPS below.
const LEGACY_STEPS: Record<string, StepId> = { layout: 'costs' }

export interface StepDef {
  id: StepId
  label: string
  // Shown on the disabled control when the step is not reachable yet.
  blockedReason: string
}

export const STEPS: readonly StepDef[] = [
  { id: 'pieces', label: 'Despiece', blockedReason: '' },
  // Reached with pieces alone, not with a result: the optimize runs INSIDE this step, so gating it
  // on a result would mean the run could never start.
  { id: 'costs', label: 'Costos', blockedReason: 'Agrega al menos una pieza con medidas' },
  {
    id: 'quote',
    label: 'Cotización',
    blockedReason: 'Falta elegir el tapacanto de algunas piezas',
  },
]

export interface WizardGates {
  // Any row carries data — enough to attempt a run.
  hasPieceData: boolean
  // A result is on screen. No longer part of the ladder (see `maxIndex`), only of the reason a
  // blocked step gives for being blocked.
  hasResult: boolean
  // A result plus every banded piece has its tapacanto product.
  canQuote: boolean
}

// Signature of everything that determines a result. Compared against the signature of the payload
// actually sent, it tells whether what's on screen still describes the current inputs.
export const signatureOf = (
  materials: MaterialInput[],
  requirements: RequirementInput[],
  strategy: PackingStrategy,
  variant: number,
  priceTierCode: string,
): string => JSON.stringify({ materials, requirements, strategy, variant, priceTierCode })

export const useOptimizerWizard = ({ hasPieceData, hasResult, canQuote }: WizardGates) => {
  const [params, setParams] = useSearchParams()

  // Furthest step the current data allows. Backwards is always free; forwards is gated.
  const maxIndex = useMemo(() => {
    if (canQuote) return 2
    if (hasPieceData) return 1
    return 0
  }, [hasPieceData, canQuote])

  const raw = params.get(STEP_PARAM)
  const asked = raw == null ? null : (LEGACY_STEPS[raw] ?? (raw as StepId))
  const requested = asked == null ? 0 : STEP_IDS.indexOf(asked)
  const index = Math.min(Math.max(requested, 0), maxIndex)
  const step = STEP_IDS[index] ?? 'pieces'

  // Clamp the URL back to what the data allows: a refresh restores pieces from the autosave but
  // never the result, so `?step=quote` in a fresh tab has to fall back. `replace` so the bogus
  // entry doesn't end up in the history. This is also what rewrites a legacy `?step=layout`.
  useEffect(() => {
    if (raw != null && raw !== step) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(STEP_PARAM, step)
          return next
        },
        { replace: true },
      )
    }
  }, [raw, step, setParams])

  // Why a step cannot be reached. Cotización has two different answers now that the run happens
  // inside Costos — "no hay resultado" and "faltan tapacantos" — and its static text only covers
  // the second. Used by the trail's tooltip as well as the footer's hint, so both agree.
  const blockedReasonFor = useCallback(
    (id: StepId): string => {
      if (id === 'quote' && !hasResult) return 'Primero hay que optimizar'
      return STEPS[STEP_IDS.indexOf(id)]?.blockedReason ?? ''
    },
    [hasResult],
  )

  const goTo = useCallback(
    (target: StepId) => {
      const i = STEP_IDS.indexOf(target)
      if (i < 0 || i > maxIndex) return
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(STEP_PARAM, target)
        return next
      })
    },
    [maxIndex, setParams],
  )

  const back = useCallback(() => {
    const prev = STEP_IDS[index - 1]
    if (prev) goTo(prev)
  }, [index, goTo])

  const isLast = index === STEP_IDS.length - 1
  const canGoNext = !isLast && index + 1 <= maxIndex
  // Why "Siguiente" is disabled, taken from the step it would lead to.
  const nextStep = STEP_IDS[index + 1]
  const nextBlockedReason =
    isLast || canGoNext || !nextStep ? undefined : blockedReasonFor(nextStep)

  const next = useCallback(() => {
    const target = STEP_IDS[index + 1]
    if (target) goTo(target)
  }, [index, goTo])

  return {
    step,
    index,
    maxIndex,
    goTo,
    back,
    next,
    canGoNext,
    blockedReasonFor,
    nextBlockedReason,
    isLast,
  }
}

export type OptimizerWizard = ReturnType<typeof useOptimizerWizard>
