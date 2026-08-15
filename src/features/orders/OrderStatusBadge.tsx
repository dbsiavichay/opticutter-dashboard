import StatusBadge from 'src/shared/components/StatusBadge'
import { ORDER_STATUS_CONFIG } from './status'
import type { OrderStatus } from './types'

interface OrderStatusBadgeProps {
  status: OrderStatus
}

const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => (
  <StatusBadge config={ORDER_STATUS_CONFIG} value={status} />
)

export default OrderStatusBadge
