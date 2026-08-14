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
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import { clamp, pieceSig } from 'src/shared/utils/cutDrawing'
import type { LayoutGroup, MaterialSummary, PlacedPiece } from './types'
import { usePieceColors } from './pieceColors'
import { GroupedPiecesList, PieceDetailCard, PieceLegend, SheetStats } from './sheetDetail'

// Pattern grid + expanded-sheet modal. The optimizer wizard shows its sheets inline through
// `SheetViewer` instead; this stays for the pre-order detail page, which keeps the compact card
// grid because its page already has an editor and an action bar competing for height.

// --- Pattern card in the grid ---

interface PatternCardProps {
  group: LayoutGroup
  colorFor: (sig: string) => string
  hoveredSig: string | null
  setHoveredSig: (sig: string | null) => void
  materialName: string
  onOpen: () => void
}

const PatternCard = ({
  group,
  colorFor,
  hoveredSig,
  setHoveredSig,
  materialName,
  onOpen,
}: PatternCardProps) => {
  const [hover, setHover] = useState(false)
  const { material, statistics } = group.layout
  const efficiencyOk = statistics.efficiency >= 80

  return (
    <div
      className="border rounded p-2 h-100"
      style={{
        transition: 'border-color .15s, box-shadow .15s',
        borderColor: hover ? 'var(--cui-primary)' : undefined,
        boxShadow: hover ? '0 0 0 .15rem rgba(var(--cui-primary-rgb), .15)' : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
        <div className="small">
          <div className="fw-semibold">
            Patrón {group.patternId}
            {group.count > 1 && (
              <CBadge color="secondary" className="ms-1">
                ×{group.count}
              </CBadge>
            )}
          </div>
          <div className="text-body-secondary d-flex align-items-center gap-1">
            {stripHalfSuffix(materialName)}
            {group.layout.material.halfBoard && <CBadge color="info">½ medio</CBadge>}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <CBadge color={efficiencyOk ? 'success' : 'warning'}>
            {statistics.efficiency.toFixed(1)}%
          </CBadge>
          <CButton size="sm" color="secondary" variant="ghost" onClick={onOpen}>
            Ampliar
          </CButton>
        </div>
      </div>

      <div role="button" title="Ampliar hoja" style={{ cursor: 'zoom-in' }} onClick={onOpen}>
        <SheetSvg
          layout={group.layout}
          colorFor={colorFor}
          dimSig={hoveredSig}
          onPieceEnter={(p) => setHoveredSig(pieceSig(p))}
          onPieceLeave={() => setHoveredSig(null)}
        />
      </div>

      {/* Efficiency bar */}
      <div
        className="mt-2"
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--cui-tertiary-bg)',
          overflow: 'hidden',
        }}
        title={`Eficiencia ${statistics.efficiency.toFixed(1)}%`}
      >
        <div
          style={{
            width: `${clamp(statistics.efficiency, 0, 100)}%`,
            height: '100%',
            background: efficiencyOk ? 'var(--cui-success)' : 'var(--cui-warning)',
          }}
        />
      </div>

      <div className="d-flex flex-wrap gap-3 mt-2 small text-body-secondary">
        <span>
          {material.width}×{material.height} mm
        </span>
        <span>{statistics.piecesCount} piezas</span>
        <span>Corte {statistics.cutLinearM.toFixed(2)} m</span>
        {statistics.edgeBandingLinearM > 0 && (
          <span>Tapacanto {statistics.edgeBandingLinearM.toFixed(2)} m</span>
        )}
      </div>
    </div>
  )
}

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
      size="xl"
      scrollable
      alignment="center"
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
              className="align-self-start"
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
                // Reserve is the modal chrome around the body — margins, header, footer, padding.
                maxHeight="min(640px, calc(100dvh - 17rem))"
                showDimensions
                enableZoom
              />
            </CCol>
            <CCol xs={12} lg={5}>
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
  const [hoveredSig, setHoveredSig] = useState<string | null>(null)
  // The open sheet is held as an INDEX, not the group object, so the modal can page to the next one.
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

  const { colorFor, legend, hasEdgeBanding } = usePieceColors(layoutGroups)

  const materialName = (materialKey: string) => {
    const m = materialsSummary.find((x) => x.materialKey === materialKey)
    if (!m) return materialKey
    return m.productName ?? m.productCode ?? `${m.width}×${m.height}×${m.thickness} mm`
  }

  if (!layoutGroups.length) return null

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <strong className="small text-body-secondary text-uppercase">Diagrama de cortes</strong>
        <PieceLegend
          legend={legend}
          hasEdgeBanding={hasEdgeBanding}
          hoveredSig={hoveredSig}
          onHover={setHoveredSig}
        />
      </div>

      <CRow className="g-3">
        {layoutGroups.map((group, i) => (
          <CCol xs={12} md={6} xl={4} key={group.patternId}>
            <PatternCard
              group={group}
              colorFor={colorFor}
              hoveredSig={hoveredSig}
              setHoveredSig={setHoveredSig}
              materialName={materialName(group.materialKey)}
              onOpen={() => setDetailIndex(i)}
            />
          </CCol>
        ))}
      </CRow>

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
