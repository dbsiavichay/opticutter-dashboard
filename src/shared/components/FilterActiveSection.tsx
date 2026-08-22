import { CFormSelect } from '@coreui/react'
import { FilterSection } from './FilterMenu'

interface FilterActiveSectionProps {
  // `''` (both), `'true'` or `'false'` — the raw URL value, so no parsing at the call site.
  value: string
  onChange: (value: string) => void
  label?: string
  bothLabel?: string
  activeLabel?: string
  inactiveLabel?: string
}

// Tri-state active filter. Three states rather than a checkbox because "both" is the default these
// listings need — a catalog admin manages the deactivated rows too, so hiding them by default would
// make them unreachable, and a two-state checkbox has no way to say "both".
const FilterActiveSection = ({
  value,
  onChange,
  label = 'Estado',
  bothLabel = 'Activos e inactivos',
  activeLabel = 'Solo activos',
  inactiveLabel = 'Solo inactivos',
}: FilterActiveSectionProps) => (
  <FilterSection label={label}>
    <div className="px-3 py-1">
      <CFormSelect size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{bothLabel}</option>
        <option value="true">{activeLabel}</option>
        <option value="false">{inactiveLabel}</option>
      </CFormSelect>
    </div>
  </FilterSection>
)

export default FilterActiveSection
