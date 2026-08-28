import { useId, type CSSProperties } from 'react'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFullscreen, cilFullscreenExit } from '@coreui/icons'

import {
  EDGE_COLOR,
  WASTE_LABEL,
  bandedSides,
  boardRotation,
  clamp,
  insetSideLine,
  pieceSig,
  remainderLabel,
  uprightText,
} from 'src/shared/utils/cutDrawing'
import useZoomPan from 'src/shared/hooks/useZoomPan'
import useFullscreen from 'src/shared/hooks/useFullscreen'
import ZoomControls from 'src/shared/components/ZoomControls'
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

          {/* Remainders / waste (hatched free areas to distinguish piece vs. waste), labelled with
              their size so the shop can set aside the retazos worth keeping. This is a touch
              screen: there is no hover, so the label and the zoom are the only way to read it. */}
          {(board.remainders ?? []).map((r, idx) => {
            const showText = r.width * scale > 130 && r.height * scale > 90
            const rcx = r.x + r.width / 2
            const rcy = r.y + r.height / 2
            return (
              <g key={`rem-${idx}`}>
                <rect
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
                {showText && (
                  <text
                    x={rcx}
                    y={rcy}
                    fontSize={clamp(Math.min(r.width, r.height) / 6, 18, 70)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={WASTE_LABEL}
                    transform={uprightText(rcx, rcy)}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {remainderLabel(r)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Piezas */}
          {board.pieces.map((p) => {
            const sig = pieceSig(p)
            const color = colorFor(sig)
            const minSide = Math.min(p.width, p.height)
            const fontSize = clamp(minSide / 5, 22, 90)
            const checkSize = clamp(minSide * 0.55, 36, 220)
            // When zoomed in, small pieces reveal their dimensions (threshold based on effective scale).
            const showText = p.width * scale > 130 && p.height * scale > 90
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

                  {showText && (
                    <text
                      x={cx}
                      y={cy}
                      fontSize={fontSize}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#212529"
                      transform={uprightText(cx, cy)}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {p.originalWidth}×{p.originalHeight}
                      {p.rotated ? ' ↻' : ''}
                    </text>
                  )}
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
