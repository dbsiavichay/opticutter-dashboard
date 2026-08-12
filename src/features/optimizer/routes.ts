import { lazy } from 'react'
import type { AppRoute } from 'src/shared/routes'

const OptimizerPage = lazy(() => import('./OptimizerPage'))

export const optimizerRoutes: AppRoute[] = [
  {
    path: '/optimizer',
    name: 'Optimizador',
    element: OptimizerPage,
    roles: ['administrador', 'vendedor'],
    // Side-by-side pieces grid and cut diagrams need every pixel of width available.
    fluid: true,
  },
]
