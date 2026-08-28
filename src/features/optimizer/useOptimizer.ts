import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import { useMutation, useQuery } from '@tanstack/react-query'

import { optimizerApi } from './optimizerApi'
import { productsApi } from 'src/features/products/productsApi'
import { REFERENCE_STALE_TIME } from 'src/shared/constants'

export const useOptimize = () =>
  useMutation({
    mutationFn: optimizerApi.optimize,
  })

// Every active catalog board (products type=board). Pages through the whole list for the same
// reason the edge bandings below do, and it is not optional: the picker, the CSV import matcher
// and the id→board lookup of a saved quote all match against this one array, so a silent cut at
// the server's 100-row cap makes a board unselectable AND shows a saved quote's board as
// unpicked. The real catalog is past 200 boards. Paging is safe because the endpoint orders by
// name. `select` narrows them to BoardProduct[].
export const useBoards = () =>
  useQuery({
    queryKey: ['boards'],
    queryFn: () => productsApi.listAll({ type: ['board'], isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
    select: (items) => items.filter((p): p is BoardProduct => p.type === 'board'),
  })

// Every active edge banding in the catalog, paged through for the same reason as the boards: it
// backs the "Seleccionar otro…" picker (which promises the complete catalog) and the id→product
// lookup that derives a saved tapacanto's band type, so a silent cut at 100 would show a quote's
// tapacanto as missing. Paging is safe because the endpoint orders by name.
export const useEdgeBandings = () =>
  useQuery({
    queryKey: ['edge-bandings'],
    queryFn: () => productsApi.listAll({ type: ['edge_banding'], isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
    select: (items) => items.filter((p): p is EdgeBandingProduct => p.type === 'edge_banding'),
  })

// Edge bandings coordinated with a board (same `family` + width rule), from
// GET /products/{boardId}/edge-bandings. Fetches the whole coordinated set (no band_type
// param) so the soft/hard filter can be applied client-side. Disabled without a board.
export const useBoardEdgeBandings = (boardId?: string) =>
  useQuery({
    queryKey: ['board-edge-bandings', String(boardId ?? '')],
    queryFn: () => productsApi.getEdgeBandings(String(boardId)),
    enabled: !!boardId,
    staleTime: REFERENCE_STALE_TIME,
  })
