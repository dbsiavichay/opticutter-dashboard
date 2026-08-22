import { useQuery } from '@tanstack/react-query'
import { createCrudHooks } from 'src/shared/hooks/createCrudHooks'
import { clientsApi, clientsApiMin } from './clientsApi'
import type { Client, ClientListParams, ClientPayload } from './types'

const hooks = createCrudHooks<Client, ClientListParams, ClientPayload, ClientPayload, string>(
  'clients',
  clientsApi,
)

export const useClients = hooks.useList
export const useCreateClient = hooks.useCreate
export const useUpdateClient = hooks.useUpdate
export const useDeleteClient = hooks.useDelete

// One client by id. `createCrudHooks` only builds the list + mutations, but a list page landed on
// with `?clientId=7` has the id and needs the name to label the filter it is showing.
export const useClient = (id?: string) =>
  useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.get(id as string),
    enabled: !!id,
  })

// Candidates for a `FilterSearchPicker`. Its own key family (`clients-min`), not `['clients', …]`:
// the CRUD mutations invalidate that one, and a picker's 50-row page has no reason to refetch
// because someone edited a client's phone number.
export const useClientsMin = (search?: string) =>
  useQuery({
    queryKey: ['clients-min', search],
    queryFn: () => clientsApiMin.list(search),
  })
