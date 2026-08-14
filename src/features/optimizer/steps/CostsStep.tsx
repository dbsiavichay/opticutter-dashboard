import { CAlert, CRow, CSpinner } from '@coreui/react'

import { fmtMoney } from 'src/features/review/format'
import PricingBlock from 'src/shared/components/PricingBlock'
import PriceTierSelect from 'src/features/settings/PriceTierSelect'
import type { OptimizeResponse } from '../types'
import { EdgeBandingSummaryTable, Kpi, MaterialsSummaryTable } from '../summaryTables'

// Step 3. Everything with a price on it, split off from the diagrams so neither has to share the
// viewport. The price tier is chosen HERE rather than next to the client: it is the one input that
// changes these numbers, and picking it beside the tables it moves means the real cost is visible
// on the spot instead of after a trip back through Optimización.

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
}

const CostsStep = ({
  result,
  missingBanding,
  priceTierCode,
  onPriceTierChange,
  isPending,
}: CostsStepProps) => {
  const boardsCost = result.totalBoardsCost ?? 0
  const bandingCost = result.totalEdgeBandingCost ?? 0

  // No card and no "Costos" heading: the step trail says it. The KPI tiles and the tables carry
  // their own borders, so wrapping them in one more box only added a frame.
  return (
    <>
      <div className="d-flex flex-wrap justify-content-end align-items-center gap-2 mb-3">
        {isPending && (
          <span className="text-body-secondary small d-flex align-items-center gap-1">
            <CSpinner size="sm" />
            Recalculando…
          </span>
        )}
        <label className="text-body-secondary small mb-0" htmlFor="costs-price-tier">
          Nivel de precio
        </label>
        {/* Narrow on purpose: it is one control on a toolbar line, not a form field. */}
        <div style={{ minWidth: '12rem' }}>
          <PriceTierSelect
            id="costs-price-tier"
            value={priceTierCode}
            onChange={onPriceTierChange}
            disabled={isPending}
          />
        </div>
      </div>

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
          value={
            result.pricing ? fmtMoney(result.pricing.total) : fmtMoney(boardsCost + bandingCost)
          }
        />
      </CRow>

      <div className="text-body-secondary small text-uppercase fw-semibold mb-2">Materiales</div>
      <MaterialsSummaryTable rows={result.materialsSummary ?? []} />

      {result.edgeBandingsSummary?.length > 0 && (
        <>
          <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
            Tapacantos
          </div>
          <EdgeBandingSummaryTable rows={result.edgeBandingsSummary} />
        </>
      )}

      {result.pricing && (
        <div className="d-flex justify-content-end">
          <PricingBlock pricing={result.pricing} />
        </div>
      )}
    </>
  )
}

export default CostsStep
