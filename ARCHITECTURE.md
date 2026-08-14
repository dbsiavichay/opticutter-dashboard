# Maderable Dashboard — Architecture

## Project Overview

Internal admin dashboard for a woodworking / carpentry manufacturing business (Maderable).
Single-page application with client-side routing (no SSR). Used by staff across multiple branches
to manage the full manufacturing workflow: quotes → orders → cutting → edge-banding → dispatch.

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| UI framework | React (functional components + Hooks) | 19.x |
| Language | TypeScript — `strict: true` | 6.x |
| Component library | CoreUI React + Bootstrap 5 | 5.x |
| Routing | React Router 7 — `HashRouter` | 7.x |
| Server state | TanStack React Query | 5.x |
| UI / auth state | Zustand | 5.x |
| Build | Vite | 8.x |
| Styles | Sass + CoreUI/Bootstrap variables | — |
| Charts | Chart.js + @coreui/react-chartjs | 4.x |

## Architectural Pattern: Vertical Slice

Code is organized **by feature**, not by technical layer. Each feature is self-contained and
exposes only its routes and nav items for composition into the shell.

```
src/features/<name>/
├── <Name>Page.tsx     # Page component(s)
├── routes.ts          # export const <name>Routes: AppRoute[]
├── nav.tsx            # export const <name>Nav: NavItem[]  (must be .tsx — contains JSX)
├── <name>Api.ts       # httpClient calls with typed generics
├── use<Name>.ts       # React Query hooks (useQuery / useMutation)
└── types.ts           # co-located domain types/interfaces
```

Features wire into the shell by adding two imports: routes into `src/shared/routes.ts` and
nav into `src/shared/components/AppSidebar.tsx`. No other files change.

## Directory Structure

```
src/
├── App.tsx                          # HashRouter + public routes + DefaultLayout
├── index.tsx                        # Entry point: QueryClientProvider
│
├── shared/
│   ├── api/
│   │   ├── httpClient.ts            # Typed fetch wrapper (get/list/post/put/patch/delete)
│   │   └── types.ts                 # ApiError, PaginatedResult<T>, Pagination
│   ├── components/                  # App shell components
│   │   ├── AppSidebar.tsx           # Sidebar composing all feature navs (role-filtered)
│   │   ├── AppSidebarNav.tsx        # Nav item renderer
│   │   ├── AppHeader.tsx            # Top bar: theme toggle, user menu
│   │   ├── AppContent.tsx           # Content area + route outlet
│   │   ├── AppBreadcrumb.tsx        # Breadcrumb trail
│   │   ├── SearchableSelect.tsx     # Reusable filterable select
│   │   ├── StatusHistoryCard.tsx    # Timeline of status changes
│   │   ├── PricingBlock.tsx         # Pricing display
│   │   └── ZoomControls.tsx         # Pan/zoom controls for SVG diagrams
│   ├── hooks/
│   │   └── useZoomPan.ts            # Pan and zoom state for SVG views
│   ├── layout/DefaultLayout.tsx     # Authenticated layout wrapper
│   ├── routes.ts                    # AppRoute[] composed from all feature routes
│   ├── scss/                        # Global styles; CoreUI/Bootstrap variable overrides
│   ├── assets/                      # Images, logos
│   └── store/
│       ├── authStore.ts             # Session: token, user, status, setSession, clearSession
│       └── uiStore.ts               # UI: sidebarShow, sidebarUnfoldable, theme
│
└── features/
    ├── auth/                        # Login, Register, Page404, Page500
    ├── dashboard/                   # Analytics hub (see below)
    ├── orders/                      # Order lifecycle + workshop cutting view
    ├── preorders/                   # Quote/proposal lifecycle
    ├── products/                    # Product catalog (boards + edge banding)
    ├── clients/                     # Client management
    ├── branches/                    # Branch / location management
    ├── users/                       # Staff user management
    ├── settings/                    # Company, cutting, preorder, price-tier settings
    ├── profile/                     # User self-service (profile + password)
    ├── optimizer/                   # Cut plan optimizer with SVG layout visualization
    ├── review/                      # Public client-facing quote review (no auth)
    └── widgets/                     # CoreUI template showcase — not a production feature
```

## Feature Summary

| Feature | Routes | Description |
|---------|--------|-------------|
| `auth` | `/login` `/register` `/404` `/500` | JWT auth, role-based session, public pages |
| `dashboard` | `/dashboard` `/analytics/*` | 4-page analytics: KPI summary, bottlenecks, user productivity, attendance. All `/api/v1/analytics/*` endpoints live here — not in a separate feature |
| `orders` | `/orders` `/orders/create` `/orders/:id` | Full order lifecycle; workshop SVG cutting view; edge-banding queue |
| `preorders` | `/preorders` `/preorders/:id` | Quote lifecycle (draft→sent→confirmed/rejected); client review links; audit trail |
| `products` | `/products` | Board and edge-banding catalog; discriminated union type; CSV bulk import |
| `clients` | `/clients` | Client management |
| `branches` | `/branches` | Branch / location management (multi-branch model) |
| `users` | `/users` | Staff user management with role assignment |
| `settings` | `/settings` | Company info, kerf/trim parameters, quote validity, price tiers |
| `profile` | `/profile` `/profile/password` | Self-service profile and password change |
| `optimizer` | `/optimizer` | Cut plan optimizer: piece input, CSV/XML import (the file's `Etiqueta` is read as edge banding), packing strategy, SVG board layout, pattern cards, draft save/load |
| `review` | `/review/:token` | Public quote review and approval portal (no auth required) |
| `widgets` | `/widgets` | Template demo — candidate for removal |

## Key Subsystems

### HTTP Client (`src/shared/api/httpClient.ts`)

Typed fetch wrapper. All API modules use it with explicit generics:

```ts
httpClient.get<T>(path, params?)       // → T
httpClient.list<T>(path, params?)      // → PaginatedResult<T>
httpClient.post<T>(path, body)         // → T
httpClient.put<T>(path, body)          // → T
httpClient.patch<T>(path, body)        // → T
httpClient.delete(path)               // → void
```

Handles JWT injection, automatic token refresh (single-flight pattern on concurrent 401s),
`{data: T, meta}` envelope unwrapping, and `ApiError` construction from error responses.

### Auth & Session

Zustand `authStore` holds `token`, `refreshToken`, `user` (with role), and `status`.
`App.tsx` restores session on load by calling `/api/v1/auth/me` with the stored token.
`httpClient` reads the token from the store and auto-refreshes on 401.

### Roles

Four roles with distinct route access and landing pages:

| Role | Access | Landing |
|------|--------|---------|
| `administrador` | All features | `/dashboard` |
| `vendedor` | Optimizer, Pre-orders, Orders, Products, Clients | `/optimizer` |
| `operador` | Orders (cutting workshop) | `/orders` |
| `canteador` | Orders (banding queue) | `/banding` |

### State Management

- **Server state** (remote data): TanStack React Query — caching, invalidation, mutations
- **Auth state**: Zustand `authStore` — persisted token / session
- **UI state**: Zustand `uiStore` — sidebar, theme
- No Redux anywhere in the codebase

### Cut Plan Optimizer (`features/optimizer`)

The most complex feature. Calls `POST /api/v1/optimize/` with materials and piece requirements.
Backend returns layouts grouped by pattern. The frontend renders:
- `CutLayoutDiagram.tsx` — SVG board diagrams with `boardRotation` / `uprightText` utilities
- `cutDrawing.ts` — pure drawing primitives shared with the orders workshop SVG view
- `SheetDetailModal` — expanded pattern view with `PiecePreview` and `GroupedPiecesList`
- `OptimizingOverlay.tsx` — cover for the results pane while `/optimize` runs (tens of seconds on a
  real job): an animated board, the wordmark, a stage message and an elapsed counter

### Multi-Branch Model

Every order, pre-order, and draft has a required `branch` foreign key.
Admins are global; `vendedor` / `operador` / `canteador` users belong to one branch.
API endpoints accept optional `branchId` filter for cross-branch admin queries.
