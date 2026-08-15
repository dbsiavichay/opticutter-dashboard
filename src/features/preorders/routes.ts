import { lazy } from 'react'
import type { AppRoute } from 'src/shared/routes'

const PreOrdersPage = lazy(() => import('./PreOrdersPage'))
const PreOrderDetailPage = lazy(() => import('./PreOrderDetailPage'))

export const preordersRoutes: AppRoute[] = [
  {
    path: '/preorders',
    name: 'Cotizaciones',
    element: PreOrdersPage,
    roles: ['administrador', 'vendedor'],
  },
  {
    path: '/preorders/:id',
    name: 'Detalle de cotización',
    element: PreOrderDetailPage,
    roles: ['administrador', 'vendedor'],
    // Same editor as /optimizer, so it needs the same width: the pieces table has twelve columns
    // and the centered container squeezed every one of them.
    fluid: true,
  },
]
