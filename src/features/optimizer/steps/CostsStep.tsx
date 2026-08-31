import { CAlert, CRow, CSpinner } from '@coreui/react'

import { fmtMoney } from 'src/features/review/format'
import PricingBlock from 'src/shared/components/PricingBlock'
import PriceLevelToggle from 'src/features/optimizer/PriceLevelToggle'
import ServiceLines from 'src/features/preorders/ServiceLines'
import {
  pricingWithServices,
  servicesNetTotal,
  type ServiceLineForm,
} from 'src/features/preorders/useServiceLines'
import { useServices } from 'src/features/services/useServices'
import { KEY } from 'src/shared/utils/platform'
import type { ModalContainer, OptimizeResponse } from '../types'
import CutLayoutDiagram from '../CutLayoutDiagram'
import OptimizingOverlay from '../OptimizingOverlay'
import { EdgeBandingSummaryTable, Kpi, MaterialsSummaryTable, meters } from '../summaryTables'

// Step 2, and the step that runs the search. There used to be an `Optimización` step before this
// one, holding four geometry KPIs and the sheets inline; it was a step you crossed on the way to
// the prices and never came back to. The run now fires on ENTERING this step (the page's effect),
// and the plan is one summary line with a fullscreen diagram behind it — the same `CutLayoutDiagram`
// the pre-order detail page mounts, so both places show a cut plan the same way.
//
// The bar goes ABOVE the money: arriving here, the first thing to confirm is that the optimization
// ran and how well it went; the numbers only mean something after that.
//
// The price tier is chosen HERE rather than next to the client: it is the one input that changes
// these numbers, and picking it beside the tables it moves means the real cost is visible on the
// spot. The additional services are here for the same reason — they used to be reachable only from
// the pre-order detail page, so a quote built in the wizard was born without them.

interface CostsStepProps {
  // Absent until the first run lands: this step owns the pending / error / empty states that the
  // Optimización step used to.
  result?: OptimizeResponse
  // A cut SEARCH is in flight — the sheets are about to move, so the viewport overlay is right.
  // A re-price (tier, per-board marks) is not this: it only moves the money and says so inline.
  isSearching: boolean
  error?: Error | null
  // Alternative-solution seed of the result on screen; only shown when it is not the canonical one.
  variant: number
  // The inputs changed since this result was computed; a fresh run is already on its way.
  isStale: boolean
  // Pieces with banding sides but no tapacanto product: their cost is missing from these tables,
  // which is exactly why they block the quote.
  missingBanding: number[]
  priceLevel: number
  // Recomputes the quote. Cheap despite being a round trip: `/optimize` is cached by input hash, so
  // changing only the tier re-prices the same cut plan instead of searching again.
  onPriceLevelChange: (level: number) => void
  isPending: boolean
  // Per-board discount: the tier sets the rate, this says which boards it applies to. Nothing is
  // discounted until the seller checks a board. Re-prices through the same cached round trip.
  leveledKeys: Set<string>
  onToggleLevel: (materialKey: string) => void
  // Per-board "the client takes the whole board": promotes a sheet the optimizer billed as half.
  // Also a cached round trip — the plan is reshaped, never searched again.
  wholeBoardKeys: Set<string>
  onToggleWholeBoard: (materialKey: string) => void
  // Billed services, owned by the page so they survive stepping away and land in the autosave.
  services: ServiceLineForm[]
  onAddService: () => void
  onUpdateService: <K extends keyof ServiceLineForm>(
    uid: string,
    field: K,
    value: ServiceLineForm[K],
  ) => void
  onRemoveService: (uid: string) => void
  container?: ModalContainer
}

const CostsStep = ({
  result,
  isSearching,
  error,
  variant,
  isStale,
  missingBanding,
  priceLevel,
  onPriceLevelChange,
  isPending,
  leveledKeys,
  onToggleLevel,
  wholeBoardKeys,
  onToggleWholeBoard,
  services,
  onAddService,
  onUpdateService,
  onRemoveService,
  container,
}: CostsStepProps) => {
  const boardsCost = result?.totalBoardsCost ?? 0
  const bandingCost = result?.totalEdgeBandingCost ?? 0

  // Queried here rather than in the page: this is server state, and the request should not go out
  // until someone actually reaches the step that spends it.
  const { data: catalogData } = useServices({ isActive: true, limit: 100 })
  const catalog = catalogData?.items ?? []

  const pricing = result?.pricing ? pricingWithServices(result.pricing, services) : undefined

  // No card and no "Costos" heading: the step trail says it. The KPI tiles and the tables carry
  // their own borders, so wrapping them in one more box only added a frame.
  return (
    <>
      {/* The overlay covers the viewport, not this pane: pinned here it was clipped by the pane and
          scrolled out of view on a long result, so the wait could end up off screen. */}
      {isSearching && <OptimizingOverlay />}

      {error && (
        <CAlert color="danger" className="py-2 small mb-3">
          {error.message || 'Error al optimizar. Intente nuevamente.'}
        </CAlert>
      )}

      {!result && !error && !isSearching && (
        <div className="text-body-secondary small">
          Todavía no hay un resultado. Usa “Optimizar” en el menú ⋮ ({`${KEY.mod}+${KEY.enter}`})
          para calcular la distribución de las piezas en los tableros y su costo.
        </div>
      )}

      {result && (
        <>
          {isStale && !isSearching && (
            <CAlert color="warning" className="py-2 small">
              Cambiaste el despiece desde este resultado. Vuelve a optimizar para verlo actualizado.
            </CAlert>
          )}

          {missingBanding.length > 0 && (
            <CAlert color="warning" className="py-2 small">
              {missingBanding.length === 1
                ? `La pieza #${missingBanding.map((i) => i + 1).join('')} tiene canto definido pero no seleccionaste el tapacanto.`
                : `Hay ${missingBanding.length} piezas con canto definido pero sin tapacanto (#${missingBanding
                    .map((i) => i + 1)
                    .join(', #')}).`}{' '}
              Su tapacanto no está costeado y no podrás crear la cotización hasta seleccionarlo —
              vuelve al paso Despiece.
            </CAlert>
          )}

          <CRow className="g-2 mb-3">
            <Kpi label="Tableros" value={fmtMoney(boardsCost)} />
            <Kpi label="Tapacanto" value={fmtMoney(bandingCost)} />
            {/* Net, like the two tiles beside it: they are the three parts of the
                subtotal, and a tile with tax inside would not add up to it. The
                services are typed tax-included below, which is exactly why this
                one has to say which number it is showing. */}
            <Kpi
              label="Servicios (sin IVA)"
              value={fmtMoney(servicesNetTotal(services, result.pricing?.taxRate ?? 0))}
            />
            <Kpi
              label="Total"
              value={pricing ? fmtMoney(pricing.total) : fmtMoney(boardsCost + bandingCost)}
            />
          </CRow>

          {/* Under the money, not over it: the tiles are what the step is for, and the plan is the
              thing you check against them. `container` is not optional here — the workspace can be
              in fullscreen, and a modal portaled to document.body would mount outside it and never
              be painted. */}
          <CutLayoutDiagram
            layoutGroups={result.layoutGroups}
            materialsSummary={result.materialsSummary}
            modalContainer={container}
            extra={
              <>
                {/* Same weight as the counts beside them — they are the same kind of fact, and the
                    muted treatment they used to have read as a footnote to the bar. The leading
                    separator continues that list rather than starting a second group. */}
                <span className="small">
                  · corte <strong>{meters(result.totalCutLinearM)}</strong> · tapacanto{' '}
                  <strong>{meters(result.totalEdgeBandingLinearM)}</strong>
                </span>
                {/* The seed used to ride as a badge on the "Volver a optimizar" button. With the
                    button in the menu, this is what says which alternative is on screen. Muted, and
                    not part of the list above: it names the run, it does not measure the plan. */}
                {variant > 0 && (
                  <span className="small text-body-secondary">alternativa #{variant}</span>
                )}
              </>
            }
          />

          <div className="text-body-secondary small text-uppercase fw-semibold mb-2">Tableros</div>
          <MaterialsSummaryTable
            rows={result.materialsSummary ?? []}
            leveledKeys={leveledKeys}
            onToggleLevel={onToggleLevel}
            wholeBoardKeys={wholeBoardKeys}
            onToggleWholeBoard={onToggleWholeBoard}
          />

          {result.edgeBandingsSummary?.length > 0 && (
            <>
              <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
                Tapacantos
              </div>
              <EdgeBandingSummaryTable rows={result.edgeBandingsSummary} />
            </>
          )}

          <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
            Servicios adicionales
          </div>
          <ServiceLines
            services={services}
            catalog={catalog}
            onAdd={onAddService}
            onUpdate={onUpdateService}
            onRemove={onRemoveService}
            container={container}
          />

          {/* The tier picker sits WITH the totals, not on a toolbar above the tables. It is the one
              control that moves these numbers, and up there the user had to scroll past the whole
              cut list to change it and scroll back to read the effect. Segmented rather than a
              select: there are only a handful of tiers, so switching is one click and the
              alternatives stay visible. */}
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 border-top pt-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="text-body-secondary small text-uppercase fw-semibold">
                Nivel de precio
              </span>
              <PriceLevelToggle
                value={priceLevel}
                onChange={onPriceLevelChange}
                disabled={isPending}
              />
              {isPending && (
                <span className="text-body-secondary small d-flex align-items-center gap-1">
                  <CSpinner size="sm" />
                  Recalculando…
                </span>
              )}
            </div>
            {pricing && <PricingBlock pricing={pricing} />}
          </div>
        </>
      )}
    </>
  )
}

export default CostsStep
