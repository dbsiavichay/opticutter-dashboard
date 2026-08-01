import type { EdgeSide } from 'src/shared/utils/cutDrawing'

export type ReviewPreOrderStatus =
  | 'draft'
  | 'sent'
  | 'changes_requested'
  | 'confirmed'
  | 'rejected'
  | 'expired'
  | 'cancelled'

export interface ReviewLine {
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
  linearM?: number
}

// Edge banding info on a piece; keys arrive in snake_case from the server.
export interface ReviewEdges {
  sides?: string[]
  band_type?: string
}

// A cut-list piece on the public review (not billed per piece).
export interface ReviewPiece {
  label?: string
  materialCode?: string | null
  materialName?: string | null
  height?: number
  width?: number
  quantity?: number
  edges?: ReviewEdges | null
}

// A billed additional service (e.g. ensamble, corte) on the public review.
export interface ReviewService {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

// Edge banding of a piece in the diagram. Unlike the optimizer's PlacedPieceEdges this carries no
// catalog identifiers — the public endpoint strips them.
export interface ReviewPieceEdges {
  // Banded sides in geometric space (post-rotation): where the band physically goes on the sheet.
  sides: EdgeSide[]
  // The same bands in the piece's own frame — the one originalWidth/originalHeight and `notation`
  // refer to. Optional: a backend older than this field doesn't send it.
  nominalSides?: EdgeSide[]
  color?: string | null
  bandType?: string | null
  notation?: string | null
}

// A piece as laid out on the sheet. `pieceId` is the label the client typed, optionally suffixed
// `#N` when the label has several physical instances.
export interface ReviewPlacedPiece {
  pieceId: string
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
  originalWidth: number
  originalHeight: number
  edges?: ReviewPieceEdges | null
}

export interface ReviewSheet {
  materialName: string | null
  width: number
  height: number
  thickness: number
  halfBoard: boolean
}

// One cutting pattern plus how many physical sheets are cut that way. Carries no saw paths and no
// efficiency stats: the client is shown the arrangement, not the shop's nesting quality.
export interface ReviewLayoutGroup {
  count: number
  sheetNumbers: number[]
  sheet: ReviewSheet
  placedPieces: ReviewPlacedPiece[]
  remainders: { x: number; y: number; width: number; height: number }[]
  piecesCount: number
}

export interface ReviewPreOrder {
  reference: string // pre-order code (PRE-…), displayed as the document reference
  status: ReviewPreOrderStatus
  orderCode: string | null // null until confirmed; "ORD-…" after confirmation
  clientName: string
  clientNote: string | null // note written by the client when requesting changes
  notes: string | null // commercial reference (project/site), same text printed on the proforma
  currency: string
  subtotal: number
  priceTierName?: string
  discountRate?: number
  discountAmount?: number
  servicesTotal?: number
  total: number
  totalBoardsUsed: number
  totalPieces: number
  createdAt: string
  sentAt: string | null
  confirmedAt: string | null
  expiresAt: string | null
  lines: ReviewLine[]
  additionalServices?: ReviewService[]
  pieces: ReviewPiece[]
  layoutGroups: ReviewLayoutGroup[]
}
