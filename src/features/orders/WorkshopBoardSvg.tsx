import { useId, type CSSProperties } from 'react'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFullscreen, cilFullscreenExit } from '@coreui/icons'

import {
  EDGE_COLOR,
  PIECE_LABEL,
  WASTE_LABEL,
  bandedSides,
  boardRotation,
  clamp,
  insetSideLine,
  pieceSig,
  uprightText,
} from 'src/shared/utils/cutDrawing'
import useZoomPan from 'src/shared/hooks/useZoomPan'
import useFullscreen from 'src/shared/hooks/useFullscreen'
import ZoomControls from 'src/shared/components/ZoomControls'
import EdgeDimensions from 'src/shared/components/EdgeDimensions'
import type { CutBoard, CutPiece } from './types'

interface WorkshopBoardSvgProps {
  board: CutBoard
  colorFor: (sig: string) => string
  // Pieces can only be tapped/marked when the order is in `cutting` state. Other states are read-only.
  interactive: boolean
  // Single tap marks the piece as cut; double-tap unmarks it (no confirmation).
  onPieceTap: (piece: CutPiece) => void
  onPieceUntap: (piece: CutPiece) => void
}

const CHECK_COLOR = '#2b8a3e' // verde del ✓ de pieza cortada

// Renders a physical board from the cutting plan using the same geometry as the optimizer, adding
// per-piece cut state (dimmed + ✓), hatched waste areas, and a tap target over each full rectangle.
const WorkshopBoardSvg = ({
  board,
  colorFor,
  interactive,
  onPieceTap,
  onPieceUntap,
}: WorkshopBoardSvgProps) => {
  const W = board.width
  const H = board.height
  const edgeWidth = clamp(Math.max(W, H) * 0.012, 8, 22)
  const rawId = useId()
  const wasteId = `waste-${rawId.replace(/:/g, '')}`

  // Zoom for inspecting/tapping small pieces. doubleClickZoom disabled: double-tap must not
  // interfere with the "tap = mark as cut" interaction.
  const { svgRef, groupTransform, scale, isZoomed, zoomIn, zoomOut, reset } = useZoomPan({
    doubleClickZoom: false,
  })
  const {
    containerRef,
    isFullscreen,
    isSupported: fullscreenSupported,
    toggle: toggleFullscreen,
  } = useFullscreen<HTMLDivElement>()

  const containerStyle: CSSProperties = { position: 'relative', overflow: 'hidden' }
  if (isFullscreen) {
    // Fullscreen element fills the viewport; center the (aspect-ratio constrained) SVG within it.
    containerStyle.display = 'flex'
    containerStyle.alignItems = 'center'
    containerStyle.justifyContent = 'center'
    containerStyle.height = '100vh'
    containerStyle.background = 'var(--cui-body-bg)'
    containerStyle.padding = '1rem'
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${H} ${W}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          maxHeight: isFullscreen ? '94vh' : '72vh',
          // Not zoomed: let the browser handle vertical page scroll (pinch is still ours).
          // Zoomed: take full control to pan the diagram with one finger.
          touchAction: isZoomed ? 'none' : 'pan-y',
          cursor: isZoomed ? 'grab' : undefined,
        }}
        role="img"
        aria-label={`Tablero ${board.sheetNumber}: ${W}×${H} con ${board.pieces.length} piezas${board.halfBoard ? ' (medio tablero)' : ''}`}
      >
        <defs>
          <pattern id={wasteId} patternUnits="userSpaceOnUse" width={48} height={48}>
            <rect width={48} height={48} fill="#f1f3f5" />
            <path d="M0,48 L48,0" stroke="#ced4da" strokeWidth={3} />
          </pattern>
        </defs>

        {/* Board rotated 90° clockwise (landscape); text counter-rotated to stay readable. */}
        <g transform={`${groupTransform} ${boardRotation(H)}`}>
          {/* Tablero */}
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="#ffffff"
            stroke="#868e96"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* Remainders / waste (hatched free areas to distinguish piece vs. waste). Their size is
              drawn on the edges (see the dimensions group below) so the shop can set aside the
              retazos worth keeping — this is a touch screen, there is no hover. */}
          {(board.remainders ?? []).map((r, idx) => (
            <rect
              key={`rem-${idx}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={`url(#${wasteId})`}
              stroke="#ced4da"
              strokeWidth={1}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Piezas */}
          {board.pieces.map((p) => {
            const sig = pieceSig(p)
            const color = colorFor(sig)
            const minSide = Math.min(p.width, p.height)
            const checkSize = clamp(minSide * 0.55, 36, 220)
            const cx = p.x + p.width / 2
            const cy = p.y + p.height / 2

            return (
              <g
                key={p.id}
                role={interactive ? 'button' : undefined}
                style={{ cursor: interactive ? 'pointer' : 'default' }}
                onClick={interactive ? () => onPieceTap(p) : undefined}
                onDoubleClick={interactive ? () => onPieceUntap(p) : undefined}
              >
                <title>
                  {p.label} · {p.originalWidth}×{p.originalHeight} mm
                  {p.rotated ? ' (rotada 90°)' : ''}
                  {p.cut ? ' — cortada' : ''}
                  {p.cut && p.cutByLabel ? ` por ${p.cutByLabel}` : ''}
                </title>

                {/* Piece visual: dimmed when already cut */}
                <g opacity={p.cut ? 0.35 : 1}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.width}
                    height={p.height}
                    fill={color}
                    fillOpacity={0.85}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Edge banding: thick inset band (does not overlap the cut line) */}
                  {bandedSides(p).map((side) => {
                    const l = insetSideLine(side, p.x, p.y, p.width, p.height, edgeWidth)
                    return (
                      <line
                        key={`${p.id}-${side}`}
                        x1={l.x1}
                        y1={l.y1}
                        x2={l.x2}
                        y2={l.y2}
                        stroke={EDGE_COLOR}
                        strokeWidth={edgeWidth}
                        strokeLinecap="butt"
                      />
                    )
                  })}
                </g>

                {/* ✓ at full opacity above the dimmed layer, so the cut state reads at a glance */}
                {p.cut && (
                  <text
                    x={cx}
                    y={cy}
                    fontSize={checkSize}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={CHECK_COLOR}
                    fontWeight={700}
                    transform={uprightText(cx, cy)}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ✓
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* Measurements drawn on the edges (not centered): positioned in screen space, so this
            sits outside the rotated board group but still carries its zoom/pan transform. Same
            reveal rule as the shapes themselves. */}
        <g transform={groupTransform}>
          {(board.remainders ?? []).map((r, idx) =>
            r.width * scale > 130 && r.height * scale > 90 ? (
              <EdgeDimensions
                key={`rem-dim-${idx}`}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                boardHeight={H}
                fontSize={clamp(Math.min(r.width, r.height) / 7, 14, 56)}
                color={WASTE_LABEL}
              />
            ) : null,
          )}
          {board.pieces.map((p) =>
            p.width * scale > 130 && p.height * scale > 90 ? (
              <g key={`piece-dim-${p.id}`} opacity={p.cut ? 0.35 : 1}>
                <EdgeDimensions
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={p.height}
                  boardHeight={H}
                  fontSize={clamp(Math.min(p.width, p.height) / 6, 16, 64)}
                  color={PIECE_LABEL}
                  suffix={p.rotated ? ' ↻' : ''}
                />
              </g>
            ) : null,
          )}
        </g>
      </svg>
      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} isZoomed={isZoomed} />
      {fullscreenSupported && (
        <CButton
          color="light"
          size="lg"
          className="shadow-sm"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
          onClick={toggleFullscreen}
        >
          <CIcon icon={isFullscreen ? cilFullscreenExit : cilFullscreen} />
        </CButton>
      )}
    </div>
  )
}

export default WorkshopBoardSvg
