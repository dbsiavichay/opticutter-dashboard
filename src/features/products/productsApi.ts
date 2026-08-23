import { httpClient } from 'src/shared/api/httpClient'
import { createCrudApi } from 'src/shared/api/crudApi'
import type {
  EdgeBandingProduct,
  Product,
  ProductListParams,
  ProductPayload,
  ProductSyncResult,
} from './types'

const BASE = '/api/v1/products'

// Server cap for `limit` (shared/pagination.py). Used to page through a full list.
const MAX_PAGE = 100

const crud = createCrudApi<Product, ProductListParams, ProductPayload, ProductPayload, string>(BASE)

export const productsApi = {
  ...crud,
  // Every product matching `params`, following pagination to the end. Only safe because the
  // endpoint orders by name; without a total order pages could repeat or skip rows.
  listAll: async (params?: ProductListParams): Promise<Product[]> => {
    const items: Product[] = []
    let total = Infinity
    while (items.length < total) {
      const page = await crud.list({ ...params, limit: MAX_PAGE, offset: items.length })
      total = page.pagination.total
      if (page.items.length === 0) break // defensive: never loop on an empty page
      items.push(...page.items)
    }
    return items
  },
  getByCode: (code: string) => httpClient.get<Product>(`${BASE}/code/${code}`),
  getEdgeBandings: (boardId: string, bandType?: string) => {
    const params = new URLSearchParams()
    if (bandType) params.set('band_type', bandType)
    const query = params.toString()
    return httpClient.get<EdgeBandingProduct[]>(
      `${BASE}/${boardId}/edge-bandings${query ? `?${query}` : ''}`,
    )
  },
  // Bulk upsert straight from the external inventory system's database — no
  // file to upload, the server reads the vendor's table itself. All-or-nothing
  // validation with row-level errors; `dryRun` runs the whole pass and rolls
  // back, so the operator sees the deletions before they happen.
  syncCatalog: (dryRun = false) =>
    httpClient.post<ProductSyncResult>(`${BASE}/sync?dryRun=${dryRun}`),
}
