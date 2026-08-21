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
  // snake_case on purpose: `toQuery` sends keys verbatim and the API param is `is_active`.
  // Omit it to list active and inactive alike (what the catalog admin needs).
  is_active?: boolean
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

export interface ProductSyncResult {
  created: number
  updated: number
  deactivated: number
  deleted: number
  skippedMedio: number
}
