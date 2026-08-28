import { useState } from 'react'
import {
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSync, cilTrash } from '@coreui/icons'

import ClientForm from './ClientForm'
import SyncClientsModal from './SyncClientsModal'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from './useClients'
import ClientsFilters, { type ClientsFilterValues } from './ClientsFilters'
import type { Client, ClientPayload } from './types'
import { clientName } from 'src/shared/utils/format'
import SearchInput from 'src/shared/components/SearchInput'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'
import type { ListSort } from 'src/shared/components/FilterSortSection'
import { useListParams } from 'src/shared/hooks/useListParams'
import { useQueryClient } from '@tanstack/react-query'

// Filter fields that live in the URL. Only the search box: a client has nothing else to narrow by.
const FILTER_KEYS = ['q']

interface ModalState {
  visible: boolean
  client: Client | null
}

const ClientsPage = () => {
  const { getParam, setParam, clearParams, offset, setOffset, limit, setLimit } = useListParams()

  const search = getParam('q')
  const values: ClientsFilterValues = {
    sort: (getParam('sort') || 'name') as ListSort,
  }

  const handleChange = <K extends keyof ClientsFilterValues>(
    key: K,
    value: ClientsFilterValues[K],
  ) => {
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const [formModal, setFormModal] = useState<ModalState>({ visible: false, client: null })
  const [deleteModal, setDeleteModal] = useState<ModalState>({ visible: false, client: null })
  const [syncModal, setSyncModal] = useState(false)
  const queryClient = useQueryClient()

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const {
    data: clientsData,
    isLoading,
    isError,
    refetch,
  } = useClients({ search: search || undefined, sort: values.sort, offset, limit })
  const clients = clientsData?.items ?? []
  const pagination = clientsData?.pagination

  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()

  const openCreate = () => setFormModal({ visible: true, client: null })
  const openEdit = (client: Client) => setFormModal({ visible: true, client })
  const closeForm = () => {
    setFormModal({ visible: false, client: null })
    createMutation.reset()
    updateMutation.reset()
  }
  const openDelete = (client: Client) => setDeleteModal({ visible: true, client })
  const closeDelete = () => setDeleteModal({ visible: false, client: null })

  const handleSubmit = (data: ClientPayload) => {
    const { client } = formModal
    if (client) {
      updateMutation.mutate({ id: client.id, data }, { onSuccess: closeForm })
    } else {
      createMutation.mutate(data, { onSuccess: closeForm })
    }
  }

  const handleDelete = () => {
    if (!deleteModal.client) return
    deleteMutation.mutate(deleteModal.client.id, { onSuccess: closeDelete })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const formError = createMutation.error || updateMutation.error

  return (
    <>
      <div className="surface">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <SearchInput
            value={search}
            // `replace`: one history entry per settled keystroke would bury the page behind the list.
            onChange={(value) => setParam('q', value, { replace: true })}
            placeholder="Buscar por nombre o identificador…"
            className="flex-grow-1"
            style={{ maxWidth: 360 }}
          />
          <ClientsFilters values={values} onChange={handleChange} onClear={handleClear} />
          <div className="d-flex gap-2 ms-auto">
            <CButton color="secondary" variant="outline" onClick={() => setSyncModal(true)}>
              <CIcon icon={cilSync} className="me-1" />
              Sincronizar clientes
            </CButton>
            <CButton color="primary" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" />
              Nuevo cliente
            </CButton>
          </div>
        </div>

        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          <CTable align="middle" hover responsive className="list-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>ID</CTableHeaderCell>
                <CTableHeaderCell>Identificador</CTableHeaderCell>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Teléfono</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell>Fuente</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {clients.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow search is
                      a place the user needs a way out of. */}
                  <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                    {search ? (
                      <>
                        <div>Ningún cliente coincide con la búsqueda.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar búsqueda
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay clientes.'
                    )}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                clients.map((c) => (
                  <CTableRow key={c.id} onClick={() => openEdit(c)}>
                    <CTableDataCell className="text-body-secondary">{c.id}</CTableDataCell>
                    <CTableDataCell>
                      <strong>{c.identifier}</strong>
                    </CTableDataCell>
                    <CTableDataCell>{clientName(c)}</CTableDataCell>
                    <CTableDataCell>{c.phone ?? '—'}</CTableDataCell>
                    <CTableDataCell>{c.email ?? '—'}</CTableDataCell>
                    <CTableDataCell>{c.source ?? '—'}</CTableDataCell>
                    <CTableDataCell className="text-end text-nowrap">
                      {/* The row opens the editor, so only the destructive action keeps a button —
                          and it must not also open it on the way. */}
                      <CButton
                        variant="ghost"
                        color="danger"
                        size="sm"
                        aria-label={`Eliminar ${clientName(c)}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDelete(c)
                        }}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </QueryState>

        <Pagination
          offset={offset}
          limit={limit}
          total={pagination?.total}
          onChange={setOffset}
          onLimitChange={setLimit}
        />
      </div>

      <CModal visible={formModal.visible} onClose={closeForm} backdrop="static">
        <CModalHeader>
          <CModalTitle>{formModal.client ? 'Editar cliente' : 'Nuevo cliente'}</CModalTitle>
        </CModalHeader>
        <ClientForm
          key={formModal.client?.id ?? 'new'}
          client={formModal.client}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          isSubmitting={isSubmitting}
          error={formError}
        />
      </CModal>

      <DeleteConfirmModal
        visible={deleteModal.visible}
        title="Eliminar cliente"
        onClose={closeDelete}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      >
        ¿Eliminar a <strong>{deleteModal.client && clientName(deleteModal.client)}</strong> (
        {deleteModal.client?.identifier})? Esta acción no se puede deshacer.
      </DeleteConfirmModal>

      <SyncClientsModal
        visible={syncModal}
        onClose={() => setSyncModal(false)}
        onSynced={() => void queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />
    </>
  )
}

export default ClientsPage
