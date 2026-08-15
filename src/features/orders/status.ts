import type { StatusConfigEntry } from 'src/shared/components/StatusBadge'
import type { OrderStatus } from './types'

// Everything the app needs to know about where an order stands, in one place — the companion of
// `preorders/status.ts`. Before this module the seven labels were written twice (the badge's config
// and the list page's filter options) and the state graph lived inline at the top of the detail
// page, which is not where the list page or a future caller would look for it.

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfigEntry> = {
  confirmed: { color: 'primary', label: 'Confirmada' },
  queued: { color: 'info', label: 'En cola' },
  cutting: { color: 'warning', label: 'En corte' },
  cut: { color: 'info', label: 'Cortada' },
  completed: { color: 'success', label: 'Completada' },
  despachado: { color: 'dark', label: 'Despachada' },
  cancelled: { color: 'danger', label: 'Cancelada' },
}

export const ORDER_STATUS_VALUES = Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[]

export const statusLabel = (status: OrderStatus) => ORDER_STATUS_CONFIG[status].label

// Nothing more happens to the order.
const TERMINAL_STATES: OrderStatus[] = ['despachado', 'cancelled']

// States where the cutting plan is relevant: queued (interactive in the workshop) and beyond
// (read-only, auditing what was cut).
const WORKSHOP_STATES: OrderStatus[] = ['queued', 'cutting', 'cut', 'completed']

// States where attachments are frozen (matches the backend 422 gate). Note this includes
// `completed`, unlike the terminal set which only covers despachado/cancelled.
const ATTACHMENTS_LOCKED: OrderStatus[] = ['completed', 'despachado', 'cancelled']

export const isTerminal = (status: OrderStatus) => TERMINAL_STATES.includes(status)
export const hasWorkshopPlan = (status: OrderStatus) => WORKSHOP_STATES.includes(status)
export const attachmentsLocked = (status: OrderStatus) => ATTACHMENTS_LOCKED.includes(status)

export interface StatusTransition {
  to: OrderStatus
  label: string
  color: string
  roles: string[]
}

// The forward move of each state comes first: the detail page's footer promotes `[0]` to its
// primary button and renders the rest as outline siblings.
export const STATUS_TRANSITIONS: Partial<Record<OrderStatus, StatusTransition[]>> = {
  confirmed: [
    {
      to: 'queued',
      label: 'Poner en cola',
      color: 'primary',
      roles: ['administrador', 'vendedor'],
    },
    { to: 'cancelled', label: 'Cancelar', color: 'danger', roles: ['administrador', 'vendedor'] },
  ],
  queued: [
    { to: 'cutting', label: 'Tomar orden', color: 'primary', roles: ['administrador', 'operador'] },
  ],
  cutting: [
    {
      to: 'cut',
      label: 'Marcar como cortada',
      color: 'primary',
      roles: ['administrador', 'operador'],
    },
    { to: 'queued', label: 'Regresar a cola', color: 'secondary', roles: ['administrador'] },
  ],
  cut: [
    {
      to: 'completed',
      label: 'Marcar como completada',
      color: 'success',
      roles: ['administrador', 'vendedor', 'operador', 'canteador'],
    },
  ],
  completed: [
    {
      to: 'despachado',
      label: 'Despachar',
      color: 'success',
      roles: ['administrador', 'vendedor'],
    },
  ],
}

export const transitionsFor = (status: OrderStatus, role: string | undefined) =>
  isTerminal(status)
    ? []
    : (STATUS_TRANSITIONS[status] ?? []).filter((t) => t.roles.includes(role ?? ''))
