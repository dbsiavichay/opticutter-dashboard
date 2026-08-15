import { useMemo } from 'react'
import { CCol, CRow } from '@coreui/react'

import {
  EDGE_COLOR,
  SIDE_LABELS_ES,
  bandedSides,
  boardRotation,
  clamp,
  pieceSig,
  uprightText,
} from 'src/shared/utils/cutDrawing'
import type { SideLine } from 'src/shared/utils/cutDrawing'
import type { EdgeSide, Layout, PlacedPiece } from './types'

// Per-sheet detail panels, shared by the wizard's inline sheet viewer and the pre-order's expanded
// sheet modal. Both show the same three things next to a board: what the piece under the cursor is,
// how the sheet performed, and which measurements it holds.

type ColorFor = (sig: string) => string

// --- Single-piece drawing ---

interface PiecePreviewProps {
  piece: PlacedPiece
  colorFor: ColorFor
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
export const PiecePreview = ({ piece, colorFor }: PiecePreviewProps) => {
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

// --- Piece detail panel ---

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
    <span className="text-body-secondary small">{label}</span>
    <span className="small fw-semibold text-end">{value}</span>
  </div>
)

interface PieceDetailCardProps {
  piece: PlacedPiece | null
  colorFor: ColorFor
  // Empty-state wording: the wizard's viewer accepts taps too, the modal is hover-only.
  emptyHint?: string
}

// Panel replacing the per-piece table: shows the piece under the cursor with all its data.
export const PieceDetailCard = ({
  piece,
  colorFor,
  emptyHint = 'Pasa el cursor sobre una pieza del diagrama para ver su detalle.',
}: PieceDetailCardProps) => {
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
          {emptyHint}
        </div>
      )}
    </div>
  )
}

// --- Pieces grouped by dimension (compact summary, does not grow with piece count) ---

interface GroupedPiecesListProps {
  pieces: PlacedPiece[]
  colorFor: ColorFor
  hoverSig: string | null
  onHover: (sig: string | null) => void
}

export const GroupedPiecesList = ({
  pieces,
  colorFor,
  hoverSig,
  onHover,
}: GroupedPiecesListProps) => {
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

// --- Per-sheet statistics ---

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <CCol xs={4}>
    <div className="text-body-secondary small">{label}</div>
    <div className="fw-semibold">{value}</div>
  </CCol>
)

// The six numbers that describe one sheet's outcome.
export const SheetStats = ({ layout }: { layout: Layout }) => {
  const s = layout.statistics
  return (
    <CRow className="g-2 mb-3">
      <Stat label="Eficiencia" value={`${s.efficiency.toFixed(1)}%`} />
      <Stat label="Piezas" value={s.piecesCount} />
      <Stat label="Medida hoja" value={`${layout.material.width}×${layout.material.height}`} />
      <Stat label="Corte lineal" value={`${s.cutLinearM.toFixed(2)} m`} />
      <Stat label="Tapacanto" value={`${s.edgeBandingLinearM.toFixed(2)} m`} />
      <Stat label="Desperdicio" value={`${(s.wasteArea / 1e6).toFixed(2)} m²`} />
    </CRow>
  )
}
