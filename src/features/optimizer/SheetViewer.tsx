import { useEffect, useId, useState } from 'react'
import { CBadge, CButton } from '@coreui/react'

import SheetSvg from 'src/shared/components/SheetSvg'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import type { LayoutGroup, MaterialSummary, PlacedPiece } from './types'
import { usePieceColors } from './pieceColors'
import { GroupedPiecesList, PieceDetailCard, SheetStats } from './sheetDetail'

// The expanded sheet, inline. This is what replaced the old "Ampliar" modal: in a step of its own
// the big board simply IS the view, so the pattern grid becomes a thumbnail rail for jumping
// between patterns instead of a grid of small sheets you have to open one by one.

const DETAIL_KEY = 'cutter:optimizer:sheetDetail:v1'

// Collapsed until asked for: the board is what this step exists to show, and the panel is a
// lookup for one piece at a time.
const loadDetailOpen = (): boolean => {
  try {
    return localStorage.getItem(DETAIL_KEY) === '1'
  } catch {
    return false
  }
}

const saveDetailOpen = (open: boolean): void => {
  try {
    localStorage.setItem(DETAIL_KEY, open ? '1' : '0')
  } catch {
    /* storage quota exceeded / private mode: the preference just won't persist */
  }
}

interface ThumbProps {
  group: LayoutGroup
  n: number
  active: boolean
  colorFor: (sig: string) => string
  onSelect: () => void
}

const Thumb = ({ group, n, active, colorFor, onSelect }: ThumbProps) => {
  const { statistics, material } = group.layout
  const efficiencyOk = statistics.efficiency >= 80
  return (
    <button
      type="button"
      className="sheet-thumb"
      data-active={active || undefined}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      title={`Patrón ${group.patternId} · ${material.width}×${material.height} mm · ${statistics.efficiency.toFixed(1)}%`}
    >
      <div className="d-flex justify-content-between align-items-center gap-1 mb-1">
        <span className="sheet-thumb-label">
          {n}
          {group.count > 1 && <span className="text-body-secondary"> ×{group.count}</span>}
        </span>
        <CBadge color={efficiencyOk ? 'success' : 'warning'}>
          {statistics.efficiency.toFixed(0)}%
        </CBadge>
      </div>
      <SheetSvg layout={group.layout} colorFor={colorFor} maxHeight={68} />
    </button>
  )
}

interface SheetViewerProps {
  layoutGroups: LayoutGroup[]
  materialsSummary: MaterialSummary[]
}

const SheetViewer = ({ layoutGroups, materialsSummary }: SheetViewerProps) => {
  const [index, setIndex] = useState(0)
  const [hoverPiece, setHoverPiece] = useState<PlacedPiece | null>(null)
  const [hoverSig, setHoverSig] = useState<string | null>(null)
  // Collapsing the side panel is what buys the board real width, so the choice is remembered:
  // whoever works without the piece detail wants it gone on every sheet, not once.
  const [detailOpen, setDetailOpen] = useState(loadDetailOpen)
  const detailId = `sheet-detail-${useId().replace(/:/g, '')}`

  const { colorFor } = usePieceColors(layoutGroups)

  // A new result can be shorter than the previous one, and the selected piece belongs to the sheet
  // that was on screen. Both are corrected during render rather than in an effect.
  const safeIndex = Math.min(index, Math.max(layoutGroups.length - 1, 0))
  const group = layoutGroups[safeIndex]
  const [shownGroup, setShownGroup] = useState(group)
  if (group !== shownGroup) {
    setShownGroup(group)
    setHoverPiece(null)
    setHoverSig(null)
  }

  // Arrow keys page between patterns, as the expanded modal used to. Inert while the user is typing
  // or a modal is open, so it never competes with a field.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable)
          return
      }
      if (document.body.classList.contains('modal-open')) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, layoutGroups.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layoutGroups.length])

  if (!layoutGroups.length || !group) return null

  const materialName = (materialKey: string) => {
    const m = materialsSummary.find((x) => x.materialKey === materialKey)
    if (!m) return materialKey
    return m.productName ?? m.productCode ?? `${m.width}×${m.height}×${m.thickness} mm`
  }

  const toggleDetail = () => {
    const next = !detailOpen
    setDetailOpen(next)
    saveDetailOpen(next)
  }

  const layout = group.layout
  const hasPrev = safeIndex > 0
  const hasNext = safeIndex < layoutGroups.length - 1

  return (
    <div className="sheet-viewer">
      {/* Thumbnail rail: a column beside the board from `xl`, a scrolling strip below it. */}
      <div className="sheet-thumbs">
        {layoutGroups.map((g, i) => (
          <Thumb
            key={g.patternId}
            group={g}
            n={i + 1}
            active={i === safeIndex}
            colorFor={colorFor}
            onSelect={() => setIndex(i)}
          />
        ))}
      </div>

      <div>
        <div className="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-semibold d-flex align-items-center gap-2">
            Patrón {group.patternId}
            {group.count > 1 && <CBadge color="secondary">×{group.count} hojas</CBadge>}
            <span className="text-body-secondary fw-normal small">
              {stripHalfSuffix(materialName(group.materialKey))}
            </span>
            {layout.material.halfBoard && <CBadge color="info">½ medio</CBadge>}
          </span>
          <div className="d-flex align-items-center gap-2">
            {layoutGroups.length > 1 && (
              <>
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={!hasPrev}
                  aria-label="Patrón anterior"
                  onClick={() => setIndex(safeIndex - 1)}
                >
                  ‹
                </CButton>
                <span className="text-body-secondary small text-nowrap">
                  {safeIndex + 1} / {layoutGroups.length}
                </span>
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={!hasNext}
                  aria-label="Patrón siguiente"
                  onClick={() => setIndex(safeIndex + 1)}
                >
                  ›
                </CButton>
              </>
            )}
          </div>
        </div>

        {/* Board, collapse handle, detail. A grid rather than a CRow so the handle can be a slim
            full-height bar between the two, the way a split divider reads. */}
        <div className="sheet-stage" data-detail={detailOpen ? 'open' : 'closed'}>
          <div>
            <SheetSvg
              // Remount per pattern so zoom/pan resets instead of carrying over and landing the
              // next sheet off-screen. The collapse state is in the key too: the board gets a new
              // width, and a stale pan would leave it off-centre.
              key={`${group.patternId}-${detailOpen ? 'd' : 'w'}`}
              layout={layout}
              colorFor={colorFor}
              highlightId={hoverPiece?.pieceId ?? null}
              dimSig={hoverSig}
              onPieceEnter={(p) => {
                setHoverPiece(p)
                setHoverSig(null)
              }}
              onPieceLeave={() => setHoverPiece(null)}
              // Tapping is the only way to inspect a piece on the workshop tablets.
              onPieceTap={(p) => {
                setHoverPiece(p)
                setHoverSig(null)
              }}
              // Boards are drawn portrait, so the render is height-bound: the width freed by
              // collapsing the panel does nothing on its own — the sheet just centres in a wider
              // column at the same size. Raising the cap is what turns the freed space into a
              // bigger board.
              maxHeight={
                detailOpen ? 'min(620px, calc(100dvh - 20rem))' : 'min(880px, calc(100dvh - 15rem))'
              }
              showDimensions
              enableZoom
              // Out of the handle's way: it occupies the board's right edge.
              zoomPlacement="top-left"
            />
          </div>

          <button
            type="button"
            className="sheet-detail-handle"
            aria-expanded={detailOpen}
            aria-controls={detailId}
            title={
              detailOpen
                ? 'Ocultar el detalle de la hoja y ampliar el tablero'
                : 'Mostrar el detalle de la hoja'
            }
            onClick={toggleDetail}
          >
            {/* Points where the click sends the panel: away to the right when it is open, back in
                from the right when it is collapsed. */}
            <span aria-hidden="true">{detailOpen ? '»' : '«'}</span>
            <span className="visually-hidden">
              {detailOpen ? 'Ocultar el detalle de la hoja' : 'Mostrar el detalle de la hoja'}
            </span>
          </button>

          {detailOpen && (
            <div id={detailId}>
              <SheetStats layout={layout} />
              <PieceDetailCard
                piece={hoverPiece}
                colorFor={colorFor}
                emptyHint="Pasa el cursor o toca una pieza del diagrama para ver su detalle."
              />
              <GroupedPiecesList
                pieces={layout.placedPieces}
                colorFor={colorFor}
                hoverSig={hoverSig}
                onHover={setHoverSig}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SheetViewer
