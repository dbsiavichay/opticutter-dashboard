import StatusBadge, { type StatusConfigEntry } from 'src/shared/components/StatusBadge'
import type { BandType } from './types'

// Badge for a tapacanto's type. `info`/`dark` rather than a semantic pair: Suave and Duro are
// CATEGORIES, not states — an amber would read as a warning about something entirely normal.
//
// It used to be folded into the product name server-side ("Tapacanto Blanco (Suave)"), where it
// was indistinguishable from the catalogue's own words and impossible to style.
const BAND_TYPE_CONFIG: Record<BandType, StatusConfigEntry> = {
  Soft: { color: 'info', label: 'Suave' },
  Hard: { color: 'dark', label: 'Duro' },
}

interface BandTypeBadgeProps {
  bandType: BandType
}

const BandTypeBadge = ({ bandType }: BandTypeBadgeProps) => (
  <StatusBadge config={BAND_TYPE_CONFIG} value={bandType} />
)

export default BandTypeBadge
