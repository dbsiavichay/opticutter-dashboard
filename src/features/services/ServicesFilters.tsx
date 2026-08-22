import FilterMenu from 'src/shared/components/FilterMenu'
import FilterActiveSection from 'src/shared/components/FilterActiveSection'
import FilterSortSection, { type ListSort } from 'src/shared/components/FilterSortSection'
import type { FilterChip } from 'src/shared/components/FilterChips'

export interface ServicesFilterValues {
  isActive: string
  sort: ListSort
}

interface ServicesFiltersProps {
  values: ServicesFilterValues
  onChange: <K extends keyof ServicesFilterValues>(key: K, value: ServicesFilterValues[K]) => void
  onClear: () => void
}

const ServicesFilters = ({ values, onChange, onClear }: ServicesFiltersProps) => (
  <FilterMenu activeCount={activeCount(values)} onClear={onClear}>
    <FilterActiveSection value={values.isActive} onChange={(next) => onChange('isActive', next)} />
    <FilterSortSection value={values.sort} onChange={(next) => onChange('sort', next)} />
  </FilterMenu>
)

export default ServicesFilters

// `sort` is excluded on purpose: it is always set to something, so counting it would leave the
// toggle permanently badged "1" and say nothing about how narrow the listing is.
export const activeCount = (values: ServicesFilterValues): number => (values.isActive ? 1 : 0)

// The chips mirror `activeCount` field by field, so what the badge counts is always what the row
// below it lists. A plain function here — unlike the orders/pre-orders panels, no label needs a
// lookup, because this listing filters by nothing that is carried as an id.
export const servicesFilterChips = (
  values: ServicesFilterValues,
  onChange: <K extends keyof ServicesFilterValues>(key: K, value: ServicesFilterValues[K]) => void,
): FilterChip[] =>
  values.isActive
    ? [
        {
          key: 'isActive',
          label: values.isActive === 'true' ? 'Solo activos' : 'Solo inactivos',
          onRemove: () => onChange('isActive', ''),
        },
      ]
    : []
