import type { ListSort } from 'src/shared/components/FilterSortSection'

export interface Client {
  id: string
  firstName: string
  lastName: string
  identifier: string
  email?: string
  phone?: string
  source?: string
}

export interface ClientPayload {
  identifier: string
  source: string
  // Optional fields are sent as null (not omitted) to clear them server-side.
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

export interface ClientListParams {
  search?: string
  sort?: ListSort
  offset?: number
  limit?: number
}

export interface ClientSyncIssue {
  /** The client's cédula/RUC — what you search for in the external system. */
  code: string
  name: string
  message: string
}

export interface ClientSyncResult {
  created: number
  updated: number
  /** Rows the sync couldn't use: no cédula, a duplicate, or a cédula that
   *  fails the check digit. Skipped, never fatal — the source is a live
   *  database and a bad row can't be fixed before every run. See `issues`. */
  skippedInvalid: number
  /** Clients the external system has taken out of service (est != 1). */
  skippedInactive: number
  issues: ClientSyncIssue[]
  /** Rows that WERE imported but with a field dropped: an unusable phone, a
   *  malformed e-mail. Reported because a client with no phone can't be
   *  quoted, and nobody would know why. */
  warnings: ClientSyncIssue[]
  /** True when the pass ran and rolled back: a preview, nothing was written. */
  dryRun: boolean
}
