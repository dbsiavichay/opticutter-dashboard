import { createCrudApi, toQuery } from 'src/shared/api/crudApi'
import { httpClient } from 'src/shared/api/httpClient'
import type { Client, ClientListParams, ClientPayload } from './types'

export const clientsApi = createCrudApi<
  Client,
  ClientListParams,
  ClientPayload,
  ClientPayload,
  string
>('/api/v1/clients')

// A short, capped client search for the filter panels' `FilterSearchPicker` — a picker shows a
// handful of candidates, never a page of them, so this asks for 50 and ignores pagination. It lived
// in `ordersApi` while orders was the only caller; the quotes listing filters by client too.
export const clientsApiMin = {
  list: (search?: string) =>
    httpClient.list<Client>(`/api/v1/clients/?${toQuery({ search, offset: 0, limit: 50 })}`),
}
