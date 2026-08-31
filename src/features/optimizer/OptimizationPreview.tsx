import { CAlert, CRow } from '@coreui/react'
import type { ReactNode } from 'react'

import { fmtMoney } from 'src/features/review/format'
import PricingBlock from 'src/shared/components/PricingBlock'
import type { OptimizeResponse } from './types'
import CutLayoutDiagram from './CutLayoutDiagram'
import OptimizingOverlay from './OptimizingOverlay'
import { EdgeBandingSummaryTable, Kpi, MaterialsSummaryTable, meters } from './summaryTables'

// The result of a cut run: KPIs, cost tables and the diagram bar stacked together. Used by the
// pre-order detail page; the optimizer wizard lays the same data out itself in `CostsStep`, and the
// two share `CutLayoutDiagram` and the summary tables.
//
// No card. It used to carry one, whose header held an "Optimizar" button, a strategy picker and
// "Otra alternativa" — none of which the only caller ever passed, since pre-orders drive the run
// from the pinned footer and the ⋮ menu. What is left renders straight onto the page's surface,
// under a plain label, the way the wizard steps do.

interface OptimizationPreviewProps {
  result?: OptimizeResponse
  isPending: boolean
  error?: Error | null
  // Price-tier control, rendered on the totals row beside PricingBlock. It lives here rather than in
  // a settings card further up because a control that moves a number belongs next to the number —
  // otherwise switching tiers means scrolling past the whole cut list to read the effect.
  priceLevel?: ReactNode
  // Per-board discount selection. Like the tier, it is a PENDING edit here: passing
  // `onToggleLevel` shows the column, and the totals only catch up after "Actualizar cotización".
  leveledKeys?: Set<string>
  onToggleLevel?: (materialKey: string) => void
  // Per-board "the client takes the whole board", same pending-edit semantics.
  wholeBoardKeys?: Set<string>
  onToggleWholeBoard?: (materialKey: string) => void
  // Freezes both marks (a closed quote, or a recompute in flight).
  marksDisabled?: boolean
}

const OptimizationPreview = ({
  result,
  isPending,
  error,
  priceLevel,
  leveledKeys,
  onToggleLevel,
  wholeBoardKeys,
  onToggleWholeBoard,
  marksDisabled,
}: OptimizationPreviewProps) => (
  <>
    <div className="text-body-secondary small text-uppercase fw-semibold mb-2">Resultado</div>
    {/* Relative so the optimizing overlay can cover exactly this pane: the previous result stays
        on screen underneath, dimmed, instead of blanking out while the new one is computed. */}
    <div style={{ position: 'relative', minHeight: isPending ? '18rem' : undefined }}>
      {isPending && <OptimizingOverlay />}
      {error && (
        <CAlert color="danger" className="py-2 small mb-3">
          {error.message || 'Error al optimizar. Intente nuevamente.'}
        </CAlert>
      )}
      {!result && !error && (
        <div className="text-body-secondary small">
          Define materiales y piezas, luego presiona “Actualizar cotización” para ver tableros,
          costo, eficiencia y el diagrama de cortes.
        </div>
      )}
      {result && (
        <>
          <CRow className="g-2 mb-3">
            <Kpi label="Tableros usados" value={result.totalBoardsUsed} />
            {/* The figure the client is quoted, not the materials' net subtotal:
                this is the headline of the quote, and everything else on the page
                (the tables, the breakdown below) already shows the parts. Falls
                back to boards + banding on a payload with no pricing block. */}
            <Kpi
              label="Total (con IVA)"
              value={fmtMoney(
                result.pricing?.total ??
                  (result.totalBoardsCost ?? 0) + (result.totalEdgeBandingCost ?? 0),
              )}
            />
            <Kpi label="Corte lineal" value={meters(result.totalCutLinearM)} />
            <Kpi label="Tapacanto lineal" value={meters(result.totalEdgeBandingLinearM)} />
          </CRow>

          <MaterialsSummaryTable
            rows={result.materialsSummary ?? []}
            leveledKeys={leveledKeys}
            onToggleLevel={onToggleLevel}
            wholeBoardKeys={wholeBoardKeys}
            onToggleWholeBoard={onToggleWholeBoard}
            marksDisabled={marksDisabled}
          />
          <EdgeBandingSummaryTable rows={result.edgeBandingsSummary ?? []} />

          <CutLayoutDiagram
            layoutGroups={result.layoutGroups}
            materialsSummary={result.materialsSummary}
          />

          {/* Tier picker and totals on one line, the same pairing the Costos step uses. The tier
              shown — and the per-board discount marks above — are the pending selection; the totals
              are the ones the server last computed, so they only agree again after "Actualizar
              cotización". */}
          {(priceLevel || result.pricing) && (
            <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 border-top pt-3">
              {priceLevel}
              {/* ms-auto, not just the row's justify-content: on a closed quote there is no tier
                  picker, and a lone child in a space-between row lands on the left. */}
              {result.pricing && (
                <div className="ms-auto">
                  <PricingBlock pricing={result.pricing} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  </>
)

export default OptimizationPreview
