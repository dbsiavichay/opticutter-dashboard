import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REFERENCE_STALE_TIME } from 'src/shared/constants'
import { settingsApi } from './settingsApi'
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

const CUTTING_KEY = ['settings', 'cutting']
const COMPANY_KEY = ['settings', 'company']
const PREORDER_KEY = ['settings', 'preorders']
const TAX_KEY = ['settings', 'taxes']

export const useCuttingSettings = () =>
  useQuery({
    queryKey: CUTTING_KEY,
    queryFn: settingsApi.getCutting,
    staleTime: REFERENCE_STALE_TIME,
  })

export const useCompanySettings = () =>
  useQuery({
    queryKey: COMPANY_KEY,
    queryFn: settingsApi.getCompany,
    staleTime: REFERENCE_STALE_TIME,
  })

export const useUpdateCuttingSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CuttingPayload) => settingsApi.updateCutting(data),
    // The PATCH response is the server's source of truth; cache it directly.
    onSuccess: (data: CuttingSettings) => qc.setQueryData(CUTTING_KEY, data),
  })
}

export const useUpdateCompanySettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CompanyPayload) => settingsApi.updateCompany(data),
    onSuccess: (data: CompanySettings) => qc.setQueryData(COMPANY_KEY, data),
  })
}

export const usePreorderSettings = () =>
  useQuery({
    queryKey: PREORDER_KEY,
    queryFn: settingsApi.getPreorders,
    staleTime: REFERENCE_STALE_TIME,
  })

export const useUpdatePreorderSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PreorderPayload) => settingsApi.updatePreorders(data),
    onSuccess: (data: PreorderSettings) => qc.setQueryData(PREORDER_KEY, data),
  })
}

export const useTaxSettings = () =>
  useQuery({
    queryKey: TAX_KEY,
    queryFn: settingsApi.getTaxes,
    staleTime: REFERENCE_STALE_TIME,
  })

export const useUpdateTaxSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TaxPayload) => settingsApi.updateTaxes(data),
    onSuccess: (data: TaxSettings) => qc.setQueryData(TAX_KEY, data),
  })
}
