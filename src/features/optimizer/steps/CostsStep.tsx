import { CAlert, CRow, CSpinner } from '@coreui/react'

import { fmtMoney } from 'src/features/review/format'
import PricingBlock from 'src/shared/components/PricingBlock'
import PriceTierToggle from 'src/features/settings/PriceTierToggle'
import ServiceLines from 'src/features/preorders/ServiceLines'
import { pricingWithServices, type ServiceLineForm } from 'src/features/preorders/useServiceLines'
import { useServices } from 'src/features/services/useServices'
import type { ModalContainer, OptimizeResponse } from '../types'
import { EdgeBandingSummaryTable, Kpi, MaterialsSummaryTable } from '../summaryTables'

// Step 3. Everything with a price on it, split off from the diagrams so neither has to share the
// viewport. The price tier is chosen HERE rather than next to the client: it is the one input that
// changes these numbers, and picking it beside the tables it moves means the real cost is visible
// on the spot instead of after a trip back through Optimización.
//
// The additional services are here for the same reason. They used to be reachable only from the
// pre-order detail page, so a quote built in the wizard was born without them and someone had to
// remember to go back and add them; this is the step where their cost belongs.

interface CostsStepProps {
  result: OptimizeResponse
  // Pieces with banding sides but no tapacanto product: their cost is missing from these tables,
  // which is exactly why they block the quote.
  missingBanding: number[]
  priceTierCode: string
  // Recomputes the quote. Cheap despite being a round trip: `/optimize` is cached by input hash, so
  // changing only the tier re-prices the same cut plan instead of searching again.
  onPriceTierChange: (code: string) => void
  isPending: boolean
  // Per-board discount: the tier sets the rate, this says which boards it applies to. Nothing is
  // discounted until the seller checks a board. Re-prices through the same cached round trip.
  discountedKeys: Set<string>
  onToggleDiscount: (materialKey: string) => void
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
  missingBanding,
  priceTierCode,
  onPriceTierChange,
  isPending,
  discountedKeys,
  onToggleDiscount,
  services,
  onAddService,
  onUpdateService,
  onRemoveService,
  container,
}: CostsStepProps) => {
  const boardsCost = result.totalBoardsCost ?? 0
  const bandingCost = result.totalEdgeBandingCost ?? 0

  // Queried here rather than in the page: this is server state, and the request should not go out
  // until someone actually reaches the step that spends it.
  const { data: catalogData } = useServices({ isActive: true, limit: 100 })
  const catalog = catalogData?.items ?? []

  const pricing = result.pricing ? pricingWithServices(result.pricing, services) : undefined

  // No card and no "Costos" heading: the step trail says it. The KPI tiles and the tables carry
  // their own borders, so wrapping them in one more box only added a frame.
  return (
    <>
      {missingBanding.length > 0 && (
        <CAlert color="warning" className="py-2 small">
          {missingBanding.length === 1
            ? `La pieza #${missingBanding.map((i) => i + 1).join('')} tiene canto definido pero no seleccionaste el tapacanto.`
            : `Hay ${missingBanding.length} piezas con canto definido pero sin tapacanto (#${missingBanding
                .map((i) => i + 1)
                .join(', #')}).`}{' '}
          Su tapacanto no está costeado y no podrás crear la cotización hasta seleccionarlo — vuelve
          al paso Despiece.
        </CAlert>
      )}

      <CRow className="g-2 mb-3">
        <Kpi label="Tableros" value={fmtMoney(boardsCost)} />
        <Kpi label="Tapacanto" value={fmtMoney(bandingCost)} />
        <Kpi label="Costo estimado" value={fmtMoney(boardsCost + bandingCost)} />
        <Kpi
          label="Total"
          value={pricing ? fmtMoney(pricing.total) : fmtMoney(boardsCost + bandingCost)}
        />
      </CRow>

      <div className="text-body-secondary small text-uppercase fw-semibold mb-2">Tableros</div>
      <MaterialsSummaryTable
        rows={result.materialsSummary ?? []}
        discountedKeys={discountedKeys}
        onToggleDiscount={onToggleDiscount}
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
          control that moves these numbers, and up there the user had to scroll past the whole cut
          list to change it and scroll back to read the effect. Segmented rather than a select: there
          are only a handful of tiers, so switching is one click and the alternatives stay visible. */}
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 border-top pt-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="text-body-secondary small text-uppercase fw-semibold">
            Nivel de precio
          </span>
          <PriceTierToggle
            value={priceTierCode}
            onChange={onPriceTierChange}
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
  )
}

export default CostsStep
