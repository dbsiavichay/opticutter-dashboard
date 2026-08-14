import { useId } from 'react'

import useZoomPan from 'src/shared/hooks/useZoomPan'
import ZoomControls from 'src/shared/components/ZoomControls'
import {
  BOARD_OUTLINE,
  EDGE_COLOR,
  PIECE_LABEL,
  WASTE_FILL,
  WASTE_OUTLINE,
  bandedSides,
  boardRotation,
  clamp,
  insetSideLine,
  pieceSig,
  uprightText,
} from 'src/shared/utils/cutDrawing'
import type { DrawableLayout, DrawnPiece } from 'src/shared/utils/cutDrawing'

interface SheetSvgProps<P extends DrawnPiece> {
  layout: DrawableLayout<P>
  colorFor: (sig: string) => string
  dimSig?: string | null
  highlightId?: string | null
  onPieceEnter?: (p: P) => void
  onPieceLeave?: () => void
  // Tap/click selection. Unlike hover, this is the only thing that works on a touch screen, so any
  // view that needs per-piece detail on mobile must wire this rather than onPieceEnter.
  onPieceTap?: (p: P) => void
  // Applied straight as the svg's CSS max-height, so a viewport-relative expression is allowed —
  // which is what the expanded modals need to stay inside their scrollport.
  maxHeight?: number | string
  // Shows board dimensions (width at top, height on the left). Expanded view only.
  showDimensions?: boolean
  // Enables zoom + pan (pinch/wheel/drag + buttons). Expanded view only.
  enableZoom?: boolean
  // Corner for the zoom buttons; see ZoomControls.placement.
  zoomPlacement?: 'top-right' | 'top-left'
  // Text drawn inside each piece when it's big enough. Defaults to its nominal dimensions.
  labelFor?: (p: P) => string
}

const defaultLabel = (p: DrawnPiece) =>
  `${p.originalWidth}×${p.originalHeight}${p.rotated ? ' ↻' : ''}`

// Renders one sheet of the cutting plan: the board, the hatched leftovers and every placed piece
// with its edge banding. Shared by the optimizer preview and the client's review diagram.
const SheetSvg = <P extends DrawnPiece>({
  layout,
  colorFor,
  dimSig,
  highlightId,
  onPieceEnter,
  onPieceLeave,
  onPieceTap,
  maxHeight = 420,
  showDimensions = false,
  enableZoom = false,
  zoomPlacement,
  labelFor = defaultLabel,
}: SheetSvgProps<P>) => {
  const rawId = useId()
  const wasteId = `waste-${rawId.replace(/:/g, '')}`
  const { material, placedPieces, remainders } = layout
  const W = material.width
  const H = material.height
  const edgeWidth = clamp(Math.max(W, H) * 0.012, 8, 22)

  const { svgRef, groupTransform, scale, isZoomed, zoomIn, zoomOut, reset } = useZoomPan()

  // Extra margin reserved for the board dimension labels (expanded view only).
  const margin = showDimensions ? Math.max(W, H) * 0.07 : 0
  const labelSize = clamp(Math.max(W, H) * 0.028, 16, 44)

  const svg = (
    <svg
      ref={enableZoom ? svgRef : undefined}
      viewBox={`${-margin} ${-margin} ${H + margin} ${W + margin}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        maxHeight,
        // Not zoomed: let the browser scroll the page vertically (pinch is still ours). Zoomed:
        // take full control to pan with one finger. Anything else traps the finger on the diagram.
        touchAction: enableZoom ? (isZoomed ? 'none' : 'pan-y') : undefined,
        cursor: enableZoom && isZoomed ? 'grab' : undefined,
      }}
      role="img"
      aria-label={`Hoja ${material.width}×${material.height} con ${placedPieces.length} piezas`}
    >
      <defs>
        <pattern id={wasteId} patternUnits="userSpaceOnUse" width={48} height={48}>
          <rect width={48} height={48} fill={WASTE_FILL} />
          <path d="M0,48 L48,0" stroke={WASTE_OUTLINE} strokeWidth={3} />
        </pattern>
      </defs>

      {/* Board dimensions: in landscape space, outside the rotation (top = H, side = W). */}
      {showDimensions && (
        <g
          transform={enableZoom ? groupTransform : undefined}
          fill={BOARD_OUTLINE}
          style={{ userSelect: 'none' }}
        >
          <text
            x={H / 2}
            y={-margin / 2}
            fontSize={labelSize}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {H} mm
          </text>
          <text
            x={-margin / 2}
            y={W / 2}
            fontSize={labelSize}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(-90 ${-margin / 2} ${W / 2})`}
          >
            {W} mm
          </text>
        </g>
      )}

      {/* Board and pieces rotated 90° clockwise (landscape); text is counter-rotated to stay readable. */}
      <g transform={enableZoom ? `${groupTransform} ${boardRotation(H)}` : boardRotation(H)}>
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="#ffffff"
          stroke={BOARD_OUTLINE}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />

        {/* Offcuts / waste */}
        {remainders.map((r, idx) => (
          <rect
            key={`rem-${idx}`}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            fill={`url(#${wasteId})`}
            stroke={WASTE_OUTLINE}
            strokeWidth={1}
            strokeDasharray="6 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {placedPieces.map((p) => {
          const sig = pieceSig(p)
          const color = colorFor(sig)
          const dimmed =
            highlightId != null ? p.pieceId !== highlightId : dimSig != null && sig !== dimSig
          const minSide = Math.min(p.width, p.height)
          const fontSize = clamp(minSide / 5, 22, 90)
          // On zoom-in, small pieces reveal their label (threshold based on effective scale).
          const showText = p.width * scale > 130 && p.height * scale > 90
          const text = labelFor(p)

          return (
            <g
              key={p.pieceId}
              opacity={dimmed ? 0.35 : 1}
              onMouseEnter={() => onPieceEnter?.(p)}
              onMouseLeave={() => onPieceLeave?.()}
              onClick={onPieceTap ? () => onPieceTap(p) : undefined}
              role={onPieceTap ? 'button' : undefined}
              style={{ cursor: onPieceTap ? 'pointer' : 'default' }}
            >
              <title>
                {p.originalWidth}×{p.originalHeight} mm{p.rotated ? ' (rotada 90°)' : ''}
              </title>
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill={color}
                fillOpacity={0.85}
                stroke={highlightId === p.pieceId ? BOARD_OUTLINE : 'rgba(0,0,0,0.35)'}
                strokeWidth={highlightId === p.pieceId ? 3 : 1}
                vectorEffect="non-scaling-stroke"
              />

              {/* Edge banding: thick band inset from the piece border (does not overlap the cut line) */}
              {bandedSides(p).map((side) => {
                const l = insetSideLine(side, p.x, p.y, p.width, p.height, edgeWidth)
                return (
                  <line
                    key={`${p.pieceId}-${side}`}
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

              {showText && text && (
                <text
                  x={p.x + p.width / 2}
                  y={p.y + p.height / 2}
                  fontSize={fontSize}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={PIECE_LABEL}
                  transform={uprightText(p.x + p.width / 2, p.y + p.height / 2)}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {text}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )

  if (!enableZoom) return svg

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {svg}
      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
        isZoomed={isZoomed}
        placement={zoomPlacement}
      />
    </div>
  )
}

export default SheetSvg
