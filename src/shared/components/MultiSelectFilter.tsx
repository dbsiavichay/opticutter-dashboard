import type { CSSProperties } from 'react'
import { CDropdown, CDropdownMenu, CDropdownToggle } from '@coreui/react'
import FilterCheckboxList, { type FilterOption } from './FilterCheckboxList'

export type { FilterOption as MultiSelectOption }

interface MultiSelectFilterProps<T extends string> {
  values: T[]
  options: FilterOption<T>[]
  onChange: (values: T[]) => void
  placeholder: string
  size?: 'sm' | 'lg'
  disabled?: boolean
  style?: CSSProperties
}

// Single-field checkbox dropdown (e.g. a lone status filter elsewhere). Styled
// like SearchableSelect's toggle (a form-select look-alike button); unlike it,
// the menu stays open across picks (`autoClose="outside"`) so several boxes can
// be checked in one visit. For several filter fields on one toolbar, prefer
// FilterMenu — one "Filtros" button holding all of them, instead of one
// dropdown per field.
const MultiSelectFilter = <T extends string>({
  values,
  options,
  onChange,
  placeholder,
  size,
  disabled = false,
  style,
}: MultiSelectFilterProps<T>) => {
  const selected = options.filter((o) => values.includes(o.value))

  const toggleLabel =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((o) => o.label).join(', ')
        : `${placeholder} (${selected.length})`

  const sizeClass = size === 'sm' ? ' form-select-sm' : size === 'lg' ? ' form-select-lg' : ''

  return (
    <CDropdown variant="dropdown" autoClose="outside" style={style}>
      <CDropdownToggle custom disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={`form-select text-start text-truncate${sizeClass}${
            selected.length === 0 ? ' text-body-secondary' : ''
          }`}
          style={{ width: '100%' }}
        >
          {toggleLabel}
        </button>
      </CDropdownToggle>
      <CDropdownMenu style={{ minWidth: 220, maxWidth: 320 }}>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          <FilterCheckboxList values={values} options={options} onChange={onChange} />
        </div>
        {selected.length > 0 && (
          <>
            <hr className="dropdown-divider" />
            <button
              type="button"
              className="dropdown-item text-primary"
              onClick={() => onChange([])}
            >
              Limpiar selección
            </button>
          </>
        )}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default MultiSelectFilter
