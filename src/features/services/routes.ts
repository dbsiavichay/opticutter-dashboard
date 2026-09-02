import { lazy } from 'react'
import type { AppRoute } from 'src/shared/routes'

const ServicesPage = lazy(() => import('./ServicesPage'))

export const servicesRoutes: AppRoute[] = [
  {
    path: '/additional-services',
    name: 'Servicios adicionales',
    element: ServicesPage,
    roles: ['administrador', 'vendedor'],
  },
]
