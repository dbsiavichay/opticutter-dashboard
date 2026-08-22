import { useState } from 'react'
import {
  CBadge,
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
import { cilPlus, cilTrash } from '@coreui/icons'

import ServiceForm from './ServiceForm'
import { useCreateService, useDeleteService, useServices, useUpdateService } from './useServices'
import ServicesFilters, {
  activeCount,
  servicesFilterChips,
  type ServicesFilterValues,
} from './ServicesFilters'
import type { AdditionalService, AdditionalServicePayload } from './types'
import { fmtMoney } from 'src/shared/utils/format'
import SearchInput from 'src/shared/components/SearchInput'
import FilterChips from 'src/shared/components/FilterChips'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'
import type { ListSort } from 'src/shared/components/FilterSortSection'
import { useListParams } from 'src/shared/hooks/useListParams'

// Filter fields that live in the URL. `q` is the search box; the rest are the panel's.
const FILTER_KEYS = ['q', 'isActive']

interface ModalState {
  visible: boolean
  service: AdditionalService | null
}

const ServicesPage = () => {
  const { getParam, setParam, clearParams, offset, setOffset, limit, setLimit } = useListParams()

  const search = getParam('q')
  const values: ServicesFilterValues = {
    isActive: getParam('isActive'),
    sort: (getParam('sort') || 'name') as ListSort,
  }

  const handleChange = <K extends keyof ServicesFilterValues>(
    key: K,
    value: ServicesFilterValues[K],
  ) => {
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const chips = servicesFilterChips(values, handleChange)
  const isFiltered = activeCount(values) > 0 || search !== ''

  const [formModal, setFormModal] = useState<ModalState>({ visible: false, service: null })
  const [deleteModal, setDeleteModal] = useState<ModalState>({ visible: false, service: null })

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const {
    data: servicesData,
    isLoading,
    isError,
    refetch,
  } = useServices({
    search: search || undefined,
    isActive: values.isActive ? values.isActive === 'true' : undefined,
    sort: values.sort,
    offset,
    limit,
  })
  const services = servicesData?.items ?? []
  const pagination = servicesData?.pagination

  const createMutation = useCreateService()
  const updateMutation = useUpdateService()
  const deleteMutation = useDeleteService()

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
      <div className="surface">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <SearchInput
            value={search}
            // `replace`: one history entry per settled keystroke would bury the page behind the list.
            onChange={(value) => setParam('q', value, { replace: true })}
            placeholder="Buscar por nombre…"
            className="flex-grow-1"
            style={{ maxWidth: 360 }}
          />
          <ServicesFilters values={values} onChange={handleChange} onClear={handleClear} />
          <CButton color="primary" className="ms-auto" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo servicio
          </CButton>
        </div>

        <FilterChips chips={chips} onClearAll={handleClear} />

        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          <CTable align="middle" hover responsive className="list-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>ID</CTableHeaderCell>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Precio</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {services.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow filter is
                      a place the user needs a way out of. */}
                  <CTableDataCell colSpan={5} className="text-center text-body-secondary py-5">
                    {isFiltered ? (
                      <>
                        <div>Ningún servicio coincide con los filtros.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar filtros
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay servicios adicionales.'
                    )}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                services.map((s) => (
                  <CTableRow key={s.id} onClick={() => openEdit(s)}>
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
                      {/* The row opens the editor, so only the destructive action keeps a button —
                          and it must not also open it on the way. */}
                      <CButton
                        variant="ghost"
                        color="danger"
                        size="sm"
                        aria-label={`Eliminar ${s.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDelete(s)
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
