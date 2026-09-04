import { CAlert } from '@coreui/react'

import type { MaterialSummary, UnplacedPiece } from './types'

// Pieces the plan does NOT cut. Only reachable when the stock is finite — a
// group of retazos can run out of material where a catalog board never does —
// so this is the one thing the seller has to learn about quoting on retazos:
// the plan on screen is correct, it just does not include these.
//
// Rendered above the diagram, not below it, because it changes what to do next
// rather than describing what was done.

interface Props {
  unplaced?: UnplacedPiece[]
  materialsSummary?: MaterialSummary[]
}

// Undefined rather than the key when the material has no summary row — which is
// exactly what happens when NONE of its pieces fit, so it produced no sheet. The
// key is an internal uid and naming it here would be worse than saying nothing.
const materialName = (materialKey: string, summary?: MaterialSummary[]): string | undefined => {
  const m = summary?.find((x) => x.materialKey === materialKey)
  if (!m) return undefined
  return m.productName ?? m.productCode ?? `${m.width}×${m.height} mm`
}

const UnplacedPiecesAlert = ({ unplaced, materialsSummary }: Props) => {
  if (!unplaced?.length) return null

  const total = unplaced.reduce((acc, u) => acc + u.quantity, 0)

  return (
    <CAlert color="warning" className="py-2">
      <div className="fw-semibold mb-1">
        {total === 1 ? 'Una pieza no entra' : `${total} piezas no entran`} en el material disponible
      </div>
      <ul className="mb-1 ps-3 small">
        {unplaced.map((u) => {
          const material = materialName(u.materialKey, materialsSummary)
          return (
            <li key={`${u.materialKey}-${u.label}-${u.height}x${u.width}`}>
              <strong>{u.quantity}×</strong> {u.label || 'pieza'} {u.height}×{u.width} mm
              {material ? ` · ${material}` : ''}
            </li>
          )
        })}
      </ul>
      <div className="small text-body-secondary">
        Sube la cantidad de retazos, agrega un tablero de catálogo al grupo, o quita estas piezas.
        El resto del plan es válido y se puede cotizar así.
      </div>
    </CAlert>
  )
}

export default UnplacedPiecesAlert
