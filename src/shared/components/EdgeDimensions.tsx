import { uprightText } from 'src/shared/utils/cutDrawing'

interface EdgeDimensionsProps {
  // Rectangle in board mm (the same space the pieces and remainders use).
  x: number
  y: number
  width: number
  height: number
  // The board's mm height (H). A board-space point (x, y) sits at (H - y, x) on screen
  // once `boardRotation(H)` has run, and this component works in that screen space.
  boardHeight: number
  fontSize: number
  color: string
  // Appended to the width label, e.g. " ↻" for a rotated piece.
  suffix?: string
}

// Draws a rectangle's two measurements ON its edges instead of centered: the mm height
// along the top edge (horizontal text) and the mm width along the left edge (rotated 90°,
// reading bottom-to-top). This is the pattern `PiecePreview` (features/optimizer/sheetDetail)
// already uses for a standalone piece, lifted out so the sheet and workshop diagrams share it.
//
// Render it OUTSIDE the `boardRotation` group — as a sibling carrying the same zoom/pan
// transform as the board-dimension labels — because it positions in screen space.
const EdgeDimensions = ({
  x,
  y,
  width,
  height,
  boardHeight,
  fontSize,
  color,
  suffix = '',
}: EdgeDimensionsProps) => {
  // Screen-space box of this rectangle after the 90° CW board rotation.
  const left = boardHeight - (y + height)
  const top = x
  const inset = fontSize * 0.9

  // mm height runs horizontally on screen: label centered along the top edge.
  const hx = left + height / 2
  const hy = top + inset
  // mm width runs vertically on screen: label centered along the left edge, rotated upright.
  const wx = left + inset
  const wy = top + width / 2

  return (
    <g fill={color} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <text x={hx} y={hy} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">
        {Math.round(height)}
      </text>
      <text
        x={wx}
        y={wy}
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="central"
        transform={uprightText(wx, wy)}
      >
        {Math.round(width)}
        {suffix}
      </text>
    </g>
  )
}

export default EdgeDimensions
