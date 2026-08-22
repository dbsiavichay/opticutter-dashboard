import { CFormSelect } from '@coreui/react'

import FilterMenu, { FilterSection } from 'src/shared/components/FilterMenu'
import FilterCheckboxList from 'src/shared/components/FilterCheckboxList'
import FilterActiveSection from 'src/shared/components/FilterActiveSection'
import FilterSortSection, { type ListSort } from 'src/shared/components/FilterSortSection'
import type { FilterChip } from 'src/shared/components/FilterChips'
import { ROLE_LABELS } from 'src/features/auth/roleLabels'
import { useActiveBranches } from 'src/features/branches/useBranches'
import type { Role } from 'src/features/auth/types'

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

export interface UsersFilterValues {
  role: Role[]
  branchId: string
  isActive: string
  sort: ListSort
}

interface UsersFiltersProps {
  values: UsersFilterValues
  onChange: <K extends keyof UsersFilterValues>(key: K, value: UsersFilterValues[K]) => void
  onClear: () => void
}

// Role, branch and status were three columns of this listing with no way to filter by them — on the
// one page where "the operators of this branch" is the question actually being asked.
const UsersFilters = ({ values, onChange, onClear }: UsersFiltersProps) => {
  const { data: branches = [] } = useActiveBranches()

  return (
    <FilterMenu activeCount={activeCount(values)} onClear={onClear}>
      <FilterSection label="Rol">
        <FilterCheckboxList
          values={values.role}
          options={ROLE_OPTIONS}
          onChange={(next) => onChange('role', next)}
        />
      </FilterSection>

      <FilterSection label="Sucursal">
        <div className="px-3 py-1">
          <CFormSelect
            size="sm"
            value={values.branchId}
            onChange={(e) => onChange('branchId', e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </CFormSelect>
        </div>
      </FilterSection>

      <FilterActiveSection
        value={values.isActive}
        onChange={(next) => onChange('isActive', next)}
      />
      <FilterSortSection value={values.sort} onChange={(next) => onChange('sort', next)} />
    </FilterMenu>
  )
}

export default UsersFilters

// `sort` is excluded on purpose: it is always set to something, so counting it would leave the
// toggle permanently badged "1" and say nothing about how narrow the listing is.
export const activeCount = (values: UsersFilterValues): number =>
  values.role.length + (values.branchId ? 1 : 0) + (values.isActive ? 1 : 0)

// The chips mirror `activeCount` field by field, so what the badge counts is always what the row
// below it lists. A hook because the branch label has to be looked up: the URL carries the id, and
// "Sucursal: 2" is not a filter anyone can read. It is the same query the panel runs — a cache hit.
export const useUsersFilterChips = (
  values: UsersFilterValues,
  onChange: <K extends keyof UsersFilterValues>(key: K, value: UsersFilterValues[K]) => void,
): FilterChip[] => {
  const { data: branches = [] } = useActiveBranches()

  const chips: FilterChip[] = values.role.map((r) => ({
    key: `role:${r}`,
    label: ROLE_LABELS[r],
    onRemove: () =>
      onChange(
        'role',
        values.role.filter((v) => v !== r),
      ),
  }))

  if (values.branchId) {
    const branch = branches.find((b) => String(b.id) === values.branchId)
    chips.push({
      key: 'branchId',
      label: `Sucursal: ${branch?.name ?? values.branchId}`,
      onRemove: () => onChange('branchId', ''),
    })
  }
  if (values.isActive) {
    chips.push({
      key: 'isActive',
      label: values.isActive === 'true' ? 'Solo activos' : 'Solo inactivos',
      onRemove: () => onChange('isActive', ''),
    })
  }
  return chips
}
