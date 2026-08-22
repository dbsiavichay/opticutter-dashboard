import { httpClient } from 'src/shared/api/httpClient'
import { toQuery } from 'src/shared/api/crudApi'
import { openInNewTab } from 'src/shared/utils/download'
import type {
  PreOrder,
  PreOrderCreate,
  PreOrderListParams,
  PreOrderSummary,
  ReviewLink,
  ReviewLinkInfo,
} from './types'

const BASE = '/api/v1/preorders'

export const preordersApi = {
  // `status` may be an array → repeated params (?status=a&status=b); `toQuery` handles that.
  // Every param must be named in this destructure or `toQuery` never sees it.
  list: ({
    status,
    clientId,
    branchId,
    search,
    createdFrom,
    createdTo,
    sort,
    offset = 0,
    limit = 20,
  }: PreOrderListParams = {}) =>
    httpClient.list<PreOrderSummary>(
      `${BASE}/?${toQuery({
        status,
        clientId,
        branchId,
        search,
        createdFrom,
        createdTo,
        sort,
        offset,
        limit,
      })}`,
    ),
  get: (id: number) => httpClient.get<PreOrder>(`${BASE}/${id}`),
  create: (data: PreOrderCreate) => httpClient.post<PreOrder>(`${BASE}/`, data),
  update: (id: number, data: Partial<PreOrderCreate>) =>
    httpClient.put<PreOrder>(`${BASE}/${id}`, data),
  remove: (id: number) => httpClient.delete<null>(`${BASE}/${id}`),
  createReviewLink: (id: number) => httpClient.post<ReviewLink>(`${BASE}/${id}/review-link`),
  getReviewLinkInfo: (id: number) => httpClient.get<ReviewLinkInfo>(`${BASE}/${id}/review-link`),
  downloadProforma: async (id: number) => {
    openInNewTab(await httpClient.download(`${BASE}/${id}/proforma?format=pdf`))
  },
}
