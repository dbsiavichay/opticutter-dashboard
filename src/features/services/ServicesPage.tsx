import { useState } from 'react'
import {
  CBadge,
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

import ServiceForm from './ServiceForm'
import { useCreateService, useDeleteService, useServices, useUpdateService } from './useServices'
import type { AdditionalService, AdditionalServicePayload } from './types'
import { PAGE_SIZE } from 'src/shared/constants'
import { fmtMoney } from 'src/shared/utils/format'
import SearchInput from 'src/shared/components/SearchInput'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'

interface ModalState {
  visible: boolean
  service: AdditionalService | null
}

const ServicesPage = () => {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)

  // Growing the page size invalidates the current page number, so both move together.
  const handleLimitChange = (next: number) => {
    setLimit(next)
    setOffset(0)
  }
  const [formModal, setFormModal] = useState<ModalState>({ visible: false, service: null })
  const [deleteModal, setDeleteModal] = useState<ModalState>({ visible: false, service: null })

  const { data: servicesData, isLoading, isError, refetch } = useServices({ search, offset, limit })
  const services = servicesData?.items ?? []
  const pagination = servicesData?.pagination
  const createMutation = useCreateService()
  const updateMutation = useUpdateService()
  const deleteMutation = useDeleteService()

  const handleSearch = (value: string) => {
    setSearch(value)
    setOffset(0)
  }

  const openCreate = () => setFormModal({ visible: true, service: null })
  const openEdit = (service: AdditionalService) => setFormModal({ visible: true, service })
  const closeForm = () => {
    setFormModal({ visible: false, service: null })
    createMutation.reset()
    updateMutation.reset()
  }
  const openDelete = (service: AdditionalService) => setDeleteModal({ visible: true, service })
  const closeDelete = () => setDeleteModal({ visible: false, service: null })

  const handleSubmit = (data: AdditionalServicePayload) => {
    const { service } = formModal
    if (service) {
      updateMutation.mutate({ id: service.id, data }, { onSuccess: closeForm })
    } else {
      createMutation.mutate(data, { onSuccess: closeForm })
    }
  }

  const handleDelete = () => {
    if (!deleteModal.service) return
    deleteMutation.mutate(deleteModal.service.id, { onSuccess: closeDelete })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const formError = createMutation.error || updateMutation.error

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Servicios adicionales</strong>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo servicio
          </CButton>
        </CCardHeader>
        <CCardBody>
          <SearchInput
            onChange={handleSearch}
            placeholder="Buscar por nombre…"
            className="mb-3"
            style={{ maxWidth: 320 }}
          />

          <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
            <CTable align="middle" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">ID</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Precio</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Estado</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary" />
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {services.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center text-body-secondary py-5">
                      Sin resultados
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  services.map((s) => (
                    <CTableRow key={s.id}>
                      <CTableDataCell className="text-body-secondary">{s.id}</CTableDataCell>
                      <CTableDataCell>
                        <strong>{s.name}</strong>
                      </CTableDataCell>
                      <CTableDataCell>{fmtMoney(s.price)}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={s.isActive ? 'success' : 'secondary'}>
                          {s.isActive ? 'Activo' : 'Inactivo'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="text-end text-nowrap">
                        <CButton
                          variant="ghost"
                          color="secondary"
                          size="sm"
                          onClick={() => openEdit(s)}
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          variant="ghost"
                          color="danger"
                          size="sm"
                          className="ms-1"
                          onClick={() => openDelete(s)}
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
          <CModalTitle>{formModal.service ? 'Editar servicio' : 'Nuevo servicio'}</CModalTitle>
        </CModalHeader>
        <ServiceForm
          key={formModal.service?.id ?? 'new'}
          service={formModal.service}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          isSubmitting={isSubmitting}
          error={formError}
        />
      </CModal>

      <DeleteConfirmModal
        visible={deleteModal.visible}
        title="Eliminar servicio"
        onClose={closeDelete}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      >
        ¿Eliminar el servicio <strong>{deleteModal.service?.name}</strong>? Esta acción no se puede
        deshacer.
      </DeleteConfirmModal>
    </>
  )
}

export default ServicesPage
