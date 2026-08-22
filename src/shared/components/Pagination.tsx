import { CFormSelect, CPagination } from '@coreui/react'
import { cilChevronLeft, cilChevronRight } from '@coreui/icons'

import CIcon from '@coreui/icons-react'
import { PAGE_SIZE_OPTIONS } from 'src/shared/constants'
import type { ReactNode } from 'react'

interface PaginationProps {
  offset: number
  limit: number
  total: number | undefined
  onChange: (offset: number) => void
  // When given, a page-size selector is rendered. The handler MUST reset the page as well as store
  // the size: page 12 of 20 does not exist once the rows-per-page grows. The pager cannot do it —
  // firing `onChange(0)` alongside would be a second write in the same tick, and for a caller whose
  // state is the URL the two do not compose (react-router's updater still sees the pre-update
  // params, so the later write wins and the size is lost).
  onLimitChange?: (limit: number) => void
}

// Numbered buttons rendered at once: the current page, one sibling either side, the first and last
// page, and the two ellipses between them. Seven is what fits beside the range readout on a phone.
const SIBLINGS = 1
const MAX_ITEMS = 3 + 2 * SIBLINGS + 2
// Slots left for a contiguous run when only one end is elided (1 2 3 4 5 … 22).
const EDGE_RUN = MAX_ITEMS - 2

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

// The page numbers to render, `null` marking an elided run: [1, null, 10, 11, 12, null, 22].
// Always keeps the first and last page reachable — on a 22-page list those are the two jumps a
// prev/next pager could never make. The count of slots stays MAX_ITEMS wherever the user is, so the
// row does not change width (and the numbers do not move under the cursor) while paging through.
const pageItems = (current: number, count: number): (number | null)[] => {
  if (count <= MAX_ITEMS) return range(1, count)

  const gapLeft = current - SIBLINGS > 2
  const gapRight = current + SIBLINGS < count - 1

  if (!gapLeft) return [...range(1, EDGE_RUN), null, count]
  if (!gapRight) return [1, null, ...range(count - EDGE_RUN + 1, count)]
  return [1, null, ...range(current - SIBLINGS, current + SIBLINGS), null, count]
}

interface PageButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

// A real <button> in Bootstrap's page-item/page-link clothing rather than `CPaginationItem`, which
// only forwards props down its anchor path: `as="button"` renders the element and silently drops
// onClick, disabled and aria-label, and its default anchor has no href, so it is unreachable by
// keyboard. The classes are the same ones CoreUI would apply, so the styling is identical.
const PageButton = ({ label, active, disabled, onClick, children }: PageButtonProps) => (
  <li
    className={`page-item${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
    {...(active && { 'aria-current': 'page' as const })}
  >
    <button
      type="button"
      className="page-link"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  </li>
)

// Offset/limit pager shared by the list pages: page size and the range readout on the left, numbered
// pages on the right. The numbers are the point — prev/next alone can only walk a long list one
// screen at a time, and never reaches its end. The readout stays visible on a single page (that is
// when "3 de 3" is most informative); only the page controls drop out.
const Pagination = ({ offset, limit, total, onChange, onLimitChange }: PaginationProps) => {
  // No results, or the count hasn't arrived yet: nothing truthful to show.
  if (!total) return null

  const pageCount = Math.ceil(total / limit)
  const current = Math.floor(offset / limit) + 1
  const from = Math.min(offset + 1, total)
  const to = Math.min(offset + limit, total)

  const goTo = (page: number) => onChange((page - 1) * limit)

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
      <div className="d-flex align-items-center gap-2">
        {onLimitChange && (
          <CFormSelect
            size="sm"
            style={{ width: 'auto' }}
            aria-label="Filas por página"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </CFormSelect>
        )}
        <span className="text-body-secondary small">
          {from}–{to} de {total}
        </span>
      </div>

      {pageCount > 1 && (
        <CPagination size="sm" className="mb-0" aria-label="Paginación">
          <PageButton
            label="Página anterior"
            disabled={current === 1}
            onClick={() => goTo(current - 1)}
          >
            <CIcon icon={cilChevronLeft} size="sm" />
          </PageButton>

          {pageItems(current, pageCount).map((page, i) =>
            page === null ? (
              // Not a button: the gap is a statement about the list, not somewhere to go.
              <li key={`gap-${i}`} className="page-item disabled" aria-hidden="true">
                <span className="page-link">…</span>
              </li>
            ) : (
              <PageButton
                key={page}
                label={`Página ${page}`}
                active={page === current}
                onClick={() => goTo(page)}
              >
                {page}
              </PageButton>
            ),
          )}

          <PageButton
            label="Página siguiente"
            disabled={current === pageCount}
            onClick={() => goTo(current + 1)}
          >
            <CIcon icon={cilChevronRight} size="sm" />
          </PageButton>
        </CPagination>
      )}
    </div>
  )
}

export default Pagination
