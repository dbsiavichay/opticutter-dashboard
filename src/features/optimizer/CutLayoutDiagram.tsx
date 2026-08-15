import { useEffect, useMemo, useState } from 'react'
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
import CIcon from '@coreui/icons-react'
import { cilFullscreen } from '@coreui/icons'

import SheetSvg from 'src/shared/components/SheetSvg'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import type { LayoutGroup, MaterialSummary, PlacedPiece } from './types'
import { usePieceColors } from './pieceColors'
import { GroupedPiecesList, PieceDetailCard, SheetStats } from './sheetDetail'

// One summary line + a fullscreen sheet viewer behind it. The optimizer wizard shows its sheets
// inline through `SheetViewer`; this is the pre-order detail page's diagram.
//
// It used to be a grid of pattern cards, each with a thumbnail, an efficiency bar and a stats strip.
// On a real quote that is two or three rows of cards — the single tallest thing on a page whose job
// is to be read at a glance, and every card was a link to the same modal. So the grid collapsed to
// the numbers it was summarising, and the modal it opened became the diagram itself.

// --- Sheet detail modal ---

interface SheetDetailModalProps {
  groups: LayoutGroup[]
  // Index of the open sheet within `groups`; null = closed. Owned by the parent so the modal can
  // page between sheets without closing.
  index: number | null
  onIndexChange: (i: number) => void
  materialNameFor: (materialKey: string) => string
  colorFor: (sig: string) => string
  // Where to portal the modal. Needed so it stays inside the element put into fullscreen —
  // document.body sits outside it and the modal would render invisibly behind the page.
  container?: () => Element | null
  onClose: () => void
}

const SheetDetailModal = ({
  groups,
  index,
  onIndexChange,
  materialNameFor,
  colorFor,
  container,
  onClose,
}: SheetDetailModalProps) => {
  const [hoverPiece, setHoverPiece] = useState<PlacedPiece | null>(null)
  const [hoverSig, setHoverSig] = useState<string | null>(null)
  const group = index == null ? null : (groups[index] ?? null)

  // Paging to another sheet must not carry the previous sheet's hover state into the detail panel.
  // Adjusted during render (React's reset-on-prop-change) rather than in an effect.
  const [shownGroup, setShownGroup] = useState(group)
  if (group !== shownGroup) {
    setShownGroup(group)
    setHoverPiece(null)
    setHoverSig(null)
  }

  const hasPrev = index != null && index > 0
  const hasNext = index != null && index < groups.length - 1
  const go = (delta: number) => {
    if (index != null) onIndexChange(index + delta)
  }

  // Arrow keys page between sheets, matching the public review modal.
  useEffect(() => {
    if (index == null) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < groups.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, groups.length, onIndexChange])

  const layout = group?.layout
  const materialName = group ? materialNameFor(group.materialKey) : ''

  return (
    <CModal
      visible={index != null}
      onClose={onClose}
      // Fullscreen, not a centered `xl`: this is now the only way to see the plan, and the page it
      // opens over is `fluid`. A 1140px dialog would have shown the sheet smaller than the grid did.
      fullscreen
      scrollable
      container={container}
    >
      <CModalHeader>
        <CModalTitle className="d-flex align-items-center gap-2 flex-wrap">
          <span>
            {group ? `Patrón ${group.patternId}` : ''}
            {group && group.count > 1 ? ` · ×${group.count} hojas` : ''}
            {materialName ? ` · ${stripHalfSuffix(materialName)}` : ''}
          </span>
          {group?.layout.material.halfBoard && <CBadge color="info">½ medio</CBadge>}
        </CModalTitle>
      </CModalHeader>
      <CModalBody style={{ scrollbarGutter: 'stable' }}>
        {layout && (
          <CRow className="g-3">
            <CCol
              xs={12}
              lg={7}
              xxl={8}
              className="align-self-start sheet-overlay-stage"
              style={{ position: 'sticky', top: 0, zIndex: 1 }}
            >
              <SheetSvg
                // Remount per sheet so zoom/pan resets instead of carrying over from the previous
                // pattern, which would land the next one off-screen.
                key={index}
                layout={layout}
                colorFor={colorFor}
                highlightId={hoverPiece?.pieceId ?? null}
                dimSig={hoverSig}
                onPieceEnter={(p) => {
                  setHoverPiece(p)
                  setHoverSig(null)
                }}
                onPieceLeave={() => setHoverPiece(null)}
                // The column is sticky, so anything taller than the modal's scrollport can never be
                // scrolled into view: its bottom edge stays clipped right where the pager sits.
                // Reserve is the modal chrome around the body — header, footer, padding. No upper
                // cap now that the dialog is fullscreen: the sheet is what the screen is for.
                maxHeight="calc(100dvh - 12rem)"
                showDimensions
                enableZoom
              />
            </CCol>
            <CCol xs={12} lg={5} xxl={4}>
              <SheetStats layout={layout} />
              <PieceDetailCard piece={hoverPiece} colorFor={colorFor} />
              <GroupedPiecesList
                pieces={layout.placedPieces}
                colorFor={colorFor}
                hoverSig={hoverSig}
                onHover={setHoverSig}
              />
            </CCol>
          </CRow>
        )}
      </CModalBody>
      {groups.length > 1 && (
        // Paging between patterns without closing: checking one sheet against the next is the whole
        // point of the expanded view, and reopening from the grid each time loses the comparison.
        <CModalFooter className="justify-content-between">
          <CButton
            color="secondary"
            variant="outline"
            disabled={!hasPrev}
            onClick={() => go(-1)}
            aria-label="Hoja anterior"
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
            aria-label="Hoja siguiente"
          >
            Siguiente ›
          </CButton>
        </CModalFooter>
      )}
    </CModal>
  )
}

// --- Main diagram ---

interface CutLayoutDiagramProps {
  layoutGroups: LayoutGroup[]
  materialsSummary: MaterialSummary[]
  // Portal target for the expanded-sheet modal; see SheetDetailModalProps.container.
  modalContainer?: () => Element | null
}

const CutLayoutDiagram = ({
  layoutGroups,
  materialsSummary,
  modalContainer,
}: CutLayoutDiagramProps) => {
  // The open sheet is held as an INDEX, not the group object, so the modal can page to the next one.
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

  const { colorFor } = usePieceColors(layoutGroups)

  const materialName = (materialKey: string) => {
    const m = materialsSummary.find((x) => x.materialKey === materialKey)
    if (!m) return materialKey
    return m.productName ?? m.productCode ?? `${m.width}×${m.height}×${m.thickness} mm`
  }

  // Weighted by `count`: a pattern repeated over four sheets weighs four times one used once, which
  // is what "aprovechamiento del plan" means. A plain mean would let a single offcut sheet drag the
  // whole figure down.
  const totals = useMemo(() => {
    let sheets = 0
    let pieces = 0
    let effSum = 0
    for (const g of layoutGroups) {
      sheets += g.count
      pieces += g.layout.statistics.piecesCount * g.count
      effSum += g.layout.statistics.efficiency * g.count
    }
    return { sheets, pieces, efficiency: sheets > 0 ? effSum / sheets : 0 }
  }, [layoutGroups])

  if (!layoutGroups.length) return null

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  return (
    <div>
      {/* No colour key either. It listed every distinct measurement in the plan — a dozen swatches
          on a busy quote — to explain a colour that identifies nothing on its own: the sheets label
          each piece with its own measurement already. Hovering a piece inside the viewer still dims
          the rest, which is what the key was actually used for. */}
      <div className="d-flex flex-wrap align-items-center gap-2 border rounded-3 p-2 mb-3">
        <span className="small text-body-secondary text-uppercase fw-semibold">
          Diagrama de cortes
        </span>
        <span className="small">
          <strong>{layoutGroups.length}</strong> {plural(layoutGroups.length, 'patrón', 'patrones')}{' '}
          · <strong>{totals.sheets}</strong> {plural(totals.sheets, 'tablero', 'tableros')} ·{' '}
          <strong>{totals.pieces}</strong> {plural(totals.pieces, 'pieza', 'piezas')}
        </span>
        {/* The one number worth a colour: below 80% the plan is worth a second look. It was the
            badge on every pattern card; one figure for the whole plan says the same thing. */}
        <CBadge color={totals.efficiency >= 80 ? 'success' : 'warning'}>
          {totals.efficiency.toFixed(1)}% aprovechamiento
        </CBadge>
        <CButton
          size="sm"
          color="primary"
          variant="outline"
          className="ms-auto"
          onClick={() => setDetailIndex(0)}
        >
          <CIcon icon={cilFullscreen} className="me-1" />
          Ver diagrama
        </CButton>
      </div>

      <SheetDetailModal
        groups={layoutGroups}
        index={detailIndex}
        onIndexChange={setDetailIndex}
        materialNameFor={materialName}
        colorFor={colorFor}
        container={modalContainer}
        onClose={() => setDetailIndex(null)}
      />
    </div>
  )
}

export default CutLayoutDiagram
