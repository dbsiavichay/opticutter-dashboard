import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from 'src/shared/api/types'
import { ordersApi } from './ordersApi'
import type {
  OrderListParams,
  UpdateStatusPayload,
  AssociateInvoicePayload,
  BandingPayload,
  ChangeBranchPayload,
  CuttingPlan,
  MarkPieceResponse,
} from './types'

const WORKSHOP_QUEUE_KEY = ['orders', 'workshop-queue'] as const

export const useOrders = (params?: OrderListParams) =>
  useQuery({
    queryKey: ['orders', params],
    queryFn: () => ordersApi.list(params),
    // Every filter edit and page turn is a new query key. Without this the table is torn down to a
    // spinner on each one — the list flashes away under the very toolbar being used to narrow it.
    placeholderData: keepPreviousData,
  })

export const useOrder = (id?: string) =>
  useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersApi.get(id as string),
    enabled: !!id,
  })

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStatusPayload }) =>
      ordersApi.updateStatus(id, data),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['orders', id] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: WORKSHOP_QUEUE_KEY })
    },
  })
}

// Rebalancing: moves an order to another branch before the workshop starts cutting.
export const useChangeOrderBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeBranchPayload }) =>
      ordersApi.changeBranch(id, data),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['orders', id] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: WORKSHOP_QUEUE_KEY })
    },
  })
}

// --- Attachments (anexos) ---

const attachmentsKey = (id: string) => ['orders', id, 'attachments'] as const

export const useAttachments = (id?: string) =>
  useQuery({
    queryKey: ['orders', id, 'attachments'],
    queryFn: () => ordersApi.listAttachments(id as string),
    enabled: !!id,
  })

export const useUploadAttachment = (orderId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => ordersApi.uploadAttachment(orderId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsKey(orderId) }),
  })
}

export const useDeleteAttachment = (orderId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: number) => ordersApi.deleteAttachment(orderId, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsKey(orderId) }),
  })
}

// --- Workshop board (shared by operador + canteador) ---

export const useWorkshopQueue = () =>
  useQuery({
    queryKey: WORKSHOP_QUEUE_KEY,
    queryFn: () => ordersApi.getWorkshopQueue(),
    // The board is shared: the operador takes an order on the shop-floor panel and, without this,
    // the canteador's screen keeps offering "Tomar" on it until someone reloads. Same interval as
    // `usePrintJobs`, which paints directly above it. It also keeps each card's "en cola hace N min"
    // moving without a re-render of its own.
    refetchInterval: 15000,
  })

export const useAssociateInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssociateInvoicePayload }) =>
      ordersApi.associateInvoice(id, data),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['orders', id] })
    },
  })
}

// --- Banding ---

// Advances the banding track and refreshes the workshop board + the order detail/list.
// When moving to `done` the banding action disappears from the board on the next refetch.
export const useUpdateBanding = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BandingPayload }) =>
      ordersApi.patchBanding(id, data),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: WORKSHOP_QUEUE_KEY })
      void qc.invalidateQueries({ queryKey: ['orders', id] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

const cuttingPlanKey = (id: string) => ['orders', id, 'cutting-plan']

// Optimistic flip for a single piece: updates its board counters and the plan total only if the
// state actually changed (idempotent against double-taps or re-marking).
const applyCut = (plan: CuttingPlan, pieceId: number, cut: boolean): CuttingPlan => {
  let changed = false
  const boards = plan.boards.map((board) => {
    const idx = board.pieces.findIndex((p) => p.id === pieceId)
    if (idx === -1) return board
    const piece = board.pieces[idx]
    if (!piece || piece.cut === cut) return board
    changed = true
    const pieces = board.pieces.slice()
    pieces[idx] = { ...piece, cut }
    const delta = cut ? 1 : -1
    return {
      ...board,
      pieces,
      progress: { ...board.progress, cutPieces: board.progress.cutPieces + delta },
    }
  })
  if (!changed) return plan
  const delta = cut ? 1 : -1
  return {
    ...plan,
    boards,
    progress: { ...plan.progress, cutPieces: plan.progress.cutPieces + delta },
  }
}

// Reconciles the cache with the PATCH response (progress/boardProgress already recalculated by the API).
const reconcile = (plan: CuttingPlan, res: MarkPieceResponse): CuttingPlan => ({
  ...plan,
  progress: res.progress,
  boards: plan.boards.map((board) => {
    const idx = board.pieces.findIndex((p) => p.id === res.piece.id)
    if (idx === -1) return board
    const pieces = board.pieces.slice()
    pieces[idx] = res.piece
    return { ...board, pieces, progress: res.boardProgress }
  }),
})

export const useCuttingPlan = (id?: string, enabled = true) =>
  useQuery({
    queryKey: ['orders', id, 'cutting-plan'],
    queryFn: () => ordersApi.getCuttingPlan(id as string),
    enabled: !!id && enabled,
  })

export const useMarkPiece = (orderId: string) => {
  const qc = useQueryClient()
  const key = cuttingPlanKey(orderId)
  return useMutation({
    mutationFn: ({ pieceId, cut }: { pieceId: number; cut: boolean }) =>
      ordersApi.markPiece(orderId, pieceId, cut),
    onMutate: async ({ pieceId, cut }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<CuttingPlan>(key)
      if (prev) qc.setQueryData<CuttingPlan>(key, applyCut(prev, pieceId, cut))
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      // 404: local plan is stale (e.g. order was recreated) → invalidate and refetch from server.
      if (err instanceof ApiError && err.status === 404)
        void qc.invalidateQueries({ queryKey: key })
    },
    onSuccess: (res) => {
      // Multi-operator (last write wins): sync with the real counters from the API response.
      qc.setQueryData<CuttingPlan>(key, (cur) => (cur ? reconcile(cur, res) : cur))
    },
  })
}
