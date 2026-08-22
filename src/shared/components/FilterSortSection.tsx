import { CFormSelect } from '@coreui/react'
import { FilterSection } from './FilterMenu'

// The ordering every CRUD listing offers, matching the backend's `ListSort`. These are reference
// catalogues, read alphabetically — hence `name` as the default on both sides; `recent` answers
// "what did we just add?". Orders and pre-orders keep their own two-value `sort`: a document listing
// has no meaningful alphabetical order.
export type ListSort = 'name' | 'recent' | 'oldest'

interface FilterSortSectionProps {
  value: ListSort
  onChange: (value: ListSort) => void
  // What "name" means here — "Por nombre" is wrong on a listing whose name column is "Código".
  nameLabel?: string
}

const FilterSortSection = ({
  value,
  onChange,
  nameLabel = 'Por nombre (A–Z)',
}: FilterSortSectionProps) => (
  <FilterSection label="Orden">
    <div className="px-3 py-1">
      <CFormSelect size="sm" value={value} onChange={(e) => onChange(e.target.value as ListSort)}>
        <option value="name">{nameLabel}</option>
        <option value="recent">Más recientes primero</option>
        <option value="oldest">Más antiguos primero</option>
      </CFormSelect>
    </div>
  </FilterSection>
)

export default FilterSortSection
