import { useMutation, useQuery } from '@tanstack/react-query'

import { createCrudHooks } from 'src/shared/hooks/createCrudHooks'
import { productsApi } from './productsApi'
import type { Product, ProductListParams, ProductPayload } from './types'

const hooks = createCrudHooks<Product, ProductListParams, ProductPayload, ProductPayload, string>(
  'products',
  productsApi,
)

export const useProducts = hooks.useList
export const useCreateProduct = hooks.useCreate
export const useUpdateProduct = hooks.useUpdate
export const useDeleteProduct = hooks.useDelete

// The dry run behind the sync modal: the server runs the whole pass against the
// external inventory and rolls back, so the operator approves the deletions
// before they happen. Deliberately uncached (`gcTime: 0`) — a preview is only
// true for the instant it was taken, and it's what the operator is approving.
// `retry: false` so an unreachable inventory surfaces at once instead of after
// three silent attempts.
export const useCatalogSyncPreview = (enabled: boolean) =>
  useQuery({
    queryKey: ['catalog-sync-preview'],
    queryFn: () => productsApi.syncCatalog(true),
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })

// The real pass. The caller refreshes the catalog list, since only it knows
// whether anything actually changed.
export const useSyncCatalog = () =>
  useMutation({
    mutationFn: () => productsApi.syncCatalog(false),
  })
