import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
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
  CSpinner,
} from '@coreui/react'

import { useCurrentUser, useHasRole } from 'src/features/auth/useAuth'
import { usePrintConsolidated } from 'src/features/print/usePrint'
import { useActiveBranches } from 'src/features/branches/useBranches'
import { WizardFooter } from 'src/features/optimizer/WizardSteps'
import StatusHistoryTable from 'src/shared/components/StatusHistoryTable'
import PricingBlock from 'src/shared/components/PricingBlock'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import { clientName, fmtDateTime, fmtMoney } from 'src/shared/utils/format'
import type { PricingData } from 'src/features/optimizer/types'
import OrderStatusBadge from './OrderStatusBadge'
import OrderStatusStrip from './OrderStatusStrip'
import OrderActionsMenu from './OrderActionsMenu'
import OrderLinesTable from './OrderLinesTable'
import OrderPiecesTable from './OrderPiecesTable'
import OrderAttachmentsModal, { humanSize } from './OrderAttachmentsModal'
import { attachmentsLocked, hasWorkshopPlan, transitionsFor } from './status'
import type { StatusTransition } from './status'
import {
  useAssociateInvoice,
  useAttachments,
  useChangeOrderBranch,
  useCuttingPlan,
  useOrder,
  useUpdateOrderStatus,
} from './useOrders'
import { ordersApi } from './ordersApi'
import type { OrderStatus } from './types'

// The order as one document on one surface, in the language the quote detail got in #83: an
// identity block that is not a card, a one-line status strip, a single `.surface`, and a pinned
// footer that carries the one action the page is for.
//
// What was here before: twelve `CCard`s. Seven of them announced their own name over content that
// already draws its own borders ("Historial" above a table, "Anexos" above a table), four were
// tinted status blocks that are one subject split four ways, and one — "Acciones" — put the status
// transitions, "Cambiar sucursal" and two warning lines in a frame at the top of a page you had to
// scroll past the whole cut list to leave.

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
  const cuttingPlan = useCuttingPlan(id, !!order && hasWorkshopPlan(order.status))
  const updateStatus = useUpdateOrderStatus()
  const associateInvoice = useAssociateInvoice()
  const changeBranch = useChangeOrderBranch()
  const printConsolidated = usePrintConsolidated()
  const { data: activeBranches = [] } = useActiveBranches()
  // Only for the summary row's count; the dialog owns the upload and delete mutations. React Query
  // serves both from the same `['orders', id, 'attachments']` entry.
  const attachments = useAttachments(id)

  // The cut-list panel lives in a search param, not in component state: `AppContent` keys its
  // ErrorBoundary on `location.pathname`, so a sub-route would remount this page. A search param
  // leaves `pathname` alone, which also makes the browser's Back button close the panel.
  const [searchParams, setSearchParams] = useSearchParams()
  const openPieces = () =>
    setSearchParams((p) => {
      p.set('panel', 'piezas')
      return p
    })
  // `replace` so "Listo" does not stack a second history entry on top of the one that opened it.
  const closePieces = () =>
    setSearchParams(
      (p) => {
        p.delete('panel')
        return p
      },
      { replace: true },
    )

  const [showHistory, setShowHistory] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
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

  const orderId = order.id
  const transitions = transitionsFor(order.status, currentUser?.role)
  // The forward move comes first in every row of the graph, so it is the footer's primary; the rest
  // ("Cancelar", "Regresar a cola") ride beside it as outline buttons.
  const [primary, ...secondary] = transitions
  const canChangeBranch = canManage && (order.status === 'confirmed' || order.status === 'queued')
  const branchOptions = activeBranches.filter((b) => b.id !== order.branch.id)
  const locked = attachmentsLocked(order.status)

  const plan = cuttingPlan.data
  const showProduction = hasWorkshopPlan(order.status)
  const piecesPending = plan ? plan.progress.totalPieces - plan.progress.cutPieces : 0
  // The API is the authoritative guard (returns 422 if pieces are missing); disabling the button is UX only.
  const cutGated = order.status === 'cutting' && !!plan && piecesPending > 0
  const planPct =
    plan && plan.progress.totalPieces > 0
      ? Math.round((plan.progress.cutPieces / plan.progress.totalPieces) * 100)
      : 0
  const planDone =
    !!plan && plan.progress.totalPieces > 0 && plan.progress.cutPieces >= plan.progress.totalPieces

  // Banding blocks the cut → completed transition while it is still pending/in-progress (API
  // returns 422; disabling is UX only).
  const bandingPending = order.bandingStatus === 'pending' || order.bandingStatus === 'in_progress'

  // What stops the primary action, in the words the two loose `text-warning` lines used to carry.
  // `WizardFooter` shows the hint only while the button is disabled, which is exactly when they
  // were rendered.
  const blockedHint =
    primary?.to === 'cut' && cutGated
      ? `Faltan ${piecesPending} pieza(s) por cortar. Márcalas en el taller.`
      : primary?.to === 'completed' && bandingPending
        ? 'Falta terminar el canteado para poder completar la orden.'
        : undefined

  const pieces = order.pieces ?? []
  const pieceUnits = pieces.reduce((sum, p) => sum + (p.quantity ?? 0), 0)
  const piecesOpen = pieces.length > 0 && searchParams.get('panel') === 'piezas'

  const files = attachments.data ?? []
  const filesBytes = files.reduce((sum, a) => sum + a.sizeBytes, 0)

  const cash = order.paymentCashAmount ?? 0
  const credit = order.paymentCreditAmount ?? 0
  const hasPayment = cash > 0 || credit > 0
  const hasHistory = !!order.history && order.history.length > 0

  return (
    <>
      {/* Identity. The breadcrumb already says "Órdenes", so this says which one. */}
      <div className="d-flex align-items-start gap-2 mb-3">
        <div className="min-w-0">
          <div className="d-flex align-items-center gap-2">
            <h5 className="mb-0">{order.code ?? 'Sin código'}</h5>
            {/* The badge is the handle for the history: the history is the list of how the order
                reached the status the badge is showing. */}
            {hasHistory ? (
              <button
                type="button"
                className="status-trigger"
                title="Ver historial de estados"
                onClick={() => setShowHistory(true)}
              >
                <OrderStatusBadge status={order.status} />
              </button>
            ) : (
              <OrderStatusBadge status={order.status} />
            )}
          </div>
          <div className="text-body-secondary small">
            {clientName(order.client)}
            {order.client?.identifier && <span> @{order.client.identifier}</span>}
            {canManage && (
              <span>
                {' · '}
                {order.branch.name}
                {order.branch.code && ` (${order.branch.code})`}
              </span>
            )}
            {order.externalInvoiceId && <span>{` · Factura ${order.externalInvoiceId}`}</span>}
          </div>
          <div className="text-body-secondary small">
            Creada {fmtDateTime(order.createdAt)}
            {order.confirmedAt && ` · Confirmada ${fmtDateTime(order.confirmedAt)}`}
            {order.dispatchedAt && ` · Despachada ${fmtDateTime(order.dispatchedAt)}`}
          </div>
          {/* Reference inherited from the quote; read-only here (no endpoint edits it) and printed
              on every PDF. */}
          {order.notes?.trim() ? (
            <ReferenceNote notes={order.notes} variant="header" />
          ) : (
            <span className="text-body-secondary small fst-italic">Sin referencia</span>
          )}
        </div>
        <div className="ms-auto">
          <OrderActionsMenu
            onOrderPdf={() => void ordersApi.downloadOrderDocument(orderId)}
            onProductionSheet={() => void ordersApi.downloadProductionSheet(orderId)}
            onConsolidatedPdf={() => void ordersApi.downloadConsolidated(orderId)}
            onDispatchSheet={
              order.status === 'despachado'
                ? () => void ordersApi.downloadDispatchSheet(orderId)
                : undefined
            }
            onInvoice={
              canManage && !order.externalInvoiceId ? () => setInvoiceModal(true) : undefined
            }
            onChangeBranch={canChangeBranch ? openBranchModal : undefined}
          />
        </div>
      </div>

      {/* Where the order stands on both tracks — one line instead of four tinted cards. */}
      <OrderStatusStrip
        status={order.status}
        assignedToLabel={order.assignedToLabel}
        assignedAt={order.assignedAt}
        dispatchedByLabel={order.dispatchedByLabel}
        banding={{
          status: order.bandingStatus,
          startedByLabel: order.bandingStartedByLabel,
          startedAt: order.bandingStartedAt,
          finishedByLabel: order.bandingFinishedByLabel,
          finishedAt: order.bandingFinishedAt,
        }}
      />

      {/* One surface for the whole document. Each section carries a plain muted label or a summary
          row instead of a card header. */}
      <div className="surface">
        {showProduction && (
          <div className="d-flex flex-wrap align-items-center gap-2 border rounded-3 p-2 mb-3">
            <span className="small text-body-secondary text-uppercase fw-semibold">Producción</span>
            {cuttingPlan.isLoading ? (
              <CSpinner size="sm" />
            ) : plan ? (
              <>
                <span className="small">
                  <strong>{plan.progress.cutPieces}</strong> de{' '}
                  <strong>{plan.progress.totalPieces}</strong> piezas cortadas ·{' '}
                  <strong>{plan.boards.length}</strong>{' '}
                  {plan.boards.length === 1 ? 'tablero' : 'tableros'}
                </span>
                {/* Capped by a wrapper, not by `style` on the CProgress: CoreUI merges that prop
                    into the child bar, where it overwrites the `width` the bar derives from
                    `value` — the bar renders empty at any percentage. Capped at all because a
                    finished order left to grow is a green bar the width of the page, which
                    outshouts the counts it is only there to illustrate. */}
                <div className="flex-grow-1" style={{ maxWidth: 200 }}>
                  <CProgress height={6}>
                    <CProgressBar value={planPct} color={planDone ? 'success' : 'primary'} />
                  </CProgress>
                </div>
                <CButton
                  size="sm"
                  color="primary"
                  variant="outline"
                  className="ms-auto"
                  onClick={() => void navigate(`/orders/${orderId}/workshop`)}
                >
                  {order.status === 'queued' || order.status === 'cutting'
                    ? 'Abrir taller'
                    : 'Ver corte'}
                </CButton>
              </>
            ) : (
              <span className="small text-body-secondary">
                {cuttingPlan.error?.message || 'No se pudo cargar el plan de corte.'}
              </span>
            )}
          </div>
        )}

        {/* The cut list as one line and a full-screen panel behind it. Rendering it inline meant a
            two-hundred-piece order put two hundred rows between the header and the totals. */}
        {pieces.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-2 border rounded-3 p-2 mb-3">
            <span className="small text-body-secondary text-uppercase fw-semibold">
              Lista de corte
            </span>
            <span className="small">
              <strong>{pieces.length}</strong> {pieces.length === 1 ? 'pieza' : 'piezas'} ·{' '}
              <strong>{pieceUnits}</strong> {pieceUnits === 1 ? 'unidad' : 'unidades'}
            </span>
            <CButton
              size="sm"
              color="primary"
              variant="outline"
              className="ms-auto"
              onClick={openPieces}
            >
              Ver lista
            </CButton>
          </div>
        )}

        {order.lines?.length > 0 && (
          <>
            <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
              Líneas de cobro
            </div>
            <OrderLinesTable lines={order.lines} />
          </>
        )}

        <div className="d-flex flex-wrap align-items-center gap-2 border rounded-3 p-2 mt-3">
          <span className="small text-body-secondary text-uppercase fw-semibold">Anexos</span>
          <span className="small">
            {files.length === 0 ? (
              <span className="text-body-secondary fst-italic">Sin anexos</span>
            ) : (
              <>
                <strong>{files.length}</strong> {files.length === 1 ? 'archivo' : 'archivos'} ·{' '}
                <strong>{humanSize(filesBytes)}</strong>
              </>
            )}
          </span>
          <CButton
            size="sm"
            color="primary"
            variant="outline"
            className="ms-auto"
            onClick={() => setShowAttachments(true)}
          >
            {canManage && !locked ? 'Gestionar' : 'Ver'}
          </CButton>
        </div>

        <hr className="my-4" />

        {/* The totals, with how they were paid beside them — the same pairing the wizard uses for
            the price tier. Payment is not a status, it is the money: reading "Total $840" and
            "Efectivo $840" in two blocks a screen apart was the old layout's doing. */}
        <div className="d-flex flex-wrap align-items-start gap-3">
          {hasPayment && (
            <div className="small">
              <div className="text-body-secondary text-uppercase fw-semibold mb-1">
                Forma de pago
              </div>
              {cash > 0 && (
                <div>
                  <span className="text-body-secondary me-2">Efectivo:</span>
                  <strong>{fmtMoney(cash)}</strong>
                </div>
              )}
              {credit > 0 && (
                <div>
                  <span className="text-body-secondary me-2">A crédito:</span>
                  <strong>{fmtMoney(credit)}</strong>
                </div>
              )}
            </div>
          )}
          {/* `ms-auto` on the block itself: with payment absent it is the only child of the row and
              would otherwise sit on the left. */}
          <div className="ms-auto">
            {order.subtotal != null ? (
              <PricingBlock
                pricing={
                  {
                    priceLevel: order.priceLevel ?? 1,
                    priceLevelName: order.priceLevelName ?? `Precio ${order.priceLevel ?? 1}`,
                    subtotal: order.subtotal,
                    servicesTotal: order.additionalServicesTotal,
                    taxRate: order.taxRate ?? 0,
                    taxAmount: order.taxAmount ?? 0,
                    total: order.total,
                  } satisfies PricingData
                }
              />
            ) : (
              <div className="fs-5 fw-semibold">Total: {fmtMoney(order.total)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned footer: leaving, and the status transitions that were a card at the top of the
          page. It stays on a terminal order so "Volver a órdenes" is always in the same place. */}
      <WizardFooter
        onBack={() => void navigate('/orders')}
        backLabel="Volver a órdenes"
        onNext={
          primary
            ? () =>
                order.status === 'confirmed' && primary.to === 'queued'
                  ? openPayment()
                  : openTransition(primary)
            : undefined
        }
        nextLabel={primary?.label}
        nextDisabled={
          (primary?.to === 'cut' && cutGated) || (primary?.to === 'completed' && bandingPending)
        }
        nextHint={blockedHint}
      >
        {secondary.map((t) => (
          <CButton
            key={t.to}
            color={t.color}
            variant="outline"
            type="button"
            onClick={() => openTransition(t)}
          >
            {t.label}
          </CButton>
        ))}
      </WizardFooter>

      {/* The cut list, full screen. Read-only, so it needs no portal container: nothing inside it
          opens a dropdown that would land under the dialog. */}
      <CModal visible={piecesOpen} onClose={closePieces} fullscreen scrollable>
        <CModalHeader>
          <CModalTitle>Lista de corte · {order.code}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* Capped and centred. Six columns stretched across a full-screen dialog put "Etiqueta"
              and "Puede rotar" a whole screen apart, so reading one row means tracking it across
              1400px of whitespace. */}
          <div className="mx-auto" style={{ maxWidth: 880 }}>
            <OrderPiecesTable pieces={pieces} maxHeight="calc(100dvh - 12rem)" />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={closePieces}>
            Listo
          </CButton>
        </CModalFooter>
      </CModal>

      {/* History, behind the status badge — something you go and check, not something you read on
          the way to the totals. */}
      <CModal visible={showHistory} onClose={() => setShowHistory(false)} size="lg" scrollable>
        <CModalHeader>
          <CModalTitle>Historial · {order.code}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <StatusHistoryTable
            entries={order.history ?? []}
            renderStatus={(s) => <OrderStatusBadge status={s as OrderStatus} />}
          />
        </CModalBody>
      </CModal>

      <OrderAttachmentsModal
        orderId={orderId}
        visible={showAttachments}
        onClose={() => setShowAttachments(false)}
        locked={locked}
        canManage={canManage}
      />

      {/* Payment modal — confirmed → queued */}
      <CModal visible={paymentModal} onClose={closePayment}>
        <CModalHeader>
          <CModalTitle>Forma de pago</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {(() => {
            const entered = (parseFloat(cashInput) || 0) + (parseFloat(creditInput) || 0)
            const orderTotal = order.total
            const empty = entered <= 0
            const mismatch = !empty && Math.abs(entered - orderTotal) > 0.01
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
                  Total ingresado: {fmtMoney(entered)} / Total de la orden: {fmtMoney(orderTotal)}
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
              const entered = (parseFloat(cashInput) || 0) + (parseFloat(creditInput) || 0)
              return (
                updateStatus.isPending || entered <= 0 || Math.abs(entered - order.total) > 0.01
              )
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
