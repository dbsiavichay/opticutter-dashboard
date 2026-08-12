import type { ComponentType, LazyExoticComponent } from 'react'
import type { Role } from 'src/features/auth/types'
import { dashboardRoutes } from 'src/features/dashboard/routes'
import { clientsRoutes } from 'src/features/clients/routes'
import { ordersRoutes } from 'src/features/orders/routes'
import { preordersRoutes } from 'src/features/preorders/routes'
import { optimizerRoutes } from 'src/features/optimizer/routes'
import { printRoutes } from 'src/features/print/routes'
import { productsRoutes } from 'src/features/products/routes'
import { servicesRoutes } from 'src/features/services/routes'
import { settingsRoutes } from 'src/features/settings/routes'
import { usersRoutes } from 'src/features/users/routes'
import { branchesRoutes } from 'src/features/branches/routes'
import { profileRoutes } from 'src/features/profile/routes'

export interface AppRoute {
  path: string
  name: string
  // Optional: breadcrumb-only entries (e.g. '/') have no element to render.
  element?: ComponentType<unknown> | LazyExoticComponent<ComponentType<unknown>>
  exact?: boolean
  roles?: Role[]
  // Renders the route in a full-width container instead of the centered one. For pages whose value
  // is horizontal room (the optimizer's side-by-side panes), where the 1320px cap is the constraint.
  fluid?: boolean
}

export const routes: AppRoute[] = [
  ...usersRoutes,
  ...branchesRoutes,
  ...printRoutes,
  ...dashboardRoutes,
  ...clientsRoutes,
  ...ordersRoutes,
  ...preordersRoutes,
  ...optimizerRoutes,
  ...productsRoutes,
  ...servicesRoutes,
  ...settingsRoutes,
  ...profileRoutes,
]
