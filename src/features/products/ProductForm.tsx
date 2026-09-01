import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CModalBody,
  CModalFooter,
  CRow,
  CSpinner,
} from '@coreui/react'

import { ApiError } from 'src/shared/api/types'
import FieldError from 'src/shared/components/FieldError'
import { BOARD_SUBTYPES, EDGE_BANDING_SUBTYPES, subtypeLabel } from './productSubtypes'
import type { Product, ProductPayload, ProductType } from './types'

const TYPES: { value: ProductType; label: string }[] = [
  { value: 'board', label: 'Tablero (Board)' },
  { value: 'edge_banding', label: 'Tapacanto (Edge Banding)' },
]

interface AttrsForm {
  height?: number | string
  width?: number | string
  thickness?: number | string
  grainDirection?: string
  bandType?: string
  color?: string
  length?: number | string
  subtype?: string
  family?: string
  alias?: string
}

interface ProductFormState {
  code: string
  name: string
  description: string
  // The three NET prices. Blank on levels 2 and 3 means "no reduced price for
  // this article": billing falls back to level 1 rather than to zero.
  price: number | string
  price2: number | string
  price3: number | string
  isActive: boolean
}

const EMPTY_BOARD_ATTRS: AttrsForm = {
  height: '',
  width: '',
  thickness: '',
  grainDirection: '',
  subtype: '',
  family: '',
}
const EMPTY_EDGE_ATTRS: AttrsForm = {
  thickness: '',
  width: '',
  bandType: '',
  color: '',
  length: '',
  subtype: '',
  family: '',
  alias: '',
}

const initAttrs = (product: Product | null): AttrsForm => {
  if (!product) return EMPTY_BOARD_ATTRS
  if (product.type === 'board') {
    const a = product.attributes ?? {}
    return {
      height: a.height ?? '',
      width: a.width ?? '',
      thickness: a.thickness ?? '',
      grainDirection: a.grainDirection ?? '',
      subtype: a.subtype ?? '',
      family: a.family ?? '',
    }
  }
  const a = product.attributes ?? {}
  return {
    thickness: a.thickness ?? '',
    width: a.width ?? '',
    bandType: a.bandType ?? '',
    color: a.color ?? '',
    length: a.length ?? '',
    subtype: a.subtype ?? '',
    family: a.family ?? '',
    alias: a.alias ?? '',
  }
}

const mapServerErrors = (error: Error | null): Record<string, string> => {
  if (!(error instanceof ApiError)) return {}
  const out: Record<string, string> = {}
  for (const e of error.errors) {
    if (e.field) {
      const key = e.field.replace(/^body\.(?:attributes\.)?/, '')
      out[key] = e.message
    } else if (e.code === 'CONFLICT') {
      if (e.message.includes('código')) out.code = e.message
      else if (e.message.includes('nombre')) out.name = e.message
    }
  }
  return out
}

interface ProductFormProps {
  product: Product | null
  onSubmit: (data: ProductPayload) => void
  onCancel: () => void
  isSubmitting: boolean
  error: Error | null
}

const ProductForm = ({ product, onSubmit, onCancel, isSubmitting, error }: ProductFormProps) => {
  const isEdit = !!product

  const [type, setType] = useState<ProductType>(product?.type ?? 'board')
  const [form, setForm] = useState<ProductFormState>({
    code: product?.code ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    price2: product?.price2 ?? '',
    price3: product?.price3 ?? '',
    isActive: product?.isActive ?? true,
  })
  const [attrs, setAttrs] = useState<AttrsForm>(initAttrs(product))

  const fieldErrors = mapServerErrors(error)
  const hasGenericError = error && Object.keys(fieldErrors).length === 0

  const set =
    (field: 'code' | 'name' | 'description' | 'price' | 'price2' | 'price3') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  const setAttr =
    (field: keyof AttrsForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAttrs((a) => ({ ...a, [field]: e.target.value }))

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as ProductType
    setType(next)
    setAttrs(next === 'board' ? EMPTY_BOARD_ATTRS : EMPTY_EDGE_ATTRS)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const attributes =
      type === 'board'
        ? {
            height: Number(attrs.height),
            width: Number(attrs.width),
            thickness: Number(attrs.thickness),
            grainDirection: attrs.grainDirection || null,
            subtype: attrs.subtype || undefined,
            family: attrs.family?.trim() || undefined,
          }
        : {
            thickness: Number(attrs.thickness),
            width: Number(attrs.width),
            bandType: attrs.bandType || null,
            color: attrs.color || null,
            length: attrs.length ? Number(attrs.length) : null,
            subtype: attrs.subtype || undefined,
            family: attrs.family?.trim() || undefined,
            alias: attrs.alias?.trim() || undefined,
          }

    onSubmit({
      type,
      code: form.code,
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      price2: form.price2 === '' ? null : Number(form.price2),
      price3: form.price3 === '' ? null : Number(form.price3),
      isActive: form.isActive,
      attributes,
    })
  }

  return (
    <CForm onSubmit={handleSubmit} className="d-flex flex-column overflow-hidden">
      <CModalBody>
        <CRow className="g-3">
          <CCol xs={12}>
            <CFormLabel>
              Tipo <span className="text-danger">*</span>
            </CFormLabel>
            <CFormSelect value={type} onChange={handleTypeChange} disabled={isEdit} required>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          <CCol xs={6}>
            <CFormLabel>
              Código <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              value={form.code}
              onChange={set('code')}
              required
              maxLength={32}
              placeholder="Ej: MDP-SL-CSH-15"
            />
            <FieldError name="code" errors={fieldErrors} />
          </CCol>

          <CCol xs={6}>
            <CFormLabel>
              Precio 1 <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              type="number"
              value={form.price}
              onChange={set('price')}
              required
              min={0}
              step="0.000001"
              placeholder="0.00"
            />
            <div className="form-text">Precio de lista, sin IVA.</div>
            <FieldError name="price" errors={fieldErrors} />
          </CCol>

          <CCol xs={6}>
            <CFormLabel>Precio 2</CFormLabel>
            <CFormInput
              type="number"
              value={form.price2}
              onChange={set('price2')}
              min={0}
              step="0.000001"
              placeholder="Vacío = usa el Precio 1"
            />
            <FieldError name="price2" errors={fieldErrors} />
          </CCol>

          <CCol xs={6}>
            <CFormLabel>Precio 3</CFormLabel>
            <CFormInput
              type="number"
              value={form.price3}
              onChange={set('price3')}
              min={0}
              step="0.000001"
              placeholder="Vacío = usa el Precio 1"
            />
            <FieldError name="price3" errors={fieldErrors} />
          </CCol>

          <CCol xs={12}>
            <CFormLabel>
              Nombre <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              value={form.name}
              onChange={set('name')}
              required
              maxLength={128}
              placeholder="Ej: MDP 15mm Cashmere"
            />
            <FieldError name="name" errors={fieldErrors} />
          </CCol>

          <CCol xs={12}>
            <CFormLabel>Descripción</CFormLabel>
            <CFormTextarea
              value={form.description}
              onChange={set('description')}
              maxLength={256}
              rows={2}
              placeholder="Opcional"
            />
            <FieldError name="description" errors={fieldErrors} />
          </CCol>

          <CCol xs={12}>
            <CFormSwitch
              label="Activo"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
          </CCol>

          {type === 'board' && (
            <>
              <CCol xs={12}>
                <hr className="my-1" />
                <small className="text-body-secondary">Atributos del tablero</small>
              </CCol>
              <CCol xs={4}>
                <CFormLabel>
                  Largo (mm) <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  value={attrs.height}
                  onChange={setAttr('height')}
                  required
                  min={1}
                  step={1}
                  placeholder="2800"
                />
                <FieldError name="height" errors={fieldErrors} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>
                  Ancho (mm) <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  value={attrs.width}
                  onChange={setAttr('width')}
                  required
                  min={1}
                  step={1}
                  placeholder="2070"
                />
                <FieldError name="width" errors={fieldErrors} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>
                  Grosor (mm) <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  value={attrs.thickness}
                  onChange={setAttr('thickness')}
                  required
                  min={1}
                  step={1}
                  placeholder="15"
                />
                <FieldError name="thickness" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Dirección de veta</CFormLabel>
                <CFormInput
                  value={attrs.grainDirection}
                  onChange={setAttr('grainDirection')}
                  maxLength={4}
                  placeholder="Ej: H (opcional)"
                />
                <FieldError name="grainDirection" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Subtipo</CFormLabel>
                <CFormSelect value={attrs.subtype} onChange={setAttr('subtype')}>
                  <option value="">Sin especificar</option>
                  {BOARD_SUBTYPES.map((s) => (
                    <option key={s} value={s}>
                      {subtypeLabel(s)}
                    </option>
                  ))}
                </CFormSelect>
                <FieldError name="subtype" errors={fieldErrors} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Familia</CFormLabel>
                <CFormInput
                  value={attrs.family}
                  onChange={setAttr('family')}
                  maxLength={64}
                  placeholder="Ej: Cashmere"
                />
                <small className="text-body-secondary">
                  Debe coincidir con la familia del tapacanto para coordinarlos. En los productos
                  sincronizados sale de la columna OBS. del inventario.
                </small>
                <FieldError name="family" errors={fieldErrors} />
              </CCol>
            </>
          )}

          {type === 'edge_banding' && (
            <>
              <CCol xs={12}>
                <hr className="my-1" />
                <small className="text-body-secondary">Atributos del tapacanto</small>
              </CCol>
              <CCol xs={4}>
                <CFormLabel>
                  Grosor (mm) <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  value={attrs.thickness}
                  onChange={setAttr('thickness')}
                  required
                  min={0.01}
                  step={0.01}
                  placeholder="0.45"
                />
                <FieldError name="thickness" errors={fieldErrors} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>
                  Ancho (mm) <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  value={attrs.width}
                  onChange={setAttr('width')}
                  required
                  min={1}
                  step={1}
                  placeholder="19"
                />
                <FieldError name="width" errors={fieldErrors} />
              </CCol>
              <CCol xs={4}>
                <CFormLabel>Tipo de canto</CFormLabel>
                <CFormSelect value={attrs.bandType} onChange={setAttr('bandType')}>
                  <option value="">Sin especificar</option>
                  <option value="Soft">Suave (Soft)</option>
                  <option value="Hard">Duro (Hard)</option>
                </CFormSelect>
                <FieldError name="bandType" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Color / Diseño</CFormLabel>
                <CFormInput
                  value={attrs.color}
                  onChange={setAttr('color')}
                  maxLength={64}
                  placeholder="Ej: Cashmere"
                />
                <FieldError name="color" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Largo del rollo (mm)</CFormLabel>
                <CFormInput
                  type="number"
                  value={attrs.length}
                  onChange={setAttr('length')}
                  min={1}
                  step={1}
                  placeholder="Opcional"
                />
                <FieldError name="length" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Subtipo</CFormLabel>
                <CFormSelect value={attrs.subtype} onChange={setAttr('subtype')}>
                  <option value="">Sin especificar</option>
                  {EDGE_BANDING_SUBTYPES.map((s) => (
                    <option key={s} value={s}>
                      {subtypeLabel(s)}
                    </option>
                  ))}
                </CFormSelect>
                <FieldError name="subtype" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Familia</CFormLabel>
                <CFormInput
                  value={attrs.family}
                  onChange={setAttr('family')}
                  maxLength={64}
                  placeholder="Ej: Cashmere"
                />
                <small className="text-body-secondary">
                  Para coordinar con el tablero (no se imprime en documentos).
                </small>
                <FieldError name="family" errors={fieldErrors} />
              </CCol>
              <CCol xs={6}>
                <CFormLabel>Alias</CFormLabel>
                <CFormInput
                  value={attrs.alias}
                  onChange={setAttr('alias')}
                  maxLength={20}
                  placeholder="Ej: CSH"
                />
                <small className="text-body-secondary">
                  Código corto impreso en la notación de despiece/documentos. En los productos
                  sincronizados es el sufijo de OBS. (<code>Cashmere - CSH</code>).
                </small>
                <FieldError name="alias" errors={fieldErrors} />
              </CCol>
            </>
          )}

          {hasGenericError && (
            <CCol xs={12}>
              <div className="text-danger small">
                {error?.message || 'Error al guardar. Intente nuevamente.'}
              </div>
            </CCol>
          )}
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" type="button" onClick={onCancel}>
          Cancelar
        </CButton>
        <CButton color="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <CSpinner size="sm" /> : 'Guardar'}
        </CButton>
      </CModalFooter>
    </CForm>
  )
}

export default ProductForm
