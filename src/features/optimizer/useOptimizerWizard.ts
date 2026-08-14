import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { MaterialInput, PackingStrategy, RequirementInput } from './types'

// The wizard's current step lives in a SEARCH PARAM, not a sub-route. `AppContent` keys its
// ErrorBoundary on `location.pathname`, so a path change would remount this page and destroy the
// whole workspace — pieces, undo history, the optimize result (a mutation, not a cached query) and
// fullscreen. A search param leaves `pathname` untouched, so back/forward walk the steps while the
// component stays mounted, and `fluid` + the breadcrumb keep matching `/optimizer`.

export const STEP_PARAM = 'paso'

export const STEP_IDS = ['despiece', 'optimizacion', 'costos', 'cotizacion'] as const
export type StepId = (typeof STEP_IDS)[number]

export interface StepDef {
  id: StepId
  label: string
  // Shown on the disabled control when the step is not reachable yet.
  blockedReason: string
}

export const STEPS: readonly StepDef[] = [
  { id: 'despiece', label: 'Despiece', blockedReason: '' },
  {
    id: 'optimizacion',
    label: 'Optimización',
    blockedReason: 'Agrega al menos una pieza con medidas',
  },
  { id: 'costos', label: 'Costos', blockedReason: 'Primero hay que optimizar' },
  {
    id: 'cotizacion',
    label: 'Cotización',
    blockedReason: 'Falta elegir el tapacanto de algunas piezas',
  },
]

export interface WizardGates {
  // Any row carries data — enough to attempt a run.
  hasPieceData: boolean
  // A result is on screen.
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
    if (canQuote) return 3
    if (hasResult) return 2
    if (hasPieceData) return 1
    return 0
  }, [hasPieceData, hasResult, canQuote])

  const raw = params.get(STEP_PARAM)
  const requested = raw == null ? 0 : STEP_IDS.indexOf(raw as StepId)
  const index = Math.min(Math.max(requested, 0), maxIndex)
  const step = STEP_IDS[index] ?? 'despiece'

  // Clamp the URL back to what the data allows: a refresh restores pieces from the autosave but
  // never the result, so `?paso=costos` in a fresh tab has to fall back. `replace` so the bogus
  // entry doesn't end up in the history.
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
  const nextBlockedReason = isLast || canGoNext ? undefined : STEPS[index + 1]?.blockedReason

  const next = useCallback(() => {
    const target = STEP_IDS[index + 1]
    if (target) goTo(target)
  }, [index, goTo])

  return { step, index, maxIndex, goTo, back, next, canGoNext, nextBlockedReason, isLast }
}

export type OptimizerWizard = ReturnType<typeof useOptimizerWizard>
