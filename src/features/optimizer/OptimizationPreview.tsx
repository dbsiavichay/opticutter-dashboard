import {
  CAlert,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalculator, cilLoopCircular } from '@coreui/icons'

import { fmtMoney } from 'src/features/review/format'
import PricingBlock from 'src/shared/components/PricingBlock'
import type { OptimizeResponse, PackingStrategy } from './types'
import CutLayoutDiagram from './CutLayoutDiagram'
import OptimizingOverlay from './OptimizingOverlay'
import { EdgeBandingSummaryTable, Kpi, MaterialsSummaryTable, meters } from './summaryTables'

// Single-card result view: KPIs, cost tables and the pattern grid stacked together. Used by the
// pre-order detail page, which shows the result alongside its editor. The optimizer wizard splits
// the same data across its Optimización and Costos steps instead.

interface OptimizationPreviewProps {
  result?: OptimizeResponse
  isPending: boolean
  error?: Error | null
  // When provided, the header shows an "Optimizar" button. Pre-orders use it as Save+Recalculate
  // alongside their sticky action bar; the optimizer drives everything from here.
  canOptimize?: boolean
  onOptimize?: () => void
  // Primary button label. Defaults to "Optimizar".
  optimizeLabel?: string
  // Cut heuristic picker, rendered in the header when both are provided. Omitted by pre-orders,
  // which keep it in their action bar.
  strategy?: PackingStrategy
  onStrategyChange?: (s: PackingStrategy) => void
  // "Otra alternativa": bumps the variant seed for a different deterministic layout. Shown only
  // once there is a result to vary.
  onAlternative?: () => void
  variant?: number
  // Portal target for the expanded-sheet modal; see CutLayoutDiagram.modalContainer.
  modalContainer?: () => Element | null
}

// "Máxima eficiencia" first because it is the default: the picker reads left-to-right from the
// normal case to the special one. Pre-orders keep their own copy in OptimizeActionBar.
export const STRATEGY_OPTIONS: { value: PackingStrategy; label: string }[] = [
  { value: 'default', label: 'Máxima eficiencia' },
  { value: 'longOffcuts', label: 'Retazos largos' },
]

export const strategyHint = (s: PackingStrategy) =>
  s === 'longOffcuts'
    ? 'Agrupa el sobrante en una tira larga reutilizable'
    : 'Minimiza el desperdicio total'

const OptimizationPreview = ({
  result,
  isPending,
  error,
  canOptimize,
  onOptimize,
  optimizeLabel = 'Optimizar',
  strategy,
  onStrategyChange,
  onAlternative,
  variant = 0,
  modalContainer,
}: OptimizationPreviewProps) => {
  const showStrategy = strategy != null && !!onStrategyChange
  return (
    <CCard className="mb-3">
      {/* Actions live in this header rather than a bar pinned to the bottom of the viewport: with
          the results pane sticky, they stay reachable without permanently spending a strip of
          screen height. */}
      <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <strong>Vista previa de optimización</strong>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {showStrategy && (
            <CButtonGroup size="sm" role="group" aria-label="Heurística de corte">
              {STRATEGY_OPTIONS.map((o) => {
                const active = strategy === o.value
                return (
                  <CButton
                    key={o.value}
                    type="button"
                    color="primary"
                    variant={active ? undefined : 'outline'}
                    active={active}
                    disabled={isPending}
                    title={strategyHint(o.value)}
                    onClick={() => onStrategyChange?.(o.value)}
                  >
                    {o.label}
                  </CButton>
                )
              })}
            </CButtonGroup>
          )}
          {result && onAlternative && (
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              type="button"
              disabled={!canOptimize || isPending}
              onClick={onAlternative}
              title="Genera una distribución alternativa con las mismas piezas"
            >
              <CIcon icon={cilLoopCircular} className="me-1" />
              Otra alternativa
              {variant > 0 && <span className="ms-1 badge text-bg-secondary">#{variant}</span>}
            </CButton>
          )}
          {onOptimize ? (
            <CButton
              size="sm"
              color="primary"
              type="button"
              disabled={!canOptimize || isPending}
              onClick={onOptimize}
            >
              {/* Spinner takes the icon's place and the label stays, so the button does not change
                  width under the cursor that just pressed it. */}
              {isPending ? (
                <CSpinner size="sm" className="me-1" />
              ) : (
                <CIcon icon={cilCalculator} className="me-1" />
              )}
              {optimizeLabel}
            </CButton>
          ) : (
            isPending && (
              <span className="text-body-secondary small d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                Optimizando…
              </span>
            )
          )}
        </div>
      </CCardHeader>
      {/* Relative so the optimizing overlay can cover exactly this pane: the previous result stays
          on screen underneath, dimmed, instead of blanking out while the new one is computed. */}
      <CCardBody style={{ position: 'relative', minHeight: isPending ? '18rem' : undefined }}>
        {isPending && <OptimizingOverlay />}
        {error && (
          <CAlert color="danger" className="py-2 small mb-3">
            {error.message || 'Error al optimizar. Intente nuevamente.'}
          </CAlert>
        )}
        {!result && !error && (
          <div className="text-body-secondary small">
            Define materiales y piezas, luego presiona “Optimizar” para ver tableros, costo,
            eficiencia y el diagrama de cortes — sin crear nada.
          </div>
        )}
        {result && (
          <>
            <CRow className="g-2 mb-3">
              <Kpi label="Tableros usados" value={result.totalBoardsUsed} />
              <Kpi
                label="Costo estimado"
                value={fmtMoney((result.totalBoardsCost ?? 0) + (result.totalEdgeBandingCost ?? 0))}
              />
              <Kpi label="Corte lineal" value={meters(result.totalCutLinearM)} />
              <Kpi label="Tapacanto lineal" value={meters(result.totalEdgeBandingLinearM)} />
            </CRow>

            {result.pricing && (
              <div className="mb-3">
                <PricingBlock pricing={result.pricing} />
              </div>
            )}

            <MaterialsSummaryTable rows={result.materialsSummary ?? []} />
            <EdgeBandingSummaryTable rows={result.edgeBandingsSummary ?? []} />

            <CutLayoutDiagram
              layoutGroups={result.layoutGroups}
              materialsSummary={result.materialsSummary}
              modalContainer={modalContainer}
            />
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default OptimizationPreview
