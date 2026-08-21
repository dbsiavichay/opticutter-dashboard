import CIcon from '@coreui/icons-react'
import { cilUser } from '@coreui/icons'
import { CNavItem } from '@coreui/react'
import type { NavItem } from 'src/shared/components/AppSidebarNav'

export const usersNav: NavItem[] = [
  {
    component: CNavItem,
    name: 'Usuarios',
    to: '/users',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
    roles: ['administrador'],
  },
]
