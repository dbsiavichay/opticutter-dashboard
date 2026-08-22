import type { Client } from 'src/features/clients/types'
import type { BranchRef } from 'src/features/branches/types'
import type {
  AdditionalServiceInput,
  MaterialInput,
  OptimizeResponse,
  PackingStrategy,
  RequirementInput,
} from 'src/features/optimizer/types'

export type PreOrderStatus =
  | 'draft'
  | 'sent'
  | 'changes_requested'
  | 'confirmed'
  | 'rejected'
  | 'expired'
  | 'cancelled'

// Listing order. Unlike orders — whose backend defaults to `oldest` because the workshop reads that
// listing FIFO — this one defaults to `recent` on both sides: nothing reads quotes in arrival order.
export type PreOrderSort = 'oldest' | 'recent'

export interface PreOrderListParams {
  // One or more statuses; with multiple the backend receives repeated `status` params.
  status?: PreOrderStatus | PreOrderStatus[]
  clientId?: number
  // Effective filter for global roles (admin and vendedor); operador is always scoped to their branch.
  branchId?: number
  // Quote code or id, or the client's identifier / first / last name.
  search?: string
  // Inclusive day bounds on createdAt, as `YYYY-MM-DD`. The backend compares them against a
  // UTC-naive column, so the cut is a UTC day (see "UTC-naive timestamps" in CLAUDE.md).
  createdFrom?: string
  createdTo?: string
  sort?: PreOrderSort
  offset?: number
  limit?: number
}

export interface PreOrderSummary {
  id: number
  code: string
  client: Client
  // Owning branch (required FK): always present in list and detail responses.
  branch: BranchRef
  status: PreOrderStatus
  // Commercial reference (project/site name) typed by the seller: the differentiator when the
  // same client has several quotes running. Shown as a subtitle under the code in the listing.
  notes: string | null
  source: string
  orderId: number | null
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

// Audit log (PR #39): timeline of pre-order status changes.
export interface PreOrderStatusHistoryEntry {
  id: number
  fromStatus?: PreOrderStatus
  toStatus: PreOrderStatus
  actor?: 'staff' | 'client' | 'system'
  actorUserId?: number | null
  actorLabel?: string | null
  note?: string | null
  createdAt: string
}

export interface PreOrder extends PreOrderSummary {
  clientNote: string | null // note written by client when requesting changes
  sentAt: string | null
  confirmedAt: string | null
  priceTierCode?: string
  strategy?: PackingStrategy
  // Alternative-solution seed remembered for the recompute (0 = canonical).
  variant?: number
  // Always present in GET /preorders/{id} and PUT responses
  materials: MaterialInput[]
  requirements: RequirementInput[]
  additionalServices: AdditionalServiceInput[]
  optimization: OptimizeResponse
  history: PreOrderStatusHistoryEntry[]
}

export interface PreOrderCreate {
  clientId: number
  notes?: string
  source?: string
  priceTierCode?: string
  strategy?: PackingStrategy
  variant?: number
  materials: MaterialInput[]
  requirements: RequirementInput[]
  additionalServices?: AdditionalServiceInput[]
  // Operador: omitted (backend uses their branch). Vendedor: optional (backend uses home branch if omitted).
  // Admin: required.
  branchId?: number
}

export interface ReviewLink {
  token: string
  url: string
  status: string
  expiresAt: string
  createdAt: string
}

export interface ReviewLinkInfo {
  status: 'active' | 'used' | 'revoked'
  createdAt: string
  expiresAt: string
  usedAt: string | null
}
