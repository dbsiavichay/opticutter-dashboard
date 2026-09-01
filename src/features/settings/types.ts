// Singleton settings for the company. No listing/create/delete: read + partial update.

/** Cutting parameters that feed the optimizer. All in mm except the waste factor. */
export interface CuttingSettings {
  kerf: number
  topTrim: number
  bottomTrim: number
  leftTrim: number
  rightTrim: number
  /** Edge-banding waste as a fraction (0.10 = +10%). Shown to the user as a percentage. */
  edgeBandingWasteFactor: number
  /** Half-board markup as a fraction (0.15 = +15%). Shown to the user as a percentage. */
  halfBoardMarkupPct: number
}

export interface Branch {
  name: string
  address: string
}

/** Company data rendered live on the proforma/production sheet letterhead. */
export interface CompanySettings {
  name: string
  tagline: string
  email: string
  phone: string
  branches: Branch[]
}

/** Pre-order policy. Both are positive integers (≥ 1), edited here in Settings. */
export interface PreorderSettings {
  /** Days a pre-order quote stays valid (drives the proforma validity line). */
  preorderValidityDays: number
  /** Anti-abuse cap on concurrently open pre-orders per client. */
  maxOpenPreordersPerClient: number
}

/** PATCH payloads are partial: send only changed fields. */
export type CuttingPayload = Partial<CuttingSettings>
/** For `branches`, sending the field REPLACES the whole array (not a per-item merge). */
export type CompanyPayload = Partial<CompanySettings>
export type PreorderPayload = Partial<PreorderSettings>

export interface TaxSettings {
  taxRate: number
}

export type TaxPayload = Partial<TaxSettings>
