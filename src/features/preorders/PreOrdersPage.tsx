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
import { useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { clientName, fmtDate } from 'src/shared/utils/format'

import PreOrderStatusBadge from './PreOrderStatusBadge'
import PreOrdersFilters, {
  activeCount,
  usePreOrdersFilterChips,
  type PreOrdersFilterValues,
} from './PreOrdersFilters'
import { usePreOrders } from './usePreOrders'
import { isExpiringSoon } from './status'
import type { PreOrderSort, PreOrderStatus } from './types'

// Filter fields that live in the URL. `q` is the search box; the rest are the panel's.
const FILTER_KEYS = ['q', 'status', 'clientId', 'branchId', 'createdFrom', 'createdTo']

const PreOrdersPage = () => {
  const navigate = useNavigate()
  const isGlobalBranch = useIsGlobalBranchRole()
  const { getParam, getParams, setParam, clearParams, offset, setOffset, limit, setLimit } =
    useListParams()

  const search = getParam('q')
  const values: PreOrdersFilterValues = {
    status: getParams('status') as PreOrderStatus[],
    clientId: getParam('clientId'),
    branchId: getParam('branchId'),
    createdFrom: getParam('createdFrom'),
    createdTo: getParam('createdTo'),
    sort: (getParam('sort') || 'recent') as PreOrderSort,
  }

  const handleChange = <K extends keyof PreOrdersFilterValues>(
    key: K,
    value: PreOrdersFilterValues[K],
  ) => {
    setParam(key, value)
  }
  const handleClear = () => clearParams(FILTER_KEYS)

  const chips = usePreOrdersFilterChips(values, isGlobalBranch, handleChange)
  const isFiltered = activeCount(values, isGlobalBranch) > 0 || search !== ''

  // Built inline, not memoised: React Query hashes the query key structurally, so a fresh object
  // with the same contents is the same key and does not refetch.
  const { data, isLoading, isError, error, refetch } = usePreOrders({
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
  const items = data?.items ?? []
  const pagination = data?.pagination
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
        <PreOrdersFilters
          values={values}
          onChange={handleChange}
          onClear={handleClear}
          showBranch={isGlobalBranch}
        />
        <CButton color="primary" className="ms-auto" onClick={() => void navigate('/optimizer')}>
          <CIcon icon={cilPlus} className="me-1" />
          Nueva cotización
        </CButton>
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
                <CTableHeaderCell>Fuente</CTableHeaderCell>
                <CTableHeaderCell>Creada</CTableHeaderCell>
                <CTableHeaderCell>Vence</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {items.length === 0 ? (
                <CTableRow>
                  {/* Two different dead ends: an empty catalog is a fact, an over-narrow filter is
                      a place the user needs a way out of. */}
                  <CTableDataCell colSpan={7} className="text-center text-body-secondary py-5">
                    {isFiltered ? (
                      <>
                        <div>Ninguna cotización coincide con los filtros.</div>
                        <CButton color="link" size="sm" onClick={handleClear}>
                          Limpiar filtros
                        </CButton>
                      </>
                    ) : (
                      'Aún no hay cotizaciones.'
                    )}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                items.map((po) => {
                  const expiringSoon = isExpiringSoon(po.expiresAt, po.status)
                  return (
                    <CTableRow key={po.id} onClick={() => void navigate(`/preorders/${po.id}`)}>
                      <CTableDataCell>
                        <strong>{po.code}</strong>
                        <ReferenceNote notes={po.notes} />
                      </CTableDataCell>
                      <CTableDataCell>
                        <div>{clientName(po.client)}</div>
                        <div className="text-body-secondary small">@{po.client.identifier}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div>{po.branch.name}</div>
                        <div className="text-body-secondary small">{po.branch.code}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <PreOrderStatusBadge status={po.status} />
                      </CTableDataCell>
                      <CTableDataCell>{po.source}</CTableDataCell>
                      <CTableDataCell className="text-nowrap">
                        {fmtDate(po.createdAt)}
                      </CTableDataCell>
                      <CTableDataCell
                        className={`text-nowrap ${expiringSoon ? 'text-danger fw-semibold' : ''}`}
                      >
                        {fmtDate(po.expiresAt)}
                        {expiringSoon && ' ⚠'}
                      </CTableDataCell>
                    </CTableRow>
                  )
                })
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

export default PreOrdersPage
