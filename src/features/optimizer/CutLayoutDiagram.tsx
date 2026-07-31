import { useMemo, useState } from 'react'
import {
  CBadge,
  CButton,
  CCol,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'

import SheetSvg from 'src/shared/components/SheetSvg'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import type { EdgeSide, LayoutGroup, MaterialSummary, PlacedPiece } from './types'
import {
  EDGE_COLOR,
  PALETTE,
  SIDE_LABELS_ES,
  bandedSides,
  boardRotation,
  clamp,
  pieceSig,
  uprightText,
} from 'src/shared/utils/cutDrawing'
import type { SideLine } from 'src/shared/utils/cutDrawing'

// --- Single-piece detail panel (shown inside the modal) ---

interface PiecePreviewProps {
  piece: PlacedPiece
  colorFor: (sig: string) => string
}

// Edge banding line parallel to the side but offset outward, so it doesn't overlap the piece.
const bandLine = (side: EdgeSide, w: number, h: number, gap: number, inset: number): SideLine => {
  switch (side) {
    case 'top':
      return { x1: inset, y1: -gap, x2: w - inset, y2: -gap }
    case 'bottom':
      return { x1: inset, y1: h + gap, x2: w - inset, y2: h + gap }
    case 'left':
      return { x1: -gap, y1: inset, x2: -gap, y2: h - inset }
    case 'right':
      return { x1: w + gap, y1: inset, x2: w + gap, y2: h - inset }
  }
}

// Standalone piece render: dimensions inside (width at bottom, height on the left),
// edge notation centered, and banding as offset bars.
const PiecePreview = ({ piece, colorFor }: PiecePreviewProps) => {
  const w = piece.width
  const h = piece.height
  const color = colorFor(pieceSig(piece))
  const maxDim = Math.max(w, h)
  const minDim = Math.min(w, h)

  // Edge banding as a thin bar separated from the border by a gap; `pad` enlarges the viewBox to fit.
  const bar = clamp(maxDim * 0.018, 4, 12)
  const gap = clamp(maxDim * 0.045, 8, 26)
  const inset = bar * 1.5
  const pad = gap + bar

  const dimSize = clamp(minDim * 0.12, 14, 56) // dimension labels inside the piece
  const noteSize = clamp(minDim * 0.1, 14, 44) // center notation
  const dimInset = dimSize * 0.95 // offset of the dimension label from the edge

  const notation = piece.edges?.notation ?? ''

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${h + 2 * pad} ${w + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: 180, display: 'block' }}
      role="img"
      aria-label={`Pieza ${piece.originalWidth}×${piece.originalHeight} mm`}
    >
      {/* Piece geometry and edge banding rotated 90° CW */}
      <g transform={boardRotation(h)}>
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill={color}
          fillOpacity={0.85}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {/* Edge banding */}
        {bandedSides(piece).map((side) => {
          const l = bandLine(side, w, h, gap, inset)
          return (
            <line
              key={side}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={EDGE_COLOR}
              strokeWidth={bar}
              strokeLinecap="round"
            />
          )
        })}
      </g>

      {/* Dimensions in rotated space: width on left (vertical), height on top (horizontal) */}
      <g fill="#212529" style={{ userSelect: 'none', pointerEvents: 'none' }}>
        <text
          x={dimInset}
          y={w / 2}
          fontSize={dimSize}
          textAnchor="middle"
          dominantBaseline="central"
          transform={uprightText(dimInset, w / 2)}
        >
          {Math.round(w)}
        </text>
        <text
          x={h / 2}
          y={dimInset}
          fontSize={dimSize}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {Math.round(h)}
        </text>
      </g>

      {/* Edge notation centered */}
      {notation && (
        <text
          x={h / 2}
          y={w / 2}
          fontSize={noteSize}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#212529"
          fontWeight={600}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {notation}
        </text>
      )}
    </svg>
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
    <span className="text-body-secondary small">{label}</span>
    <span className="small fw-semibold text-end">{value}</span>
  </div>
)

interface PieceDetailCardProps {
  piece: PlacedPiece | null
  colorFor: (sig: string) => string
}

// Panel replacing the per-piece table: shows the piece under the cursor with all its data.
const PieceDetailCard = ({ piece, colorFor }: PieceDetailCardProps) => {
  const sides = piece ? bandedSides(piece) : []
  return (
    <div className="border rounded p-2 mb-3">
      <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
        Detalle de pieza
      </div>
      {piece ? (
        <>
          <PiecePreview piece={piece} colorFor={colorFor} />
          <div className="mt-2">
            <Detail
              label="Medida nominal"
              value={`${piece.originalWidth}×${piece.originalHeight} mm`}
            />
            {piece.rotated && (
              <Detail
                label="En hoja"
                value={`${Math.round(piece.width)}×${Math.round(piece.height)} mm`}
              />
            )}
            <Detail label="Rotación" value={piece.rotated ? 'Rotada 90° ↻' : 'Sin rotar'} />
            <Detail
              label="Posición (x, y)"
              value={`${Math.round(piece.x)}, ${Math.round(piece.y)} mm`}
            />
            <Detail
              label="Tapacanto"
              value={
                piece.edges
                  ? sides.map((s) => SIDE_LABELS_ES[s]).join(', ') || '—'
                  : 'Sin tapacanto'
              }
            />
            {piece.edges && (
              <Detail
                label="Material canto"
                value={
                  [piece.edges.code, piece.edges.color, piece.edges.notation]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
              />
            )}
          </div>
        </>
      ) : (
        <div
          className="d-flex align-items-center justify-content-center text-body-secondary small text-center px-3"
          style={{ height: 180 }}
        >
          Pasa el cursor sobre una pieza del diagrama para ver su detalle.
        </div>
      )}
    </div>
  )
}

// --- Pieces grouped by dimension (compact summary, does not grow with piece count) ---

interface GroupedPiecesListProps {
  pieces: PlacedPiece[]
  colorFor: (sig: string) => string
  hoverSig: string | null
  onHover: (sig: string | null) => void
}

const GroupedPiecesList = ({ pieces, colorFor, hoverSig, onHover }: GroupedPiecesListProps) => {
  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of pieces) {
      const sig = pieceSig(p)
      counts.set(sig, (counts.get(sig) ?? 0) + 1)
    }
    return [...counts.entries()].map(([sig, count]) => ({ sig, count }))
  }, [pieces])

  return (
    <div>
      <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
        Piezas por medida
      </div>
      <div className="d-flex flex-wrap gap-1" style={{ maxHeight: 200, overflowY: 'auto' }}>
        {groups.map(({ sig, count }) => (
          <span
            key={sig}
            className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded border small"
            style={{
              cursor: 'default',
              background: hoverSig === sig ? 'var(--cui-tertiary-bg)' : undefined,
              opacity: hoverSig && hoverSig !== sig ? 0.45 : 1,
            }}
            onMouseEnter={() => onHover(sig)}
            onMouseLeave={() => onHover(null)}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: colorFor(sig),
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {sig} mm ×{count}
          </span>
        ))}
      </div>
    </div>
  )
}

// --- Sheet detail modal ---

interface SheetDetailModalProps {
  group: LayoutGroup | null
  materialName: string
  colorFor: (sig: string) => string
  onClose: () => void
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <CCol xs={4}>
    <div className="text-body-secondary small">{label}</div>
    <div className="fw-semibold">{value}</div>
  </CCol>
)

const SheetDetailModal = ({ group, materialName, colorFor, onClose }: SheetDetailModalProps) => {
  const [hoverPiece, setHoverPiece] = useState<PlacedPiece | null>(null)
  const [hoverSig, setHoverSig] = useState<string | null>(null)
  const layout = group?.layout
  const stats = layout?.statistics

  return (
    <CModal visible={!!group} onClose={onClose} size="xl" scrollable alignment="center">
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
        {layout && stats && (
          <CRow className="g-3">
            <CCol
              xs={12}
              lg={7}
              className="align-self-start"
              style={{ position: 'sticky', top: 0, zIndex: 1 }}
            >
              <SheetSvg
                layout={layout}
                colorFor={colorFor}
                highlightId={hoverPiece?.pieceId ?? null}
                dimSig={hoverSig}
                onPieceEnter={(p) => {
                  setHoverPiece(p)
                  setHoverSig(null)
                }}
                onPieceLeave={() => setHoverPiece(null)}
                maxHeight={640}
                showDimensions
                enableZoom
              />
            </CCol>
            <CCol xs={12} lg={5}>
              <CRow className="g-2 mb-3">
                <Stat label="Eficiencia" value={`${stats.efficiency.toFixed(1)}%`} />
                <Stat label="Piezas" value={stats.piecesCount} />
                <Stat
                  label="Medida hoja"
                  value={`${layout.material.width}×${layout.material.height}`}
                />
                <Stat label="Corte lineal" value={`${stats.cutLinearM.toFixed(2)} m`} />
                <Stat label="Tapacanto" value={`${stats.edgeBandingLinearM.toFixed(2)} m`} />
                <Stat label="Desperdicio" value={`${(stats.wasteArea / 1e6).toFixed(2)} m²`} />
              </CRow>

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
    </CModal>
  )
}

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

// --- Main diagram ---

interface CutLayoutDiagramProps {
  layoutGroups: LayoutGroup[]
  materialsSummary: MaterialSummary[]
}

const CutLayoutDiagram = ({ layoutGroups, materialsSummary }: CutLayoutDiagramProps) => {
  const [hoveredSig, setHoveredSig] = useState<string | null>(null)
  const [detail, setDetail] = useState<LayoutGroup | null>(null)

  // Stable color per signature (first-appearance order) + total count for the legend.
  const { colorFor, legend, hasEdgeBanding } = useMemo(() => {
    const colors = new Map<string, string>()
    const counts = new Map<string, number>()
    let banding = false
    for (const group of layoutGroups) {
      for (const p of group.layout.placedPieces) {
        const sig = pieceSig(p)
        if (!colors.has(sig)) colors.set(sig, PALETTE[colors.size % PALETTE.length] ?? PALETTE[0])
        // Each group represents `count` identical physical sheets.
        counts.set(sig, (counts.get(sig) ?? 0) + group.count)
        if (bandedSides(p).length > 0) banding = true
      }
    }
    return {
      colorFor: (sig: string) => colors.get(sig) ?? PALETTE[0],
      legend: [...colors.keys()].map((sig) => ({
        sig,
        color: colors.get(sig) ?? PALETTE[0],
        count: counts.get(sig) ?? 0,
      })),
      hasEdgeBanding: banding,
    }
  }, [layoutGroups])

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
        {(legend.length > 0 || hasEdgeBanding) && (
          <div
            className="d-flex flex-wrap gap-2 justify-content-end align-items-center"
            style={{ maxHeight: 96, overflowY: 'auto' }}
          >
            {legend.map((l) => (
              <span
                key={l.sig}
                role="button"
                className="d-inline-flex align-items-center gap-1 small"
                style={{ opacity: hoveredSig && hoveredSig !== l.sig ? 0.4 : 1, cursor: 'default' }}
                onMouseEnter={() => setHoveredSig(l.sig)}
                onMouseLeave={() => setHoveredSig(null)}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: l.color,
                    display: 'inline-block',
                  }}
                />
                {l.sig} mm
                <span className="text-body-secondary">×{l.count}</span>
              </span>
            ))}
            {hasEdgeBanding && (
              <span className="d-inline-flex align-items-center gap-1 small text-body-secondary">
                <span
                  style={{
                    width: 16,
                    height: 4,
                    borderRadius: 2,
                    background: EDGE_COLOR,
                    display: 'inline-block',
                  }}
                />
                Tapacanto
              </span>
            )}
          </div>
        )}
      </div>

      <CRow className="g-3">
        {layoutGroups.map((group) => (
          <CCol xs={12} md={6} xl={4} key={group.patternId}>
            <PatternCard
              group={group}
              colorFor={colorFor}
              hoveredSig={hoveredSig}
              setHoveredSig={setHoveredSig}
              materialName={materialName(group.materialKey)}
              onOpen={() => setDetail(group)}
            />
          </CCol>
        ))}
      </CRow>

      <SheetDetailModal
        group={detail}
        materialName={detail ? materialName(detail.materialKey) : ''}
        colorFor={colorFor}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}

export default CutLayoutDiagram
