import { CButton, CCard, CCardBody, CProgress, CProgressBar, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronRight } from '@coreui/icons'

import ReferenceNote from 'src/shared/components/ReferenceNote'
import { isOlderThan, relativeTime } from 'src/shared/utils/date'
import OrderStatusBadge from './OrderStatusBadge'
import BandingStatusBadge from './BandingStatusBadge'
import type { CardAction, WorkshopQueueItem } from './types'

const pct = ({ cutPieces, totalPieces }: WorkshopQueueItem['progress']) =>
  totalPieces > 0 ? Math.round((cutPieces / totalPieces) * 100) : 0

const isDone = ({ cutPieces, totalPieces }: WorkshopQueueItem['progress']) =>
  totalPieces > 0 && cutPieces >= totalPieces

// A queued order that has been waiting a full day is the thing a shop-floor board exists to give
// away. Only `queued`: once someone has taken it, elapsed time is no longer anybody's cue.
const STALE_MS = 24 * 60 * 60 * 1000

// One line standing in for the whole material list: how much there is to cut, and how much banding
// to run. A real order carries six boards and four banding lines; printing them all made the card
// taller than the queue it sits in. The count of DISTINCT products is deliberately not here — it
// changes no decision the board asks for; it belongs in the modal's totals row.
const materialsSummary = ({ boardUsage, bandingUsage }: WorkshopQueueItem): string => {
  const sheets = boardUsage.reduce((n, board) => n + board.count, 0)
  const meters = bandingUsage.reduce((m, banding) => m + banding.linearM, 0)
  const parts: string[] = []
  if (sheets > 0) parts.push(`${sheets} ${sheets === 1 ? 'tablero' : 'tableros'}`)
  if (meters > 0) parts.push(`${meters.toFixed(1)} m de tapacanto`)
  return parts.join(' · ')
}

interface WorkshopQueueCardProps {
  item: WorkshopQueueItem
  // Head of the FIFO queue, computed by the page across every item.
  isNext: boolean
  operatorAction: CardAction | null
  bandingAction: CardAction | null
  // Scoped to THIS card: a shared mutation's `isPending` would freeze every card on the board.
  statusPending: boolean
  bandingPending: boolean
  statusError: string | null
  bandingError: string | null
  onAction: (action: CardAction) => void
  onShowMaterials: () => void
}

const WorkshopQueueCard = ({
  item,
  isNext,
  operatorAction,
  bandingAction,
  statusPending,
  bandingPending,
  statusError,
  bandingError,
  onAction,
  onShowMaterials,
}: WorkshopQueueCardProps) => {
  const showBanding = item.bandingStatus !== 'not_applicable'
  const isStale = item.status === 'queued' && isOlderThan(item.createdAt, STALE_MS)
  const summary = materialsSummary(item)

  return (
    <CCard className="workshop-card h-100" data-status={item.status}>
      <CCardBody className="d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div className="d-flex flex-column gap-1">
            {isNext && <span className="workshop-next">Siguiente</span>}
            <span className="fs-4 fw-bold">{item.orderCode ?? '—'}</span>
          </div>
          {/* Both tracks as plain badges. Their own labels already say which is which — "Canteado
              pendiente" names its track, and "En cola / En corte / Cortada" read as the order's
              state — so a rubric over each one was scaffolding around something self-describing. */}
          <div className="d-flex flex-wrap justify-content-end gap-1">
            <OrderStatusBadge status={item.status} />
            {showBanding && <BandingStatusBadge status={item.bandingStatus} />}
          </div>
        </div>

        <div>
          <div className="fw-semibold">
            {item.client.firstName} {item.client.lastName}
          </div>
          {/* Reference (project/site): tells apart several orders of the same client. */}
          <ReferenceNote notes={item.notes} variant="header" />
        </div>

        {/* The whole line is the target, not a link at its end: on a touch panel the row is the
            control. What it opens is the one thing the summary cannot say — WHICH materials. */}
        {summary && (
          <button type="button" className="usage-summary" onClick={onShowMaterials}>
            <span>
              <span className="usage-label d-block">Materiales</span>
              <span className="fw-semibold">{summary}</span>
            </span>
            <CIcon icon={cilChevronRight} className="usage-summary__chevron" />
          </button>
        )}

        {item.progress.totalPieces > 0 && (
          <div className="d-flex align-items-center gap-3">
            <CProgress className="flex-grow-1">
              <CProgressBar
                value={pct(item.progress)}
                color={isDone(item.progress) ? 'success' : 'primary'}
              />
            </CProgress>
            <span className="fw-semibold text-nowrap">
              {item.progress.cutPieces}/{item.progress.totalPieces} piezas
            </span>
          </div>
        )}

        <div className={isStale ? 'text-warning-emphasis fw-semibold' : 'text-body-secondary'}>
          En cola {relativeTime(item.createdAt)}
        </div>

        <div className="d-flex gap-2 mt-auto">
          {operatorAction && (
            <CButton
              color={operatorAction.color}
              size="lg"
              className="flex-fill"
              disabled={operatorAction.disabled || statusPending}
              title={operatorAction.title}
              onClick={() => onAction(operatorAction)}
            >
              {statusPending ? (
                <CSpinner size="sm" className="me-1" />
              ) : (
                <CIcon icon={operatorAction.icon} className="me-1" />
              )}
              {operatorAction.label}
            </CButton>
          )}
          {bandingAction && (
            <CButton
              color={bandingAction.color}
              size="lg"
              className="flex-fill"
              disabled={bandingPending}
              onClick={() => onAction(bandingAction)}
            >
              {bandingPending ? (
                <CSpinner size="sm" className="me-1" />
              ) : (
                <CIcon icon={bandingAction.icon} className="me-1" />
              )}
              {bandingAction.label}
            </CButton>
          )}
        </div>

        {statusError && <div className="text-danger small">{statusError}</div>}
        {bandingError && <div className="text-danger small">{bandingError}</div>}
      </CCardBody>
    </CCard>
  )
}

export default WorkshopQueueCard
