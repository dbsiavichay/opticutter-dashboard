import type { CSSProperties } from 'react'
import {
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import type { OrderPiece } from './types'

// The cut list an order was created with, read-only: unlike a quote, a confirmed order's despiece
// is frozen. Bare, like `OrderLinesTable` — the detail page mounts it inside a full-screen panel.
//
// Sticky header rather than none: the panel exists precisely because this list can run to hundreds
// of rows. Same treatment as `PieceRowsTable`'s `thStyle`, minus its `background` override — the
// `.summary-table` header already paints an opaque fill of its own, and setting one here would
// paint over the brand tint.
const stickyHead: CSSProperties = { position: 'sticky', top: 0, zIndex: 2 }

interface OrderPiecesTableProps {
  pieces: OrderPiece[]
  // Scroll box for the rows. The panel hands it the dialog's height so a long list scrolls inside
  // the dialog rather than inside a short box with the rest of the screen left empty.
  maxHeight?: string
}

const OrderPiecesTable = ({ pieces, maxHeight }: OrderPiecesTableProps) => {
  if (pieces.length === 0) return null

  return (
    <div style={{ maxHeight, overflow: 'auto' }}>
      <CTable small responsive hover className="summary-table mb-0">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell style={stickyHead}>Etiqueta</CTableHeaderCell>
            <CTableHeaderCell style={stickyHead} className="text-end">
              Largo (mm)
            </CTableHeaderCell>
            <CTableHeaderCell style={stickyHead} className="text-end">
              Ancho (mm)
            </CTableHeaderCell>
            <CTableHeaderCell style={stickyHead} className="text-end">
              Cant.
            </CTableHeaderCell>
            <CTableHeaderCell style={stickyHead} className="text-end">
              Prioridad
            </CTableHeaderCell>
            <CTableHeaderCell style={stickyHead} className="text-center">
              Puede rotar
            </CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {pieces.map((p, i) => (
            // `OrderPiece.id` is optional in the API contract, and the index is stable here: the
            // list is read-only and never reordered.
            <CTableRow key={p.id ?? i}>
              <CTableDataCell>{p.label ?? '—'}</CTableDataCell>
              <CTableDataCell className="text-end">{p.height}</CTableDataCell>
              <CTableDataCell className="text-end">{p.width}</CTableDataCell>
              <CTableDataCell className="text-end">{p.quantity}</CTableDataCell>
              <CTableDataCell className="text-end">{p.priority}</CTableDataCell>
              <CTableDataCell className="text-center">{p.canRotate ? 'Sí' : 'No'}</CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </div>
  )
}

export default OrderPiecesTable
