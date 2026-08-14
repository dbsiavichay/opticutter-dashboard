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

import type { OptimizeResponse, PackingStrategy } from '../types'
import { STRATEGY_OPTIONS, strategyHint } from '../OptimizationPreview'
import { Kpi, meters } from '../summaryTables'
import OptimizingOverlay from '../OptimizingOverlay'
import SheetViewer from '../SheetViewer'

// Step 2. Geometry only: how the pieces landed on the boards. The money moved to the Costos step,
// which is what freed the room for the sheets to be shown big instead of behind an "Ampliar" modal.

interface LayoutStepProps {
  result?: OptimizeResponse
  isPending: boolean
  error?: Error | null
  canOptimize: boolean
  // First run, when there is nothing on screen yet.
  onOptimize: () => void
  strategy: PackingStrategy
  onStrategyChange: (s: PackingStrategy) => void
  // Re-run with a bumped seed. Once a result exists this is what the primary button does — see the
  // note on the button itself.
  onAlternative: () => void
  variant: number
  // The inputs changed since this result was computed; a fresh run is already on its way.
  isStale: boolean
}

const LayoutStep = ({
  result,
  isPending,
  error,
  canOptimize,
  onOptimize,
  strategy,
  onStrategyChange,
  onAlternative,
  variant,
  isStale,
}: LayoutStepProps) => (
  <CCard className="mb-0">
    <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <strong>Optimización</strong>
      <div className="d-flex flex-wrap align-items-center gap-2">
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
                onClick={() => onStrategyChange(o.value)}
              >
                {o.label}
              </CButton>
            )
          })}
        </CButtonGroup>
        {/* One button, because a plain re-run would do nothing visible: entering this step already
            optimized, and the backend caches by input hash, so pressing "Volver a optimizar" on the
            same inputs would return the identical layout. Once a result exists the button bumps the
            alternative seed instead — which is what the user actually wants from it. */}
        <CButton
          size="sm"
          color="primary"
          type="button"
          disabled={!canOptimize || isPending}
          onClick={result ? onAlternative : onOptimize}
          title={
            result
              ? 'Genera una distribución alternativa con las mismas piezas'
              : 'Calcula la distribución de las piezas'
          }
        >
          {/* Spinner takes the icon's place and the label stays, so the button does not change
              width under the cursor that just pressed it. */}
          {isPending ? (
            <CSpinner size="sm" className="me-1" />
          ) : (
            <CIcon icon={result ? cilLoopCircular : cilCalculator} className="me-1" />
          )}
          {result ? 'Volver a optimizar' : 'Optimizar'}
          {variant > 0 && <span className="ms-1 badge text-bg-light text-dark">#{variant}</span>}
        </CButton>
      </div>
    </CCardHeader>
    {/* Relative so the overlay covers exactly this pane: the previous result stays legible
        underneath, dimmed, instead of blanking out while the new one is computed. */}
    <CCardBody style={{ position: 'relative', minHeight: isPending ? '24rem' : undefined }}>
      {isPending && <OptimizingOverlay />}

      {error && (
        <CAlert color="danger" className="py-2 small mb-3">
          {error.message || 'Error al optimizar. Intente nuevamente.'}
        </CAlert>
      )}

      {!result && !error && !isPending && (
        <div className="text-body-secondary small">
          Presiona “Optimizar” para calcular la distribución de las piezas en los tableros.
        </div>
      )}

      {result && (
        <>
          {isStale && !isPending && (
            <CAlert color="warning" className="py-2 small">
              Cambiaste el despiece desde este resultado. Vuelve a optimizar para verlo actualizado.
            </CAlert>
          )}

          <CRow className="g-2 mb-3">
            <Kpi label="Tableros usados" value={result.totalBoardsUsed} />
            <Kpi label="Patrones" value={result.layoutGroups.length} />
            <Kpi label="Corte lineal" value={meters(result.totalCutLinearM)} />
            <Kpi label="Tapacanto lineal" value={meters(result.totalEdgeBandingLinearM)} />
          </CRow>

          <SheetViewer
            layoutGroups={result.layoutGroups}
            materialsSummary={result.materialsSummary}
          />
        </>
      )}
    </CCardBody>
  </CCard>
)

export default LayoutStep
