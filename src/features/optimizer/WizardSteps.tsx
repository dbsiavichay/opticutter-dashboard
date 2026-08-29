import type { ReactNode } from 'react'
import { CButton, CProgress, CProgressBar } from '@coreui/react'

import { KEY } from 'src/shared/utils/platform'
import { STEPS } from './useOptimizerWizard'
import type { StepId } from './useOptimizerWizard'

// Step indicator. Built from plain buttons rather than CoreUI's CTabs: a tab has two states and a
// step has three (done / current / locked), and CoreUI free ships no stepper.

interface WizardStepsProps {
  index: number
  // Furthest reachable step; anything past it is locked and explains why.
  maxIndex: number
  // Why a locked step is locked. From the wizard rather than from `STEPS`: Cotización has two
  // different answers (no result yet vs. missing tapacantos) and its static text only covers one.
  blockedReasonFor: (id: StepId) => string
  onSelect: (id: StepId) => void
  // The page's actions menu. It rides on this row because the row exists anyway — the alternative
  // was a toolbar of its own above it, which is exactly what this redesign removed. It also has to
  // stay inside the page: the app header sits outside the fullscreen element and is never painted.
  actions?: ReactNode
}

const WizardSteps = ({
  index,
  maxIndex,
  blockedReasonFor,
  onSelect,
  actions,
}: WizardStepsProps) => {
  const current = STEPS[index]

  return (
    <div className="d-flex align-items-center gap-2 mb-3">
      {/* From `md` up: the full trail. */}
      <nav
        className="wizard-steps d-none d-md-grid flex-grow-1 min-w-0"
        aria-label="Pasos del optimizador"
      >
        {STEPS.map((s, i) => {
          const state = i < index ? 'done' : i === index ? 'current' : 'todo'
          const locked = i > maxIndex
          // The cell carries the state and the connector; the button inside it carries the click.
          // They used to be the same element, which made a quarter of the row a hit target for a
          // step whose marker was hundreds of pixels away.
          return (
            <div key={s.id} className="wizard-step" data-state={state}>
              <button
                type="button"
                className="wizard-step-hit"
                disabled={locked}
                aria-current={i === index ? 'step' : undefined}
                title={locked ? blockedReasonFor(s.id) : undefined}
                onClick={() => onSelect(s.id)}
              >
                <span className="wizard-step-marker">{state === 'done' ? '✓' : i + 1}</span>
                <span className="wizard-step-label small">{s.label}</span>
              </button>
            </div>
          )
        })}
      </nav>

      {/* Below `md` the trail doesn't fit; the position plus a bar carries the same information. */}
      <div className="d-md-none flex-grow-1 min-w-0">
        <div className="d-flex justify-content-between align-items-baseline mb-1">
          <strong className="small">{current?.label}</strong>
          <span className="text-body-secondary small">
            Paso {index + 1} de {STEPS.length}
          </span>
        </div>
        <CProgress height={4}>
          <CProgressBar value={((index + 1) / STEPS.length) * 100} />
        </CProgress>
      </div>

      {actions}
    </div>
  )
}

interface WizardFooterProps {
  onBack?: () => void
  // Defaults to "Atrás" (a step back). The pre-order page leaves the record entirely, so it says so.
  backLabel?: string
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  // Muted text next to a disabled "Siguiente", saying what is missing.
  nextHint?: string
  // Left half of the bar: the running totals, swapped for the selection actions while rows are
  // marked. Both used to cost a row of their own above the list.
  left?: ReactNode
  // Extra actions for the step (e.g. the final "Crear cotización").
  children?: ReactNode
}

// Pinned to the bottom of the viewport: the pieces list runs to dozens of rows, and a footer in
// normal flow means scrolling the whole table to reach "Siguiente" — where it also ended up flush
// against the app's own footer. The pre-order detail page mounts the same bar (it had a near-copy,
// OptimizeActionBar, that sat at the sticky z-tier and painted over its own dropdowns).
export const WizardFooter = ({
  onBack,
  backLabel = 'Atrás',
  onNext,
  nextLabel = 'Siguiente',
  nextDisabled,
  nextHint,
  left,
  children,
}: WizardFooterProps) => (
  <div className="wizard-footer">
    <div className="d-flex flex-wrap align-items-center gap-2 p-2 border rounded-3 bg-body shadow-sm">
      {onBack && (
        <CButton
          color="secondary"
          variant="outline"
          type="button"
          title={`${KEY.alt}+←`}
          onClick={onBack}
        >
          ‹ {backLabel}
        </CButton>
      )}
      {left}
      <div className="ms-auto d-flex align-items-center gap-2">
        {nextHint && nextDisabled && (
          <span className="text-body-secondary small d-none d-sm-inline">{nextHint}</span>
        )}
        {children}
        {onNext && (
          <CButton
            color="primary"
            type="button"
            disabled={nextDisabled}
            title={nextDisabled ? nextHint : `${KEY.alt}+→`}
            onClick={onNext}
          >
            {nextLabel} ›
          </CButton>
        )}
      </div>
    </div>
  </div>
)

export default WizardSteps
