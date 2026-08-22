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
import { cilPlus, cilSync, cilTrash } from '@coreui/icons'
import { useCreateProduct, useDeleteProduct, useProducts, useUpdateProduct } from './useProducts'
import { useState } from 'react'

import CIcon from '@coreui/icons-react'
import ProductForm from './ProductForm'
import SyncCatalogModal from './SyncCatalogModal'
import ProductsFilters, {
  activeCount,
  productsFilterChips,
  prunedSubtypes,
  type ProductsFilterValues,
} from './ProductsFilters'
import { useHasRole } from 'src/features/auth/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { fmtMoney } from 'src/shared/utils/format'
import SearchInput from 'src/shared/components/SearchInput'
import FilterChips from 'src/shared/components/FilterChips'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import DeleteConfirmModal from 'src/shared/components/DeleteConfirmModal'
import StatusBadge, { type StatusConfigEntry } from 'src/shared/components/StatusBadge'
import type { ListSort } from 'src/shared/components/FilterSortSection'
import { useListParams } from 'src/shared/hooks/useListParams'

const TYPE_CONFIG: Record<string, StatusConfigEntry> = {
  board: { color: 'info', label: 'Tablero' },
  edge_banding: { color: 'warning', label: 'Tapacanto' },
  hardware: { color: 'secondary', label: 'Herraje' },
}
const BAND_TYPE_LABELS: Record<string, string> = { Soft: 'Suave', Hard: 'Duro' }

// Filter fields that live in the URL. `q` is the search box; the rest are the panel's.
const FILTER_KEYS = ['q', 'type', 'subtype', 'isActive']

interface ProductModalState {
  visible: boolean
  product: Product | null
}

const ProductsPage = () => {
  const isReadOnly = useHasRole('vendedor')
  const queryClient = useQueryClient()
  const {
    getParam,
    getParams,
    setParam,
    setParams,
    clearParams,
    offset,
    setOffset,
    limit,
    setLimit,
  } = useListParams()

  const search = getParam('q')
  const values: ProductsFilterValues = {
    type: getParams('type') as ProductType[],
    subtype: getParams('subtype'),
    isActive: getParam('isActive'),
    sort: (getParam('sort') || 'name') as ListSort,
  }

  const handleChange = <K extends keyof ProductsFilterValues>(
    key: K,
    value: ProductsFilterValues[K],
  ) => {
    // Narrowing the type set can strand a subtype that no longer belongs to it, which combines
    // into a guaranteed-empty result. Both keys move in ONE write: two `setSearchParams` in a tick
    // do not compose — react-router's updater still sees the pre-update params, so the second wins.
    if (key === 'type') {
      const nextTypes = value as ProductType[]
      const nextSubtypes = prunedSubtypes(nextTypes, values.subtype)
      setParams({ type: nextTypes, subtype: nextSubtypes })
      return
    }
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const chips = productsFilterChips(values, handleChange)
  const isFiltered = activeCount(values) > 0 || search !== ''

  const [formModal, setFormModal] = useState<ProductModalState>({ visible: false, product: null })
  const [deleteModal, setDeleteModal] = useState<ProductModalState>({
    visible: false,
    product: null,
  })
  const [syncModal, setSyncModal] = useState(false)

  // Specialized (per-type) columns only make sense when the filter narrows to
  // exactly one type; with none or both selected, fall back to the generic view.
  const singleType = values.type.length === 1 ? values.type[0] : null

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const queryParams: ProductListParams = {
    search: search || undefined,
    type: values.type.length ? values.type : undefined,
    subtype: values.subtype.length ? values.subtype : undefined,
    isActive: values.isActive ? values.isActive === 'true' : undefined,
    sort: values.sort,
    offset,
    limit,
  }

  const { data: productsData, isLoading, isError, refetch } = useProducts(queryParams)
  const products = productsData?.items ?? []
  const pagination = productsData?.pagination

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

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
          <CTableHeaderCell>ID</CTableHeaderCell>
          <CTableHeaderCell>Código</CTableHeaderCell>
          <CTableHeaderCell>Nombre</CTableHeaderCell>
          <CTableHeaderCell>Precio</CTableHeaderCell>
          <CTableHeaderCell>Dimensiones</CTableHeaderCell>
          <CTableHeaderCell>Grosor</CTableHeaderCell>
          <CTableHeaderCell>Estado</CTableHeaderCell>
          <CTableHeaderCell />
        </>
      )
    }
    if (singleType === 'edge_banding') {
      return (
        <>
          <CTableHeaderCell>ID</CTableHeaderCell>
          <CTableHeaderCell>Código</CTableHeaderCell>
          <CTableHeaderCell>Nombre</CTableHeaderCell>
          <CTableHeaderCell>Precio</CTableHeaderCell>
          <CTableHeaderCell>Grosor</CTableHeaderCell>
          <CTableHeaderCell>Ancho</CTableHeaderCell>
          <CTableHeaderCell>Tipo</CTableHeaderCell>
          <CTableHeaderCell>Color</CTableHeaderCell>
          <CTableHeaderCell>Estado</CTableHeaderCell>
          <CTableHeaderCell />
        </>
      )
    }
    return (
      <>
        <CTableHeaderCell>ID</CTableHeaderCell>
        <CTableHeaderCell>Tipo</CTableHeaderCell>
        <CTableHeaderCell>Código</CTableHeaderCell>
        <CTableHeaderCell>Nombre</CTableHeaderCell>
        <CTableHeaderCell>Precio</CTableHeaderCell>
        <CTableHeaderCell>Estado</CTableHeaderCell>
        <CTableHeaderCell />
      </>
    )
  }

  const renderRow = (p: Product) => {
    // The row opens the editor, so only the destructive action keeps a button — and it must not
    // also open it on the way.
    const actions = (
      <CTableDataCell className="text-end text-nowrap">
        {!isReadOnly && (
          <CButton
            variant="ghost"
            color="danger"
            size="sm"
            aria-label={`Eliminar ${p.name}`}
            onClick={(e) => {
              e.stopPropagation()
              openDelete(p)
            }}
          >
            <CIcon icon={cilTrash} />
          </CButton>
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
        <CTableRow key={p.id} onClick={isReadOnly ? undefined : () => openEdit(p)}>
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
        <CTableRow key={p.id} onClick={isReadOnly ? undefined : () => openEdit(p)}>
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
      <CTableRow key={p.id} onClick={isReadOnly ? undefined : () => openEdit(p)}>
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
          <ProductsFilters values={values} onChange={handleChange} onClear={handleClear} />
          {!isReadOnly && (
            <div className="d-flex gap-2 ms-auto">
              <CButton color="secondary" variant="outline" onClick={() => setSyncModal(true)}>
                <CIcon icon={cilSync} className="me-1" />
                Sincronizar catálogo
              </CButton>
              <CButton color="primary" onClick={openCreate}>
                <CIcon icon={cilPlus} className="me-1" />
                Nuevo producto
              </CButton>
            </div>
          )}
        </div>

        <FilterChips chips={chips} onClearAll={handleClear} />

        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          {/* A vendedor has no editor to open, and a hand cursor promising one would be a lie. */}
          <CTable
            align="middle"
            hover
            responsive
            className={`list-table${isReadOnly ? ' rows-static' : ''}`}
          >
            <CTableHead>
              <CTableRow>{renderHeaders()}</CTableRow>
            </CTableHead>
            <CTableBody>
              {products.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow filter is
                      a place the user needs a way out of. */}
                  <CTableDataCell
                    colSpan={colSpan}
                    className="text-center text-body-secondary py-5"
                  >
                    {isFiltered ? (
                      <>
                        <div>Ningún producto coincide con los filtros.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar filtros
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay productos.'
                    )}
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
          limit={limit}
          total={pagination?.total}
          onChange={setOffset}
          onLimitChange={setLimit}
        />
      </div>

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
