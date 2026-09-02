import CIcon from '@coreui/icons-react'
import { cilBriefcase } from '@coreui/icons'
import { CNavItem } from '@coreui/react'
import type { NavItem } from 'src/shared/components/AppSidebarNav'

export const servicesNav: NavItem[] = [
  {
    component: CNavItem,
    name: 'Servicios',
    to: '/additional-services',
    icon: <CIcon icon={cilBriefcase} customClassName="nav-icon" />,
    roles: ['administrador', 'vendedor'],
  },
]
