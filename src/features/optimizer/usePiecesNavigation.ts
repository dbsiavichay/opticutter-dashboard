import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { normalizeText } from 'src/shared/utils/text'
import type { BoardProduct } from 'src/features/products/types'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { materialLabel, requirementIssues } from './optimizerForm'

// Finding a piece and getting to it. Deliberately a VIEW over the editor: it never touches
// `requirements`, never reorders and never hides a row.
//
// That is not caution, it is a hard constraint. A piece has no identity of its own — `selected` is a
// Set of flat indices, `focusRow` is a flat index, the undo history is a stack of whole arrays, and
// `PieceRowsTable` maps local→flat by adding `startIndex`. Filtering the list would silently
// repoint every one of them, and `rowFromY` (which maps a pointer's Y to a row by DOM order) would
// aim the fill drag and the reorder drag at the wrong rows. So this highlights and scrolls, and the
// list underneath stays exactly what it was.

export interface PiecesNavigation {
  query: string
  setQuery: (q: string) => void
  // Flat indices of the matching pieces, in list order.
  matches: number[]
  // The match currently revealed, as a flat index.
  activeMatch: number | null
  // Position of `activeMatch` within `matches`; -1 when there is none.
  matchIndex: number
  goToMatch: (delta: 1 | -1) => void
  // Flat indices of half-filled pieces, live (the step's alert only lists them after a blocked
  // attempt to advance; the badge and the "siguiente incompleta" button need them all the time).
  issues: number[]
  // Flat indices of incomplete pieces per material uid, for the group badge and the chip strip.
  issuesByMaterial: Map<string, number[]>
  goToNextIssue: (materialUid?: string) => void
  revealPiece: (flat: number) => void
  revealMaterial: (uid: string) => void
  // Material whose header is at the top of the pane, for the chip strip.
  activeMaterialUid: string | null
  registerMaterial: (uid: string) => (el: HTMLElement | null) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  focusSearch: () => void
}

interface Options {
  requirements: RequirementForm[]
  materials: MaterialForm[]
  boards: BoardProduct[]
  collapsed: Set<string>
  expand: (uid: string) => void
}

export const usePiecesNavigation = ({
  requirements,
  materials,
  boards,
  collapsed,
  expand,
}: Options): PiecesNavigation => {
  const [query, setQueryState] = useState('')
  const [activeMatch, setActiveMatch] = useState<number | null>(null)
  const [activeMaterialUid, setActiveMaterialUid] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  // Material uid → display name, so a search for "melamina" finds the pieces of that board even
  // though the row itself never says which board it is on.
  const labelByUid = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of materials) map.set(m.uid, materialLabel(m, boards))
    return map
  }, [materials, boards])

  const matches = useMemo(() => {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    // Same AND-over-tokens rule as SearchableSelect, so "720 puerta" narrows instead of widening.
    return requirements.reduce<number[]>((acc, r, i) => {
      const hay = normalizeText(
        `${r.label} ${r.height} ${r.width} ${r.quantity} ${labelByUid.get(r.materialUid) ?? ''}`,
      )
      if (tokens.every((t) => hay.includes(t))) acc.push(i)
      return acc
    }, [])
  }, [query, requirements, labelByUid])

  const issues = useMemo(
    () => requirementIssues(requirements, materials).map((it) => it.index),
    [requirements, materials],
  )

  const issuesByMaterial = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const flat of issues) {
      const uid = requirements[flat]?.materialUid
      if (!uid) continue
      const list = map.get(uid)
      if (list) list.push(flat)
      else map.set(uid, [flat])
    }
    return map
  }, [issues, requirements])

  // --- Revealing -----------------------------------------------------------------------------

  // Read through refs: `revealPiece` is handed to a keyboard shortcut and to the chip strip, and
  // both would otherwise re-subscribe on every keystroke in the grid.
  const collapsedRef = useRef(collapsed)
  const requirementsRef = useRef(requirements)
  useEffect(() => {
    collapsedRef.current = collapsed
    requirementsRef.current = requirements
  })

  const revealPiece = useCallback(
    (flat: number) => {
      const uid = requirementsRef.current[flat]?.materialUid
      // Expanding renders the rows; the element only exists on the next frame.
      if (uid && collapsedRef.current.has(uid)) expand(uid)
      setActiveMatch(flat)
      requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(`[data-piece-flat="${flat}"]`)
        if (!row) return
        row.scrollIntoView({ block: 'center', behavior: 'smooth' })
        // The label is the human-readable column and the one a user is most likely to have been
        // looking for, so the caret lands there rather than on the first dimension.
        row.querySelector<HTMLElement>('[data-col="4"]')?.focus({ preventScroll: true })
      })
    },
    [expand],
  )

  // Takes you to the START of a material: its header pins at the top of the pane and its first piece
  // sits right under it. The target is the `.material-group`, NOT the sticky header inside it — a
  // stuck header is wherever the scroll put it, so scrolling to one from below landed on the
  // material's last row, which is the opposite of what clicking its chip asks for.
  const revealMaterial = useCallback(
    (uid: string) => {
      if (collapsedRef.current.has(uid)) expand(uid)
      setActiveMaterialUid(uid)
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`.material-group[data-material-uid="${uid}"]`)
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
    },
    [expand],
  )

  const matchIndex = activeMatch == null ? -1 : matches.indexOf(activeMatch)

  const goToMatch = useCallback(
    (delta: 1 | -1) => {
      if (matches.length === 0) return
      // From nowhere, forward starts at the first match and backward at the last.
      const next =
        matchIndex < 0
          ? delta === 1
            ? 0
            : matches.length - 1
          : (matchIndex + delta + matches.length) % matches.length
      const flat = matches[next]
      if (flat != null) revealPiece(flat)
    },
    [matches, matchIndex, revealPiece],
  )

  const goToNextIssue = useCallback(
    (materialUid?: string) => {
      const list = materialUid ? (issuesByMaterial.get(materialUid) ?? []) : issues
      if (list.length === 0) return
      // Repeated presses tour the list, but only continue from the row already showing when that row
      // belongs to THIS list. Otherwise a highlight left somewhere else — a search hit, or another
      // material's badge — would silently skip every issue numbered below it.
      const touring = activeMatch != null && list.includes(activeMatch)
      const flat = (touring ? list.find((i) => i > activeMatch) : undefined) ?? list[0]
      if (flat != null) revealPiece(flat)
    },
    [issues, issuesByMaterial, activeMatch, revealPiece],
  )

  // A new query drops the previous highlight, so the counter and the painted row never disagree.
  // Done here rather than in an effect on `query`: it is a consequence of the event, not a
  // synchronisation with anything outside React.
  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setActiveMatch(null)
  }, [])

  const focusSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])

  // --- Which material am I looking at? --------------------------------------------------------

  // The answer is "whose header is currently PINNED to the top of the pane" — the material whose
  // rows the eye is reading. An IntersectionObserver answers a fuzzier question and, worse, is
  // created in an effect: ref callbacks fire first, so on mount it observes nothing.
  //
  // Measured on the GROUP, not on its header. The header is sticky, and right after a jump it has
  // not stuck yet — it sits one `padding-top` below the pane's edge, so a header-based test picked
  // the PREVIOUS material and the strip highlighted the wrong chip by one. The group's top edge is
  // at or above the pane in both states.
  const elementsRef = useRef(new Map<string, HTMLElement>())

  const recompute = useCallback(() => {
    const els = [...elementsRef.current.entries()].filter(([, el]) => el.isConnected)
    if (els.length === 0) return
    const pane = els[0]?.[1].closest('.pieces-pane')
    const paneTop = pane ? pane.getBoundingClientRect().top : 0
    let current: string | null = null
    for (const [uid, el] of els) {
      // 1px of slack: at rest the first group sits exactly on the pane's edge, and sub-pixel
      // layout would otherwise leave the strip blank until the first scroll.
      if (el.getBoundingClientRect().top <= paneTop + 1) current = uid
    }
    setActiveMaterialUid(current ?? els[0]?.[0] ?? null)
  }, [])

  // Re-bound on `materials` because effects run after ref callbacks: by the time this fires, every
  // header of the current list is registered.
  useEffect(() => {
    const first = elementsRef.current.values().next().value
    const pane = first?.closest('.pieces-pane')
    if (!pane) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(recompute)
    }
    pane.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(recompute)
    return () => {
      cancelAnimationFrame(raf)
      pane.removeEventListener('scroll', onScroll)
    }
  }, [recompute, materials])

  // One stable ref callback per uid, cached. Handing React a fresh function each render would make
  // it detach and re-attach the node every time — which here means on every keystroke in the grid.
  const callbacksRef = useRef(new Map<string, (el: HTMLElement | null) => void>())
  const registerMaterial = useCallback((uid: string) => {
    const cached = callbacksRef.current.get(uid)
    if (cached) return cached
    const fn = (el: HTMLElement | null) => {
      if (el) elementsRef.current.set(uid, el)
      else elementsRef.current.delete(uid)
    }
    callbacksRef.current.set(uid, fn)
    return fn
  }, [])

  return {
    query,
    setQuery,
    matches,
    activeMatch,
    matchIndex,
    goToMatch,
    issues,
    issuesByMaterial,
    goToNextIssue,
    revealPiece,
    revealMaterial,
    activeMaterialUid,
    registerMaterial,
    searchRef,
    focusSearch,
  }
}

export default usePiecesNavigation
