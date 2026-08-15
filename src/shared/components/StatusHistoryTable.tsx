import {
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import type { ReactNode } from 'react'
import { fmtDateTime } from 'src/shared/utils/format'
import StatusBadge, { type StatusConfigEntry } from './StatusBadge'

// Actor type: the type of entity that performed the action, not a free-form name.
// `actorLabel` is the actor's display name frozen at the time of the status change.
export type ActorType = 'staff' | 'client' | 'system'

const ACTOR_CONFIG: Record<ActorType, StatusConfigEntry> = {
  staff: { color: 'primary', label: 'Equipo' },
  client: { color: 'info', label: 'Cliente' },
  system: { color: 'secondary', label: 'Sistema' },
}

// Generic status history entry; used for both orders and pre-orders.
export interface StatusHistoryEntry {
  id: string | number
  fromStatus?: string | null
  toStatus: string
  actor?: ActorType | null
  actorUserId?: number | null
  actorLabel?: string | null
  note?: string | null
  createdAt: string
}

interface StatusHistoryTableProps {
  entries: StatusHistoryEntry[]
  // Each feature renders statuses with its own badge (OrderStatusBadge / PreOrderStatusBadge).
  renderStatus: (status: string) => ReactNode
}

// The table and nothing else — no card, no title. The chrome belongs to whoever places it: the order
// detail page keeps it in a CCard among its other cards, the pre-order page folds it into a
// <details> at the end of its surface, because a history is consulted rather than read.
// Renders nothing when empty, so both call sites can drop it in unconditionally.
const StatusHistoryTable = ({ entries, renderStatus }: StatusHistoryTableProps) => {
  if (!entries || entries.length === 0) return null

  // `.summary-table` for the brand header, like the materials and edge-banding tables. The cells
  // carry no `bg-body-tertiary`: Bootstrap's background utilities are `!important`, so the grey
  // would win over the class no matter the order.
  return (
    <CTable small responsive className="summary-table mb-0">
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Desde</CTableHeaderCell>
          <CTableHeaderCell>Hacia</CTableHeaderCell>
          <CTableHeaderCell>Actor</CTableHeaderCell>
          <CTableHeaderCell>Nota</CTableHeaderCell>
          <CTableHeaderCell>Fecha</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {entries.map((h) => (
          <CTableRow key={h.id}>
            <CTableDataCell>{h.fromStatus ? renderStatus(h.fromStatus) : '—'}</CTableDataCell>
            <CTableDataCell>{renderStatus(h.toStatus)}</CTableDataCell>
            <CTableDataCell className="text-nowrap">
              <span className="me-2">{h.actorLabel ?? '—'}</span>
              {h.actor && <StatusBadge config={ACTOR_CONFIG} value={h.actor} />}
            </CTableDataCell>
            <CTableDataCell>{h.note ?? '—'}</CTableDataCell>
            <CTableDataCell className="text-nowrap">{fmtDateTime(h.createdAt)}</CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  )
}

export default StatusHistoryTable
