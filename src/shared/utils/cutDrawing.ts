// Pure drawing primitives for the cut plan: the color palette, the dimension signature, and edge
// banding geometry. No JSX or state. Lives in shared/ because three features draw the same boards —
// the optimizer preview, the workshop board, and the client's public review — and shared/ must never
// import from a feature.

// Geometric side of a piece as drawn (post-rotation).
export type EdgeSide = 'top' | 'bottom' | 'left' | 'right'

// Paleta estable para colorear piezas por dimensión (firma). Colores tipo Tableau, legibles.
export const PALETTE = [
  '#4e79a7',
  '#59a14f',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#b07aa1',
  '#edc948',
  '#ff9da7',
  '#9c755f',
  '#86bcb6',
] as const

// Board chrome, taken from the backend's own diagram renderer
// (`opticutter-api/src/modules/optimizations/visualization.py`), which is itself aligned with the
// MADERABLE letterhead. The client sees the same cut plan twice — here and in the PDF — so the two
// have to be the same drawing, not two drawings of the same thing.
//
// Only the chrome is shared. PALETTE above stays as it is: on screen the hue identifies a piece
// size (and drives cross-highlighting), a job the printed diagram solves by labelling instead.
export const BOARD_OUTLINE = '#1d1d1b' // COLOR_BOARD_OUTLINE, and COLOR_DIM for the mm labels
export const PIECE_LABEL = '#212121' // COLOR_LABEL
export const WASTE_FILL = '#ececec' // COLOR_WASTE_FILL
export const WASTE_OUTLINE = '#9e9e9e' // COLOR_WASTE_OUTLINE
// Leftover dimensions drawn inside the hatch. Darker than the outline so the text reads over the
// pattern, lighter than PIECE_LABEL so a leftover never competes with a piece for attention.
export const WASTE_LABEL = '#6c757d'

// Edge banding has no counterpart in the backend diagram (it is drawn only on screen), so this one
// answers to legibility over the piece fills rather than to the document.
export const EDGE_COLOR = '#d9480f' // edge banding color in the diagram

export const SIDE_LABELS_ES: Record<EdgeSide, string> = {
  top: 'Superior',
  bottom: 'Inferior',
  left: 'Izquierdo',
  right: 'Derecho',
}

// Only what the drawing needs from an edge-banding record. Kept minimal on purpose: the optimizer's
// PlacedPieceEdges carries catalog identifiers that the public review response deliberately omits,
// so both satisfy this structurally without the drawing code knowing which one it got.
export interface DrawableEdges {
  sides: EdgeSide[]
  notation?: string | null
  color?: string | null
  bandType?: string | null
}

// Minimal structural shape shared by PlacedPiece (optimizer), CutPiece (orders) and
// ReviewPlacedPiece (review): enough to draw the scaled rectangle, its signature color, and the
// edge banding strips.
export interface DrawablePiece {
  x: number
  y: number
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  rotated: boolean
  edges?: DrawableEdges | null
}

// A piece the renderer can also identify, for highlighting and tap callbacks.
export type DrawnPiece = DrawablePiece & { pieceId: string }

// A leftover rectangle on the sheet, in the same mm coordinate space as the pieces. The optimizer,
// the cutting plan and the public review all send exactly these four numbers.
export interface DrawableRemainder {
  x: number
  y: number
  width: number
  height: number
}

// What SheetSvg needs to render one sheet, regardless of which endpoint produced it. Generic over
// the piece so callers get their own richer type back from the hover/tap callbacks.
export interface DrawableLayout<P extends DrawnPiece = DrawnPiece> {
  material: { width: number; height: number }
  placedPieces: P[]
  remainders: DrawableRemainder[]
}

// Leftover size drawn inside the rectangle: mm, no unit, like the piece labels. Rounded because a
// sub-millimetre leftover edge is noise on a saw whose kerf is 4 mm.
export const remainderLabel = (r: DrawableRemainder) =>
  `${Math.round(r.width)}×${Math.round(r.height)}`

// Hover text. Carries the unit and the area because it has the room the rectangle may not have, and
// it is the only way to read a small leftover without zooming in.
export const remainderTitle = (r: DrawableRemainder) =>
  `Sobrante ${remainderLabel(r)} mm · ${((r.width * r.height) / 1_000_000).toFixed(2)} m²`

// Identical pieces share the same nominal dimensions (originalWidth×originalHeight).
export const pieceSig = (p: Pick<DrawablePiece, 'originalWidth' | 'originalHeight'>) =>
  `${p.originalWidth}×${p.originalHeight}`

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

// Rotates the board content 90° clockwise and repositions it in the positive quadrant (the box
// [0,W]×[0,H] becomes [0,H]×[0,W]). Pair with a viewBox with swapped sides (H wide × W tall).
export const boardRotation = (height: number) => `translate(${height} 0) rotate(90)`

// Counter-rotation so a <text> inside the rotated group stays horizontal and readable, pivoting
// on its own anchor (use with textAnchor="middle" / dominantBaseline="central").
export const uprightText = (x: number, y: number) => `rotate(-90 ${x} ${y})`

export const bandedSides = (p: Pick<DrawablePiece, 'edges'>): EdgeSide[] => p.edges?.sides ?? []

export interface SideLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

// Edge banding line offset INWARD: with offset t/2 the outer edge of the stroke (thickness t)
// aligns with the piece boundary and the band grows inward. This shows which piece owns the edge
// without overlapping the cut line or invading the neighbor. Use with strokeLinecap="butt" and the
// same thickness t; adjacent two-side bands overlap cleanly at the corner.
export const insetSideLine = (
  side: EdgeSide,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): SideLine => {
  const o = t / 2
  switch (side) {
    case 'top':
      return { x1: x, y1: y + o, x2: x + w, y2: y + o }
    case 'bottom':
      return { x1: x, y1: y + h - o, x2: x + w, y2: y + h - o }
    case 'left':
      return { x1: x + o, y1: y, x2: x + o, y2: y + h }
    case 'right':
      return { x1: x + w - o, y1: y, x2: x + w - o, y2: y + h }
  }
}

// The optimizer suffixes a piece label with `#N` when it has several physical instances, so the
// base label is what a human recognises ("Puerta izq#2" → "Puerta izq"). Auto-generated ids
// (`piece_7`) carry no meaning and are reported as empty so callers can fall back to dimensions.
export const pieceLabel = (pieceId: string): string => {
  const base = pieceId.replace(/#\d+$/, '')
  return /^piece_\d+$/.test(base) ? '' : base
}
