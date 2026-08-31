import { CButton, CFormInput } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'

import SearchableSelect from 'src/shared/components/SearchableSelect'
import { fmtMoney } from 'src/shared/utils/format'
import type { AdditionalService } from 'src/features/services/types'
import type { ModalContainer } from 'src/features/optimizer/types'
import { servicesTotal, type ServiceLineForm } from './useServiceLines'

// The service lines, and nothing else — no card and no title, on the same reasoning as
// `MaterialGroups`: the chrome belongs to whoever is placing the list. The pre-order page wraps it
// in a CCard because there it is one section among many; the optimizer's Costos step gives it the
// same plain section heading as "Materiales" and "Tapacantos", because no step renders a card.
//
// "Agregar servicio" stays inside as the dashed slot that ends the list, which is where
// "Agregar material" ended up for the same reason: it is part of the list, not a toolbar.

interface ServiceLinesProps {
  services: ServiceLineForm[]
  catalog: AdditionalService[]
  onAdd: () => void
  onUpdate: <K extends keyof ServiceLineForm>(
    uid: string,
    field: K,
    value: ServiceLineForm[K],
  ) => void
  onRemove: (uid: string) => void
  // Fullscreen portal target for the picker's dropdown; the optimizer runs inside a fullscreen host
  // where a menu portaled to document.body mounts but never paints.
  container?: ModalContainer
}

const ServiceLines = ({
  services,
  catalog,
  onAdd,
  onUpdate,
  onRemove,
  container,
}: ServiceLinesProps) => {
  const activeOptions = catalog
    .filter((s) => s.isActive)
    .map((s) => ({ value: String(s.id), label: s.name, sublabel: fmtMoney(s.price) }))

  // Adds a synthetic option for a line whose catalog service is gone/inactive so
  // the picker still shows what was selected.
  const optionsFor = (s: ServiceLineForm) => {
    if (s.serviceId && !activeOptions.some((o) => o.value === s.serviceId)) {
      return [...activeOptions, { value: s.serviceId, label: s.name || 'Servicio', sublabel: '—' }]
    }
    return activeOptions
  }

  const handlePick = (line: ServiceLineForm) => (value: string) => {
    onUpdate(line.uid, 'serviceId', value)
    const svc = catalog.find((s) => String(s.id) === value)
    if (svc) {
      onUpdate(line.uid, 'name', svc.name)
      onUpdate(line.uid, 'unitPrice', svc.price)
    }
  }

  // The editor's running total is what the seller TYPED, i.e. tax included — it
  // has to reconcile with the price list they are reading from, not with the
  // document. The net figure that reaches the quote is computed once, in
  // `servicesNetTotal`, and shown by the breakdown below the tables.
  const total = servicesTotal(services)

  return (
    <div className="mb-3">
      {services.length === 0 ? (
        <div className="text-body-secondary small mb-2">
          Sin servicios adicionales. Agrega perforación, armado, instalación, etc.
        </div>
      ) : (
        <div className="d-flex flex-column gap-2 mb-2">
          {services.map((s) => {
            const lineTotal = (Number(s.unitPrice) || 0) * (Number(s.quantity) || 0)
            return (
              <div key={s.uid} className="d-flex flex-wrap align-items-end gap-2">
                <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                  <label className="form-label small mb-1">Servicio</label>
                  <SearchableSelect
                    size="sm"
                    value={s.serviceId}
                    placeholder="Seleccionar…"
                    searchPlaceholder="Buscar servicio…"
                    emptyText="Sin servicios que coincidan"
                    options={optionsFor(s)}
                    onChange={handlePick(s)}
                    container={container}
                  />
                </div>
                <div style={{ width: 90 }}>
                  <label className="form-label small mb-1">Cantidad</label>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    step={1}
                    value={s.quantity}
                    onChange={(e) => onUpdate(s.uid, 'quantity', e.target.value)}
                  />
                </div>
                <div style={{ width: 120 }}>
                  {/* The one price in the system that is typed WITH tax: it comes
                      off a service price list, not from the vendor's inventory.
                      The server converts it to net so the document's single IVA
                      line covers it too. */}
                  <label className="form-label small mb-1" title="IVA incluido">
                    P. Unit. (c/IVA)
                  </label>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.unitPrice}
                    onChange={(e) => onUpdate(s.uid, 'unitPrice', e.target.value)}
                  />
                </div>
                <div style={{ width: 100 }} className="text-end">
                  <label className="form-label small mb-1 d-block">Subtotal</label>
                  <span className="small">{fmtMoney(lineTotal)}</span>
                </div>
                <CButton
                  size="sm"
                  variant="ghost"
                  color="danger"
                  type="button"
                  title="Eliminar servicio"
                  onClick={() => onRemove(s.uid)}
                >
                  <CIcon icon={cilTrash} />
                </CButton>
              </div>
            )
          })}
          <div className="d-flex justify-content-end pt-2 border-top">
            <span className="text-body-secondary me-2 small">
              Servicios adicionales (IVA incluido):
            </span>
            <strong className="small">{fmtMoney(total)}</strong>
          </div>
        </div>
      )}

      <CButton
        size="sm"
        color="primary"
        variant="ghost"
        type="button"
        className="add-slot w-100"
        onClick={onAdd}
      >
        <CIcon icon={cilPlus} className="me-1" />
        Agregar servicio
      </CButton>
    </div>
  )
}

export default ServiceLines
