import { useState } from 'react'
import {
  CBadge,
  CButton,
  CFormSwitch,
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
import { cilPlus } from '@coreui/icons'

import BranchForm from './BranchForm'
import { useBranches, useCreateBranch, useUpdateBranch } from './useBranches'
import BranchesFilters, {
  activeCount,
  branchesFilterChips,
  type BranchesFilterValues,
} from './BranchesFilters'
import type { Branch, BranchPayload, BranchUpdatePayload } from './types'
import SearchInput from 'src/shared/components/SearchInput'
import FilterChips from 'src/shared/components/FilterChips'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import type { ListSort } from 'src/shared/components/FilterSortSection'
import { useListParams } from 'src/shared/hooks/useListParams'

// Filter fields that live in the URL. `q` is the search box; the rest are the panel's.
const FILTER_KEYS = ['q', 'isActive']

interface ModalState {
  visible: boolean
  branch: Branch | null
}

// What the branch's shop sends to its print agent, at a glance. A muted badge = that printer
// isn't there, so the automatic dispatch is skipped (edit the branch to change it).
const PrintingBadges = ({ branch }: { branch: Branch }) => (
  <>
    <CBadge
      color={branch.printLabelsEnabled ? 'success' : 'secondary'}
      className="me-1"
      title="Etiqueta por pieza cortada"
    >
      Etiquetas
    </CBadge>
    <CBadge
      color={branch.printConsolidatedEnabled ? 'success' : 'secondary'}
      title="Hoja consolidada al completar la orden"
    >
      Hojas
    </CBadge>
  </>
)

const BranchesPage = () => {
  const { getParam, setParam, clearParams, offset, setOffset, limit, setLimit } = useListParams()

  const search = getParam('q')
  const values: BranchesFilterValues = {
    isActive: getParam('isActive'),
    sort: (getParam('sort') || 'name') as ListSort,
  }

  const handleChange = <K extends keyof BranchesFilterValues>(
    key: K,
    value: BranchesFilterValues[K],
  ) => {
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const chips = branchesFilterChips(values, handleChange)
  const isFiltered = activeCount(values) > 0 || search !== ''

  const [formModal, setFormModal] = useState<ModalState>({ visible: false, branch: null })

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const { data, isLoading, isError, refetch } = useBranches({
    search: search || undefined,
    isActive: values.isActive ? values.isActive === 'true' : undefined,
    sort: values.sort,
    offset,
    limit,
  })
  const branches = data?.items ?? []
  const pagination = data?.pagination
  const createMutation = useCreateBranch()
  const updateMutation = useUpdateBranch()

  const openCreate = () => setFormModal({ visible: true, branch: null })
  const openEdit = (branch: Branch) => setFormModal({ visible: true, branch })
  const closeForm = () => {
    setFormModal({ visible: false, branch: null })
    createMutation.reset()
    updateMutation.reset()
  }

  const handleSubmit = (payload: BranchPayload | BranchUpdatePayload) => {
    const { branch } = formModal
    if (branch) {
      updateMutation.mutate({ id: branch.id, data: payload }, { onSuccess: closeForm })
    } else {
      createMutation.mutate(payload as BranchPayload, { onSuccess: closeForm })
    }
  }

  // Soft-delete: the "Activa" toggle maps to isActive via PUT — DELETE is avoided to preserve FK integrity.
  const toggleActive = (branch: Branch) =>
    updateMutation.mutate({ id: branch.id, data: { isActive: !branch.isActive } })

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
            placeholder="Buscar por código o nombre…"
            className="flex-grow-1"
            style={{ maxWidth: 360 }}
          />
          <BranchesFilters values={values} onChange={handleChange} onClear={handleClear} />
          <CButton color="primary" className="ms-auto" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nueva sucursal
          </CButton>
        </div>

        <FilterChips chips={chips} onClearAll={handleClear} />

        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          <CTable align="middle" hover responsive className="list-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Código</CTableHeaderCell>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Dirección</CTableHeaderCell>
                <CTableHeaderCell>Teléfono</CTableHeaderCell>
                <CTableHeaderCell>Impresión</CTableHeaderCell>
                <CTableHeaderCell>Activa</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {branches.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow filter is
                      a place the user needs a way out of. */}
                  <CTableDataCell colSpan={6} className="text-center text-body-secondary py-5">
                    {isFiltered ? (
                      <>
                        <div>Ninguna sucursal coincide con los filtros.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar filtros
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay sucursales.'
                    )}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                branches.map((b) => (
                  <CTableRow key={b.id} onClick={() => openEdit(b)}>
                    <CTableDataCell className="fw-semibold">{b.code}</CTableDataCell>
                    <CTableDataCell>{b.name}</CTableDataCell>
                    <CTableDataCell>{b.address ?? '—'}</CTableDataCell>
                    <CTableDataCell>{b.phone ?? '—'}</CTableDataCell>
                    <CTableDataCell className="text-nowrap">
                      <PrintingBadges branch={b} />
                    </CTableDataCell>
                    {/* The row opens the editor; this cell retires the branch instead, so the click
                        must stop here. The switch is the only delete this listing has — DELETE is
                        avoided to preserve FK integrity. */}
                    <CTableDataCell onClick={(e) => e.stopPropagation()}>
                      <CFormSwitch
                        checked={b.isActive}
                        disabled={updateMutation.isPending}
                        onChange={() => toggleActive(b)}
                        aria-label={`Sucursal ${b.name} activa`}
                      />
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
          <CModalTitle>{formModal.branch ? 'Editar sucursal' : 'Nueva sucursal'}</CModalTitle>
        </CModalHeader>
        <BranchForm
          key={formModal.branch?.id ?? 'new'}
          branch={formModal.branch}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          isSubmitting={isSubmitting}
          error={formError}
        />
      </CModal>
    </>
  )
}

export default BranchesPage
