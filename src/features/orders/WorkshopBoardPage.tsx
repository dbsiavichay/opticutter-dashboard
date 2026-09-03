// Shared card-grid board for the production floor: multi-order queue for operador (cutting) and
// canteador (banding), plus administrador. NOT to be confused with:
//   - WorkshopPage.tsx        → single order's cutting canvas, at /orders/:id/workshop
//   - WorkshopBoardSvg.tsx    → SVG renderer for ONE physical board/sheet within that canvas
// This file (WorkshopBoardPage) is the multi-order dashboard at /workshop-board.
//
// It is the landing page of `operador` and `canteador` (permissions.ts) — the only screen those two
// roles have — and it runs on a shop-floor touch panel: controls are `lg`, and nothing may depend on
// a hover (a `title=` says nothing there). It carries no page chrome of its own, like every other
// screen since the optimizer: the breadcrumb and the sidebar already name it, and a card wrapping a
// grid of cards only draws a second border.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  CAlert,
  CButton,
  CCol,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { cilArrowRight, cilCheckAlt, cilMediaPlay } from '@coreui/icons'

import { useHasRole } from 'src/features/auth/useAuth'
import { PRINT_JOBS_KEY, usePrintConsolidated } from 'src/features/print/usePrint'
import PrintJobsPanel from 'src/features/print/PrintJobsPanel'
import WorkshopQueueCard from './WorkshopQueueCard'
import WorkshopMaterialsModal from './WorkshopMaterialsModal'
import { useUpdateBanding, useUpdateOrderStatus, useWorkshopQueue } from './useOrders'
import type { BoardAction, CardAction, WorkshopQueueItem } from './types'

interface ConfirmState {
  kind: BoardAction
  item: WorkshopQueueItem
}

const ACTION_COPY: Record<
  BoardAction,
  { verb: string; label: string; color: 'primary' | 'success' }
> = {
  take: { verb: 'Tomar', label: 'Tomar', color: 'primary' },
  complete: { verb: 'Completar', label: 'Completar', color: 'success' },
  startBanding: { verb: 'Iniciar el canteado de', label: 'Iniciar canteado', color: 'primary' },
  finishBanding: { verb: 'Terminar el canteado de', label: 'Terminar canteado', color: 'success' },
}

// Head of the FIFO queue: the oldest order still waiting to be taken. Derived here rather than
// trusting the endpoint's order, so the "Siguiente" pill stays true whatever it decides to sort by.
const nextOrderId = (items: WorkshopQueueItem[]): number | null => {
  let head: WorkshopQueueItem | null = null
  for (const item of items) {
    if (item.status !== 'queued') continue
    if (!head || new Date(item.createdAt).getTime() < new Date(head.createdAt).getTime())
      head = item
  }
  return head?.orderId ?? null
}

const WorkshopBoardPage = () => {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useWorkshopQueue()
  const updateStatus = useUpdateOrderStatus()
  const updateBanding = useUpdateBanding()
  const printConsolidated = usePrintConsolidated()
  const canOperate = useHasRole('administrador', 'operador')
  const canBand = useHasRole('administrador', 'canteador')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  // One dialog for the whole board rather than one per card: only one can be open at a time, and it
  // pages through the queue. State is the ORDER ID, not the index the dialog's API speaks: the queue
  // polls, so an index would keep pointing at a slot after the order in it was completed elsewhere —
  // silently showing a different order's materials.
  const [materialsId, setMaterialsId] = useState<number | null>(null)
  const materialsIndex = items.findIndex((item) => item.orderId === materialsId)

  const nextId = useMemo(() => nextOrderId(items), [items])

  const runAction = (kind: BoardAction, item: WorkshopQueueItem) => {
    const id = String(item.orderId)
    if (kind === 'take') updateStatus.mutate({ id, data: { status: 'cutting' } })
    // On completion, dispatch the consolidated sheet to the branch's inkjet — unless that branch
    // has no sheet printer. Every role that can complete from this board (operador/canteador/admin)
    // also holds `orders:workshop`. The switch is per item: the admin's board spans every branch.
    else if (kind === 'complete')
      updateStatus.mutate(
        { id, data: { status: 'completed' } },
        {
          onSuccess: () => {
            if (!item.printConsolidatedEnabled) return
            printConsolidated.mutate(
              { orderId: id },
              // Surface the new job in the panel right away instead of waiting for the poll.
              { onSuccess: () => void qc.invalidateQueries({ queryKey: PRINT_JOBS_KEY }) },
            )
          },
        },
      )
    else if (kind === 'startBanding') updateBanding.mutate({ id, data: { status: 'in_progress' } })
    else if (kind === 'finishBanding') updateBanding.mutate({ id, data: { status: 'done' } })
  }

  const confirmAction = () => {
    if (!confirm) return
    runAction(confirm.kind, confirm.item)
    setConfirm(null)
  }

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <>
      <PrintJobsPanel />

      {error ? (
        <CAlert color="danger">{error.message || 'No se pudo cargar el tablero de taller.'}</CAlert>
      ) : items.length === 0 ? (
        <div className="text-center text-body-secondary py-5">No hay órdenes en el tablero.</div>
      ) : (
        <CRow className="g-3">
          {items.map((item) => {
            const bandingBlocked =
              item.bandingStatus === 'pending' || item.bandingStatus === 'in_progress'
            const idStr = String(item.orderId)

            let operatorAction: CardAction | null = null
            if (canOperate) {
              if (item.status === 'queued') {
                operatorAction = {
                  kind: 'take',
                  label: 'Tomar',
                  color: 'primary',
                  icon: cilMediaPlay,
                }
              } else if (item.status === 'cutting') {
                operatorAction = {
                  kind: 'complete',
                  label: 'Abrir taller',
                  color: 'primary',
                  icon: cilArrowRight,
                  nav: true,
                }
              } else if (item.status === 'cut') {
                operatorAction = {
                  kind: 'complete',
                  label: 'Completar',
                  color: 'success',
                  icon: cilCheckAlt,
                  disabled: bandingBlocked,
                  title: bandingBlocked ? 'Falta terminar el canteado' : undefined,
                }
              }
            }

            let bandingAction: CardAction | null = null
            if (canBand) {
              if (
                (item.status === 'cutting' || item.status === 'cut') &&
                item.bandingStatus === 'pending'
              ) {
                bandingAction = {
                  kind: 'startBanding',
                  label: 'Iniciar canteado',
                  color: 'primary',
                  icon: cilMediaPlay,
                }
              } else if (
                (item.status === 'cutting' || item.status === 'cut') &&
                item.bandingStatus === 'in_progress'
              ) {
                bandingAction = {
                  kind: 'finishBanding',
                  label: 'Terminar canteado',
                  color: 'success',
                  icon: cilCheckAlt,
                }
              } else if (
                item.status === 'cut' &&
                (item.bandingStatus === 'done' || item.bandingStatus === 'not_applicable')
              ) {
                bandingAction = {
                  kind: 'complete',
                  label: 'Completar',
                  color: 'success',
                  icon: cilCheckAlt,
                }
              }
            }

            // Dedupe: administrador with both gates on the same order shouldn't see two
            // identical "Completar" buttons.
            if (operatorAction && bandingAction && operatorAction.kind === bandingAction.kind) {
              bandingAction = null
            }

            // Both the pending and the error state are scoped to the card that acted: the two
            // mutations are shared by the whole page, so an unscoped `isPending` froze the buttons
            // of every other order on the board while one request was in flight.
            const acting = updateStatus.variables?.id === idStr
            const bandingActing = updateBanding.variables?.id === idStr
            const statusError =
              updateStatus.isError && acting
                ? updateStatus.error?.message || 'No se pudo actualizar la orden.'
                : null
            const bandingError =
              updateBanding.isError && bandingActing
                ? updateBanding.error?.message || 'No se pudo actualizar el canteado.'
                : null

            return (
              <CCol key={item.orderId} xs={12} md={6} xxl={4}>
                <WorkshopQueueCard
                  item={item}
                  isNext={item.orderId === nextId}
                  operatorAction={operatorAction}
                  bandingAction={bandingAction}
                  statusPending={updateStatus.isPending && acting}
                  bandingPending={updateBanding.isPending && bandingActing}
                  statusError={statusError}
                  bandingError={bandingError}
                  onAction={(action) => {
                    if (action.nav) void navigate(`/orders/${item.orderId}/workshop`)
                    else setConfirm({ kind: action.kind, item })
                  }}
                  onShowMaterials={() => setMaterialsId(item.orderId)}
                />
              </CCol>
            )
          })}
        </CRow>
      )}

      <WorkshopMaterialsModal
        items={items}
        index={materialsIndex < 0 ? null : materialsIndex}
        onIndexChange={(next) => setMaterialsId(items[next]?.orderId ?? null)}
        onClose={() => setMaterialsId(null)}
      />

      <CModal visible={!!confirm} onClose={() => setConfirm(null)}>
        <CModalHeader>
          <CModalTitle>Confirmar acción</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="mb-0 fs-5">
            ¿{confirm && ACTION_COPY[confirm.kind].verb} la orden{' '}
            <strong>{confirm?.item.orderCode}</strong>?
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" size="lg" onClick={() => setConfirm(null)}>
            Cancelar
          </CButton>
          {/* The verb, not a generic "Confirmar": on a touch panel the button you are about to press
              should say what it does. */}
          <CButton
            color={confirm ? ACTION_COPY[confirm.kind].color : 'primary'}
            size="lg"
            onClick={confirmAction}
          >
            {confirm ? ACTION_COPY[confirm.kind].label : 'Confirmar'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default WorkshopBoardPage
