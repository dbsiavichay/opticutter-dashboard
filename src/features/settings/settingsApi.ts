import { httpClient } from 'src/shared/api/httpClient'
import type {
  CompanyPayload,
  CompanySettings,
  CuttingPayload,
  CuttingSettings,
  PreorderPayload,
  PreorderSettings,
  TaxPayload,
  TaxSettings,
} from './types'

const BASE = '/api/v1/settings'

export const settingsApi = {
  getCutting: () => httpClient.get<CuttingSettings>(`${BASE}/cutting`),
  updateCutting: (data: CuttingPayload) =>
    httpClient.patch<CuttingSettings>(`${BASE}/cutting`, data),
  getCompany: () => httpClient.get<CompanySettings>(`${BASE}/company`),
  updateCompany: (data: CompanyPayload) =>
    httpClient.patch<CompanySettings>(`${BASE}/company`, data),
  getPreorders: () => httpClient.get<PreorderSettings>(`${BASE}/preorders`),
  updatePreorders: (data: PreorderPayload) =>
    httpClient.patch<PreorderSettings>(`${BASE}/preorders`, data),
  getTaxes: () => httpClient.get<TaxSettings>(`${BASE}/taxes`),
  updateTaxes: (data: TaxPayload) => httpClient.patch<TaxSettings>(`${BASE}/taxes`, data),
}
