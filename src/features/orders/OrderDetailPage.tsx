import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CProgress,
  CProgressBar,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilExternalLink } from '@coreui/icons'

import { useCurrentUser, useHasRole } from 'src/features/auth/useAuth'
import { usePrintConsolidated } from 'src/features/print/usePrint'
import { useActiveBranches } from 'src/features/branches/useBranches'
import StatusHistoryTable from 'src/shared/components/StatusHistoryTable'
import PricingBlock from 'src/shared/components/PricingBlock'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import { clientName, fmtDateTime, fmtMoney } from 'src/shared/utils/format'
import type { PricingData } from 'src/features/optimizer/types'
import OrderStatusBadge from './OrderStatusBadge'
import BandingStatusBadge from './BandingStatusBadge'
import {
  useAssociateInvoice,
  useAttachments,
  useChangeOrderBranch,
  useCuttingPlan,
  useDeleteAttachment,
  useOrder,
  useUpdateOrderStatus,
  useUploadAttachment,
} from './useOrders'
import { ordersApi } from './ordersApi'
import type { OrderStatus } from './types'

interface StatusTransition {
  to: OrderStatus
  label: string
  color: string
  roles: string[]
}

const TERMINAL_STATES: OrderStatus[] = ['despachado', 'cancelled']

// States where the cutting plan is relevant: queued (interactive in the workshop) and beyond
// (read-only, auditing what was cut).
const WORKSHOP_STATES: OrderStatus[] = ['queued', 'cutting', 'cut', 'completed']

// States where attachments are frozen (matches the backend 422 gate). Note this includes
// `completed`, unlike TERMINAL_STATES which only covers despachado/cancelled.
const ATTACHMENTS_LOCKED: OrderStatus[] = ['completed', 'despachado', 'cancelled']
const ATTACH_MAX_MB = 10
const ATTACH_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const humanSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1_048_576
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / 1_048_576).toFixed(1)} MB`

const STATUS_TRANSITIONS: Partial<Record<OrderStatus, StatusTransition[]>> = {
  confirmed: [
    {
      to: 'queued',
      label: 'Poner en cola',
      color: 'primary',
      roles: ['administrador', 'vendedor'],
    },
    { to: 'cancelled', label: 'Cancelar', color: 'danger', roles: ['administrador', 'vendedor'] },
  ],
  queued: [
    { to: 'cutting', label: 'Tomar orden', color: 'primary', roles: ['administrador', 'operador'] },
  ],
  cutting: [
    {
      to: 'cut',
      label: 'Marcar como cortada',
      color: 'primary',
      roles: ['administrador', 'operador'],
    },
    { to: 'queued', label: 'Regresar a cola', color: 'secondary', roles: ['administrador'] },
  ],
  cut: [
    {
      to: 'completed',
      label: 'Marcar como completada',
      color: 'success',
      roles: ['administrador', 'vendedor', 'operador', 'canteador'],
    },
  ],
  completed: [
    {
      to: 'despachado',
      label: 'Despachar',
      color: 'success',
      roles: ['administrador', 'vendedor'],
    },
  ],
}

interface TransitionModalState {
  visible: boolean
  transition: StatusTransition | null
}

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // Operador can view the order, document, and cutting plan, but cannot change status or invoice.
  const canManage = useHasRole('administrador', 'vendedor')
  // Operador doesn't use the detail view: their flow is the workshop. Redirect there (including direct URL).
  const isOperator = useHasRole('operador')
  // Consolidated print needs `orders:workshop`; the cut → completed transition here is also open to
  // vendedor (who lacks it), so gate the trigger to those roles to avoid a 403.
  const canPrintConsolidated = useHasRole('administrador', 'operador', 'canteador')

  const currentUser = useCurrentUser()
  const { data: order, isLoading } = useOrder(id)
  const cuttingPlan = useCuttingPlan(id, !!order && WORKSHOP_STATES.includes(order.status))
  const updateStatus = useUpdateOrderStatus()
  const associateInvoice = useAssociateInvoice()
  const changeBranch = useChangeOrderBranch()
  const printConsolidated = usePrintConsolidated()
  const { data: activeBranches = [] } = useActiveBranches()
  const attachments = useAttachments(id)
  const uploadAtt = useUploadAttachment(id ?? '')
  const deleteAtt = useDeleteAttachment(id ?? '')

  const [attachError, setAttachError] = useState<string | null>(null)
  const [transitionModal, setTransitionModal] = useState<TransitionModalState>({
    visible: false,
    transition: null,
  })
  const [transitionNote, setTransitionNote] = useState('')
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [invoiceId, setInvoiceId] = useState('')
  const [branchModal, setBranchModal] = useState(false)
  const [targetBranchId, setTargetBranchId] = useState('')
  const [branchNote, setBranchNote] = useState('')
  const [paymentModal, setPaymentModal] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [creditInput, setCreditInput] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const openTransition = (transition: StatusTransition) => {
    setTransitionNote('')
    setTransitionModal({ visible: true, transition })
  }
  const closeTransition = () => {
    setTransitionModal({ visible: false, transition: null })
    updateStatus.reset()
  }

  const confirmTransition = () => {
    const { transition } = transitionModal
    if (!id || !transition) return
    updateStatus.mutate(
      { id, data: { status: transition.to, note: transitionNote || undefined } },
      {
        onSuccess: () => {
          closeTransition()
          // Completing the order dispatches the consolidated sheet to the branch's inkjet,
          // unless that branch has no sheet printer.
          if (
            transition.to === 'completed' &&
            canPrintConsolidated &&
            order?.branch.printConsolidatedEnabled
          )
            printConsolidated.mutate({ orderId: id })
        },
      },
    )
  }

  const openPayment = () => {
    setCashInput('')
    setCreditInput('')
    setPaymentNote('')
    updateStatus.reset()
    setPaymentModal(true)
  }
  const closePayment = () => {
    setPaymentModal(false)
    updateStatus.reset()
  }
  const handleCashChange = (raw: string) => {
    setCashInput(raw)
    const cash = parseFloat(raw)
    if (raw === '' || isNaN(cash)) {
      setCreditInput('')
      return
    }
    const remaining = Math.max((order?.total ?? 0) - cash, 0)
    setCreditInput(remaining.toFixed(2))
  }
  const handleCreditChange = (raw: string) => {
    setCreditInput(raw)
    const credit = parseFloat(raw)
    if (raw === '' || isNaN(credit)) {
      setCashInput('')
      return
    }
    const remaining = Math.max((order?.total ?? 0) - credit, 0)
    setCashInput(remaining.toFixed(2))
  }
  const confirmPayment = () => {
    if (!id) return
    const cash = parseFloat(cashInput) || 0
    const credit = parseFloat(creditInput) || 0
    const payment: { cashAmount?: number; creditAmount?: number } = {}
    if (cash > 0) payment.cashAmount = cash
    if (credit > 0) payment.creditAmount = credit
    updateStatus.mutate(
      { id, data: { status: 'queued', payment, note: paymentNote || undefined } },
      { onSuccess: closePayment },
    )
  }

  const closeInvoice = () => {
    setInvoiceModal(false)
    setInvoiceId('')
    associateInvoice.reset()
  }
  const confirmInvoice = () => {
    if (!id) return
    associateInvoice.mutate(
      { id, data: { externalInvoiceId: invoiceId } },
      { onSuccess: closeInvoice },
    )
  }

  const openBranchModal = () => {
    setTargetBranchId('')
    setBranchNote('')
    changeBranch.reset()
    setBranchModal(true)
  }
  const closeBranchModal = () => {
    setBranchModal(false)
    changeBranch.reset()
  }
  const confirmBranchChange = () => {
    if (!id || !targetBranchId) return
    changeBranch.mutate(
      { id, data: { branchId: Number(targetBranchId), note: branchNote || undefined } },
      { onSuccess: closeBranchModal },
    )
  }

  // Client-side pre-check is UX only; the API is the authority and returns 422 on bad type/size.
  const onPickFile = (file?: File | null) => {
    if (!file) return
    if (!ATTACH_TYPES.includes(file.type)) return setAttachError('Solo PDF, PNG o JPEG.')
    if (file.size > ATTACH_MAX_MB * 1024 * 1024)
      return setAttachError(`Máximo ${ATTACH_MAX_MB} MB.`)
    setAttachError(null)
    uploadAtt.reset()
    uploadAtt.mutate(file)
  }

  const onDeleteAttachment = (attachmentId: number, filename: string) => {
    if (!window.confirm(`¿Eliminar el anexo "${filename}"?`)) return
    deleteAtt.reset()
    deleteAtt.mutate(attachmentId)
  }

  if (isOperator) {
    return <Navigate to={`/orders/${id}/workshop`} replace />
  }

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (!order) {
    return <CAlert color="danger">Orden no encontrada.</CAlert>
  }

  const transitions = (STATUS_TRANSITIONS[order.status] ?? []).filter((t) =>
    t.roles.includes(currentUser?.role ?? ''),
  )
  const canChangeBranch = canManage && (order.status === 'confirmed' || order.status === 'queued')
  const branchOptions = activeBranches.filter((b) => b.id !== order.branch.id)
  const isTerminal = TERMINAL_STATES.includes(order.status)
  const attachmentsLocked = ATTACHMENTS_LOCKED.includes(order.status)

  const plan = cuttingPlan.data
  const showProduction = WORKSHOP_STATES.includes(order.status)
  const piecesPending = plan ? plan.progress.totalPieces - plan.progress.cutPieces : 0
  // The API is the authoritative guard (returns 422 if pieces are missing); disabling the button is UX only.
  const cutGated = order.status === 'cutting' && !!plan && piecesPending > 0
  const planPct =
    plan && plan.progress.totalPieces > 0
      ? Math.round((plan.progress.cutPieces / plan.progress.totalPieces) * 100)
      : 0
  const planDone =
    !!plan && plan.progress.totalPieces > 0 && plan.progress.cutPieces >= plan.progress.totalPieces

  // Banding block: visible when the order has edge banding. The cut → completed transition is blocked
  // while banding is still pending/in-progress (API returns 422; disabling is UX only).
  const bandingPending = order.bandingStatus === 'pending' || order.bandingStatus === 'in_progress'

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3">
        <CButton
          variant="ghost"
          color="secondary"
          size="sm"
          onClick={() => void navigate('/orders')}
        >
          <CIcon icon={cilArrowLeft} className="me-1" />
          Volver
        </CButton>
      </div>

      {/* Header */}
      <CCard className="mb-3">
        <CCardBody>
          <CRow className="g-3">
            <CCol xs={12} md={6}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h5 className="mb-0">{order.code ?? 'Sin código'}</h5>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="text-body-secondary small">
                Cliente: <strong>{clientName(order.client)}</strong> (@{order.client?.identifier})
              </div>
              {canManage && (
                <div className="text-body-secondary small">
                  Sucursal: <strong>{order.branch.name}</strong>
                  {order.branch.code && <span> ({order.branch.code})</span>}
                </div>
              )}
              {/* Reference inherited from the quote (read-only here); also printed on every PDF. */}
              <ReferenceNote notes={order.notes} variant="header" />
            </CCol>
            <CCol xs={12} md={6}>
              <div className="small">
                <div>
                  <span className="text-body-secondary">Creado:</span>{' '}
                  {fmtDateTime(order.createdAt)}
                </div>
                {order.confirmedAt && (
                  <div>
                    <span className="text-body-secondary">Confirmado:</span>{' '}
                    {fmtDateTime(order.confirmedAt)}
                  </div>
                )}
              </div>
            </CCol>
            <CCol xs={12}>
              {order.subtotal != null && order.priceTierCode ? (
                <PricingBlock
                  pricing={
                    {
                      priceTierCode: order.priceTierCode,
                      priceTierName: order.priceTierName ?? order.priceTierCode,
                      discountRate: order.discountRate ?? 0,
                      discountBase: order.subtotal,
                      subtotal: order.subtotal,
                      discountAmount: order.discountAmount ?? 0,
                      total: order.total,
                    } satisfies PricingData
                  }
                />
              ) : (
                <div className="fs-5 fw-semibold">Total: {fmtMoney(order.total)}</div>
              )}
              {order.externalInvoiceId && (
                <div className="text-body-secondary small">
                  Factura: <strong>{order.externalInvoiceId}</strong>
                </div>
              )}
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Operator assignment (active cutting or post-cut audit) */}
      {(order.status === 'cutting' || order.status === 'cut') && order.assignedToLabel && (
        <CCard className="mb-3 border-warning">
          <CCardBody className="bg-warning bg-opacity-10 py-2">
            <div className="fw-semibold text-warning-emphasis mb-1">En corte</div>
            <div className="small">
              <span className="text-body-secondary">Operador:</span>{' '}
              <strong>{order.assignedToLabel}</strong>
            </div>
            {order.assignedAt && (
              <div className="small">
                <span className="text-body-secondary">Desde:</span> {fmtDateTime(order.assignedAt)}
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Banding — parallel track to cutting. Hidden if the order has no edge banding. */}
      {order.bandingStatus && order.bandingStatus !== 'not_applicable' && (
        <CCard className="mb-3 border-info">
          <CCardBody className="bg-info bg-opacity-10 py-2">
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="fw-semibold text-info-emphasis">Canteado</span>
              <BandingStatusBadge status={order.bandingStatus} />
            </div>
            {order.bandingStartedByLabel && (
              <div className="small">
                <span className="text-body-secondary">Inició:</span>{' '}
                <strong>{order.bandingStartedByLabel}</strong>
                {order.bandingStartedAt && <span> · {fmtDateTime(order.bandingStartedAt)}</span>}
              </div>
            )}
            {order.bandingFinishedByLabel && (
              <div className="small">
                <span className="text-body-secondary">Terminó:</span>{' '}
                <strong>{order.bandingFinishedByLabel}</strong>
                {order.bandingFinishedAt && <span> · {fmtDateTime(order.bandingFinishedAt)}</span>}
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Dispatch — fields frozen when transitioning to despachado */}
      {order.status === 'despachado' && (
        <CCard className="mb-3 border-success">
          <CCardBody className="bg-success bg-opacity-10 py-2">
            <div className="fw-semibold text-success-emphasis mb-1">Despachada</div>
            {order.dispatchedByLabel && (
              <div className="small">
                <span className="text-body-secondary">Despachado por:</span>{' '}
                <strong>{order.dispatchedByLabel}</strong>
              </div>
            )}
            {order.dispatchedAt && (
              <div className="small">
                <span className="text-body-secondary">Fecha:</span>{' '}
                {fmtDateTime(order.dispatchedAt)}
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Payment method — frozen at the confirmed → queued transition */}
      {(order.paymentCashAmount != null || order.paymentCreditAmount != null) && (
        <CCard className="mb-3 border-primary">
          <CCardBody className="bg-primary bg-opacity-10 py-2">
            <div className="fw-semibold text-primary-emphasis mb-1">Forma de pago</div>
            {order.paymentCashAmount != null && order.paymentCashAmount > 0 && (
              <div className="small">
                <span className="text-body-secondary">Efectivo:</span>{' '}
                <strong>{fmtMoney(order.paymentCashAmount)}</strong>
              </div>
            )}
            {order.paymentCreditAmount != null && order.paymentCreditAmount > 0 && (
              <div className="small">
                <span className="text-body-secondary">A crédito:</span>{' '}
                <strong>{fmtMoney(order.paymentCreditAmount)}</strong>
              </div>
            )}
            <div className="small">
              <span className="text-body-secondary">Total:</span>{' '}
              <strong>
                {fmtMoney((order.paymentCashAmount ?? 0) + (order.paymentCreditAmount ?? 0))}
              </strong>
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* Status actions */}
      {!isTerminal && (transitions.length > 0 || canChangeBranch) && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Acciones</strong>
          </CCardHeader>
          <CCardBody>
            <div className="d-flex gap-2 flex-wrap">
              {transitions.map((t) => {
                const cutBlocked = t.to === 'cut' && cutGated
                const bandingBlocked = t.to === 'completed' && bandingPending
                const blocked = cutBlocked || bandingBlocked
                const title = cutBlocked
                  ? `Faltan ${piecesPending} pieza(s) por cortar`
                  : bandingBlocked
                    ? 'Falta terminar el canteado'
                    : undefined
                return (
                  <CButton
                    key={t.to}
                    color={t.color}
                    size="sm"
                    disabled={blocked}
                    title={title}
                    onClick={() =>
                      order.status === 'confirmed' && t.to === 'queued'
                        ? openPayment()
                        : openTransition(t)
                    }
                  >
                    {t.label}
                  </CButton>
                )
              })}
            </div>
            {canChangeBranch && (
              <div className="mt-2">
                <CButton color="secondary" variant="outline" size="sm" onClick={openBranchModal}>
                  Cambiar sucursal
                </CButton>
              </div>
            )}
            {cutGated && (
              <div className="text-warning small mt-2">
                Faltan {piecesPending} pieza(s) por cortar. Márcalas en el taller para habilitar el
                corte.
              </div>
            )}
            {bandingPending && transitions.some((t) => t.to === 'completed') && (
              <div className="text-warning small mt-2">
                Falta terminar el canteado para poder completar la orden.
              </div>
            )}
            {updateStatus.error && (
              <div className="text-danger small mt-2">
                {updateStatus.error.message || 'Error al cambiar estado.'}
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Producción / Taller */}
      {showProduction && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Producción</strong>
          </CCardHeader>
          <CCardBody>
            {cuttingPlan.isLoading ? (
              <CSpinner size="sm" />
            ) : plan ? (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold">
                    {plan.progress.cutPieces} de {plan.progress.totalPieces} piezas cortadas
                  </span>
                  <span className="text-body-secondary small">{plan.boards.length} tablero(s)</span>
                </div>
                <CProgress className="mb-3" height={12}>
                  <CProgressBar value={planPct} color={planDone ? 'success' : 'primary'} />
                </CProgress>
                <CButton color="primary" onClick={() => void navigate(`/orders/${id}/workshop`)}>
                  {order.status === 'queued' || order.status === 'cutting'
                    ? 'Abrir taller'
                    : 'Ver corte'}
                </CButton>
              </>
            ) : (
              <div className="text-body-secondary small">
                {cuttingPlan.error?.message || 'No se pudo cargar el plan de corte.'}
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Lines */}
      {order.lines?.length > 0 && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Líneas de cobro</strong>
          </CCardHeader>
          <CCardBody>
            <CTable small responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">Producto</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Código</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">Cant.</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">
                    Precio unit.
                  </CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">
                    Total línea
                  </CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">
                    Eficiencia avg
                  </CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">Área m²</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {order.lines.map((l) => (
                  <CTableRow key={l.id}>
                    <CTableDataCell>
                      {stripHalfSuffix(l.productName) ?? '—'}{' '}
                      {l.halfBoard && <CBadge color="info">½ medio</CBadge>}
                    </CTableDataCell>
                    <CTableDataCell>{l.productCode ?? '—'}</CTableDataCell>
                    <CTableDataCell className="text-end">{l.quantity}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {fmtMoney(l.unitPriceSnapshot)}
                    </CTableDataCell>
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
          </CCardBody>
        </CCard>
      )}

      {/* Pieces */}
      {order.pieces && order.pieces.length > 0 && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Lista de corte</strong>
          </CCardHeader>
          <CCardBody>
            <CTable small responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">Etiqueta</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">
                    Largo (mm)
                  </CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">
                    Ancho (mm)
                  </CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">Cant.</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-end">
                    Prioridad
                  </CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary text-center">
                    Puede rotar
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {order.pieces.map((p) => (
                  <CTableRow key={p.id}>
                    <CTableDataCell>{p.label ?? '—'}</CTableDataCell>
                    <CTableDataCell className="text-end">{p.height}</CTableDataCell>
                    <CTableDataCell className="text-end">{p.width}</CTableDataCell>
                    <CTableDataCell className="text-end">{p.quantity}</CTableDataCell>
                    <CTableDataCell className="text-end">{p.priority}</CTableDataCell>
                    <CTableDataCell className="text-center">
                      {p.canRotate ? 'Sí' : 'No'}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      )}

      {/* History — actor label + actor type badge; see StatusHistoryTable. The table renders bare,
          so the card is this page's: it is one section among many here. */}
      {order.history && order.history.length > 0 && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Historial</strong>
          </CCardHeader>
          <CCardBody>
            <StatusHistoryTable
              entries={order.history}
              renderStatus={(s) => <OrderStatusBadge status={s as OrderStatus} />}
            />
          </CCardBody>
        </CCard>
      )}

      {/* Documents & invoice — orders are created in confirmed state and always have documents. */}
      <CCard className="mb-3">
        <CCardHeader>
          <strong>Documentos y factura</strong>
        </CCardHeader>
        <CCardBody>
          <div className="d-flex gap-2 flex-wrap">
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              onClick={() => {
                if (id) void ordersApi.downloadOrderDocument(id)
              }}
            >
              <CIcon icon={cilExternalLink} className="me-1" />
              Orden de pedido PDF
            </CButton>
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              onClick={() => {
                if (id) void ordersApi.downloadProductionSheet(id)
              }}
            >
              <CIcon icon={cilExternalLink} className="me-1" />
              Hoja de producción PDF
            </CButton>
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              onClick={() => {
                if (id) void ordersApi.downloadConsolidated(id)
              }}
            >
              <CIcon icon={cilExternalLink} className="me-1" />
              PDF consolidado
            </CButton>
            {order.status === 'despachado' && (
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (id) void ordersApi.downloadDispatchSheet(id)
                }}
              >
                <CIcon icon={cilExternalLink} className="me-1" />
                Hoja de despacho PDF
              </CButton>
            )}
            {canManage && (
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                disabled={!!order.externalInvoiceId}
                onClick={() => setInvoiceModal(true)}
              >
                {order.externalInvoiceId ? 'Factura asociada' : 'Asociar factura'}
              </CButton>
            )}
          </div>
        </CCardBody>
      </CCard>

      {/* Attachments (anexos) — upload/delete gated to admin/vendedor and non-terminal orders. */}
      <CCard className="mb-3">
        <CCardHeader>
          <strong>Anexos</strong>
        </CCardHeader>
        <CCardBody>
          {canManage && !attachmentsLocked && (
            <div className="mb-3">
              <CFormInput
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={uploadAtt.isPending}
                onChange={(e) => {
                  onPickFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <div className="text-body-secondary small mt-1">
                PDF, PNG o JPEG · máx {ATTACH_MAX_MB} MB.
                {uploadAtt.isPending && <CSpinner size="sm" className="ms-2" />}
              </div>
              {(attachError || uploadAtt.error) && (
                <div className="text-danger small mt-1">
                  {attachError ?? uploadAtt.error?.message}
                </div>
              )}
            </div>
          )}
          {attachmentsLocked && (
            <div className="text-body-secondary small mb-2">
              La orden está cerrada: no se pueden agregar ni quitar anexos.
            </div>
          )}
          {attachments.isLoading ? (
            <CSpinner size="sm" />
          ) : attachments.data && attachments.data.length > 0 ? (
            <CTable small responsive hover className="mb-0 align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Archivo</CTableHeaderCell>
                  <CTableHeaderCell>Tamaño</CTableHeaderCell>
                  <CTableHeaderCell>Fecha</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Acciones</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {attachments.data.map((att) => (
                  <CTableRow key={att.id}>
                    <CTableDataCell>
                      <CBadge
                        color={att.contentType === 'application/pdf' ? 'danger' : 'info'}
                        className="me-2"
                      >
                        {att.contentType.split('/')[1]?.toUpperCase() ?? 'ARCHIVO'}
                      </CBadge>
                      {att.filename}
                    </CTableDataCell>
                    <CTableDataCell>{humanSize(att.sizeBytes)}</CTableDataCell>
                    <CTableDataCell>{fmtDateTime(att.createdAt)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CButton
                        color="secondary"
                        variant="outline"
                        size="sm"
                        className="me-2"
                        onClick={() => {
                          if (id) void ordersApi.downloadAttachment(id, att.id)
                        }}
                      >
                        <CIcon icon={cilExternalLink} className="me-1" />
                        Ver
                      </CButton>
                      {canManage && !attachmentsLocked && (
                        <CButton
                          color="danger"
                          variant="outline"
                          size="sm"
                          disabled={deleteAtt.isPending}
                          onClick={() => onDeleteAttachment(att.id, att.filename)}
                        >
                          Borrar
                        </CButton>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          ) : (
            <div className="text-body-secondary small">Sin anexos.</div>
          )}
          {deleteAtt.error && (
            <div className="text-danger small mt-2">{deleteAtt.error.message}</div>
          )}
        </CCardBody>
      </CCard>

      {/* Payment modal — confirmed → queued */}
      <CModal visible={paymentModal} onClose={closePayment}>
        <CModalHeader>
          <CModalTitle>Forma de pago</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {(() => {
            const cash = parseFloat(cashInput) || 0
            const credit = parseFloat(creditInput) || 0
            const sum = cash + credit
            const orderTotal = order.total
            const empty = sum <= 0
            const mismatch = !empty && Math.abs(sum - orderTotal) > 0.01
            return (
              <>
                <div className="d-flex gap-2 mb-3">
                  <CButton
                    color="primary"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCashChange(orderTotal.toFixed(2))}
                  >
                    Todo efectivo
                  </CButton>
                </div>
                <div className="mb-3">
                  <CFormLabel>Efectivo (USD)</CFormLabel>
                  <CFormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashInput}
                    onChange={(e) => handleCashChange(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="mb-3">
                  <CFormLabel>A crédito (USD)</CFormLabel>
                  <CFormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditInput}
                    onChange={(e) => handleCreditChange(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="fw-semibold small mb-3">
                  Total ingresado: {fmtMoney(sum)} / Total de la orden: {fmtMoney(orderTotal)}
                </div>
                {empty && (
                  <div className="text-warning small mb-2">
                    Ingresa al menos un monto mayor a 0.
                  </div>
                )}
                {mismatch && (
                  <div className="text-danger small mb-2">
                    La suma de los montos debe ser igual al total de la orden (
                    {fmtMoney(orderTotal)}).
                  </div>
                )}
                <div className="mb-2">
                  <CFormLabel>Nota (opcional)</CFormLabel>
                  <CFormTextarea
                    rows={2}
                    maxLength={512}
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Motivo o comentario…"
                  />
                </div>
                {updateStatus.error && (
                  <div className="text-danger small mt-2">
                    {updateStatus.error.message || 'Error al cambiar estado.'}
                  </div>
                )}
              </>
            )
          })()}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closePayment}>
            Cancelar
          </CButton>
          <CButton
            color="primary"
            onClick={confirmPayment}
            disabled={(() => {
              const cash = parseFloat(cashInput) || 0
              const credit = parseFloat(creditInput) || 0
              const sum = cash + credit
              return updateStatus.isPending || sum <= 0 || Math.abs(sum - order.total) > 0.01
            })()}
          >
            {updateStatus.isPending ? <CSpinner size="sm" /> : 'Confirmar'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Transition confirmation modal */}
      <CModal visible={transitionModal.visible} onClose={closeTransition}>
        <CModalHeader>
          <CModalTitle>Confirmar acción</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            ¿Confirmar: <strong>{transitionModal.transition?.label}</strong>?
          </p>
          <CFormLabel>Nota (opcional)</CFormLabel>
          <CFormTextarea
            rows={2}
            maxLength={512}
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
            placeholder="Motivo o comentario…"
          />
          {updateStatus.error && (
            <div className="text-danger small mt-2">
              {updateStatus.error.message || 'Error al cambiar estado.'}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeTransition}>
            Cancelar
          </CButton>
          <CButton
            color={transitionModal.transition?.color ?? 'primary'}
            onClick={confirmTransition}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? <CSpinner size="sm" /> : 'Confirmar'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Invoice modal */}
      <CModal visible={invoiceModal} onClose={closeInvoice}>
        <CModalHeader>
          <CModalTitle>Asociar factura externa</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormLabel>ID de factura</CFormLabel>
          <CFormInput
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            maxLength={64}
            placeholder="FAC-2026-0001"
          />
          {associateInvoice.error && (
            <div className="text-danger small mt-2">
              {associateInvoice.error.message || 'Error al asociar la factura.'}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeInvoice}>
            Cancelar
          </CButton>
          <CButton
            color="primary"
            onClick={confirmInvoice}
            disabled={associateInvoice.isPending || !invoiceId.trim()}
          >
            {associateInvoice.isPending ? <CSpinner size="sm" /> : 'Asociar'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Change branch modal — rebalancing before the workshop starts cutting */}
      <CModal visible={branchModal} onClose={closeBranchModal}>
        <CModalHeader>
          <CModalTitle>Cambiar sucursal</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormLabel>Sucursal destino</CFormLabel>
          <CFormSelect value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>
            <option value="">— Seleccionar sucursal —</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </CFormSelect>
          <CFormLabel className="mt-3">Motivo/nota (opcional)</CFormLabel>
          <CFormTextarea
            rows={2}
            maxLength={512}
            value={branchNote}
            onChange={(e) => setBranchNote(e.target.value)}
            placeholder="Motivo o comentario…"
          />
          {changeBranch.error && (
            <div className="text-danger small mt-2">
              {changeBranch.error.message || 'No se pudo cambiar la sucursal.'}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeBranchModal}>
            Cancelar
          </CButton>
          <CButton
            color="primary"
            onClick={confirmBranchChange}
            disabled={!targetBranchId || changeBranch.isPending}
          >
            {changeBranch.isPending ? <CSpinner size="sm" /> : 'Mover'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default OrderDetailPage
