import {
  CBadge,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import { fmtMoney } from 'src/shared/utils/format'
import type { OrderLine } from './types'

// The billing snapshot: one row per material, priced at what it cost the day the quote was
// confirmed. Rendered bare — the chrome belongs to the call site, as with `MaterialGroups` and
// `StatusHistoryTable`.
//
// `.summary-table` rather than the grey `bg-body-tertiary` the header cells used to carry: this is
// a read-out table like every other one in the app, and the brand rule is what marks it as such.
// Those utility classes had to go, not just lose priority — Bootstrap's background utilities are
// `!important` and would beat the `.summary-table` rule whatever the order of the stylesheets.

interface OrderLinesTableProps {
  lines: OrderLine[]
}

const OrderLinesTable = ({ lines }: OrderLinesTableProps) => {
  if (lines.length === 0) return null

  return (
    <CTable small responsive hover className="summary-table mb-0">
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Producto</CTableHeaderCell>
          <CTableHeaderCell>Código</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Cant.</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Precio unit.</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Total línea</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Eficiencia avg</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Área m²</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {lines.map((l) => (
          <CTableRow key={l.id}>
            <CTableDataCell>
              {stripHalfSuffix(l.productName) ?? '—'}{' '}
              {l.halfBoard && <CBadge color="info">½ medio</CBadge>}
            </CTableDataCell>
            <CTableDataCell>{l.productCode ?? '—'}</CTableDataCell>
            <CTableDataCell className="text-end">{l.quantity}</CTableDataCell>
            <CTableDataCell className="text-end">{fmtMoney(l.unitPriceSnapshot)}</CTableDataCell>
            <CTableDataCell className="text-end">{fmtMoney(l.lineTotal)}</CTableDataCell>
            <CTableDataCell className="text-end">
              {l.avgEfficiency != null ? `${l.avgEfficiency.toFixed(1)}%` : '—'}
            </CTableDataCell>
            <CTableDataCell className="text-end">
              {l.totalAreaM2 != null ? `${l.totalAreaM2.toFixed(3)} m²` : '—'}
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  )
}

export default OrderLinesTable
