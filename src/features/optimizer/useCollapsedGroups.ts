import { useCallback, useMemo, useState } from 'react'

import type { MaterialForm } from './optimizerForm'

// Which material groups are folded, keyed by uid (expanded by default = not in the set). This used
// to be local state inside `MaterialGroups`, but the control that toggles them all now lives in the
// page's actions menu, outside that component — so the page owns it, like every other piece of
// workspace state.
export interface CollapsedGroups {
  collapsed: Set<string>
  toggle: (uid: string) => void
  // Unfold one group, idempotently. `toggle` cannot serve here: the navigation reveals a piece
  // without knowing whether its group was folded, and toggling an open one would hide the row it
  // is about to scroll to.
  expand: (uid: string) => void
  allCollapsed: boolean
  toggleAll: () => void
}

export const useCollapsedGroups = (materials: MaterialForm[]): CollapsedGroups => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = useCallback(
    (uid: string) =>
      setCollapsed((s) => {
        const next = new Set(s)
        if (next.has(uid)) next.delete(uid)
        else next.add(uid)
        return next
      }),
    [],
  )

  const expand = useCallback(
    (uid: string) =>
      setCollapsed((s) => {
        if (!s.has(uid)) return s
        const next = new Set(s)
        next.delete(uid)
        return next
      }),
    [],
  )

  const allCollapsed = useMemo(
    () => materials.length > 0 && materials.every((m) => collapsed.has(m.uid)),
    [materials, collapsed],
  )

  const toggleAll = useCallback(
    () => setCollapsed(allCollapsed ? new Set() : new Set(materials.map((m) => m.uid))),
    [allCollapsed, materials],
  )

  return { collapsed, toggle, expand, allCollapsed, toggleAll }
}

export default useCollapsedGroups
