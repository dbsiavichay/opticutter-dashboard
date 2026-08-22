import { useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
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
import { cilPencil, cilPlus } from '@coreui/icons'

import BranchForm from './BranchForm'
import { useBranches, useCreateBranch, useUpdateBranch } from './useBranches'
import type { Branch, BranchPayload, BranchUpdatePayload } from './types'
import { PAGE_SIZE } from 'src/shared/constants'
import SearchInput from 'src/shared/components/SearchInput'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'

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
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)

  // Growing the page size invalidates the current page number, so both move together.
  const handleLimitChange = (next: number) => {
    setLimit(next)
    setOffset(0)
  }
  const [formModal, setFormModal] = useState<ModalState>({ visible: false, branch: null })

  const { data, isLoading, isError, refetch } = useBranches({ search, offset, limit })
  const branches = data?.items ?? []
  const pagination = data?.pagination
  const createMutation = useCreateBranch()
  const updateMutation = useUpdateBranch()

  const handleSearch = (value: string) => {
    setSearch(value)
    setOffset(0)
  }

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
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Sucursales</strong>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nueva sucursal
          </CButton>
        </CCardHeader>
        <CCardBody>
          <SearchInput
            onChange={handleSearch}
            placeholder="Buscar por código o nombre…"
            className="mb-3"
            style={{ maxWidth: 320 }}
          />

          <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
            <CTable align="middle" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">Código</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Dirección</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Teléfono</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Impresión</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Activa</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary" />
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {branches.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                      Sin resultados
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  branches.map((b) => (
                    <CTableRow key={b.id}>
                      <CTableDataCell className="fw-semibold">{b.code}</CTableDataCell>
                      <CTableDataCell>{b.name}</CTableDataCell>
                      <CTableDataCell>{b.address ?? '—'}</CTableDataCell>
                      <CTableDataCell>{b.phone ?? '—'}</CTableDataCell>
                      <CTableDataCell className="text-nowrap">
                        <PrintingBadges branch={b} />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormSwitch
                          checked={b.isActive}
                          disabled={updateMutation.isPending}
                          onChange={() => toggleActive(b)}
                          aria-label="Activa"
                        />
                      </CTableDataCell>
                      <CTableDataCell className="text-end text-nowrap">
                        <CButton
                          variant="ghost"
                          color="secondary"
                          size="sm"
                          onClick={() => openEdit(b)}
                        >
                          <CIcon icon={cilPencil} />
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
