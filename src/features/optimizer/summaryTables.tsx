import {
  CBadge,
  CCol,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import { fmtMoney } from 'src/features/review/format'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import type { EdgeBandingSummary, MaterialSummary } from './types'

// Result read-outs shared by the wizard's steps and the pre-order preview. The wizard splits them
// across two steps (geometry vs money); the pre-order keeps them stacked in one card.

interface KpiProps {
  label: string
  value: string | number
  // Column span at `md` and up. Four tiles per row by default.
  md?: number
}

// Compact KPI tile with a subtle border, so the headline metrics read as a scannable group.
export const Kpi = ({ label, value, md = 3 }: KpiProps) => (
  <CCol xs={6} md={md}>
    <div className="border rounded-3 p-2 h-100">
      <div className="text-body-secondary small text-uppercase">{label}</div>
      <div className="fs-5 fw-semibold">{value}</div>
    </div>
  </CCol>
)

export const meters = (n?: number | null) => (n != null ? `${n.toFixed(2)} m` : '—')

export const MaterialsSummaryTable = ({ rows }: { rows: MaterialSummary[] }) => {
  if (!rows.length) return null
  return (
    <CTable small responsive className="summary-table mb-3">
      <CTableHead>
        <CTableRow>
          {/* "Tablero", not "Material": every row here IS a board, and the old wording clashed with
              the "Tableros" count column beside it — now "Cant." */}
          <CTableHeaderCell>Tablero</CTableHeaderCell>
          <CTableHeaderCell>Medida</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Cant.</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Efic. avg</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Costo</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {rows.map((m) => (
          <CTableRow key={m.materialKey}>
            <CTableDataCell>
              {stripHalfSuffix(m.productName) ?? m.productCode ?? m.materialKey}{' '}
              {m.halfBoard && <CBadge color="info">½ medio</CBadge>}
            </CTableDataCell>
            <CTableDataCell className="text-nowrap">
              {m.width}×{m.height}×{m.thickness} mm
            </CTableDataCell>
            <CTableDataCell className="text-end">{m.count}</CTableDataCell>
            <CTableDataCell className="text-end">
              {m.avgEfficiency != null ? `${m.avgEfficiency.toFixed(1)}%` : '—'}
            </CTableDataCell>
            <CTableDataCell className="text-end">{fmtMoney(m.totalCost)}</CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  )
}

export const EdgeBandingSummaryTable = ({ rows }: { rows: EdgeBandingSummary[] }) => {
  if (!rows.length) return null
  return (
    <CTable small responsive className="summary-table mb-3">
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Tapacanto</CTableHeaderCell>
          <CTableHeaderCell className="text-end">m netos</CTableHeaderCell>
          <CTableHeaderCell className="text-end">m facturados</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Precio/m</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Costo</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {rows.map((e) => (
          <CTableRow key={e.productId ?? 'sin-producto'}>
            <CTableDataCell>
              {e.productName ?? e.productCode ?? 'Sin asignar'}
              {e.color ? <span className="text-body-secondary"> · {e.color}</span> : null}
            </CTableDataCell>
            <CTableDataCell className="text-end">{e.netLinearM.toFixed(2)}</CTableDataCell>
            <CTableDataCell className="text-end">{e.billedLinearM}</CTableDataCell>
            <CTableDataCell className="text-end">
              {e.pricePerM ? fmtMoney(e.pricePerM) : '—'}
            </CTableDataCell>
            <CTableDataCell className="text-end">
              {e.totalCost ? fmtMoney(e.totalCost) : '—'}
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  )
}
