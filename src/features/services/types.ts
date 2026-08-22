import type { ListSort } from 'src/shared/components/FilterSortSection'

export interface AdditionalService {
  id: string
  name: string
  price: number
  isActive: boolean
}

export interface AdditionalServicePayload {
  name: string
  price: number
  isActive: boolean
}

export interface AdditionalServiceListParams {
  search?: string
  // Omit to list active and inactive alike (what the catalog admin needs).
  isActive?: boolean
  sort?: ListSort
  offset?: number
  limit?: number
}
