import { useEffect } from 'react'
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronLeft, cilChevronRight } from '@coreui/icons'

import { sygnet } from 'src/assets/brand/sygnet'
import { useSwipeNav } from 'src/shared/hooks/useSwipeNav'
import OrderStatusBadge from './OrderStatusBadge'
import BandingStatusBadge from './BandingStatusBadge'
import type { WorkshopQueueItem } from './types'

interface WorkshopMaterialsModalProps {
  // The whole queue, in board order: the dialog pages through it so the materials of a shift's worth
  // of orders can be reviewed without closing and reopening once per card.
  items: WorkshopQueueItem[]
  // Position in `items`; `null` keeps the dialog closed. Same shape as the optimizer's
  // `SheetDetailModal`, which pages the same way.
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}

// The full material list for one queued order, opened from the card's summary line. It lives here
// rather than on the card because a queue of a dozen orders would otherwise mount a dozen dialogs,
// and only one can ever be open.
//
// Both lists are `.summary-table`s with the same vocabulary the optimizer's own materials table uses
// ("Tablero", "Cant."), so a vendedor and an operador read the same words for the same thing. The
// totals sit in a `<tfoot>`, where a proforma puts them — and where "N materiales" is finally worth
// printing: on the card it was a number that changed no decision. Only from two rows up: under a
// single row the total restates that row.
const WorkshopMaterialsModal = ({
  items,
  index,
  onIndexChange,
  onClose,
}: WorkshopMaterialsModalProps) => {
  const item = index == null ? undefined : items[index]
  const boards = item?.boardUsage ?? []
  const banding = item?.bandingUsage ?? []
  const sheets = boards.reduce((n, board) => n + board.count, 0)
  const meters = banding.reduce((m, line) => m + line.linearM, 0)
  const showBanding = !!item && item.bandingStatus !== 'not_applicable'
  const hasPrev = index != null && index > 0
  const hasNext = index != null && index < items.length - 1

  // The swipe is a shortcut, never the only way through: the shop floor is gloved hands on a dusty
  // panel, where a drag fails far more often than a tap, so `‹ ›` stay in the header regardless.
  const swipeRef = useSwipeNav({
    enabled: index != null,
    onPrev: () => hasPrev && index != null && onIndexChange(index - 1),
    onNext: () => hasNext && index != null && onIndexChange(index + 1),
  })

  // Arrow keys page between orders, the same way the cut-diagram modal pages between sheets. Nothing
  // in this dialog takes typed input, so they cost no field its own arrows.
  useEffect(() => {
    if (index == null) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < items.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, onIndexChange])

  return (
    <CModal
      size="lg"
      visible={!!item}
      onClose={onClose}
      alignment="center"
      // Below `lg` Bootstrap has already dropped `.modal-lg`'s 800px cap, so the dialog is edge to
      // edge and only keeps a half-rem margin and rounded corners that say nothing — while the tables
      // still do not get the height. `md` would leave the 768–991 tablet, which is the shop panel,
      // in exactly that state.
      fullscreen="lg"
    >
      <CModalHeader className="materials-header">
        <div className="materials-headline">
          {/* The isotype is three stacked boards — the subject of this dialog, not decoration. */}
          <CIcon icon={sygnet} height={36} className="flex-shrink-0" />
          <div className="min-w-0">
            <div className="materials-eyebrow">Materiales de la orden</div>
            <CModalTitle className="materials-title">{item?.orderCode ?? '—'}</CModalTitle>
            {/* Who the order is for, because paging changes it under you: the code alone is not
                enough to tell you where you landed. */}
            <div className="materials-client">
              {item ? `${item.client.firstName} ${item.client.lastName}` : ''}
            </div>
          </div>
          <div className="materials-nav">
            <button
              type="button"
              className="materials-nav__btn"
              disabled={!hasPrev}
              aria-label="Orden anterior"
              onClick={() => index != null && onIndexChange(index - 1)}
            >
              <CIcon icon={cilChevronLeft} />
            </button>
            <span className="materials-nav__count">
              {index == null ? '' : `${index + 1} de ${items.length}`}
            </span>
            <button
              type="button"
              className="materials-nav__btn"
              disabled={!hasNext}
              aria-label="Orden siguiente"
              onClick={() => index != null && onIndexChange(index + 1)}
            >
              <CIcon icon={cilChevronRight} />
            </button>
          </div>
        </div>
      </CModalHeader>

      <CModalBody>
        {/* `touch-action: pan-y` on the wrapper hands vertical scrolling back to the browser and keeps
            the horizontal axis for the handler. */}
        <div ref={swipeRef} className="materials-swipe">
          {/* The order's two tracks, pinned to the top of the body rather than scattered over the two
            section headings. This dialog is a paging tool — the point of `‹ ›` is to review a shift's
            orders quickly — so the state has to be in ONE place that does not move under you as you
            page. On the body's neutral ground, not up on the coral band: these badges carry meaning
            in their colour, and blue-on-coral and amber-on-coral read as neither. */}
          {item && (
            <div className="materials-status d-flex flex-wrap gap-2">
              <OrderStatusBadge status={item.status} />
              {showBanding && <BandingStatusBadge status={item.bandingStatus} />}
            </div>
          )}

          <div className="usage-label mb-2">Tableros</div>
          <CTable small responsive className="summary-table materials-table mb-4">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Tablero</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Cant.</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {boards.length > 0 ? (
                boards.map((board) => (
                  <CTableRow key={board.name}>
                    <CTableDataCell>{board.name}</CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold">{board.count}×</CTableDataCell>
                  </CTableRow>
                ))
              ) : (
                <CTableRow>
                  <CTableDataCell colSpan={2} className="text-body-secondary">
                    Esta orden no registra tableros.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
            {boards.length > 1 && (
              <CTableFoot>
                <CTableRow>
                  <CTableDataCell className="fw-semibold">
                    {boards.length} {boards.length === 1 ? 'material' : 'materiales'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end fw-semibold">{sheets}×</CTableDataCell>
                </CTableRow>
              </CTableFoot>
            )}
          </CTable>

          {/* Rendered whenever the order has a banding track, even with no lines yet: the badge is the
            canteador's cue and must not depend on the material list being populated. */}
          {showBanding && (
            <>
              <div className="usage-label mb-2">Tapacantos</div>
              <CTable small responsive className="summary-table materials-table mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Tapacanto</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Metros</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {banding.length > 0 ? (
                    banding.map((line) => (
                      <CTableRow key={line.name}>
                        <CTableDataCell>{line.name}</CTableDataCell>
                        <CTableDataCell className="text-end fw-semibold">
                          {line.linearM.toFixed(1)} m
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  ) : (
                    <CTableRow>
                      <CTableDataCell colSpan={2} className="text-body-secondary">
                        Sin tapacantos registrados.
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
                {banding.length > 1 && (
                  <CTableFoot>
                    <CTableRow>
                      <CTableDataCell className="fw-semibold">
                        {banding.length} {banding.length === 1 ? 'tapacanto' : 'tapacantos'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {meters.toFixed(1)} m
                      </CTableDataCell>
                    </CTableRow>
                  </CTableFoot>
                )}
              </CTable>
            </>
          )}
        </div>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" size="lg" onClick={onClose}>
          Cerrar
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default WorkshopMaterialsModal
