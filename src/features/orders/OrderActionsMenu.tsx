import {
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBolt, cilBuilding, cilExternalLink, cilFile, cilOptions } from '@coreui/icons'

// The order's paperwork and its administrative moves, in one ⋮ — the same grammar as the
// optimizer's menu (sections that render only when their handler arrives, muted headers, items as
// buttons), but a component of its own rather than two more sections bolted onto
// `OptimizerActionsMenu`: that one already carries twenty-five props for two call sites, and not
// one entry of its "Documento" section (proforma, review link, ver orden, eliminar) means anything
// on an order.
//
// It replaces two full-width cards on the detail page: "Documentos y factura" — five buttons of
// which at most one gets pressed per visit — and the lone "Cambiar sucursal" button that was the
// second row of the "Acciones" card, where it sat next to the status transitions as if it were one.

interface OrderActionsMenuProps {
  onOrderPdf?: () => void
  onProductionSheet?: () => void
  onConsolidatedPdf?: () => void
  // Only a dispatched order has one.
  onDispatchSheet?: () => void
  // Omitted once a factura is already linked — the identity block shows the id, so a permanently
  // disabled entry repeating it would be the section's only content on most closed orders.
  onInvoice?: () => void
  onChangeBranch?: () => void
  // Priority attention. Omitted once the order is closed — prioritizing an order the workshop board
  // no longer lists means nothing, and the API refuses it.
  onTogglePriority?: () => void
  // Only decides the entry's wording: the same item both marks and unmarks.
  isPriority?: boolean
}

const OrderActionsMenu = ({
  onOrderPdf,
  onProductionSheet,
  onConsolidatedPdf,
  onDispatchSheet,
  onInvoice,
  onChangeBranch,
  onTogglePriority,
  isPriority = false,
}: OrderActionsMenuProps) => {
  const hasDocs = !!(onOrderPdf || onProductionSheet || onConsolidatedPdf || onDispatchSheet)
  const hasManage = !!(onInvoice || onChangeBranch || onTogglePriority)

  return (
    <CDropdown alignment="end" portal>
      <CDropdownToggle color="secondary" variant="outline" caret={false} title="Acciones">
        <CIcon icon={cilOptions} />
      </CDropdownToggle>
      <CDropdownMenu style={{ minWidth: 260 }}>
        {hasDocs && (
          <>
            <CDropdownHeader className="text-body-secondary small">Documentos</CDropdownHeader>
            {onOrderPdf && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onOrderPdf}
              >
                <CIcon icon={cilExternalLink} className="me-2" />
                Orden de pedido PDF
              </CDropdownItem>
            )}
            {onProductionSheet && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onProductionSheet}
              >
                <CIcon icon={cilExternalLink} className="me-2" />
                Hoja de producción PDF
              </CDropdownItem>
            )}
            {onConsolidatedPdf && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onConsolidatedPdf}
              >
                <CIcon icon={cilExternalLink} className="me-2" />
                PDF consolidado
              </CDropdownItem>
            )}
            {onDispatchSheet && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onDispatchSheet}
              >
                <CIcon icon={cilExternalLink} className="me-2" />
                Hoja de despacho PDF
              </CDropdownItem>
            )}
          </>
        )}

        {hasDocs && hasManage && <CDropdownDivider />}

        {hasManage && (
          <>
            <CDropdownHeader className="text-body-secondary small">Gestión</CDropdownHeader>
            {onInvoice && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onInvoice}
              >
                <CIcon icon={cilFile} className="me-2" />
                Asociar factura…
              </CDropdownItem>
            )}
            {onChangeBranch && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onChangeBranch}
              >
                <CIcon icon={cilBuilding} className="me-2" />
                Cambiar sucursal…
              </CDropdownItem>
            )}
            {onTogglePriority && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onTogglePriority}
              >
                <CIcon icon={cilBolt} className="me-2" />
                {isPriority ? 'Quitar prioridad…' : 'Marcar como prioritaria…'}
              </CDropdownItem>
            )}
          </>
        )}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default OrderActionsMenu
