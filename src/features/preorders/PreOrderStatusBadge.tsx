import StatusBadge from 'src/shared/components/StatusBadge'
import { PREORDER_STATUS_CONFIG } from './status'
import type { PreOrderStatus } from './types'

interface PreOrderStatusBadgeProps {
  status: PreOrderStatus
}

const PreOrderStatusBadge = ({ status }: PreOrderStatusBadgeProps) => (
  <StatusBadge config={PREORDER_STATUS_CONFIG} value={status} />
)

export default PreOrderStatusBadge
