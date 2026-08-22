import { useMemo, useState } from 'react'
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

import UserForm from './UserForm'
import { useUsers, useCreateUser, useDeleteUser, useUpdateUser } from './useUsers'
import { useBranches } from 'src/features/branches/useBranches'
import type { User } from 'src/features/auth/types'
import type { UserPayload, UserUpdatePayload } from './types'
import { ROLE_BADGE_CONFIG } from 'src/features/auth/roleLabels'
import { PAGE_SIZE } from 'src/shared/constants'
import SearchInput from 'src/shared/components/SearchInput'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'
import StatusBadge from 'src/shared/components/StatusBadge'

interface ModalState {
  visible: boolean
  user: User | null
}

const UsersPage = () => {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)

  // Growing the page size invalidates the current page number, so both move together.
  const handleLimitChange = (next: number) => {
    setLimit(next)
    setOffset(0)
  }
  const [formModal, setFormModal] = useState<ModalState>({ visible: false, user: null })
  const [deleteModal, setDeleteModal] = useState<ModalState>({ visible: false, user: null })

  const {
    data: usersData,
    isLoading,
    isError,
    refetch,
  } = useUsers({
    search,
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

  const handleSearch = (value: string) => {
    setSearch(value)
    setOffset(0)
  }

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
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Usuarios</strong>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo usuario
          </CButton>
        </CCardHeader>
        <CCardBody>
          <SearchInput
            onChange={handleSearch}
            placeholder="Buscar por nombre o email…"
            className="mb-3"
            style={{ maxWidth: 320 }}
          />

          <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
            <CTable align="middle" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell className="bg-body-tertiary">ID</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Email</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Rol</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Sucursal</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary">Estado</CTableHeaderCell>
                  <CTableHeaderCell className="bg-body-tertiary" />
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {users.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                      Sin resultados
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  users.map((u) => (
                    <CTableRow key={u.id}>
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
                        <CButton
                          variant="ghost"
                          color="secondary"
                          size="sm"
                          onClick={() => openEdit(u)}
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          variant="ghost"
                          color="danger"
                          size="sm"
                          className="ms-1"
                          onClick={() => openDelete(u)}
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
