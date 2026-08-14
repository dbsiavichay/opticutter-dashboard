import type { Client } from 'src/features/clients/types'
import type { BranchRef } from 'src/features/branches/types'
import type { EdgeSide } from 'src/shared/utils/cutDrawing'
import type { MaterialForm, RequirementForm } from './optimizerForm'

// Response types for POST /api/v1/optimize/. The contract is deterministic and cached by
// input hash; see the endpoint spec for field details.

export type PackingStrategy = 'default' | 'longOffcuts'

// Portal target for the optimizer's modals. CModal portals to document.body by default, which sits
// OUTSIDE the element handed to the Fullscreen API — the modal would render behind the fullscreen
// page and be invisible. Pointing it at the fullscreen host keeps it visible in both modes.
export type ModalContainer = () => Element | null

// Fill order for a catalog board that carries pooled offcuts (same material).
// 'auto' lets the backend pick the least-waste layout; the others force it.
export type PoolFillOrder = 'auto' | 'offcutsFirst' | 'catalogFirst'

export type MaterialSourceKind = 'catalog' | 'companyOffcut' | 'clientOffcut' | 'manual'

// Defined with the drawing primitives (shared/) since that's what consumes it; re-exported here
// so the rest of the optimizer keeps importing its types from one place.
export type { EdgeSide }

// Physical material of a sheet, as returned in each Layout.
export interface OptimizeMaterialSheet {
  materialKey: string
  sheetNumber: number
  height: number
  width: number
  thickness: number
  area: number
  halfBoard?: boolean
}

// Edge banding for a piece. Keys arrive in snake_case from the server.
export interface PlacedPieceEdges {
  // Banded sides in geometric space (post-rotation).
  sides: EdgeSide[]
  product_id: number | null
  code: string | null
  color: string | null
  notation: string | null
}

export interface PlacedPiece {
  pieceId: string
  x: number
  y: number
  height: number
  width: number
  rotated: boolean
  originalHeight: number
  originalWidth: number
  // Edge banding applied to the piece, or null if none. See PlacedPieceEdges.
  edges?: PlacedPieceEdges | null
}

export interface Remainder {
  x: number
  y: number
  height: number
  width: number
}

export interface LayoutStatistics {
  usedArea: number
  wasteArea: number
  efficiency: number
  piecesCount: number
  cutLinearM: number
  edgeBandingLinearM: number
}

export interface Layout {
  material: OptimizeMaterialSheet
  placedPieces: PlacedPiece[]
  statistics: LayoutStatistics
  remainders: Remainder[]
}

export interface MaterialSummary {
  materialKey: string
  source: MaterialSourceKind
  productId?: number
  productCode?: string
  productName?: string
  height: number
  width: number
  thickness: number
  count: number
  totalAreaM2: number
  avgEfficiency: number
  costPerUnit: number
  totalCost: number
  halfBoard?: boolean
}

export interface EdgeBandingSummary {
  productId: number | null
  productCode: string | null
  productName: string | null
  thickness: number | null
  color?: string | null
  netLinearM: number
  linearM: number
  billedLinearM: number
  pricePerM: number
  totalCost: number
}

// Groups sheets sharing the same cut pattern (deduplicated for the diagram).
export interface LayoutGroup {
  patternId: number
  count: number
  sheetNumbers: number[]
  materialKey: string
  layout: Layout
}

export interface PricingData {
  priceTierCode: string
  priceTierName: string
  discountRate: number
  discountBase: number
  subtotal: number
  discountAmount: number
  // Sum of additional services (added after the discount). Optional: absent on
  // raw /optimize responses and pre-feature snapshots.
  servicesTotal?: number
  total: number
}

export interface OptimizeResponse {
  id: null
  client: Client | null
  optimizationHash: string | null
  totalBoardsUsed: number
  totalBoardsCost?: number
  totalEdgeBandingCost?: number
  totalCutLinearM?: number
  totalEdgeBandingLinearM?: number
  layouts: Layout[]
  materialsSummary: MaterialSummary[]
  edgeBandingsSummary: EdgeBandingSummary[]
  layoutGroups: LayoutGroup[]
  pricing?: PricingData
  strategy?: PackingStrategy
  // Alternative-solution seed this result was computed with (0 = canonical).
  variant?: number
}

// --- Request inputs (what the frontend sends) ---

export interface CatalogMaterialInput {
  key: string
  source: 'catalog'
  productId: number
  // Fill order when this board has attached (pooled) offcuts; omitted otherwise.
  fillOrder?: PoolFillOrder
}

export interface InlineMaterialInput {
  key: string
  source: Exclude<MaterialSourceKind, 'catalog'>
  height: number
  width: number
  thickness: number
  costPerUnit?: number
  label?: string
  // Finite units available (pooled offcut). Defaults to 1 server-side.
  quantity?: number
  // If set, this offcut is extra stock of the catalog board with this key: its
  // pieces come from that board's requirements, packed across board + offcuts.
  poolKey?: string
}

export type MaterialInput = CatalogMaterialInput | InlineMaterialInput

export interface EdgeBandingSpec {
  sides: EdgeSide[]
  productId?: number
}

export interface RequirementInput {
  materialKey: string
  height: number
  width: number
  quantity: number
  priority: number
  label?: string
  canRotate: boolean
  edgeBanding?: EdgeBandingSpec
}

// Billed additional service on a quote (qty × editable unit price). Not cut
// geometry: it rides alongside the optimizer inputs and is folded into the total
// server-side, after the discount.
export interface AdditionalServiceInput {
  serviceId?: number
  name: string
  unitPrice: number
  quantity: number
}

export interface OptimizePayload {
  materials: MaterialInput[]
  requirements: RequirementInput[]
  clientId?: number
  priceTierCode?: string
  strategy?: PackingStrategy
  // Alternative-solution seed: bump it ("Generar otra alternativa") to get a
  // genuinely different deterministic layout when alternatives exist.
  variant?: number
}

// --- Optimizer drafts (persistence) ---

// What gets persisted is the RAW FORM STATE (including `uid` values), not the `buildPayload()` contract.
// This allows the form to be reconstructed exactly, including incomplete/invalid rows.
// The backend treats `payload` as opaque JSON; `version` allows future migrations.
export interface OptimizerDraftPayload {
  version: 1
  materials: MaterialForm[]
  requirements: RequirementForm[]
  // Billed additional services. Optional because drafts saved before the wizard had a services step
  // do not carry the key; the backend stores `payload` as an opaque JSON object, so adding it needed
  // no schema change on that side.
  additionalServices?: AdditionalServiceInput[]
}

// List item (no payload).
export interface DraftSummary {
  id: number
  name: string
  clientId: number | null
  // Owning branch (required FK): always present in list and detail responses.
  branch: BranchRef
  createdAt: string
  updatedAt: string
}

// Detail item (includes payload).
export interface Draft extends DraftSummary {
  payload: OptimizerDraftPayload
}
