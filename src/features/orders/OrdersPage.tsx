import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'

import NoBranchNotice, { isNoBranchError } from 'src/shared/components/NoBranchNotice'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import SearchInput from 'src/shared/components/SearchInput'
import FilterChips from 'src/shared/components/FilterChips'
import Pagination from 'src/shared/components/Pagination'
import QueryState from 'src/shared/components/QueryState'
import { useListParams } from 'src/shared/hooks/useListParams'
import { useHasRole, useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { clientName, fmtDate, fmtMoney } from 'src/shared/utils/format'

import OrderStatusBadge from './OrderStatusBadge'
import OrdersFilters, {
  activeCount,
  useOrdersFilterChips,
  type OrdersFilterValues,
} from './OrdersFilters'
import { useOrders } from './useOrders'
import type { OrderSort, OrderStatus } from './types'

// Filter fields that live in the URL. `q` is the search box; the rest are the panel's.
const FILTER_KEYS = ['q', 'status', 'clientId', 'branchId', 'createdFrom', 'createdTo']

const OrdersPage = () => {
  const navigate = useNavigate()
  // Operador can view orders but cannot create quotes (that belongs to the optimizer).
  const canCreate = useHasRole('administrador', 'vendedor')
  const isGlobalBranch = useIsGlobalBranchRole()
  const { getParam, getParams, setParam, clearParams, offset, setOffset, limit, setLimit } =
    useListParams()

  const search = getParam('q')
  const values: OrdersFilterValues = {
    status: getParams('status') as OrderStatus[],
    clientId: getParam('clientId'),
    branchId: getParam('branchId'),
    createdFrom: getParam('createdFrom'),
    createdTo: getParam('createdTo'),
    // The backend defaults to FIFO for the workshop; this page is the back office's.
    sort: (getParam('sort') || 'recent') as OrderSort,
  }

  const handleChange = <K extends keyof OrdersFilterValues>(
    key: K,
    value: OrdersFilterValues[K],
  ) => {
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const chips = useOrdersFilterChips(values, isGlobalBranch, handleChange)
  const filterCount = activeCount(values, isGlobalBranch)
  const isFiltered = filterCount > 0 || search !== ''

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const {
    data: ordersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useOrders({
    search: search || undefined,
    status: values.status.length ? values.status : undefined,
    clientId: values.clientId ? Number(values.clientId) : undefined,
    branchId: values.branchId ? Number(values.branchId) : undefined,
    createdFrom: values.createdFrom || undefined,
    createdTo: values.createdTo || undefined,
    sort: values.sort,
    offset,
    limit,
  })
  const orders = ordersData?.items ?? []
  const pagination = ordersData?.pagination
  const noBranch = isNoBranchError(error)

  return (
    <div className="surface">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <SearchInput
          value={search}
          // `replace`: one history entry per settled keystroke would bury the page behind the list.
          onChange={(value) => setParam('q', value, { replace: true })}
          placeholder="Buscar por código, N° o cliente…"
          className="flex-grow-1"
          style={{ maxWidth: 360 }}
        />
        <OrdersFilters
          values={values}
          onChange={handleChange}
          onClear={handleClear}
          showBranch={isGlobalBranch}
        />
        {canCreate && (
          <CButton color="primary" className="ms-auto" onClick={() => void navigate('/optimizer')}>
            <CIcon icon={cilPlus} className="me-1" />
            Nueva cotización
          </CButton>
        )}
      </div>

      <FilterChips chips={chips} onClearAll={handleClear} />

      {noBranch ? (
        <NoBranchNotice />
      ) : (
        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          <CTable align="middle" hover responsive className="list-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Código</CTableHeaderCell>
                <CTableHeaderCell>Cliente</CTableHeaderCell>
                <CTableHeaderCell>Sucursal</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Total</CTableHeaderCell>
                <CTableHeaderCell>Creado</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {orders.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow filter is
                      a place the user needs a way out of. */}
                  <CTableDataCell colSpan={6} className="text-center text-body-secondary py-5">
                    {isFiltered ? (
                      <>
                        <div>Ninguna orden coincide con los filtros.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar filtros
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay órdenes.'
                    )}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                orders.map((o) => (
                  <CTableRow key={o.id} onClick={() => void navigate(`/orders/${o.id}`)}>
                    <CTableDataCell>
                      <strong>{o.code ?? '—'}</strong>
                      <ReferenceNote notes={o.notes} />
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>{clientName(o.client)}</div>
                      <div className="text-body-secondary small">@{o.client?.identifier}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>{o.branch.name}</div>
                      <div className="text-body-secondary small">{o.branch.code}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <OrderStatusBadge status={o.status} />
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-nowrap">
                      {fmtMoney(o.total)}
                    </CTableDataCell>
                    <CTableDataCell className="text-nowrap">{fmtDate(o.createdAt)}</CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </QueryState>
      )}

      <Pagination
        offset={offset}
        limit={limit}
        total={pagination?.total}
        onChange={setOffset}
        onLimitChange={setLimit}
      />
    </div>
  )
}

export default OrdersPage
