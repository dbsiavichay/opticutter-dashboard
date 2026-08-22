import { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
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
import { cilPencil, cilPlus, cilTrash } from '@coreui/icons'

import ClientForm from './ClientForm'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from './useClients'
import type { Client, ClientPayload } from './types'
import { PAGE_SIZE } from 'src/shared/constants'
import { clientName } from 'src/shared/utils/format'
import SearchInput from 'src/shared/components/SearchInput'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'

interface ModalState {
  visible: boolean
  client: Client | null
}

const ClientsPage = () => {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)

  // Growing the page size invalidates the current page number, so both move together.
  const handleLimitChange = (next: number) => {
    setLimit(next)
    setOffset(0)
  }
  const [formModal, setFormModal] = useState<ModalState>({ visible: false, client: null })
  const [deleteModal, setDeleteModal] = useState<ModalState>({ visible: false, client: null })

  const {
    data: clientsData,
    isLoading,
    isError,
    refetch,
  } = useClients({
    search,
    offset,
    limit,
  })
  const clients = clientsData?.items ?? []
  const pagination = clientsData?.pagination
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()

  const handleSearch = (value: string) => {
    setSearch(value)
    setOffset(0)
  }

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
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Clientes</strong>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo cliente
          </CButton>
        </CCardHeader>
        <CCardBody>
          <SearchInput
            onChange={handleSearch}
            placeholder="Buscar por nombre o identificador…"
            className="mb-3"
            style={{ maxWidth: 320 }}
          />

          <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
            <CTable align="middle" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">ID</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Identificador</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Teléfono</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Email</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Fuente</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary" />
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {clients.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                      Sin resultados
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  clients.map((c) => (
                    <CTableRow key={c.id}>
                      <CTableDataCell className="text-body-secondary">{c.id}</CTableDataCell>
                      <CTableDataCell>
                        <strong>{c.identifier}</strong>
                      </CTableDataCell>
                      <CTableDataCell>{clientName(c)}</CTableDataCell>
                      <CTableDataCell>{c.phone ?? '—'}</CTableDataCell>
                      <CTableDataCell>{c.email ?? '—'}</CTableDataCell>
                      <CTableDataCell>{c.source ?? '—'}</CTableDataCell>
                      <CTableDataCell className="text-end text-nowrap">
                        <CButton
                          variant="ghost"
                          color="secondary"
                          size="sm"
                          onClick={() => openEdit(c)}
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          variant="ghost"
                          color="danger"
                          size="sm"
                          className="ms-1"
                          onClick={() => openDelete(c)}
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
            onLimitChange={handleLimitChange}
          />
        </CCardBody>
      </CCard>

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
    </>
  )
}

export default ClientsPage
