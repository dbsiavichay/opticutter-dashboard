import FilterMenu from 'src/shared/components/FilterMenu'
import FilterActiveSection from 'src/shared/components/FilterActiveSection'
import FilterSortSection, { type ListSort } from 'src/shared/components/FilterSortSection'
import type { FilterChip } from 'src/shared/components/FilterChips'

export interface BranchesFilterValues {
  isActive: string
  sort: ListSort
}

interface BranchesFiltersProps {
  values: BranchesFilterValues
  onChange: <K extends keyof BranchesFilterValues>(key: K, value: BranchesFilterValues[K]) => void
  onClear: () => void
}

const BranchesFilters = ({ values, onChange, onClear }: BranchesFiltersProps) => (
  <FilterMenu activeCount={activeCount(values)} onClear={onClear}>
    <FilterActiveSection
      value={values.isActive}
      onChange={(next) => onChange('isActive', next)}
      bothLabel="Activas e inactivas"
      activeLabel="Solo activas"
      inactiveLabel="Solo inactivas"
    />
    <FilterSortSection value={values.sort} onChange={(next) => onChange('sort', next)} />
  </FilterMenu>
)

export default BranchesFilters

// `sort` is excluded on purpose: it is always set to something, so counting it would leave the
// toggle permanently badged "1" and say nothing about how narrow the listing is.
export const activeCount = (values: BranchesFilterValues): number => (values.isActive ? 1 : 0)

export const branchesFilterChips = (
  values: BranchesFilterValues,
  onChange: <K extends keyof BranchesFilterValues>(key: K, value: BranchesFilterValues[K]) => void,
): FilterChip[] =>
  values.isActive
    ? [
        {
          key: 'isActive',
          label: values.isActive === 'true' ? 'Solo activas' : 'Solo inactivas',
          onRemove: () => onChange('isActive', ''),
        },
      ]
    : []
