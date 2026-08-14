import type { ReactNode } from 'react'
import { CButton, CProgress, CProgressBar } from '@coreui/react'

import { STEPS } from './useOptimizerWizard'
import type { StepId } from './useOptimizerWizard'

// Step indicator. Built from plain buttons rather than CoreUI's CTabs: a tab has two states and a
// step has three (done / current / locked), and CoreUI free ships no stepper.

interface WizardStepsProps {
  index: number
  // Furthest reachable step; anything past it is locked and explains why.
  maxIndex: number
  onSelect: (id: StepId) => void
}

const WizardSteps = ({ index, maxIndex, onSelect }: WizardStepsProps) => {
  const current = STEPS[index]

  return (
    <>
      {/* From `md` up: the full trail. */}
      <nav className="wizard-steps d-none d-md-grid mb-3" aria-label="Pasos del optimizador">
        {STEPS.map((s, i) => {
          const state = i < index ? 'done' : i === index ? 'current' : 'todo'
          const locked = i > maxIndex
          return (
            <button
              key={s.id}
              type="button"
              className="wizard-step"
              data-state={state}
              disabled={locked}
              aria-current={i === index ? 'step' : undefined}
              title={locked ? s.blockedReason : undefined}
              onClick={() => onSelect(s.id)}
            >
              <span className="wizard-step-marker">{state === 'done' ? '✓' : i + 1}</span>
              <span className="wizard-step-label small">{s.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Below `md` the trail doesn't fit; the position plus a bar carries the same information. */}
      <div className="d-md-none mb-3">
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
    </>
  )
}

interface WizardFooterProps {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  // Muted text next to a disabled "Siguiente", saying what is missing.
  nextHint?: string
  // Extra actions for the step (e.g. the final "Crear cotización").
  children?: ReactNode
}

// Pinned to the bottom of the viewport: the pieces list runs to dozens of rows, and a footer in
// normal flow means scrolling the whole table to reach "Siguiente" — where it also ended up flush
// against the app's own footer. Same treatment as OptimizeActionBar, which pre-orders still use.
export const WizardFooter = ({
  onBack,
  onNext,
  nextLabel = 'Siguiente',
  nextDisabled,
  nextHint,
  children,
}: WizardFooterProps) => (
  <div className="wizard-footer">
    <div className="d-flex flex-wrap align-items-center gap-2 p-2 border rounded-3 bg-body shadow-sm">
      {onBack && (
        <CButton color="secondary" variant="outline" type="button" onClick={onBack}>
          ‹ Atrás
        </CButton>
      )}
      <div className="ms-auto d-flex align-items-center gap-2">
        {nextHint && nextDisabled && (
          <span className="text-body-secondary small d-none d-sm-inline">{nextHint}</span>
        )}
        {children}
        {onNext && (
          <CButton color="primary" type="button" disabled={nextDisabled} onClick={onNext}>
            {nextLabel} ›
          </CButton>
        )}
      </div>
    </div>
  </div>
)

export default WizardSteps
