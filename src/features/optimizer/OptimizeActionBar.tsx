import { CButton, CButtonGroup, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalculator, cilCart, cilLoopCircular } from '@coreui/icons'

import type { PackingStrategy } from './types'

interface OptimizeActionBarProps {
  strategy: PackingStrategy
  onStrategyChange: (s: PackingStrategy) => void
  canOptimize: boolean
  isPending: boolean
  hasResult: boolean
  onOptimize: () => void
  // Optional: when omitted (e.g. in the pre-order view, which already is a quote) the button is hidden.
  onCreateQuote?: () => void
  // Gates the "Crear cotización" button (e.g. disabled while a piece has banding sides but no
  // tapacanto). Defaults to true.
  canCreateQuote?: boolean
  // Primary button label. Defaults to "Optimizar"; pre-orders use "Actualizar cotización" since the
  // action there saves and recomputes the quote rather than running a throwaway preview.
  optimizeLabel?: string
  // Optional muted hint shown next to the primary button while it is disabled (e.g. "Sin cambios
  // por guardar" in the pre-order view). Only rendered when the button is disabled and not pending.
  disabledHint?: string
  // "Generar otra alternativa": bumps the variant seed and recomputes, producing a genuinely
  // different deterministic layout when alternatives exist. Hidden when omitted or without result.
  onAlternative?: () => void
  // Current variant seed (shown as a hint when > 0 so the user knows which alternative is active).
  variant?: number
  // Own gate for the alternative button (defaults to canOptimize). The pre-order view gates the
  // primary button on "dirty", but generating an alternative is precisely a no-pending-edits action.
  canAlternative?: boolean
}

const OPTIONS: { value: PackingStrategy; label: string }[] = [
  { value: 'longOffcuts', label: 'Retazos largos' },
  { value: 'default', label: 'Máxima eficiencia' },
]

// Sticky action bar pinned to the bottom of the viewport: keeps the cut heuristic and the primary
// "Optimizar" action always visible, regardless of how long the pieces list gets.
const OptimizeActionBar = ({
  strategy,
  onStrategyChange,
  canOptimize,
  isPending,
  hasResult,
  onOptimize,
  onCreateQuote,
  canCreateQuote = true,
  optimizeLabel = 'Optimizar',
  disabledHint,
  onAlternative,
  variant = 0,
  canAlternative,
}: OptimizeActionBarProps) => (
  <div style={{ position: 'sticky', bottom: 0, zIndex: 1020 }} className="mb-3">
    <div className="d-flex flex-wrap align-items-center gap-3 p-2 border rounded-3 bg-body shadow-sm">
      <div>
        <div className="small text-body-secondary fw-semibold text-uppercase mb-1">
          Heurística de corte
        </div>
        <CButtonGroup size="sm" role="group" aria-label="Heurística de corte">
          {OPTIONS.map((o) => {
            const active = strategy === o.value
            return (
              <CButton
                key={o.value}
                type="button"
                color="primary"
                variant={active ? undefined : 'outline'}
                active={active}
                disabled={isPending}
                onClick={() => onStrategyChange(o.value)}
              >
                {o.label}
              </CButton>
            )
          })}
        </CButtonGroup>
      </div>

      <div className="text-body-secondary small d-none d-lg-block" style={{ maxWidth: 260 }}>
        Retazos largos: agrupa el sobrante en una tira larga reutilizable.
      </div>

      <div className="ms-auto d-flex align-items-center gap-2">
        {disabledHint && !canOptimize && !isPending && (
          <span className="text-body-secondary small d-none d-sm-inline">{disabledHint}</span>
        )}
        {hasResult && onAlternative && (
          <CButton
            color="secondary"
            variant="outline"
            type="button"
            disabled={!(canAlternative ?? canOptimize) || isPending}
            onClick={onAlternative}
            title="Genera una distribución alternativa con las mismas piezas"
          >
            <CIcon icon={cilLoopCircular} className="me-1" />
            Otra alternativa
            {variant > 0 && <span className="ms-1 badge text-bg-secondary">#{variant}</span>}
          </CButton>
        )}
        {hasResult && onCreateQuote && (
          <CButton
            color="secondary"
            variant="outline"
            type="button"
            disabled={!canCreateQuote}
            onClick={onCreateQuote}
          >
            <CIcon icon={cilCart} className="me-1" />
            Crear cotización
          </CButton>
        )}
        <CButton
          color="primary"
          size="lg"
          type="button"
          disabled={!canOptimize || isPending}
          onClick={onOptimize}
        >
          {isPending ? (
            <CSpinner size="sm" className="me-1" />
          ) : (
            <CIcon icon={cilCalculator} className="me-1" />
          )}
          {optimizeLabel}
        </CButton>
      </div>
    </div>
  </div>
)

export default OptimizeActionBar
