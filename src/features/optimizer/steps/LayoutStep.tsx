import { CAlert, CRow } from '@coreui/react'

import type { OptimizeResponse } from '../types'
import { Kpi, meters } from '../summaryTables'
import OptimizingOverlay from '../OptimizingOverlay'
import SheetViewer from '../SheetViewer'

// Step 2. Geometry only: how the pieces landed on the boards. The money moved to the Costos step,
// which is what freed the room for the sheets to be shown big instead of behind an "Ampliar" modal.
//
// Nothing but the result: no card, no heading, and no control row. The heuristic picker and
// "Volver a optimizar" moved into the page's actions menu (`OptimizerActionsMenu`, `Ctrl+↵`), which
// is where every other action already lives — so the sheet gets the full width and the full height.

interface LayoutStepProps {
  result?: OptimizeResponse
  isPending: boolean
  error?: Error | null
  // Alternative-solution seed of the result on screen; only shown when it is not the canonical one.
  variant: number
  // The inputs changed since this result was computed; a fresh run is already on its way.
  isStale: boolean
}

const LayoutStep = ({ result, isPending, error, variant, isStale }: LayoutStepProps) => (
  <>
    {/* The overlay covers the viewport, not this pane: pinned here it was clipped by the pane and
        scrolled out of view on a long result, so the wait could end up off screen. */}
    {isPending && <OptimizingOverlay />}

    {error && (
      <CAlert color="danger" className="py-2 small mb-3">
        {error.message || 'Error al optimizar. Intente nuevamente.'}
      </CAlert>
    )}

    {!result && !error && !isPending && (
      <div className="text-body-secondary small">
        Todavía no hay un resultado. Usa “Optimizar” en el menú ⋮ (Ctrl+↵) para calcular la
        distribución de las piezas en los tableros.
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

        {/* The seed used to ride as a badge on the "Volver a optimizar" button. With the button in
            the menu, this is what says which alternative is on screen. */}
        {variant > 0 && (
          <div className="text-body-secondary small mb-2">Alternativa #{variant}</div>
        )}

        <SheetViewer
          layoutGroups={result.layoutGroups}
          materialsSummary={result.materialsSummary}
        />
      </>
    )}
  </>
)

export default LayoutStep
