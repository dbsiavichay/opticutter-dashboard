import FilterMenu from 'src/shared/components/FilterMenu'
import FilterSortSection, { type ListSort } from 'src/shared/components/FilterSortSection'

export interface ClientsFilterValues {
  sort: ListSort
}

interface ClientsFiltersProps {
  values: ClientsFilterValues
  onChange: <K extends keyof ClientsFilterValues>(key: K, value: ClientsFilterValues[K]) => void
  onClear: () => void
}

// A client has no status, no owning branch and no type — the only thing to narrow by is the search
// box, which lives on the toolbar. So this panel holds ordering alone, and its badge is always 0:
// `sort` is never counted, here as everywhere, because it is always set to something.
const ClientsFilters = ({ values, onChange, onClear }: ClientsFiltersProps) => (
  <FilterMenu activeCount={0} onClear={onClear}>
    <FilterSortSection
      value={values.sort}
      onChange={(next) => onChange('sort', next)}
      nameLabel="Por apellido (A–Z)"
    />
  </FilterMenu>
)

export default ClientsFilters
