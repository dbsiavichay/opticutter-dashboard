import { useEffect, useState } from 'react'
import {
  CBadge,
  CButton,
  CCol,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'

import SheetSvg from 'src/shared/components/SheetSvg'
import CantoPreview from 'src/shared/components/CantoPreview'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import { pieceLabel } from 'src/shared/utils/cutDrawing'
import { cantoNotation, cantoSides, edgesLabel } from './format'
import type { ReviewLayoutGroup, ReviewPlacedPiece } from './types'

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="d-flex justify-content-between gap-3 py-2 border-bottom">
    <span className="text-body-secondary small">{label}</span>
    <span className="small fw-semibold text-end">{value}</span>
  </div>
)

// Detail of the tapped piece. Tap — not hover — because this view is opened on a phone more often
// than not, and there is no cursor to hover with.
const PieceDetail = ({ piece }: { piece: ReviewPlacedPiece | null }) => {
  if (!piece) {
    return (
      <div className="border rounded p-3 text-body-secondary small text-center">
        Toca una pieza del tablero para ver su detalle.
      </div>
    )
  }
  const label = pieceLabel(piece.pieceId)
  return (
    <div className="border rounded p-3">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <strong>{label || 'Pieza'}</strong>
        {piece.edges?.sides?.length ? <CantoPreview sides={cantoSides(piece.edges)} /> : null}
      </div>
      <Detail label="Medida" value={`${piece.originalWidth} × ${piece.originalHeight} mm`} />
      <Detail label="Cantos" value={edgesLabel(piece.edges)} />
      {piece.edges?.sides?.length ? (
        <Detail label="Notación" value={cantoNotation(piece.edges)} />
      ) : null}
      {piece.edges?.color && <Detail label="Color del canto" value={piece.edges.color} />}
      {piece.rotated && (
        <div className="text-body-secondary small mt-2">
          Esta pieza se dibuja girada para aprovechar mejor el tablero. La medida que recibes es la
          de arriba.
        </div>
      )}
    </div>
  )
}

interface ReviewSheetModalProps {
  groups: ReviewLayoutGroup[]
  // Index of the open sheet within `groups`; null means the modal is closed.
  index: number | null
  onIndexChange: (i: number) => void
  colorFor: (sig: string) => string
  titleFor: (index: number) => string
  onClose: () => void
}

const ReviewSheetModal = ({
  groups,
  index,
  onIndexChange,
  colorFor,
  titleFor,
  onClose,
}: ReviewSheetModalProps) => {
  const [selected, setSelected] = useState<ReviewPlacedPiece | null>(null)
  const group = index == null ? null : (groups[index] ?? null)

  // A new sheet starts with no selection, otherwise the panel shows a piece from the previous one.
  // Adjusted during render (React's recommended reset-on-prop-change) rather than in an effect.
  const [shownGroup, setShownGroup] = useState(group)
  if (group !== shownGroup) {
    setShownGroup(group)
    setSelected(null)
  }

  const hasPrev = index != null && index > 0
  const hasNext = index != null && index < groups.length - 1
  const go = (delta: number) => {
    if (index != null) onIndexChange(index + delta)
  }

  // Arrow keys move between sheets on desktop, where a keyboard is the natural way to page through.
  useEffect(() => {
    if (index == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < groups.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, groups.length, onIndexChange])

  return (
    <CModal
      visible={index != null}
      onClose={onClose}
      size="xl"
      fullscreen="lg"
      scrollable
      alignment="center"
    >
      <CModalHeader>
        <CModalTitle className="fs-6 d-flex align-items-center gap-2 flex-wrap">
          <span>{index == null ? '' : titleFor(index)}</span>
          {group?.sheet.halfBoard && <CBadge color="info">½ medio</CBadge>}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {group && (
          <CRow className="g-3">
            <CCol xs={12} lg={7}>
              <SheetSvg
                // Remount per sheet so the zoom/pan resets instead of carrying over from the
                // previous board, which would land the next one off-screen.
                key={index}
                layout={{
                  material: group.sheet,
                  placedPieces: group.placedPieces,
                  remainders: group.remainders,
                }}
                colorFor={colorFor}
                highlightId={selected?.pieceId ?? null}
                onPieceTap={(p) => setSelected((cur) => (cur?.pieceId === p.pieceId ? null : p))}
                labelFor={(p) => pieceLabel(p.pieceId) || `${p.originalWidth}×${p.originalHeight}`}
                maxHeight={640}
                showDimensions
                enableZoom
              />
              <div className="text-body-secondary small mt-2 text-center">
                {stripHalfSuffix(group.sheet.materialName ?? undefined) ?? 'Tablero'} ·{' '}
                {group.sheet.width} × {group.sheet.height} mm · {group.piecesCount} piezas
              </div>
            </CCol>
            <CCol xs={12} lg={5}>
              <PieceDetail piece={selected} />
            </CCol>
          </CRow>
        )}
      </CModalBody>
      {groups.length > 1 && (
        // Paging between boards without closing: on a phone, going back out to the list and
        // finding the next card is the slowest part of reviewing a multi-board job.
        <CModalFooter className="justify-content-between">
          <CButton
            color="secondary"
            variant="outline"
            disabled={!hasPrev}
            onClick={() => go(-1)}
            aria-label="Tablero anterior"
          >
            ‹ Anterior
          </CButton>
          <span className="text-body-secondary small text-nowrap">
            {(index ?? 0) + 1} / {groups.length}
          </span>
          <CButton
            color="secondary"
            variant="outline"
            disabled={!hasNext}
            onClick={() => go(1)}
            aria-label="Tablero siguiente"
          >
            Siguiente ›
          </CButton>
        </CModalFooter>
      )}
    </CModal>
  )
}

export default ReviewSheetModal
