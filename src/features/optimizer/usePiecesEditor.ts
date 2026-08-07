import { useCallback, useState } from 'react'

import { cloneRequirement, emptyRequirement, isRequirementEmpty } from './optimizerForm'
import type { MaterialForm, RequirementForm } from './optimizerForm'

// Campos que admiten "rellenar hacia abajo" (aplicar de una fila a varias).
export type FillableField =
  | 'materialUid'
  | 'height'
  | 'width'
  | 'quantity'
  | 'priority'
  | 'label'
  | 'canRotate'
  | 'edgeBanding'
  | 'edgeBandingSides'
  | 'edgeBandingProductId'
  | 'edgeBandingBandType'
export type FillScope = 'all' | 'selected'

// Campos por los que se puede ordenar una tabla de grupo.
export type SortField = 'height' | 'width' | 'quantity' | 'priority' | 'label'
export type SortDir = 'asc' | 'desc'

const MAX_HISTORY = 20

// Clusters requirements so pieces of the same material are contiguous, in first-appearance order.
// The grouped view (MaterialGroups) relies on each material occupying a single contiguous
// flat-index range; the flat view (PiecesTable) is agnostic to order, so clustering is safe for both.
const clusterByMaterial = (rs: RequirementForm[]): RequirementForm[] => {
  const order: string[] = []
  const buckets = new Map<string, RequirementForm[]>()
  for (const r of rs) {
    let bucket = buckets.get(r.materialUid)
    if (!bucket) {
      bucket = []
      buckets.set(r.materialUid, bucket)
      order.push(r.materialUid)
    }
    bucket.push(r)
  }
  return order.flatMap((uid) => buckets.get(uid) ?? [])
}

// Contiguous flat-index range [start, end) of a material's block (assumes the list is clustered).
const rangeOf = (rs: RequirementForm[], uid: string): [number, number] => {
  const start = rs.findIndex((r) => r.materialUid === uid)
  if (start < 0) return [rs.length, rs.length]
  let end = start
  while (end < rs.length && rs[end]?.materialUid === uid) end++
  return [start, end]
}

// Applies a single field value from `src` onto `r`. Edge-banding sub-fields are copied immutably.
const applyField = (
  r: RequirementForm,
  src: RequirementForm,
  field: FillableField,
): RequirementForm => {
  if (field === 'edgeBanding') {
    return {
      ...r,
      edgeBanding: {
        productId: src.edgeBanding.productId,
        sides: { ...src.edgeBanding.sides },
        bandType: src.edgeBanding.bandType ?? '',
      },
    }
  }
  if (field === 'edgeBandingSides') {
    return { ...r, edgeBanding: { ...r.edgeBanding, sides: { ...src.edgeBanding.sides } } }
  }
  if (field === 'edgeBandingProductId') {
    return { ...r, edgeBanding: { ...r.edgeBanding, productId: src.edgeBanding.productId } }
  }
  if (field === 'edgeBandingBandType') {
    // Mirror the manual "Tipo" select: the band type and its coordinated tapacanto travel
    // together, so a drag-fill of this column doesn't leave target rows without a product.
    return {
      ...r,
      edgeBanding: {
        ...r.edgeBanding,
        bandType: src.edgeBanding.bandType ?? '',
        productId: src.edgeBanding.productId,
      },
    }
  }
  return { ...r, [field]: src[field] }
}

// Comparator for a sortable field. Blank numeric cells sink to the bottom; labels sort locale-aware.
const compareBy = (a: RequirementForm, b: RequirementForm, field: SortField): number => {
  if (field === 'label') {
    return a.label.trim().localeCompare(b.label.trim(), 'es', { sensitivity: 'base' })
  }
  const an = Number(a[field])
  const bn = Number(b[field])
  const av = Number.isFinite(an) ? an : Infinity
  const bv = Number.isFinite(bn) ? bn : Infinity
  return av - bv
}

// Encapsulates the piece list and all bulk editing operations (paste, duplicate, fill-down,
// multi-select, focus, undo history). Follows the project style: flat state + immutable updates.
// Serves both the flat table (PiecesTable) and the grouped view (MaterialGroups): the list is kept
// clustered by material so each material owns a contiguous index range.
export const usePiecesEditor = (materials: MaterialForm[], initial?: RequirementForm[]) => {
  const firstUid = () => materials[0]?.uid ?? ''
  // `initial` is only used to hydrate the initial state (e.g. from autosave). Passing it in
  // subsequent renders does not reset the list: later edits take precedence.
  const [requirements, setRequirements] = useState<RequirementForm[]>(() =>
    clusterByMaterial(initial && initial.length ? initial : [emptyRequirement(firstUid())]),
  )
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  // Row index to focus after adding (consumed by the table and then cleared).
  const [focusRow, setFocusRow] = useState<number | null>(null)
  // Undo history stack. Stores snapshots before structural operations (not on every keystroke).
  const [history, setHistory] = useState<RequirementForm[][]>([])

  const clearFocus = useCallback(() => setFocusRow(null), [])

  // Saves current state to history then applies the updater. Do not use in `update` (keystroke).
  const applyWithHistory = (updater: (rs: RequirementForm[]) => RequirementForm[]) => {
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), requirements])
    setRequirements(updater)
  }

  const undo = useCallback(() => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setRequirements(prev)
    setSelected(new Set())
  }, [history])

  // Flat table: adds a blank row inheriting the material from the last row (or the first available).
  const add = () => {
    applyWithHistory((rs) => {
      const inheritUid = rs[rs.length - 1]?.materialUid || firstUid()
      return [...rs, emptyRequirement(inheritUid)]
    })
    setFocusRow(requirements.length)
    setSelected(new Set())
  }

  // Grouped view: adds a blank row at the end of a specific material's group and focuses it.
  const addTo = (materialUid: string) => {
    const [, end] = rangeOf(requirements, materialUid)
    applyWithHistory((rs) => {
      const [, e] = rangeOf(rs, materialUid)
      const copy = [...rs]
      copy.splice(e, 0, emptyRequirement(materialUid))
      return copy
    })
    setFocusRow(end)
    setSelected(new Set())
  }

  // Adds imported/pasted rows. `replace` replaces the list; otherwise appends (replacing a single
  // blank row if that is all that exists). The result is reclustered so multi-material imports group.
  // Returns the resulting list so the caller can prune material groups that ended up with no pieces.
  const addMany = (rows: RequirementForm[], replace: boolean): RequirementForm[] => {
    const rs = requirements
    const next = replace
      ? clusterByMaterial(rows.length ? rows : [emptyRequirement(firstUid())])
      : rs.length === 1 && rs[0] && isRequirementEmpty(rs[0])
        ? clusterByMaterial(rows.length ? rows : rs)
        : clusterByMaterial([...rs, ...rows])
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), rs])
    setRequirements(next)
    setSelected(new Set())
    return next
  }

  const remove = (i: number) => {
    applyWithHistory((rs) => rs.filter((_, idx) => idx !== i))
    setSelected(new Set())
  }

  const removeSelected = () => {
    applyWithHistory((rs) => {
      const kept = rs.filter((_, i) => !selected.has(i))
      return kept.length ? kept : [emptyRequirement(firstUid())]
    })
    setSelected(new Set())
  }

  const duplicate = (i: number) => {
    applyWithHistory((rs) => {
      const src = rs[i]
      if (!src) return rs
      return [...rs.slice(0, i + 1), cloneRequirement(src), ...rs.slice(i + 1)]
    })
    setSelected(new Set())
  }

  const duplicateSelected = () => {
    applyWithHistory((rs) => {
      const out: RequirementForm[] = []
      rs.forEach((r, i) => {
        out.push(r)
        if (selected.has(i)) out.push(cloneRequirement(r))
      })
      return out
    })
    setSelected(new Set())
  }

  const update = <K extends keyof RequirementForm>(
    i: number,
    field: K,
    value: RequirementForm[K],
  ) => setRequirements((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))

  // Flat table: applies the value from the source row (first, or first selected) to the scope.
  const fillDown = (field: FillableField, scope: FillScope) => {
    applyWithHistory((rs) => {
      const hasSel = scope === 'selected' && selected.size > 0
      const srcIndex = hasSel ? Math.min(...selected) : 0
      const src = rs[srcIndex]
      if (!src) return rs
      const inTarget = (i: number) => (hasSel ? selected.has(i) : true)
      return rs.map((r, i) => (i === srcIndex || !inTarget(i) ? r : applyField(r, src, field)))
    })
  }

  // Grouped view: applies the value from the group's source row (first, or first selected in the
  // group) to the rest of that material's group.
  const fillDownGroup = (materialUid: string, field: FillableField, scope: FillScope) => {
    applyWithHistory((rs) => {
      const [start, end] = rangeOf(rs, materialUid)
      if (start >= end) return rs
      const selInGroup = [...selected].filter((i) => i >= start && i < end)
      const hasSel = scope === 'selected' && selInGroup.length > 0
      const srcIndex = hasSel ? Math.min(...selInGroup) : start
      const src = rs[srcIndex]
      if (!src) return rs
      const inTarget = (i: number) => i >= start && i < end && (hasSel ? selected.has(i) : true)
      return rs.map((r, i) => (i === srcIndex || !inTarget(i) ? r : applyField(r, src, field)))
    })
  }

  // Copies the field value from row `srcIndex` to rows between srcIndex and targetIndex (inclusive),
  // without touching the source. Used by the drag fill handle. In the grouped view srcIndex and
  // targetIndex are always within one contiguous group, so the fill stays inside that group.
  const fillRange = (srcIndex: number, targetIndex: number, field: FillableField) => {
    if (srcIndex === targetIndex) return
    applyWithHistory((rs) => {
      const src = rs[srcIndex]
      if (!src) return rs
      const lo = Math.min(srcIndex, targetIndex)
      const hi = Math.max(srcIndex, targetIndex)
      return rs.map((r, i) => (i < lo || i > hi || i === srcIndex ? r : applyField(r, src, field)))
    })
    setSelected(new Set())
  }

  // Grouped view: drag-reorders a row to another position WITHIN its material's block. `toFlat`
  // is clamped to the material's contiguous range so a row never crosses into another material
  // (cross-material moves go through `moveSelectedTo`). The moved row ends at index `to`.
  const moveRow = (fromFlat: number, toFlat: number) => {
    applyWithHistory((rs) => {
      const src = rs[fromFlat]
      if (!src) return rs
      const [start, end] = rangeOf(rs, src.materialUid)
      const to = Math.max(start, Math.min(toFlat, end - 1))
      if (to === fromFlat) return rs
      const copy = [...rs]
      copy.splice(fromFlat, 1)
      copy.splice(to, 0, src)
      return copy
    })
    setSelected(new Set())
  }

  // Sorts only the rows of a material's group by a field, preserving the rest of the list.
  const sortGroup = (materialUid: string, field: SortField, dir: SortDir) => {
    applyWithHistory((rs) => {
      const [start, end] = rangeOf(rs, materialUid)
      if (end - start <= 1) return rs
      const slice = rs.slice(start, end)
      slice.sort((a, b) => (dir === 'asc' ? 1 : -1) * compareBy(a, b, field))
      return [...rs.slice(0, start), ...slice, ...rs.slice(end)]
    })
    setSelected(new Set())
  }

  // Grouped view: applies a pure mapper to each row of a material's group. Used for automatic,
  // derived updates (e.g. re-inferring the coordinated tapacanto when the board changes), so it
  // does NOT push to the undo history and no-ops when the mapper changes nothing (keeps referential
  // identity to avoid effect loops).
  const updateGroup = (materialUid: string, mapper: (r: RequirementForm) => RequirementForm) =>
    setRequirements((rs) => {
      let changed = false
      const next = rs.map((r) => {
        if (r.materialUid !== materialUid) return r
        const mapped = mapper(r)
        if (mapped !== r) changed = true
        return mapped
      })
      return changed ? next : rs
    })

  const clear = () => {
    applyWithHistory(() => [emptyRequirement(firstUid())])
    setSelected(new Set())
  }

  // Grouped view: moves every piece of `fromUid` to `toUid` (keep pieces when deleting a material).
  const movePiecesTo = (fromUid: string, toUid: string) => {
    applyWithHistory((rs) =>
      clusterByMaterial(
        rs.map((r) => (r.materialUid === fromUid ? { ...r, materialUid: toUid } : r)),
      ),
    )
    setSelected(new Set())
  }

  // Grouped view: moves the currently selected pieces to `toUid` (reassign material + recluster).
  // Supports one or many pieces, even spanning several source materials.
  const moveSelectedTo = (toUid: string) => {
    if (selected.size === 0) return
    applyWithHistory((rs) =>
      clusterByMaterial(rs.map((r, i) => (selected.has(i) ? { ...r, materialUid: toUid } : r))),
    )
    setSelected(new Set())
  }

  // Grouped view: removes every piece of a material (delete a material together with its pieces).
  const removePiecesOf = (uid: string) => {
    applyWithHistory((rs) => rs.filter((r) => r.materialUid !== uid))
    setSelected(new Set())
  }

  // Grouped view: clones every piece of `fromUid` into a new material `toUid`, inserting the copies
  // right after the source group's block (kept contiguous by clusterByMaterial).
  const duplicateGroup = (fromUid: string, toUid: string) => {
    applyWithHistory((rs) => {
      const clones = rs
        .filter((r) => r.materialUid === fromUid)
        .map((r) => ({ ...cloneRequirement(r), materialUid: toUid }))
      if (clones.length === 0) return rs
      const [, end] = rangeOf(rs, fromUid)
      return clusterByMaterial([...rs.slice(0, end), ...clones, ...rs.slice(end)])
    })
    setSelected(new Set())
  }

  // Pastes a column of values into `field` starting at `startIndex`. Overwrites existing rows and
  // creates new ones (cloned from the source row) when they run out; reclusters to keep groups intact.
  const pasteIntoField = (
    startIndex: number,
    field: 'height' | 'width' | 'quantity' | 'priority' | 'label',
    rawValues: string[],
  ) => {
    applyWithHistory((rs) => {
      if (rawValues.length === 0 || startIndex >= rs.length) return rs
      const src = rs[startIndex]
      if (!src) return rs
      const result = [...rs]
      const toValue = (s: string): string | number => {
        if (field === 'label') return s.trim()
        const n = Number(s.trim().replace(',', '.'))
        return Number.isFinite(n) ? n : s.trim()
      }
      rawValues.forEach((val, i) => {
        const target = startIndex + i
        const existing = result[target]
        if (existing) {
          result[target] = { ...existing, [field]: toValue(val) }
        } else {
          result.push({ ...cloneRequirement(src), [field]: toValue(val) })
        }
      })
      return clusterByMaterial(result)
    })
    setSelected(new Set())
  }

  // Pastes complete rows starting at `startIndex`. Overwrites existing rows and appends the overflow.
  // `forceMaterialUid` (grouped view) pins every pasted row to one material; the flat view keeps each
  // row's parsed material. Reclusters so groups stay contiguous.
  const pasteRows = (startIndex: number, rows: RequirementForm[], forceMaterialUid?: string) => {
    applyWithHistory((rs) => {
      if (rows.length === 0 || startIndex >= rs.length) return rs
      const result = [...rs]
      rows.forEach((row, i) => {
        const withUid = forceMaterialUid != null ? { ...row, materialUid: forceMaterialUid } : row
        const target = startIndex + i
        if (target < result.length) result[target] = withUid
        else result.push(withUid)
      })
      return clusterByMaterial(result)
    })
    setSelected(new Set())
  }

  const toggleSelect = (i: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const selectAll = (checked: boolean) =>
    setSelected(checked ? new Set(requirements.map((_, i) => i)) : new Set())

  // Adds/removes a set of row indices from the selection (grouped view "select all in group").
  const selectMany = (indices: number[], checked: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      indices.forEach((i) => (checked ? next.add(i) : next.delete(i)))
      return next
    })

  return {
    requirements,
    selected,
    focusRow,
    clearFocus,
    add,
    addTo,
    addMany,
    remove,
    removeSelected,
    duplicate,
    duplicateSelected,
    update,
    fillDown,
    fillDownGroup,
    fillRange,
    moveRow,
    sortGroup,
    updateGroup,
    clear,
    movePiecesTo,
    moveSelectedTo,
    removePiecesOf,
    duplicateGroup,
    pasteIntoField,
    pasteRows,
    undo,
    canUndo: history.length > 0,
    toggleSelect,
    selectAll,
    selectMany,
  }
}

export type PiecesEditor = ReturnType<typeof usePiecesEditor>
