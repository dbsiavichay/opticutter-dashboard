import {
  CBadge,
  CCol,
  CFormCheck,
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

interface MaterialsSummaryTableProps {
  rows: MaterialSummary[]
  // Which boards the price tier's discount applies to, by materialKey. Passing `onToggleDiscount`
  // is what turns the "Desc." column on: without it the table stays exactly as read-only as before.
  discountedKeys?: Set<string>
  onToggleDiscount?: (materialKey: string) => void
  // Selection visible but frozen (a closed pre-order, or a recompute in flight).
  discountDisabled?: boolean
}

export const MaterialsSummaryTable = ({
  rows,
  discountedKeys,
  onToggleDiscount,
  discountDisabled = false,
}: MaterialsSummaryTableProps) => {
  if (!rows.length) return null
  const selectable = !!onToggleDiscount
  return (
    <CTable small responsive className="summary-table mb-3">
      <CTableHead>
        <CTableRow>
          {/* "Tablero", not "Material": every row here IS a board, and the old wording clashed with
              the "Tableros" count column beside it — now "Cant." */}
          <CTableHeaderCell>Tablero</CTableHeaderCell>
          <CTableHeaderCell>Medida</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Cant.</CTableHeaderCell>
          {/* Precio unitario, no eficiencia: esta es la tabla de dinero del paso, y con solo
              Cant. y Costo había que dividir para saber a cuánto sale el tablero — que es el
              número que se negocia y el que decide el check de "Desc." de la misma fila. El
              aprovechamiento se lee en Optimización (badge por patrón) y en el diagrama de cortes. */}
          <CTableHeaderCell className="text-end">Precio unit.</CTableHeaderCell>
          <CTableHeaderCell className="text-end">Costo</CTableHeaderCell>
          {/* Last column, right after the cost it acts on: the checkbox answers "does the
              discount apply to THIS amount", so it reads next to the amount. */}
          {selectable && (
            <CTableHeaderCell
              className="text-center"
              title="Aplicar el descuento del nivel de precio a este tablero"
            >
              Desc.
            </CTableHeaderCell>
          )}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {rows.map((m) => (
          // A material billed as full boards AND half boards yields two rows sharing one
          // materialKey, so the key has to include `halfBoard`. Plain `materialKey` was already
          // a duplicate-key collision; it went unnoticed while the cells were static text and
          // would have started mixing up state now that a row carries a checkbox.
          <CTableRow key={`${m.materialKey}-${m.halfBoard ? 'half' : 'full'}`}>
            <CTableDataCell>
              {stripHalfSuffix(m.productName) ?? m.productCode ?? m.materialKey}{' '}
              {m.halfBoard && <CBadge color="info">½ medio</CBadge>}
            </CTableDataCell>
            <CTableDataCell className="text-nowrap">
              {m.width}×{m.height}×{m.thickness} mm
            </CTableDataCell>
            <CTableDataCell className="text-end">{m.count}</CTableDataCell>
            {/* Precio de lista: el descuento del nivel vive en `pricing`, no aquí, así que este
                es el precio contra el que se lee el check de al lado. Para medio tablero ya llega
                dividido y con su markup desde el backend, en su propia fila. */}
            <CTableDataCell className="text-end">{fmtMoney(m.costPerUnit)}</CTableDataCell>
            <CTableDataCell className="text-end">{fmtMoney(m.totalCost)}</CTableDataCell>
            {selectable && (
              <CTableDataCell className="text-center">
                {/* Only catalog boards are discountable — an offcut or a manual measurement has no
                    list price to discount. The two rows of one material share its mark. */}
                {m.productId != null && (
                  <CFormCheck
                    checked={discountedKeys?.has(m.materialKey) ?? false}
                    disabled={discountDisabled}
                    onChange={() => onToggleDiscount?.(m.materialKey)}
                    aria-label={`Aplicar descuento a ${
                      stripHalfSuffix(m.productName) ?? m.productCode ?? m.materialKey
                    }`}
                  />
                )}
              </CTableDataCell>
            )}
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
