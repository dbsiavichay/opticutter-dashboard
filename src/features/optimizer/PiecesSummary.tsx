import { piecesSummary } from './optimizerForm'
import type { MaterialForm, RequirementForm } from './optimizerForm'

// Running totals for the pieces list. Extracted from `MaterialGroups` so each page can place it:
// the optimizer puts it in its pinned footer (always visible, no row of its own), pre-orders keep it
// under the list where it has always been.

const areaFmt = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

interface PiecesSummaryProps {
  requirements: RequirementForm[]
  materials: MaterialForm[]
}

const PiecesSummary = ({ requirements, materials }: PiecesSummaryProps) => {
  const summary = piecesSummary(requirements, materials)

  return (
    <div className="d-flex flex-wrap gap-3 small text-body-secondary">
      <span>
        <strong className="text-body">{summary.pieces}</strong> piezas
      </span>
      <span>
        <strong className="text-body">{summary.units}</strong> unidades
      </span>
      <span>
        área total <strong className="text-body">{areaFmt.format(summary.areaM2)} m²</strong>
      </span>
      {summary.invalid > 0 && (
        <span className="text-danger">{summary.invalid} con datos incompletos</span>
      )}
    </div>
  )
}

export default PiecesSummary
