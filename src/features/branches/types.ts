import type { ListSort } from 'src/shared/components/FilterSortSection'

// Printing switches: whether the branch's shop has a thermal label printer and/or a sheet
// printer. They gate the automatic dispatches to the local print agent — the backend skips
// the enqueue regardless, this just avoids firing a request that would do nothing.
export interface BranchPrintingSwitches {
  printLabelsEnabled: boolean
  printConsolidatedEnabled: boolean
}

// Branch (store location) — top-level resource of the multi-branch API model.
export interface Branch extends BranchPrintingSwitches {
  id: number
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
}

// Compact branch reference embedded in orders, pre-orders, and drafts. The FK is mandatory
// in those documents, so it is never optional. Shared type for the "owning branch" pattern.
// It carries the printing switches so the order detail can gate its consolidated dispatch
// without a separate branch request.
export interface BranchRef extends BranchPrintingSwitches {
  id: number
  code: string
  name: string
}

export interface BranchPayload {
  code: string
  name: string
  address?: string
  phone?: string
  printLabelsEnabled?: boolean
  printConsolidatedEnabled?: boolean
}

export interface BranchUpdatePayload {
  code?: string
  name?: string
  address?: string
  phone?: string
  isActive?: boolean
  printLabelsEnabled?: boolean
  printConsolidatedEnabled?: boolean
}

export interface BranchListParams {
  search?: string
  // Omit to list active and inactive alike — a branch is retired by unsetting this, never deleted,
  // so hiding the inactive ones by default would make them unreachable.
  isActive?: boolean
  sort?: ListSort
  offset?: number
  limit?: number
}
