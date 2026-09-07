import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
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
import {
  cilArrowLeft,
  cilArrowRight,
  cilCheckAlt,
  cilFullscreen,
  cilFullscreenExit,
} from '@coreui/icons'

import { useHasRole } from 'src/features/auth/useAuth'
import { usePrintLabel } from 'src/features/print/usePrint'
import { PALETTE, pieceSig } from 'src/shared/utils/cutDrawing'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import useFullscreen from 'src/shared/hooks/useFullscreen'
import { useToastStore } from 'src/shared/store/toastStore'
import AppToaster from 'src/shared/components/AppToaster'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import OrderStatusBadge from './OrderStatusBadge'
import BandingStatusBadge from './BandingStatusBadge'
import WorkshopBoardSvg from './WorkshopBoardSvg'
import WorkshopBoardPicker from './WorkshopBoardPicker'
import { useCuttingPlan, useMarkPiece, useOrder, useUpdateOrderStatus } from './useOrders'
import type { CutPiece, CutProgress } from './types'

const pct = ({ cutPieces, totalPieces }: CutProgress) =>
  totalPieces > 0 ? Math.round((cutPieces / totalPieces) * 100) : 0

const hasPending = ({ cutPieces, totalPieces }: CutProgress) => cutPieces < totalPieces

const isDone = ({ cutPieces, totalPieces }: CutProgress) =>
  totalPieces > 0 && cutPieces >= totalPieces

// The cutting canvas is the one screen in the app that owns the whole viewport: it runs on a tablet
// bolted next to the saw, where the only task is marking pieces cut and a scroll costs a gloved
// hand a second attempt. So it is a fixed three-row shell — top bar, diagram, one action — over the
// app's header and sidebar, sized to fit the smallest panel in the shop (960×544 CSS on the Infinix
// XPad, ~1080×735 on the iPad). The Fullscreen API sits ON TOP of that, hosted on the whole shell
// rather than on the diagram, and its only extra job is reclaiming the browser's own toolbar.
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
  const addToast = useToastStore((s) => s.addToast)

  const [cutModal, setCutModal] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Board currently on screen (one at a time). Identified by persistent id to survive refetches.
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)

  const {
    containerRef,
    isFullscreen,
    isSupported: fullscreenSupported,
    toggle: toggleFullscreen,
  } = useFullscreen<HTMLDivElement>()
  // Modals must portal INSIDE the fullscreen host: document.body sits outside the fullscreen
  // element, so anything portaled there mounts but is never painted.
  const modalContainer = useCallback(() => containerRef.current, [containerRef])

  // The shell is fixed and covers everything, but the layout's `min-vh-100` wrapper is still behind
  // it — on iOS that rubber-bands under the fixed element. Locking the body is what makes "no
  // scroll" true rather than merely invisible.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

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

  const interactive = plan?.status === 'cutting'

  // Single tap marks a piece as cut; tapping an already-cut piece does nothing (double-tap unmarks it).
  // Once the cut is confirmed server-side, dispatch its label to the branch's thermal printer —
  // skipped when the branch has no such printer (the backend would skip it anyway; not firing
  // keeps the cut from costing a pointless round trip on every single piece).
  //
  // Failures go to a toast rather than an alert on the page: an alert would push the layout that
  // exists precisely so nothing has to scroll.
  const onPieceTap = (piece: CutPiece) => {
    if (!id || piece.cut) return
    markPiece.mutate(
      { pieceId: piece.id, cut: true },
      {
        onSuccess: () => {
          if (plan?.printLabelsEnabled) printLabel.mutate({ orderId: id, pieceId: piece.id })
        },
        onError: (e) => addToast(e?.message || 'No se pudo marcar la pieza.', 'danger'),
      },
    )
  }

  // Double-tap = unmark, no confirmation required.
  const onPieceUntap = (piece: CutPiece) => {
    if (!id || !piece.cut) return
    markPiece.mutate(
      { pieceId: piece.id, cut: false },
      { onError: (e) => addToast(e?.message || 'No se pudo desmarcar la pieza.', 'danger') },
    )
  }

  const changeStatus = (status: 'cutting' | 'cut', onDone?: () => void) => {
    if (!id) return
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => onDone?.(),
        onError: (e) => addToast(e?.message || 'Error al cambiar estado.', 'danger'),
      },
    )
  }

  const backToOrder = () => void navigate(isOperator ? '/orders' : `/orders/${id}`)
  const backLabel = isOperator ? 'Volver a órdenes' : 'Volver a la orden'

  // Every state paints inside the shell, so the app chrome stays hidden even while loading or after
  // a failure — a screen that grows a sidebar for one second and loses it again reads as a glitch.
  const shell = (children: ReactNode) => (
    <div ref={containerRef} className="workshop-shell">
      {children}
      {/* Fullscreen renders only this subtree, and the layout's toaster sits outside it. */}
      {isFullscreen && <AppToaster />}
    </div>
  )

  if (isLoading) {
    return shell(
      <div className="d-flex align-items-center justify-content-center h-100">
        <CSpinner color="primary" />
      </div>,
    )
  }

  if (isError || !plan) {
    return shell(
      <div className="p-3">
        <CButton variant="ghost" color="secondary" size="lg" className="mb-3" onClick={backToOrder}>
          <CIcon icon={cilArrowLeft} className="me-1" />
          {backLabel}
        </CButton>
        <CAlert color="danger">{error?.message || 'No se pudo cargar el plan de corte.'}</CAlert>
      </div>,
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

  const topBar = (
    <div className="workshop-topbar">
      <CButton
        color="secondary"
        variant="ghost"
        size="lg"
        title={backLabel}
        aria-label={backLabel}
        onClick={backToOrder}
      >
        <CIcon icon={cilArrowLeft} size="lg" />
      </CButton>

      <div className="workshop-identity">
        <strong className="text-nowrap">{plan.orderCode}</strong>
        <OrderStatusBadge status={plan.status} />
        {order?.bandingStatus && order.bandingStatus !== 'not_applicable' && (
          <span className="workshop-banding-badge">
            <BandingStatusBadge status={order.bandingStatus} />
          </span>
        )}
        {/* No "solo lectura" label: the status badge already says `Cortada`, the action bar is gone
            and the pieces carry no pointer affordance — a third copy only cost the width that
            truncated the badges next to it. */}
        {/* Which job of this client is on the saw. First thing to go when the bar runs out of room. */}
        <ReferenceNote notes={plan.notes} maxWidth={220} className="d-none d-xl-block" />
      </div>

      {current && (
        <div className="workshop-pager">
          <CButton
            color="secondary"
            variant="outline"
            size="lg"
            disabled={safeIndex === 0}
            title="Tablero anterior"
            aria-label="Tablero anterior"
            onClick={() => goTo(safeIndex - 1)}
          >
            <CIcon icon={cilArrowLeft} />
          </CButton>
          <CButton
            color="secondary"
            variant="outline"
            size="lg"
            className="workshop-pager__label"
            title="Ver todos los tableros"
            onClick={() => setPickerOpen(true)}
          >
            <span className="fw-semibold">Tablero {current.sheetNumber}</span>
            <span className="text-body-secondary">
              {/* Which of how many boards: the first thing to go on a narrow panel, since `‹ ›`
                  and the picker already say there are others. The cut count stays — it is the
                  reason to look at the label at all. */}
              <span className="d-none d-md-inline">
                {' '}
                · {safeIndex + 1}/{boards.length}
              </span>{' '}
              · {current.progress.cutPieces}/{current.progress.totalPieces}
            </span>
          </CButton>
          <CButton
            color="secondary"
            variant="outline"
            size="lg"
            disabled={safeIndex === boards.length - 1}
            title="Tablero siguiente"
            aria-label="Tablero siguiente"
            onClick={() => goTo(safeIndex + 1)}
          >
            <CIcon icon={cilArrowRight} />
          </CButton>
        </div>
      )}

      <div className="workshop-total">
        <span className="fw-semibold text-nowrap">
          {plan.progress.cutPieces}/{plan.progress.totalPieces}
        </span>
        <CProgress height={8} className="workshop-total__bar">
          <CProgressBar
            value={pct(plan.progress)}
            color={isDone(plan.progress) ? 'success' : 'primary'}
          />
        </CProgress>
      </div>

      {fullscreenSupported && (
        <CButton
          color="secondary"
          variant="outline"
          size="lg"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          onClick={toggleFullscreen}
        >
          <CIcon icon={isFullscreen ? cilFullscreenExit : cilFullscreen} />
        </CButton>
      )}
    </div>
  )

  if (boards.length === 0 || !current) {
    return shell(
      <>
        {topBar}
        <div className="p-3">
          <CAlert color="info" className="mb-0">
            Esta orden no tiene tableros en su plan de corte.
          </CAlert>
        </div>
      </>,
    )
  }

  const pendingCount = plan.progress.totalPieces - plan.progress.cutPieces
  // A board that is done while others are pending, and "everything is cut", are mutually exclusive:
  // `pendingNext` is null exactly when the order can be closed. So one primary action is enough.
  const nextTarget = !hasPending(current.progress) ? pendingNext : null

  let actionBar: ReactNode = null
  if (plan.status === 'queued') {
    actionBar = isAdminOrOperator ? (
      <CButton
        color="primary"
        size="lg"
        className="ms-auto"
        disabled={updateStatus.isPending}
        onClick={() => changeStatus('cutting')}
      >
        {updateStatus.isPending ? <CSpinner size="sm" /> : 'Tomar esta orden'}
      </CButton>
    ) : (
      <span className="text-body-secondary">
        Disponible en la cola. Toma la orden para empezar a cortar.
      </span>
    )
  } else if (interactive) {
    actionBar = nextTarget ? (
      <CButton
        color="success"
        size="lg"
        className="ms-auto"
        onClick={() => setSelectedBoardId(nextTarget.id)}
      >
        Tablero {current.sheetNumber} completo — Ir al Tablero {nextTarget.sheetNumber} →
      </CButton>
    ) : (
      <>
        {pendingCount > 0 && (
          <span className="text-warning-emphasis">Faltan {pendingCount} pieza(s) por cortar</span>
        )}
        {/* The API is the authoritative guard (422 if pieces are missing); disabling is UX only. */}
        <CButton
          color="primary"
          size="lg"
          className="ms-auto"
          disabled={pendingCount > 0 || updateStatus.isPending}
          onClick={() => setCutModal(true)}
        >
          <CIcon icon={cilCheckAlt} className="me-1" />
          Marcar orden como cortada
        </CButton>
      </>
    )
  }

  return shell(
    <>
      {topBar}

      <div className="workshop-stage-wrap">
        <WorkshopBoardSvg
          key={current.id}
          board={current}
          colorFor={colorFor}
          interactive={!!interactive}
          onPieceTap={onPieceTap}
          onPieceUntap={onPieceUntap}
          onPrevBoard={safeIndex > 0 ? () => goTo(safeIndex - 1) : undefined}
          onNextBoard={safeIndex < boards.length - 1 ? () => goTo(safeIndex + 1) : undefined}
        />
        {/* Which physical board this is, over the letterbox margin the sheet leaves anyway: it
            names what is on screen and costs no row. */}
        <div className="workshop-boardname">
          <span className="text-truncate">{stripHalfSuffix(current.productName)}</span>
          {current.halfBoard && <CBadge color="info">½ medio</CBadge>}
        </div>
      </div>

      {/* A read-only order has nothing to act on, so the bar goes and the diagram takes its height. */}
      {actionBar && <div className="workshop-actionbar">{actionBar}</div>}

      <WorkshopBoardPicker
        visible={pickerOpen}
        boards={boards}
        currentId={current.id}
        container={modalContainer}
        onSelect={(boardId) => {
          setSelectedBoardId(boardId)
          setPickerOpen(false)
        }}
        onClose={() => setPickerOpen(false)}
      />

      {/* Confirm cut close (order → cortada) */}
      <CModal
        visible={cutModal}
        onClose={() => setCutModal(false)}
        container={modalContainer}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Marcar como cortada</CModalTitle>
        </CModalHeader>
        <CModalBody>
          ¿Marcar la orden <strong>{plan.orderCode}</strong> como <strong>cortada</strong>? Esto
          cierra el corte y la vista pasará a solo lectura.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" size="lg" onClick={() => setCutModal(false)}>
            Cancelar
          </CButton>
          <CButton
            color="primary"
            size="lg"
            onClick={() => changeStatus('cut', () => setCutModal(false))}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? <CSpinner size="sm" /> : 'Marcar como cortada'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>,
  )
}

export default WorkshopPage
