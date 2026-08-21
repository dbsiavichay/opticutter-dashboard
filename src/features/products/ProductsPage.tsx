import type {
  BoardAttributes,
  EdgeBandingAttributes,
  Product,
  ProductListParams,
  ProductPayload,
  ProductType,
} from './types'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CModal,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import { cilPencil, cilPlus, cilSync, cilTrash } from '@coreui/icons'
import { useCreateProduct, useDeleteProduct, useProducts, useUpdateProduct } from './useProducts'
import { useMemo, useState } from 'react'

import CIcon from '@coreui/icons-react'
import ProductForm from './ProductForm'
import SyncCatalogModal from './SyncCatalogModal'
import { BOARD_SUBTYPES, EDGE_BANDING_SUBTYPES, subtypeLabel } from './productSubtypes'
import { useHasRole } from 'src/features/auth/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE } from 'src/shared/constants'
import { fmtMoney } from 'src/shared/utils/format'
import SearchInput from 'src/shared/components/SearchInput'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'
import StatusBadge, { type StatusConfigEntry } from 'src/shared/components/StatusBadge'
import FilterMenu from 'src/shared/components/FilterMenu'
import FilterCheckboxList, { type FilterOption } from 'src/shared/components/FilterCheckboxList'

const TYPE_CONFIG: Record<string, StatusConfigEntry> = {
  board: { color: 'info', label: 'Tablero' },
  edge_banding: { color: 'warning', label: 'Tapacanto' },
  hardware: { color: 'secondary', label: 'Herraje' },
}
const BAND_TYPE_LABELS: Record<string, string> = { Soft: 'Suave', Hard: 'Duro' }

const TYPE_OPTIONS: FilterOption<ProductType>[] = [
  { value: 'board', label: 'Tablero' },
  { value: 'edge_banding', label: 'Tapacanto' },
]

const BOARD_SUBTYPE_SET = new Set<string>(BOARD_SUBTYPES)
const EDGE_BANDING_SUBTYPE_SET = new Set<string>(EDGE_BANDING_SUBTYPES)

interface ProductModalState {
  visible: boolean
  product: Product | null
}

const ProductsPage = () => {
  const isReadOnly = useHasRole('vendedor')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType[]>([])
  const [subtypeFilter, setSubtypeFilter] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [formModal, setFormModal] = useState<ProductModalState>({ visible: false, product: null })
  const [deleteModal, setDeleteModal] = useState<ProductModalState>({
    visible: false,
    product: null,
  })
  const [syncModal, setSyncModal] = useState(false)

  // Specialized (per-type) columns only make sense when the filter narrows to
  // exactly one type; with none or both selected, fall back to the generic view.
  const singleType = typeFilter.length === 1 ? typeFilter[0] : null

  // Subtype choices are scoped to the selected type(s) — showing MDP/OSB while
  // filtering by "Tapacanto" would only ever produce zero results. With no type
  // selected, both groups show (grouped by header, since either can match); with
  // exactly one type selected the group header is dropped — the Tipo filter
  // right next to it already says so, and repeating it is just clutter.
  const subtypeOptions = useMemo(() => {
    const includeBoard = typeFilter.length === 0 || typeFilter.includes('board')
    const includeEdge = typeFilter.length === 0 || typeFilter.includes('edge_banding')
    const showGroups = includeBoard && includeEdge
    const options: FilterOption[] = []
    if (includeBoard) {
      options.push(
        ...BOARD_SUBTYPES.map((s) => ({
          value: s,
          label: subtypeLabel(s),
          group: showGroups ? 'Tablero' : undefined,
        })),
      )
    }
    if (includeEdge) {
      options.push(
        ...EDGE_BANDING_SUBTYPES.map((s) => ({
          value: s,
          label: subtypeLabel(s),
          group: showGroups ? 'Tapacanto' : undefined,
        })),
      )
    }
    return options
  }, [typeFilter])

  const handleTypeChange = (next: ProductType[]) => {
    setTypeFilter(next)
    setOffset(0)
    // Drop any selected subtype that no longer belongs to the narrowed type set,
    // so the filter never silently combines into a guaranteed-empty result.
    const includeBoard = next.length === 0 || next.includes('board')
    const includeEdge = next.length === 0 || next.includes('edge_banding')
    setSubtypeFilter((prev) =>
      prev.filter(
        (s) =>
          (includeBoard && BOARD_SUBTYPE_SET.has(s)) ||
          (includeEdge && EDGE_BANDING_SUBTYPE_SET.has(s)),
      ),
    )
  }

  const handleSubtypeChange = (next: string[]) => {
    setSubtypeFilter(next)
    setOffset(0)
  }

  const handleClearFilters = () => {
    setTypeFilter([])
    setSubtypeFilter([])
    setOffset(0)
  }

  const queryParams: ProductListParams = { search, offset, limit: PAGE_SIZE }
  if (typeFilter.length) queryParams.type = typeFilter
  if (subtypeFilter.length) queryParams.subtype = subtypeFilter

  const { data: productsData, isLoading, isError, refetch } = useProducts(queryParams)
  const products = productsData?.items ?? []
  const pagination = productsData?.pagination

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

  const handleSearch = (value: string) => {
    setSearch(value)
    setOffset(0)
  }

  const openCreate = () => setFormModal({ visible: true, product: null })
  const openEdit = (product: Product) => setFormModal({ visible: true, product })
  const closeForm = () => {
    setFormModal({ visible: false, product: null })
    createMutation.reset()
    updateMutation.reset()
  }
  const openDelete = (product: Product) => setDeleteModal({ visible: true, product })
  const closeDelete = () => setDeleteModal({ visible: false, product: null })

  const handleSubmit = (data: ProductPayload) => {
    const { product } = formModal
    if (product) {
      updateMutation.mutate({ id: product.id, data }, { onSuccess: closeForm })
    } else {
      createMutation.mutate(data, { onSuccess: closeForm })
    }
  }

  const handleDelete = () => {
    if (!deleteModal.product) return
    deleteMutation.mutate(deleteModal.product.id, { onSuccess: closeDelete })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const formError = createMutation.error || updateMutation.error

  const renderHeaders = () => {
    if (singleType === 'board') {
      return (
        <>
          <CTableHeaderCell className="bg-body-tertiary">ID</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Código</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Precio</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Dimensiones</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Grosor</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Estado</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary" />
        </>
      )
    }
    if (singleType === 'edge_banding') {
      return (
        <>
          <CTableHeaderCell className="bg-body-tertiary">ID</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Código</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Precio</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Grosor</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Ancho</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Tipo</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Color</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary">Estado</CTableHeaderCell>
          <CTableHeaderCell className="bg-body-tertiary" />
        </>
      )
    }
    return (
      <>
        <CTableHeaderCell className="bg-body-tertiary">ID</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary">Tipo</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary">Código</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary">Nombre</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary">Precio</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary">Estado</CTableHeaderCell>
        <CTableHeaderCell className="bg-body-tertiary" />
      </>
    )
  }

  const renderRow = (p: Product) => {
    const actions = (
      <CTableDataCell className="text-end text-nowrap">
        {!isReadOnly && (
          <>
            <CButton variant="ghost" color="secondary" size="sm" onClick={() => openEdit(p)}>
              <CIcon icon={cilPencil} />
            </CButton>
            <CButton
              variant="ghost"
              color="danger"
              size="sm"
              className="ms-1"
              onClick={() => openDelete(p)}
            >
              <CIcon icon={cilTrash} />
            </CButton>
          </>
        )}
      </CTableDataCell>
    )

    const statusBadge = (
      <CBadge color={p.isActive ? 'success' : 'secondary'}>
        {p.isActive ? 'Activo' : 'Inactivo'}
      </CBadge>
    )

    if (singleType === 'board') {
      const a = (p.attributes ?? {}) as BoardAttributes & EdgeBandingAttributes
      return (
        <CTableRow key={p.id}>
          <CTableDataCell className="text-body-secondary">{p.id}</CTableDataCell>
          <CTableDataCell>
            <strong>{p.code}</strong>
          </CTableDataCell>
          <CTableDataCell>{p.name}</CTableDataCell>
          <CTableDataCell>{fmtMoney(p.price)}</CTableDataCell>
          <CTableDataCell>
            {a.height && a.width ? `${a.height} × ${a.width} mm` : '—'}
          </CTableDataCell>
          <CTableDataCell>{a.thickness ? `${a.thickness} mm` : '—'}</CTableDataCell>
          <CTableDataCell>{statusBadge}</CTableDataCell>
          {actions}
        </CTableRow>
      )
    }

    if (singleType === 'edge_banding') {
      const a = (p.attributes ?? {}) as BoardAttributes & EdgeBandingAttributes
      return (
        <CTableRow key={p.id}>
          <CTableDataCell className="text-body-secondary">{p.id}</CTableDataCell>
          <CTableDataCell>
            <strong>{p.code}</strong>
          </CTableDataCell>
          <CTableDataCell>{p.name}</CTableDataCell>
          <CTableDataCell>{fmtMoney(p.price)}</CTableDataCell>
          <CTableDataCell>{a.thickness != null ? `${a.thickness} mm` : '—'}</CTableDataCell>
          <CTableDataCell>{a.width ? `${a.width} mm` : '—'}</CTableDataCell>
          <CTableDataCell>
            {a.bandType ? (BAND_TYPE_LABELS[a.bandType] ?? a.bandType) : '—'}
          </CTableDataCell>
          <CTableDataCell>{a.color ?? '—'}</CTableDataCell>
          <CTableDataCell>{statusBadge}</CTableDataCell>
          {actions}
        </CTableRow>
      )
    }

    return (
      <CTableRow key={p.id}>
        <CTableDataCell className="text-body-secondary">{p.id}</CTableDataCell>
        <CTableDataCell>
          <StatusBadge config={TYPE_CONFIG} value={p.type} />
        </CTableDataCell>
        <CTableDataCell>
          <strong>{p.code}</strong>
        </CTableDataCell>
        <CTableDataCell>{p.name}</CTableDataCell>
        <CTableDataCell>{fmtMoney(p.price)}</CTableDataCell>
        <CTableDataCell>{statusBadge}</CTableDataCell>
        {actions}
      </CTableRow>
    )
  }

  const colSpan = singleType === 'board' ? 8 : singleType === 'edge_banding' ? 10 : 7

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Productos</strong>
          {!isReadOnly && (
            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={() => setSyncModal(true)}
              >
                <CIcon icon={cilSync} className="me-1" />
                Sincronizar catálogo
              </CButton>
              <CButton color="primary" size="sm" onClick={openCreate}>
                <CIcon icon={cilPlus} className="me-1" />
                Nuevo producto
              </CButton>
            </div>
          )}
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3 g-2">
            <CCol xs={12} sm="auto">
              <FilterMenu
                activeCount={typeFilter.length + subtypeFilter.length}
                onClear={handleClearFilters}
              >
                <div className="px-3 pb-1">
                  <div className="fw-semibold small text-body-secondary mb-1">Tipo</div>
                  <FilterCheckboxList
                    values={typeFilter}
                    options={TYPE_OPTIONS}
                    onChange={handleTypeChange}
                  />
                </div>
                <hr className="dropdown-divider" />
                <div className="px-3 pt-1">
                  <div className="fw-semibold small text-body-secondary mb-1">Subtipo</div>
                  <FilterCheckboxList
                    values={subtypeFilter}
                    options={subtypeOptions}
                    onChange={handleSubtypeChange}
                  />
                </div>
              </FilterMenu>
            </CCol>
            <CCol xs={12} sm>
              <SearchInput
                onChange={handleSearch}
                placeholder="Buscar por código o nombre…"
                style={{ maxWidth: 360 }}
              />
            </CCol>
          </CRow>

          <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
            <CTable align="middle" hover responsive>
              <CTableHead>
                <CTableRow>{renderHeaders()}</CTableRow>
              </CTableHead>
              <CTableBody>
                {products.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell
                      colSpan={colSpan}
                      className="text-center text-body-secondary py-5"
                    >
                      Sin resultados
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  products.map(renderRow)
                )}
              </CTableBody>
            </CTable>
          </QueryState>

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={pagination?.total}
            onChange={setOffset}
          />
        </CCardBody>
      </CCard>

      <CModal
        visible={formModal.visible}
        onClose={closeForm}
        backdrop="static"
        size="lg"
        scrollable
      >
        <CModalHeader>
          <CModalTitle>{formModal.product ? 'Editar producto' : 'Nuevo producto'}</CModalTitle>
        </CModalHeader>
        <ProductForm
          key={formModal.product?.id ?? 'new'}
          product={formModal.product}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          isSubmitting={isSubmitting}
          error={formError}
        />
      </CModal>

      <DeleteConfirmModal
        visible={deleteModal.visible}
        title="Eliminar producto"
        onClose={closeDelete}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      >
        ¿Eliminar <strong>{deleteModal.product?.name}</strong> ({deleteModal.product?.code})? Esta
        acción no se puede deshacer.
      </DeleteConfirmModal>

      <SyncCatalogModal
        visible={syncModal}
        onClose={() => setSyncModal(false)}
        onSynced={() => void queryClient.invalidateQueries({ queryKey: ['products'] })}
      />
    </>
  )
}

export default ProductsPage
