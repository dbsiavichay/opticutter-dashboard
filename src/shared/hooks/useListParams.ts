import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PAGE_SIZE } from 'src/shared/constants'

// Filter/pagination state for a list page, kept in the URL's search params instead of component
// state. Three things follow from that and none of them work otherwise: the view is linkable, the
// back button undoes a filter choice, and coming back from a detail page restores the exact list
// the row was clicked from — which is what `ordersFilterStore` used to approximate with a zustand
// singleton that survived the unmount but not a refresh.
//
// A search param leaves `pathname` alone, so `AppContent`'s ErrorBoundary (keyed on pathname) never
// remounts the page. Same reasoning as the optimizer's `?step=` and the pre-order's `?panel=`.
export const useListParams = () => {
  const [params, writeSearchParams] = useSearchParams()

  const write = useCallback(
    (mutate: (sp: URLSearchParams) => void, replace: boolean) => {
      writeSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev)
          mutate(sp)
          return sp
        },
        { replace },
      )
    },
    [writeSearchParams],
  )

  const getParam = useCallback((key: string) => params.get(key) ?? '', [params])
  const getParams = useCallback((key: string) => params.getAll(key), [params])

  // Every filter write drops `offset`: the row that sat at offset 40 of the previous result set
  // means nothing in the new one, and landing on an empty page reads as "no results".
  // `replace` for the search box — one history entry per settled keystroke would bury the page
  // the user came from; a push for the discrete choices, so back undoes them one at a time.
  // Several filter keys in ONE url update, for an action that changes more than one at a time:
  // narrowing the product types strands the subtypes that no longer belong to them, and the two
  // must move together. Two `setParam` calls in the same tick do NOT compose — react-router's
  // functional updater still receives the pre-update params, so the second write wins and the first
  // is silently lost. Same reason `setLimit` drops `offset` itself.
  const setParams = useCallback(
    (values: Record<string, string | string[] | undefined>, options?: { replace?: boolean }) => {
      write((sp) => {
        sp.delete('offset')
        Object.entries(values).forEach(([key, value]) => {
          sp.delete(key)
          const list = value == null ? [] : Array.isArray(value) ? value : [value]
          list.filter((v) => v !== '').forEach((v) => sp.append(key, v))
        })
      }, options?.replace ?? false)
    },
    [write],
  )

  const setParam = useCallback(
    (key: string, value: string | string[] | undefined, options?: { replace?: boolean }) => {
      setParams({ [key]: value }, options)
    },
    [setParams],
  )

  const clearParams = useCallback(
    (keys: string[]) => {
      write((sp) => {
        keys.forEach((k) => sp.delete(k))
        sp.delete('offset')
      }, false)
    },
    [write],
  )

  // Page size, like the page itself, belongs in the URL: a link to "the 100-row view of this
  // filter" is one of the things a shareable listing is for. Not a filter, though — "Limpiar
  // filtros" leaves it alone.
  const limit = Number(params.get('limit') ?? 0) || PAGE_SIZE
  const setLimit = useCallback(
    (next: number) => {
      write((sp) => {
        sp.delete('offset')
        if (next === PAGE_SIZE) sp.delete('limit')
        else sp.set('limit', String(next))
      }, false)
    },
    [write],
  )

  const offset = Number(params.get('offset') ?? 0) || 0
  const setOffset = useCallback(
    (next: number) => {
      write((sp) => {
        if (next > 0) sp.set('offset', String(next))
        else sp.delete('offset')
      }, false)
    },
    [write],
  )

  return {
    getParam,
    getParams,
    setParam,
    setParams,
    clearParams,
    offset,
    setOffset,
    limit,
    setLimit,
  }
}
