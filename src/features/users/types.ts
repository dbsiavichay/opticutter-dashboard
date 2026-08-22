import type { ListSort } from 'src/shared/components/FilterSortSection'

export type { Role, User } from 'src/features/auth/types'

export interface UserPayload {
  email: string
  password: string
  role: import('src/features/auth/types').Role
  fullName?: string
  // Required for vendedor/operador/canteador; ignored by the backend for administrador.
  branchId?: number | null
}

export interface UserUpdatePayload {
  email?: string
  fullName?: string
  role?: import('src/features/auth/types').Role
  isActive?: boolean
  password?: string
  branchId?: number | null
}

export interface UserListParams {
  search?: string
  // One or more roles; with multiple the backend receives repeated `role` params.
  role?: import('src/features/auth/types').Role | import('src/features/auth/types').Role[]
  branchId?: number
  // Omit to list active and inactive alike (what the admin needs).
  isActive?: boolean
  sort?: ListSort
  offset?: number
  limit?: number
}
