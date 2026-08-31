import CuttingSettingsCard from './CuttingSettingsCard'
import PreorderSettingsCard from './PreorderSettingsCard'
import CompanySettingsCard from './CompanySettingsCard'
import TaxSettingsCard from './TaxSettingsCard'

// Each card loads and saves its own section independently (separate GET/PATCH).
const SettingsPage = () => (
  <>
    <CuttingSettingsCard />
    <PreorderSettingsCard />
    <TaxSettingsCard />
    <CompanySettingsCard />
  </>
)

export default SettingsPage
