import { useMemo, useState } from 'react'
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

import UserForm from './UserForm'
import { useUsers, useCreateUser, useDeleteUser, useUpdateUser } from './useUsers'
import { useBranches } from 'src/features/branches/useBranches'
import UsersFilters, {
  activeCount,
  useUsersFilterChips,
  type UsersFilterValues,
} from './UsersFilters'
import type { Role, User } from 'src/features/auth/types'
import type { UserPayload, UserUpdatePayload } from './types'
import { ROLE_BADGE_CONFIG } from 'src/features/auth/roleLabels'
import SearchInput from 'src/shared/components/SearchInput'
import FilterChips from 'src/shared/components/FilterChips'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'
import StatusBadge from 'src/shared/components/StatusBadge'
import type { ListSort } from 'src/shared/components/FilterSortSection'
import { useListParams } from 'src/shared/hooks/useListParams'

// Filter fields that live in the URL. `q` is the search box; the rest are the panel's.
const FILTER_KEYS = ['q', 'role', 'branchId', 'isActive']

interface ModalState {
  visible: boolean
  user: User | null
}

const UsersPage = () => {
  const { getParam, getParams, setParam, clearParams, offset, setOffset, limit, setLimit } =
    useListParams()

  const search = getParam('q')
  const values: UsersFilterValues = {
    role: getParams('role') as Role[],
    branchId: getParam('branchId'),
    isActive: getParam('isActive'),
    sort: (getParam('sort') || 'name') as ListSort,
  }

  const handleChange = <K extends keyof UsersFilterValues>(key: K, value: UsersFilterValues[K]) => {
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const chips = useUsersFilterChips(values, handleChange)
  const isFiltered = activeCount(values) > 0 || search !== ''

  const [formModal, setFormModal] = useState<ModalState>({ visible: false, user: null })
  const [deleteModal, setDeleteModal] = useState<ModalState>({ visible: false, user: null })

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const {
    data: usersData,
    isLoading,
    isError,
    refetch,
  } = useUsers({
    search: search || undefined,
    role: values.role.length ? values.role : undefined,
    branchId: values.branchId ? Number(values.branchId) : undefined,
    isActive: values.isActive ? values.isActive === 'true' : undefined,
    sort: values.sort,
    offset,
    limit,
  })
  const users = usersData?.items ?? []
  const pagination = usersData?.pagination

  // Resolve branchId → name (includes inactive branches to preserve labels for historical staff).
  const { data: branchesData } = useBranches({ limit: 100 })
  const branchName = useMemo(
    () => new Map((branchesData?.items ?? []).map((b) => [b.id, b.name])),
    [branchesData],
  )
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()

  const openCreate = () => setFormModal({ visible: true, user: null })
  const openEdit = (user: User) => setFormModal({ visible: true, user })
  const closeForm = () => {
    setFormModal({ visible: false, user: null })
    createMutation.reset()
    updateMutation.reset()
  }
  const openDelete = (user: User) => setDeleteModal({ visible: true, user })
  const closeDelete = () => setDeleteModal({ visible: false, user: null })

  const handleSubmit = (data: UserPayload | UserUpdatePayload) => {
    const { user } = formModal
    if (user) {
      updateMutation.mutate({ id: user.id, data: data }, { onSuccess: closeForm })
    } else {
      createMutation.mutate(data as UserPayload, { onSuccess: closeForm })
    }
  }

  const handleDelete = () => {
    if (!deleteModal.user) return
    deleteMutation.mutate(deleteModal.user.id, { onSuccess: closeDelete })
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
            placeholder="Buscar por nombre o email…"
            className="flex-grow-1"
            style={{ maxWidth: 360 }}
          />
          <UsersFilters values={values} onChange={handleChange} onClear={handleClear} />
          <CButton color="primary" className="ms-auto" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo usuario
          </CButton>
        </div>

        <FilterChips chips={chips} onClearAll={handleClear} />

        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          <CTable align="middle" hover responsive className="list-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>ID</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Rol</CTableHeaderCell>
                <CTableHeaderCell>Sucursal</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {users.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow filter is
                      a place the user needs a way out of. */}
                  <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                    {isFiltered ? (
                      <>
                        <div>Ningún usuario coincide con los filtros.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar filtros
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay usuarios.'
                    )}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                users.map((u) => (
                  <CTableRow key={u.id} onClick={() => openEdit(u)}>
                    <CTableDataCell className="text-body-secondary">{u.id}</CTableDataCell>
                    <CTableDataCell>{u.email}</CTableDataCell>
                    <CTableDataCell>{u.fullName ?? '—'}</CTableDataCell>
                    <CTableDataCell>
                      <StatusBadge config={ROLE_BADGE_CONFIG} value={u.role} />
                    </CTableDataCell>
                    <CTableDataCell>
                      {u.role === 'administrador'
                        ? 'Global'
                        : u.branchId != null
                          ? (branchName.get(u.branchId) ?? '—')
                          : '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={u.isActive ? 'success' : 'secondary'}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-nowrap">
                      {/* The row opens the editor, so only the destructive action keeps a button —
                          and it must not also open it on the way. */}
                      <CButton
                        variant="ghost"
                        color="danger"
                        size="sm"
                        aria-label={`Eliminar ${u.fullName ?? u.email}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDelete(u)
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
          <CModalTitle>{formModal.user ? 'Editar usuario' : 'Nuevo usuario'}</CModalTitle>
        </CModalHeader>
        <UserForm
          key={formModal.user?.id ?? 'new'}
          user={formModal.user}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          isSubmitting={isSubmitting}
          error={formError}
        />
      </CModal>

      <DeleteConfirmModal
        visible={deleteModal.visible}
        title="Eliminar usuario"
        onClose={closeDelete}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      >
        ¿Eliminar a <strong>{deleteModal.user?.fullName ?? deleteModal.user?.email}</strong>? Esta
        acción no se puede deshacer.
      </DeleteConfirmModal>
    </>
  )
}

export default UsersPage
