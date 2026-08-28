import { createCrudApi, toQuery } from 'src/shared/api/crudApi'
import { httpClient } from 'src/shared/api/httpClient'
import type { Client, ClientListParams, ClientPayload, ClientSyncResult } from './types'

export const clientsApi = createCrudApi<
  Client,
  ClientListParams,
  ClientPayload,
  ClientPayload,
  string
>('/api/v1/clients')

// Pulls the client list from the external system (SIFAC), matched by cédula/RUC. Takes no body;
// `dryRun` runs the whole pass and rolls back, so the operator sees the numbers before they land.
export const syncClients = (dryRun = false) =>
  httpClient.post<ClientSyncResult>(`/api/v1/clients/sync?dryRun=${dryRun}`)

// A short, capped client search for the filter panels' `FilterSearchPicker` — a picker shows a
// handful of candidates, never a page of them, so this asks for 50 and ignores pagination. It lived
// in `ordersApi` while orders was the only caller; the quotes listing filters by client too.
export const clientsApiMin = {
  list: (search?: string) =>
    httpClient.list<Client>(`/api/v1/clients/?${toQuery({ search, offset: 0, limit: 50 })}`),
}
