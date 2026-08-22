import { useEffect, useRef, useState } from 'react'
import { CButton, CFormInput, CSpinner } from '@coreui/react'
import { useDebounce } from 'src/shared/hooks/useDebounce'
import { SEARCH_DEBOUNCE_MS } from 'src/shared/constants'

export interface PickerOption {
  value: string
  label: string
  sublabel?: string
}

interface FilterSearchPickerProps {
  value: string
  // Display name of the current selection. The URL only carries the id, so on a cold load the call
  // site resolves it (a `get(id)` query) rather than storing a label in the query string.
  selectedLabel?: string
  options: PickerOption[]
  // Called with the debounced term; the call site turns it into a request.
  onSearch: (term: string) => void
  onChange: (value: string) => void
  isLoading?: boolean
  searchPlaceholder?: string
  emptyText?: string
}

// Single-value picker whose candidates come from the SERVER, for filtering by an entity with more
// rows than a select can hold (clients). `SearchableSelect` cannot do this job: it filters a fully
// loaded `options` array in the browser. Nor can it live in here — it portals its menu to
// `document.body`, and a click on a portaled node counts as OUTSIDE the `autoClose="outside"`
// dropdown that `FilterMenu` is, so picking an option would close the whole panel. This one renders
// in flow: no portal, no z-index tier, nothing to close.
const FilterSearchPicker = ({
  value,
  selectedLabel,
  options,
  onSearch,
  onChange,
  isLoading = false,
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
}: FilterSearchPickerProps) => {
  const [term, setTerm] = useState('')
  const debounced = useDebounce(term, SEARCH_DEBOUNCE_MS)

  // Same guard as SearchInput: keep the latest callback in a ref so the effect depends only on the
  // settled term, not on an identity that changes with every parent render.
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  })
  useEffect(() => {
    onSearchRef.current(debounced)
  }, [debounced])

  // Once a value is picked the filter is settled: show it and offer to drop it, rather than keeping
  // a search box open over a list the user is done with.
  if (value) {
    return (
      <div className="d-flex align-items-center gap-2 px-3 py-1">
        <span className="text-truncate flex-grow-1">{selectedLabel || value}</span>
        <CButton color="link" size="sm" className="px-1 flex-shrink-0" onClick={() => onChange('')}>
          Quitar
        </CButton>
      </div>
    )
  }

  return (
    <div>
      <div className="px-3 py-1">
        <CFormInput
          size="sm"
          placeholder={searchPlaceholder}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {isLoading ? (
          <div className="text-center py-2">
            <CSpinner size="sm" color="primary" />
          </div>
        ) : options.length === 0 ? (
          <div className="px-3 py-2 text-body-secondary small">{emptyText}</div>
        ) : (
          options.map((o) => (
            <button
              key={o.value}
              type="button"
              className="dropdown-item text-truncate"
              onClick={() => onChange(o.value)}
            >
              {o.label}
              {o.sublabel && <span className="text-body-secondary small ms-1">{o.sublabel}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default FilterSearchPicker
