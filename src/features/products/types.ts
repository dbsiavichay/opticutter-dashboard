import type { ListSort } from 'src/shared/components/FilterSortSection'

export type ProductType = 'board' | 'edge_banding'

export interface BoardAttributes {
  height?: number
  width?: number
  thickness?: number
  grainDirection?: string
  subtype?: string
  family?: string
}

export interface EdgeBandingAttributes {
  thickness?: number
  width?: number
  length?: number
  bandType?: string
  color?: string
  subtype?: string
  family?: string
  alias?: string
}

interface ProductBase {
  id: string
  code: string
  externalCode?: string | null
  name: string
  description?: string | null
  price: number
  isActive: boolean
}

export interface BoardProduct extends ProductBase {
  type: 'board'
  attributes: BoardAttributes
}

export interface EdgeBandingProduct extends ProductBase {
  type: 'edge_banding'
  attributes: EdgeBandingAttributes
}

/** Discriminated union on `type` — narrow with `product.type === 'board'`. */
export type Product = BoardProduct | EdgeBandingProduct

export interface ProductListParams {
  // One or more types/subtypes; with multiple, `toQuery` sends repeated params
  // (?type=a&type=b), same convention as orders' `status`.
  type?: ProductType[]
  subtype?: string[]
  search?: string
  offset?: number
  limit?: number
  // Omit it to list active and inactive alike (what the catalog admin needs). Was `is_active`:
  // that was the only query param in the API still snake_case on the wire, while its own request
  // body already used `isActive`.
  isActive?: boolean
  sort?: ListSort
}

export interface ProductPayload {
  code: string
  name: string
  description?: string | null
  type: ProductType
  price: number
  isActive?: boolean
  attributes: BoardAttributes | EdgeBandingAttributes
}

/** A source row the sync couldn't import, identified the way the operator
 *  finds it in the inventory system: by code and article name. */
export interface ProductSyncIssue {
  code: string
  name: string
  message: string
}

export interface ProductSyncResult {
  created: number
  updated: number
  deactivated: number
  deleted: number
  skippedMedio: number
  /** Articles the inventory system has taken out of service (est/FecEli). */
  skippedInactive: number
  /** Rows whose data couldn't be parsed. Skipped, never fatal — and left
   *  untouched in the catalog rather than treated as removed. */
  skippedInvalid: number
  issues: ProductSyncIssue[]
  /** True when the pass ran and rolled back: a preview, nothing was written. */
  dryRun: boolean
}
