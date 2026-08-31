import { fmtMoney } from 'src/features/review/format'
import type { PricingData } from 'src/features/optimizer/types'

interface PricingBlockProps {
  pricing: PricingData
  currency?: string
}

// The money block, mirroring the PDF: net breakdown, one tax line, then the total.
// Every number comes from the server — Python's rounding and JS's disagree by a
// cent, so nothing here is computed, only formatted.
const PricingBlock = ({ pricing, currency = 'USD' }: PricingBlockProps) => {
  const fmt = (n?: number) => fmtMoney(n, currency)
  const taxPct = Math.round(pricing.taxRate * 100)

  return (
    <div className="d-flex flex-column align-items-end gap-1 small">
      {!!pricing.servicesTotal && (
        <div>
          <span className="text-body-secondary me-2">Servicios adicionales (sin IVA):</span>
          <span>{fmt(pricing.servicesTotal)}</span>
        </div>
      )}
      <div>
        <span className="text-body-secondary me-2">Subtotal:</span>
        <span>{fmt(pricing.subtotal)}</span>
      </div>
      <div>
        <span className="text-body-secondary me-2">IVA ({taxPct}%):</span>
        <span>{fmt(pricing.taxAmount)}</span>
      </div>
      <div className="fs-5 fw-semibold">
        <span className="text-body-secondary me-2">Total:</span>
        <span>{fmt(pricing.total)}</span>
      </div>
    </div>
  )
}

export default PricingBlock
