import { useCallback, useMemo, useState } from 'react'

import type { MaterialForm } from './optimizerForm'

// Which material groups are folded, keyed by uid (expanded by default = not in the set). This used
// to be local state inside `MaterialGroups`, but the control that toggles them all now lives in the
// page's actions menu, outside that component — so the page owns it, like every other piece of
// workspace state.
export interface CollapsedGroups {
  collapsed: Set<string>
  toggle: (uid: string) => void
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

  const allCollapsed = useMemo(
    () => materials.length > 0 && materials.every((m) => collapsed.has(m.uid)),
    [materials, collapsed],
  )

  const toggleAll = useCallback(
    () => setCollapsed(allCollapsed ? new Set() : new Set(materials.map((m) => m.uid))),
    [allCollapsed, materials],
  )

  return { collapsed, toggle, allCollapsed, toggleAll }
}

export default useCollapsedGroups
