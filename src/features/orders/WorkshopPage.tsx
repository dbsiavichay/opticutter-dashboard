import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CProgress,
  CProgressBar,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilArrowRight, cilCheckAlt, cilPrint } from '@coreui/icons'

import { useHasRole } from 'src/features/auth/useAuth'
import { usePrintLabel } from 'src/features/print/usePrint'
import { PALETTE, pieceSig } from 'src/shared/utils/cutDrawing'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import OrderStatusBadge from './OrderStatusBadge'
import BandingStatusBadge from './BandingStatusBadge'
import WorkshopBoardSvg from './WorkshopBoardSvg'
import { ordersApi } from './ordersApi'
import { useCuttingPlan, useMarkPiece, useOrder, useUpdateOrderStatus } from './useOrders'
import type { CutPiece, CutProgress } from './types'

const pct = ({ cutPieces, totalPieces }: CutProgress) =>
  totalPieces > 0 ? Math.round((cutPieces / totalPieces) * 100) : 0

const hasPending = ({ cutPieces, totalPieces }: CutProgress) => cutPieces < totalPieces

const isDone = ({ cutPieces, totalPieces }: CutProgress) =>
  totalPieces > 0 && cutPieces >= totalPieces

const WorkshopPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // Operador has no order detail view: back button goes to the list instead of /orders/:id.
  const isOperator = useHasRole('operador')
  const isAdminOrOperator = useHasRole('administrador', 'operador')

  const { data: plan, isLoading, isError, error } = useCuttingPlan(id, !!id)
  // The cutting plan does not include banding data; we fetch the order to show the banding badge (read-only).
  const { data: order } = useOrder(id)
  const markPiece = useMarkPiece(id ?? '')
  const updateStatus = useUpdateOrderStatus()
  const printLabel = usePrintLabel()

  const [cutModal, setCutModal] = useState(false)
  // Board currently on screen (one at a time). Identified by persistent id to survive refetches.
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  // Stable color keyed by dimension signature across all boards, so identical pieces share
  // the same color across sheets (same logic as the optimizer).
  const colorFor = useMemo(() => {
    const colors = new Map<string, string>()
    for (const board of plan?.boards ?? []) {
      for (const p of board.pieces) {
        const sig = pieceSig(p)
        if (!colors.has(sig)) colors.set(sig, PALETTE[colors.size % PALETTE.length] ?? PALETTE[0])
      }
    }
    return (sig: string) => colors.get(sig) ?? PALETTE[0]
  }, [plan])

  // Keep the active chip visible when switching boards (centered horizontally, no vertical jumps).
  // Chips are direct children of the strip in the same order as boards.
  useEffect(() => {
    if (!plan) return
    const idx = Math.max(
      0,
      plan.boards.findIndex((b) => b.id === selectedBoardId),
    )
    stripRef.current?.children[idx]?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [plan, selectedBoardId])

  const interactive = plan?.status === 'cutting'

  // Single tap marks a piece as cut; tapping an already-cut piece does nothing (double-tap unmarks it).
  // Once the cut is confirmed server-side, dispatch its label to the branch's thermal printer —
  // skipped when the branch has no such printer (the backend would skip it anyway; not firing
  // keeps the cut from costing a pointless round trip on every single piece).
  const onPieceTap = (piece: CutPiece) => {
    if (!id || piece.cut) return
    markPiece.mutate(
      { pieceId: piece.id, cut: true },
      {
        onSuccess: () => {
          if (plan?.printLabelsEnabled) printLabel.mutate({ orderId: id, pieceId: piece.id })
        },
      },
    )
  }

  // Double-tap = unmark, no confirmation required.
  const onPieceUntap = (piece: CutPiece) => {
    if (!id || !piece.cut) return
    markPiece.mutate({ pieceId: piece.id, cut: false })
  }

  const confirmCut = () => {
    if (!id) return
    updateStatus.mutate({ id, data: { status: 'cut' } }, { onSuccess: () => setCutModal(false) })
  }

  const backToOrder = () => void navigate(isOperator ? '/orders' : `/orders/${id}`)

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (isError || !plan) {
    return (
      <>
        <CButton variant="ghost" color="secondary" className="mb-3" onClick={backToOrder}>
          <CIcon icon={cilArrowLeft} className="me-1" />
          {isOperator ? 'Volver a órdenes' : 'Volver a la orden'}
        </CButton>
        <CAlert color="danger">{error?.message || 'No se pudo cargar el plan de corte.'}</CAlert>
      </>
    )
  }

  const boards = plan.boards

  // Default selection with no side effect: if the current selection is invalid (first render or board
  // removed after a refetch), fall back to the first pending board. React render-phase state adjustment
  // pattern: converges (once a valid id is set the condition stops being true) and does not auto-advance
  // when a board is completed, because its id still exists.
  if (selectedBoardId == null || !boards.some((b) => b.id === selectedBoardId)) {
    const fallback = (boards.find((b) => hasPending(b.progress)) ?? boards[0])?.id ?? null
    if (fallback !== selectedBoardId) setSelectedBoardId(fallback)
  }

  const safeIndex = Math.max(
    0,
    boards.findIndex((b) => b.id === selectedBoardId),
  )
  const current = boards[safeIndex]
  const goTo = (i: number) => setSelectedBoardId(boards[i]?.id ?? null)

  // Next board with pending pieces (starting from the current one, with wrap-around) for the "go to next" CTA.
  const pendingNext = (() => {
    for (let k = 1; k <= boards.length; k++) {
      const b = boards[(safeIndex + k) % boards.length]
      if (b && hasPending(b.progress)) return b
    }
    return null
  })()

  const header = (
    <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
      <CButton variant="ghost" color="secondary" size="lg" onClick={backToOrder}>
        <CIcon icon={cilArrowLeft} className="me-1" />
        {isOperator ? 'Volver a órdenes' : 'Volver a la orden'}
      </CButton>
      <div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h4 className="mb-0">{plan.orderCode}</h4>
          <OrderStatusBadge status={plan.status} />
          {order?.bandingStatus && order.bandingStatus !== 'not_applicable' && (
            <BandingStatusBadge status={order.bandingStatus} />
          )}
        </div>
        {/* Reference (project/site): which job of this client is on the saw. */}
        <ReferenceNote notes={plan.notes} variant="header" />
      </div>
      <CButton
        color="secondary"
        variant="outline"
        size="lg"
        onClick={() => {
          if (id) void ordersApi.downloadProductionSheet(id)
        }}
      >
        <CIcon icon={cilPrint} className="me-1" />
        Hoja de producción
      </CButton>
    </div>
  )

  if (boards.length === 0 || !current) {
    return (
      <>
        {header}
        <CAlert color="info">Esta orden no tiene tableros en su plan de corte.</CAlert>
      </>
    )
  }

  return (
    <>
      {header}

      {/* Sticky controls: overall progress + board selector, always accessible while cutting */}
      <div
        className="bg-body border-bottom mb-3 pt-2 pb-2 px-2"
        style={{ position: 'sticky', top: '4rem', zIndex: 1010 }}
      >
        <div className="d-flex align-items-center gap-3 mb-2">
          <strong className="text-nowrap">
            Total {plan.progress.cutPieces}/{plan.progress.totalPieces}
          </strong>
          <CProgress className="flex-grow-1" height={12}>
            <CProgressBar
              value={pct(plan.progress)}
              color={isDone(plan.progress) ? 'success' : 'primary'}
            />
          </CProgress>
          {isDone(plan.progress) && <span className="text-success fw-semibold">¡Completo!</span>}
        </div>

        {/* Horizontal chip strip per board (scroll); tap = navigate to that board */}
        <div ref={stripRef} className="d-flex gap-2 overflow-auto pb-1">
          {boards.map((b, i) => {
            const active = b.id === current.id
            const done = isDone(b.progress)
            const color = done ? 'success' : b.progress.cutPieces > 0 ? 'primary' : 'secondary'
            return (
              <CButton
                key={b.id}
                color={color}
                variant={active ? undefined : 'outline'}
                className="d-flex flex-column align-items-center flex-shrink-0 px-3 py-2"
                style={{ minWidth: 96, lineHeight: 1.15 }}
                onClick={() => goTo(i)}
              >
                <span className="fw-semibold">Tablero {b.sheetNumber}</span>
                <span className="small">
                  {done ? '✓ Listo' : `${b.progress.cutPieces}/${b.progress.totalPieces}`}
                </span>
              </CButton>
            )
          })}
        </div>
      </div>

      {/* Waiting queue: operador has not yet taken the order */}
      {plan.status === 'queued' && isAdminOrOperator && (
        <CCard className="mb-3 border-primary">
          <CCardBody>
            <p className="mb-3">Esta orden está disponible para cortar.</p>
            <CButton
              color="primary"
              size="lg"
              className="w-100"
              disabled={updateStatus.isPending}
              onClick={() => id && updateStatus.mutate({ id, data: { status: 'cutting' } })}
            >
              {updateStatus.isPending ? <CSpinner size="sm" /> : 'Tomar esta orden'}
            </CButton>
            {updateStatus.error && (
              <div className="text-danger small mt-2">
                {updateStatus.error.message || 'Error al tomar la orden.'}
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Close cut: enabled only when all pieces are marked. The API is the authoritative guard
          (422 if pieces are missing); disabling is UX only. When moving to 'cut', the plan
          refreshes and the view becomes read-only. */}
      {interactive && (
        <div className="mb-3">
          <CButton
            color="primary"
            size="lg"
            className="w-100"
            disabled={hasPending(plan.progress) || updateStatus.isPending}
            title={
              hasPending(plan.progress)
                ? `Faltan ${plan.progress.totalPieces - plan.progress.cutPieces} pieza(s) por cortar`
                : undefined
            }
            onClick={() => setCutModal(true)}
          >
            <CIcon icon={cilCheckAlt} className="me-1" />
            Marcar orden como cortada
          </CButton>
          {hasPending(plan.progress) && (
            <div className="text-warning small mt-2">
              Faltan {plan.progress.totalPieces - plan.progress.cutPieces} pieza(s) por cortar para
              habilitar el corte.
            </div>
          )}
          {updateStatus.error && (
            <div className="text-danger small mt-2">
              {updateStatus.error.message || 'Error al cambiar estado.'}
            </div>
          )}
        </div>
      )}

      {!interactive && plan.status !== 'queued' && (
        <div className="text-body-secondary small mb-3">
          Solo lectura: el corte ya fue completado.
        </div>
      )}
      {!interactive && plan.status === 'queued' && !isAdminOrOperator && (
        <div className="text-body-secondary small mb-3">
          Disponible en la cola. Toma la orden para empezar a cortar.
        </div>
      )}

      {markPiece.isError && (
        <CAlert color="danger" className="py-2">
          {markPiece.error?.message || 'No se pudo actualizar la pieza.'}
        </CAlert>
      )}

      {/* Focused board (one at a time) */}
      <CCard className="mb-3">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <strong>
                Tablero {current.sheetNumber} ({safeIndex + 1} de {boards.length}) —{' '}
                {current.progress.cutPieces}/{current.progress.totalPieces}
              </strong>
              <div className="text-body-secondary small d-flex align-items-center gap-1">
                {stripHalfSuffix(current.productName)}
                {current.halfBoard && <CBadge color="info">½ medio</CBadge>}
              </div>
            </div>
            <div className="d-flex gap-2 flex-shrink-0">
              <CButton
                color="secondary"
                variant="outline"
                size="lg"
                disabled={safeIndex === 0}
                title="Tablero anterior"
                onClick={() => goTo(safeIndex - 1)}
              >
                <CIcon icon={cilArrowLeft} />
              </CButton>
              <CButton
                color="secondary"
                variant="outline"
                size="lg"
                disabled={safeIndex === boards.length - 1}
                title="Tablero siguiente"
                onClick={() => goTo(safeIndex + 1)}
              >
                <CIcon icon={cilArrowRight} />
              </CButton>
            </div>
          </div>
          <CProgress height={8} className="mt-2">
            <CProgressBar
              value={pct(current.progress)}
              color={isDone(current.progress) ? 'success' : 'primary'}
            />
          </CProgress>
        </CCardHeader>
        <CCardBody>
          {/* Low-friction CTA: when a board is done, one tap jumps to the next pending board */}
          {!hasPending(current.progress) && pendingNext && (
            <CButton
              color="success"
              size="lg"
              className="w-100 mb-3"
              onClick={() => setSelectedBoardId(pendingNext.id)}
            >
              Tablero {current.sheetNumber} completo — Ir al siguiente pendiente (Tablero{' '}
              {pendingNext.sheetNumber}) →
            </CButton>
          )}
          <WorkshopBoardSvg
            key={current.id}
            board={current}
            colorFor={colorFor}
            interactive={!!interactive}
            onPieceTap={onPieceTap}
            onPieceUntap={onPieceUntap}
          />
        </CCardBody>
      </CCard>

      {/* Confirm cut close (order → cortada) */}
      <CModal visible={cutModal} onClose={() => setCutModal(false)}>
        <CModalHeader>
          <CModalTitle>Marcar como cortada</CModalTitle>
        </CModalHeader>
        <CModalBody>
          ¿Marcar la orden <strong>{plan.orderCode}</strong> como <strong>cortada</strong>? Esto
          cierra el corte y la vista pasará a solo lectura.
          {updateStatus.error && (
            <div className="text-danger small mt-2">
              {updateStatus.error.message || 'Error al cambiar estado.'}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setCutModal(false)}>
            Cancelar
          </CButton>
          <CButton color="primary" onClick={confirmCut} disabled={updateStatus.isPending}>
            {updateStatus.isPending ? <CSpinner size="sm" /> : 'Confirmar'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default WorkshopPage
