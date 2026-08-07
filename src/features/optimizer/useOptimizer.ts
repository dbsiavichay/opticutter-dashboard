import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import { useMutation, useQuery } from '@tanstack/react-query'

import { optimizerApi } from './optimizerApi'
import { productsApi } from 'src/features/products/productsApi'

export const useOptimize = () =>
  useMutation({
    mutationFn: optimizerApi.optimize,
  })

// Catalog boards (products type=board). `select` narrows them to BoardProduct[].
// The limit caps what the board picker and the CSV import can match against, so it is generous:
// a board past it is invisible to both. A server-searched select would be the real fix.
export const useBoards = () =>
  useQuery({
    queryKey: ['boards'],
    queryFn: () => productsApi.list({ type: 'board', limit: 100 }),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.items.filter((p): p is BoardProduct => p.type === 'board'),
  })

// Catalog edge bandings (products type=edge_banding).
export const useEdgeBandings = () =>
  useQuery({
    queryKey: ['edge-bandings'],
    queryFn: () => productsApi.list({ type: 'edge_banding', limit: 100 }),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.items.filter((p): p is EdgeBandingProduct => p.type === 'edge_banding'),
  })

// Edge bandings coordinated with a board (same `family` + width rule), from
// GET /products/{boardId}/edge-bandings. Fetches the whole coordinated set (no band_type
// param) so the soft/hard filter can be applied client-side. Disabled without a board.
export const useBoardEdgeBandings = (boardId?: string) =>
  useQuery({
    queryKey: ['board-edge-bandings', String(boardId ?? '')],
    queryFn: () => productsApi.getEdgeBandings(String(boardId)),
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000,
  })
