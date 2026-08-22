import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { preordersApi } from './preordersApi'
import type { PreOrderCreate, PreOrderListParams, PreOrderStatus } from './types'

export const usePreOrders = (params?: PreOrderListParams) =>
  useQuery({
    queryKey: ['preorders', params],
    queryFn: () => preordersApi.list(params),
    // Every filter edit and page turn is a new query key. Without this the table is torn down to a
    // spinner on each one — the list flashes away under the very toolbar being used to narrow it.
    placeholderData: keepPreviousData,
  })

export const usePreOrder = (id?: number) =>
  useQuery({
    queryKey: ['preorders', id],
    queryFn: () => preordersApi.get(id as number),
    enabled: !!id,
  })

export const useCreatePreOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PreOrderCreate) => preordersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preorders'] }),
  })
}

export const useUpdatePreOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PreOrderCreate> }) =>
      preordersApi.update(id, data),
    // A single broad invalidation covers both the detail (['preorders', id]) and the list; also
    // invalidating the exact detail key would refetch that same query a second time.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preorders'] }),
  })
}

export const useDeletePreOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => preordersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preorders'] }),
  })
}

export const useCreatePreOrderReviewLink = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => preordersApi.createReviewLink(id),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: ['preorder-link', id] }),
  })
}

export const usePreOrderReviewLinkInfo = (id?: number, status?: PreOrderStatus) =>
  useQuery({
    queryKey: ['preorder-link', id],
    queryFn: () => preordersApi.getReviewLinkInfo(id as number),
    enabled: !!id && (status === 'draft' || status === 'sent' || status === 'changes_requested'),
    retry: false,
  })
