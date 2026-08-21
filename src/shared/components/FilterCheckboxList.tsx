export interface FilterOption<T extends string = string> {
  value: T
  label: string
  // Optional section header rendered above the first option of each group
  // (consecutive options sharing a group are not re-headered).
  group?: string
}

interface FilterCheckboxListProps<T extends string> {
  values: T[]
  options: FilterOption<T>[]
  onChange: (values: T[]) => void
}

// Bare checkbox list (+ optional group headers) for a multi-value filter. No
// dropdown/toggle of its own, and styled with Bootstrap's `.dropdown-item` /
// `.dropdown-header` classes on the assumption it always renders inside a
// `.dropdown-menu` — MultiSelectFilter wraps one in a standalone dropdown;
// FilterMenu stacks several as sections inside one shared panel.
const FilterCheckboxList = <T extends string>({
  values,
  options,
  onChange,
}: FilterCheckboxListProps<T>) => {
  const toggle = (value: T) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  return (
    <div>
      {options.map((o, i) => {
        const showGroupHeader = o.group !== undefined && o.group !== options[i - 1]?.group
        return (
          <div key={o.value}>
            {showGroupHeader && (
              <div className="dropdown-header px-3 pt-2 pb-1 text-uppercase small">{o.group}</div>
            )}
            <label
              className="dropdown-item d-flex align-items-center gap-2 mb-0"
              style={{ cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                className="form-check-input mt-0 flex-shrink-0"
                checked={values.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span className="text-truncate">{o.label}</span>
            </label>
          </div>
        )
      })}
    </div>
  )
}

export default FilterCheckboxList
