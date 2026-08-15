import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import NoBranchNotice, { isNoBranchError } from 'src/shared/components/NoBranchNotice'
import ReferenceNote from 'src/shared/components/ReferenceNote'

import CIcon from '@coreui/icons-react'
import type { ChangeEvent } from 'react'
import type { PreOrderStatus } from './types'
import PreOrderStatusBadge from './PreOrderStatusBadge'
import { cilPlus } from '@coreui/icons'
import { useActiveBranches } from 'src/features/branches/useBranches'
import { useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { useNavigate } from 'react-router-dom'
import { usePreOrders } from './usePreOrders'
import { useState } from 'react'
import { PAGE_SIZE } from 'src/shared/constants'
import { clientName, fmtDate } from 'src/shared/utils/format'
import { isExpiringSoon } from './status'

const STATUSES: { value: PreOrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviada' },
  { value: 'changes_requested', label: 'Cambios solicitados' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'rejected', label: 'Rechazada' },
  { value: 'expired', label: 'Vencida' },
  { value: 'cancelled', label: 'Cancelada' },
]

const PreOrdersPage = () => {
  const navigate = useNavigate()
  const isGlobalBranch = useIsGlobalBranchRole()
  const [status, setStatus] = useState<PreOrderStatus | ''>('')
  const [branchId, setBranchId] = useState('')
  const [offset, setOffset] = useState(0)

  const { data: branches = [] } = useActiveBranches()
  const { data, isLoading, error } = usePreOrders({
    status: status || undefined,
    branchId: branchId ? Number(branchId) : undefined,
    offset,
    limit: PAGE_SIZE,
  })
  const items = data?.items ?? []
  const pagination = data?.pagination
  const noBranch = isNoBranchError(error)

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value as PreOrderStatus | '')
    setOffset(0)
  }

  const showPrev = offset > 0
  const showNext = pagination ? offset + PAGE_SIZE < pagination.total : false

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Cotizaciones</strong>
          <CButton color="primary" size="sm" onClick={() => void navigate('/optimizer')}>
            <CIcon icon={cilPlus} className="me-1" />
            Nueva cotización
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3">
            <CCol xs={12} sm={6} md={4}>
              <CFormSelect value={status} onChange={handleStatusChange}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            {isGlobalBranch && (
              <CCol xs={12} sm={6} md={4}>
                <CFormSelect
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value)
                    setOffset(0)
                  }}
                >
                  <option value="">Todas las sucursales</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            )}
          </CRow>

          {noBranch ? (
            <NoBranchNotice />
          ) : isLoading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
            </div>
          ) : (
            <CTable align="middle" hover responsive style={{ cursor: 'pointer' }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">Código</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Cliente</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Sucursal</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Estado</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Fuente</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Creada</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Vence</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {items.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                      Sin resultados
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  items.map((po) => {
                    const expiringSoon = isExpiringSoon(po.expiresAt, po.status)
                    return (
                      <CTableRow key={po.id} onClick={() => void navigate(`/preorders/${po.id}`)}>
                        <CTableDataCell>
                          <strong>{po.code}</strong>
                          <ReferenceNote notes={po.notes} />
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>{clientName(po.client)}</div>
                          <div className="text-body-secondary small">@{po.client.identifier}</div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>{po.branch.name}</div>
                          <div className="text-body-secondary small">{po.branch.code}</div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <PreOrderStatusBadge status={po.status} />
                        </CTableDataCell>
                        <CTableDataCell>{po.source}</CTableDataCell>
                        <CTableDataCell className="text-nowrap">
                          {fmtDate(po.createdAt)}
                        </CTableDataCell>
                        <CTableDataCell
                          className={`text-nowrap ${expiringSoon ? 'text-danger fw-semibold' : ''}`}
                        >
                          {fmtDate(po.expiresAt)}
                          {expiringSoon && ' ⚠'}
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })
                )}
              </CTableBody>
            </CTable>
          )}

          {(showPrev || showNext) && (
            <div className="d-flex justify-content-end gap-2 mt-2">
              <CButton
                size="sm"
                color="secondary"
                disabled={!showPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Anterior
              </CButton>
              <CButton
                size="sm"
                color="secondary"
                disabled={!showNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Siguiente
              </CButton>
            </div>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default PreOrdersPage
