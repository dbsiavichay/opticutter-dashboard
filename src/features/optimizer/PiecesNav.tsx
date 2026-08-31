import type { KeyboardEvent } from 'react'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { CBadge, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronLeft, cilChevronRight, cilWarning } from '@coreui/icons'

import SearchInput from 'src/shared/components/SearchInput'
import type { BoardProduct } from 'src/features/products/types'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { materialLabel } from './optimizerForm'
import { accentFor } from './groupColors'
import type { PiecesNavigation } from './usePiecesNavigation'

// Finding your way around the pieces list: one row to search it, one row that indexes it.
//
// It sits ABOVE the scrolling pane rather than inside it, so it never has to be sticky and never
// competes with the two sticky headers below (the material's, then the table's).
//
// The strip is the piece that does the most work. It is the table of contents (how many materials
// are there, what are they called), the compass (which one am I in) and the jump target, in a single
// row that costs the 12-column table no width at all.

interface PiecesNavProps {
  nav: PiecesNavigation
  materials: MaterialForm[]
  requirements: RequirementForm[]
  boards: BoardProduct[]
}

const PiecesNav = ({ nav, materials, requirements, boards }: PiecesNavProps) => {
  const {
    query,
    setQuery,
    matches,
    matchIndex,
    goToMatch,
    issues,
    issuesByMaterial,
    goToNextIssue,
    revealMaterial,
    activeMaterialUid,
    searchRef,
  } = nav

  const stripRef = useRef<HTMLDivElement>(null)

  // Keep the active chip in view while the pane scrolls, or the strip stops being a compass the
  // moment there are more materials than fit the row. Same move as the workshop's board strip.
  useEffect(() => {
    if (!activeMaterialUid) return
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-chip-uid="${activeMaterialUid}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeMaterialUid])

  const counts = new Map<string, number>()
  for (const r of requirements) counts.set(r.materialUid, (counts.get(r.materialUid) ?? 0) + 1)

  // Enter walks forward, Shift+Enter back, Escape clears — the find-bar idiom, so nobody has to be
  // told. They are handled before the debounce so a press right after typing already works.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      goToMatch(e.shiftKey ? -1 : 1)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setQuery('')
      e.currentTarget.blur()
    }
  }

  const hasQuery = query.trim().length > 0

  return (
    <div className="mb-2">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <SearchInput
          size="sm"
          value={query}
          onChange={setQuery}
          inputRef={searchRef}
          onKeyDown={handleKeyDown}
          placeholder="Buscar pieza… (Ctrl+F)"
          style={{ flex: '0 1 300px' }}
        />

        {hasQuery && (
          <div className="d-flex align-items-center gap-1">
            <span
              className={`small text-nowrap ${matches.length === 0 ? 'text-danger' : 'text-body-secondary'}`}
            >
              {matches.length === 0
                ? 'Sin coincidencias'
                : matchIndex >= 0
                  ? `${matchIndex + 1} de ${matches.length}`
                  : `${matches.length} coincidencia${matches.length === 1 ? '' : 's'}`}
            </span>
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              type="button"
              className="px-1"
              disabled={matches.length === 0}
              title="Coincidencia anterior (Shift+Enter)"
              onClick={() => goToMatch(-1)}
            >
              <CIcon icon={cilChevronLeft} />
            </CButton>
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              type="button"
              className="px-1"
              disabled={matches.length === 0}
              title="Coincidencia siguiente (Enter)"
              onClick={() => goToMatch(1)}
            >
              <CIcon icon={cilChevronRight} />
            </CButton>
          </div>
        )}

        {/* The alert above the list names the offending rows by number; this reaches them without
            having to wait for a blocked "Siguiente" to raise it. */}
        {issues.length > 0 && (
          <CButton
            size="sm"
            color="danger"
            variant="outline"
            type="button"
            className="ms-auto text-nowrap"
            title="Ir a la siguiente pieza incompleta"
            onClick={() => goToNextIssue()}
          >
            <CIcon icon={cilWarning} className="me-1" />
            {issues.length === 1 ? '1 incompleta' : `${issues.length} incompletas`}
            <CIcon icon={cilChevronRight} className="ms-1" />
          </CButton>
        )}
      </div>

      {/* One material is its own index: the sticky header already names it on every screen. */}
      {materials.length > 1 && (
        <div
          ref={stripRef}
          className="d-flex flex-nowrap gap-2 mt-2 pb-1 material-strip"
          role="tablist"
          aria-label="Materiales"
        >
          {materials.map((m, i) => {
            const bad = issuesByMaterial.get(m.uid)?.length ?? 0
            const active = m.uid === activeMaterialUid
            return (
              <button
                key={m.uid}
                type="button"
                role="tab"
                aria-selected={active}
                data-chip-uid={m.uid}
                className={`material-chip${active ? ' material-chip--active' : ''}`}
                style={{ '--group-accent': accentFor(i) } as CSSProperties}
                title={materialLabel(m, boards)}
                onClick={() => revealMaterial(m.uid)}
              >
                <span className="material-chip-dot" />
                <span className="material-chip-label">{materialLabel(m, boards)}</span>
                <span className="material-chip-count">{counts.get(m.uid) ?? 0}</span>
                {bad > 0 && (
                  <CBadge color="danger" className="ms-1">
                    {bad}
                  </CBadge>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PiecesNav
