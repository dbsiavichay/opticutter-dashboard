import { useQuery } from '@tanstack/react-query'
import { createCrudHooks } from 'src/shared/hooks/createCrudHooks'
import { clientsApi } from './clientsApi'
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
