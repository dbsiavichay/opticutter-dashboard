import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import { fmtMoney } from './format'
import type { ReviewPreOrder, ReviewService } from './types'

const ServicesTable = ({ services, currency }: { services: ReviewService[]; currency: string }) => (
  <CTable small responsive>
    <CTableHead>
      <CTableRow>
        <CTableHeaderCell className="bg-body-tertiary">Servicio</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary text-end">Cant.</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary text-end">Precio unit.</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary text-end">Total</CTableHeaderCell>
      </CTableRow>
    </CTableHead>
    <CTableBody>
      {services.map((s, i) => (
        <CTableRow key={i}>
          <CTableDataCell>{s.name}</CTableDataCell>
          <CTableDataCell className="text-end">{s.quantity}</CTableDataCell>
          <CTableDataCell className="text-end">{fmtMoney(s.unitPrice, currency)}</CTableDataCell>
          <CTableDataCell className="text-end">{fmtMoney(s.lineTotal, currency)}</CTableDataCell>
        </CTableRow>
      ))}
    </CTableBody>
  </CTable>
)

interface ReviewQuoteProps {
  data: ReviewPreOrder
}

// The billing detail: what the client is charged for (products used, not pieces cut).
const ReviewQuote = ({ data }: ReviewQuoteProps) => {
  const currency = data.currency ?? 'USD'

  return (
    <>
      <CCard className="mb-3">
        <CCardHeader>
          <strong>Detalle de cobro</strong>
        </CCardHeader>
        <CCardBody>
          <CTable small responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell className="bg-body-tertiary">Producto</CTableHeaderCell>
                <CTableHeaderCell className="bg-body-tertiary text-end">Cant.</CTableHeaderCell>
                <CTableHeaderCell className="bg-body-tertiary text-end d-none d-sm-table-cell">
                  Precio unit.
                </CTableHeaderCell>
                <CTableHeaderCell className="bg-body-tertiary text-end">Total</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {data.lines?.map((l, i) => (
                <CTableRow key={i}>
                  <CTableDataCell>{l.productName ?? '—'}</CTableDataCell>
                  <CTableDataCell className="text-end">{l.quantity}</CTableDataCell>
                  <CTableDataCell className="text-end d-none d-sm-table-cell">
                    {fmtMoney(l.unitPrice, currency)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {fmtMoney(l.lineTotal, currency)}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
          <div className="d-flex justify-content-end mt-2">
            <div className="d-flex flex-column align-items-end gap-1 small">
              {!!data.servicesTotal && (
                <div>
                  <span className="text-body-secondary me-2">Servicios adicionales:</span>
                  <span>{fmtMoney(data.servicesTotal, currency)}</span>
                </div>
              )}
              <div>
                <span className="text-body-secondary me-2">Subtotal:</span>
                <span>{fmtMoney(data.subtotal, currency)}</span>
              </div>
              <div>
                <span className="text-body-secondary me-2">
                  IVA ({Math.round((data.taxRate ?? 0) * 100)}%):
                </span>
                <span>{fmtMoney(data.taxAmount, currency)}</span>
              </div>
              <div className="fs-5 fw-semibold">
                <span className="text-body-secondary me-2">Total:</span>
                <span>{fmtMoney(data.total, currency)}</span>
              </div>
            </div>
          </div>
        </CCardBody>
      </CCard>

      {!!data.additionalServices?.length && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Servicios adicionales</strong>
          </CCardHeader>
          <CCardBody>
            <ServicesTable services={data.additionalServices} currency={currency} />
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default ReviewQuote
