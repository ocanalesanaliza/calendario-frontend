import { useEffect, useState } from 'react'
import {
  assignArea,
  createGerenteOperaciones,
  deactivateGerenteOperaciones,
  getGerentesOperaciones,
  reassignArea,
  resetGerenteOperacionesPassword,
  updateGerenteOperaciones,
} from '../services/gerentesOperacionesService'
import './GerentesOperacionesPage.css'

const identityFields = ['nombre', 'apellido', 'email']

function areasText(areas) {
  if (!areas?.length) return 'Sin áreas asignadas'

  return areas.map((area) => area.codigo || area.nombre).join(', ')
}

function fieldError(errors, field) {
  return Array.isArray(errors[field]) ? errors[field].join(' ') : errors[field]
}

function validationErrors(error) {
  if (error.status !== 400 || !error.fields || typeof error.fields !== 'object' || Array.isArray(error.fields)) {
    return {}
  }

  return error.fields
}

function hasFieldErrors(errors, fields) {
  return fields.some((field) => Boolean(fieldError(errors, field)))
}

function messageFor(error, fallback) {
  if (error.status === 403) return 'No tienes permisos para realizar esta acción.'
  if (error.status === 404) return 'El registro solicitado ya no existe.'

  return error.message || fallback
}

function passwordRecipientName(result, fallbackName) {
  return result.gerente_operaciones?.nombre
    || result.go?.nombre
    || result.gerente?.nombre
    || result.nombre
    || fallbackName
}

function Modal({ title, children, onClose }) {
  return (
    <div className="go-modal-backdrop">
      <section className="go-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="go-modal-header">
          <h2>{title}</h2>
          <button type="button" className="go-icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function IdentityModal({ gerente, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nombre: gerente.nombre || '',
    apellido: gerente.apellido || '',
    email: gerente.email || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()

    const body = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => value.trim() !== (gerente[key] || '').trim()),
    )

    if (!Object.keys(body).length) {
      onClose()
      return
    }

    setSaving(true)
    setErrors({})

    try {
      await onSubmit(body)
    } catch (error) {
      setErrors({
        ...validationErrors(error),
        detail: messageFor(error, 'No se pudieron guardar los cambios.'),
      })
      setSaving(false)
    }
  }

  return (
    <Modal title="Editar gerente de operaciones" onClose={onClose}>
      <form className="go-modal-form" onSubmit={submit}>
        {identityFields.map((field) => {
          const error = fieldError(errors, field)
          const label = field === 'email' ? 'Correo electrónico' : field[0].toUpperCase() + field.slice(1)

          return (
            <div className="go-form-group" key={field}>
              <label htmlFor={`go-${field}`}>{label}</label>
              <input
                id={`go-${field}`}
                type={field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                required
                aria-describedby={error ? `${field}-error` : undefined}
              />
              {error && <span id={`${field}-error`} className="go-form-error" role="alert">{error}</span>}
            </div>
          )
        })}

        {errors.detail && !hasFieldErrors(errors, identityFields) && (
          <p className="go-form-error" role="alert">{errors.detail}</p>
        )}

        <div className="go-modal-actions">
          <button type="button" className="go-btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="go-btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </form>
    </Modal>
  )
}

function AreaModal({ gerente, availableAreas, onClose, onAssign, onReassign }) {
  const [areaId, setAreaId] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(operation) {
    setSaving(true)
    setErrors({})

    try {
      if (operation === 'assign') {
        await onAssign(Number(areaId))
      } else {
        await onReassign(Number(areaId))
      }
    } catch (error) {
      const conflict = operation === 'assign'
        ? 'El área seleccionada no está disponible para una asignación inmediata.'
        : 'No se puede programar la reasignación porque el área tiene un conflicto actual o futuro.'

      setErrors({
        ...validationErrors(error),
        detail: error.status === 409 ? conflict : messageFor(error, 'No se pudo actualizar el área.'),
      })
      setSaving(false)
    }
  }

  const areaError = fieldError(errors, 'area_id')

  return (
    <Modal title={`Gestionar áreas — ${gerente.nombre}`} onClose={onClose}>
      <div className="go-modal-form">

        <div className="go-form-group">
          <label htmlFor="go-area">Área</label>
          <select
            id="go-area"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            required
            aria-describedby={areaError ? 'area_id-error' : undefined}
          >
            <option value="">Seleccionar área</option>
            {availableAreas.map((area) => (
              <option value={area.id} key={area.id}>{area.codigo} — {area.nombre}</option>
            ))}
          </select>
          {areaError && <span id="area_id-error" className="go-form-error" role="alert">{areaError}</span>}
        </div>

        <fieldset className="go-area-selector">
          <legend>Operación</legend>

          <button type="button" className="go-btn-secondary" disabled={saving || !areaId} onClick={() => submit('assign')}>
            {saving ? 'Procesando...' : 'Asignar área disponible'}
          </button>

          <button type="button" className="go-btn-primary" disabled={saving || !areaId} onClick={() => submit('reassign')}>
            {saving ? 'Procesando...' : 'Reasignar área ocupada'}
          </button>
        </fieldset>

        {errors.detail && <p className="go-form-error" role="alert">{errors.detail}</p>}

        <div className="go-modal-actions">
          <button type="button" className="go-btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  )
}

function ConfirmModal({ title, children, confirm, onClose, onConfirm }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)

    try {
      await onConfirm()
    } catch (requestError) {
      setError(messageFor(requestError, 'No se pudo completar la acción.'))
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="go-modal-form">
        <p>{children}</p>
        {error && <p className="go-form-error" role="alert">{error}</p>}
        <div className="go-modal-actions">
          <button className="go-btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="go-btn-primary" onClick={submit} disabled={saving}>{saving ? 'Procesando...' : confirm}</button>
        </div>
      </div>
    </Modal>
  )
}

function PasswordModal({ result, recipientName, onClose }) {
  const [status, setStatus] = useState('')
  const deliveryPending = result.notification_delivery_status === 'notification_delivery_pending_retry'

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')

      await navigator.clipboard.writeText(result.password_temporal)
      setStatus('¡Copiado!')
    } catch {
      setStatus('No se pudo copiar la contraseña. Cópiala manualmente.')
    }
  }

  return (
    <Modal title="Contraseña temporal" onClose={onClose}>
      <div className="go-modal-form">
        <p>Contraseña temporal para {passwordRecipientName(result, recipientName)}. No se volverá a mostrar.</p>
        <p className="go-password">{result.password_temporal}</p>
        <button className="go-copy-btn" onClick={copy}>Copiar contraseña</button>
        {status && <p role="status">{status}</p>}
        {deliveryPending && (
          <p className="go-delivery-warning" role="status">
            La cuenta se creó, pero el correo se entregará en un reintento. Comparte la contraseña temporal por un canal seguro si fuera necesario.
          </p>
        )}
        <div className="go-modal-actions">
          <button className="go-btn-primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </Modal>
  )
}

function CreateModal({ areas, onClose, onSubmit }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', area_ids: [] })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function toggleArea(areaId) {
    setForm((current) => ({
      ...current,
      area_ids: current.area_ids.includes(areaId)
        ? current.area_ids.filter((id) => id !== areaId)
        : [...current.area_ids, areaId],
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    const body = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      ...(form.area_ids.length ? { area_ids: form.area_ids } : {}),
    }

    try {
      await onSubmit(body)
    } catch (error) {
      setErrors({
        ...validationErrors(error),
        detail: messageFor(error, 'No se pudo crear el gerente.'),
      })
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo gerente de operaciones" onClose={onClose}>
      <form className="go-modal-form" onSubmit={submit}>
        {identityFields.map((field) => {
          const error = fieldError(errors, field)
          const label = field === 'email' ? 'Correo electrónico' : field[0].toUpperCase() + field.slice(1)

          return (
            <div className="go-form-group" key={field}>
              <label htmlFor={`create-go-${field}`}>{label}</label>
              <input
                id={`create-go-${field}`}
                type={field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                required
                aria-describedby={error ? `${field}-error` : undefined}
              />
              {error && <span id={`${field}-error`} className="go-form-error" role="alert">{error}</span>}
            </div>
          )
        })}

        <fieldset className="go-area-selector">
          <legend>Áreas (opcional)</legend>
          {areas.length ? areas.map((area) => (
            <label key={area.id} className="go-area-option">
              <input type="checkbox" checked={form.area_ids.includes(area.id)} onChange={() => toggleArea(area.id)} />
              {area.codigo} — {area.nombre}
            </label>
          )) : <p>No hay áreas disponibles.</p>}
          {fieldError(errors, 'area_ids') && (
            <span className="go-form-error" role="alert">{fieldError(errors, 'area_ids')}</span>
          )}
        </fieldset>

        {errors.detail && <p className="go-form-error" role="alert">{errors.detail}</p>}

        <div className="go-modal-actions">
          <button className="go-btn-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="go-btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear gerente'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function GerentesOperacionesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      setData(await getGerentesOperaciones())
    } catch (requestError) {
      setError(messageFor(requestError, 'No se pudieron cargar los gerentes de operaciones.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const close = () => setModal(null)
  const mutate = async (action) => {
    const result = await action()
    await loadData()
    close()
    return result
  }
  const gerentes = data?.results || []
  const areas = data?.areas_disponibles || []

  return (
    <div className="go-page">
      <div className="go-page-header">
        <div>
          <h1>Gerentes de operaciones</h1>
          <p>{gerentes.length} registrado{gerentes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="go-btn-primary" onClick={() => setModal({ type: 'create' })}>Nuevo gerente</button>
      </div>

      {loading ? (
        <div className="go-loading-state" role="status">Cargando gerentes de operaciones...</div>
      ) : error ? (
        <div className="go-error-state" role="alert">
          <p>{error}</p>
          <button className="go-btn-secondary" onClick={loadData}>Reintentar</button>
        </div>
      ) : !gerentes.length ? (
        <div className="go-empty-state">No hay gerentes de operaciones registrados.</div>
      ) : (
        <div className="go-table-card go-table-wrapper">
          <table className="go-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Cambio de contraseña</th>
                <th>Áreas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gerentes.map((gerente) => (
                <tr key={gerente.id}>
                  <td>{gerente.id}</td>
                  <td>{gerente.nombre}</td>
                  <td>{gerente.apellido || '—'}</td>
                  <td>{gerente.email}</td>
                  <td>{gerente.activo ? 'Activo' : 'Inactivo'}</td>
                  <td>{gerente.debe_cambiar_password ? 'Pendiente' : 'Al día'}</td>
                  <td>{areasText(gerente.areas)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" title="Editar" aria-label="Editar" onClick={() => setModal({ type: 'edit', gerente })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="action-btn" title="Gestionar áreas" aria-label="Gestionar áreas" onClick={() => setModal({ type: 'areas', gerente })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6l9-4 9 4-9 4-9-4z" />
                          <path d="M3 12l9 4 9-4" />
                          <path d="M3 18l9 4 9-4" />
                        </svg>
                      </button>
                      <button className="action-btn" title="Resetear contraseña" aria-label="Resetear contraseña" onClick={() => setModal({ type: 'reset', gerente })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                      </button>
                      {gerente.activo && (
                        <button className="action-btn action-btn-danger" title="Desactivar" aria-label="Desactivar" onClick={() => setModal({ type: 'deactivate', gerente })}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'create' && (
        <CreateModal
          areas={areas}
          onClose={close}
          onSubmit={async (form) => {
            const result = await createGerenteOperaciones(form)
            await loadData()
            setModal({ type: 'password', result, recipientName: form.nombre })
          }}
        />
      )}
      {modal?.type === 'edit' && (
        <IdentityModal
          gerente={modal.gerente}
          onClose={close}
          onSubmit={(body) => mutate(() => updateGerenteOperaciones(modal.gerente.id, body))}
        />
      )}
      {modal?.type === 'areas' && (
        <AreaModal
          gerente={modal.gerente}
          availableAreas={areas}
          onClose={close}
          onAssign={(id) => mutate(() => assignArea(modal.gerente.id, id))}
          onReassign={(id) => mutate(() => reassignArea(modal.gerente.id, id))}
        />
      )}
      {modal?.type === 'deactivate' && (
        <ConfirmModal
          title="Desactivar gerente"
          confirm="Desactivar"
          onClose={close}
          onConfirm={() => mutate(() => deactivateGerenteOperaciones(modal.gerente.id))}
        >
          ¿Deseas desactivar a {modal.gerente.nombre}? Ya no podrá iniciar sesión.
        </ConfirmModal>
      )}
      {modal?.type === 'reset' && (
        <ConfirmModal
          title="Resetear contraseña"
          confirm="Resetear"
          onClose={close}
          onConfirm={async () => {
            const result = await resetGerenteOperacionesPassword(modal.gerente.id)
            await loadData()
            setModal({ type: 'password', result, recipientName: modal.gerente.nombre })
          }}
        >
          Se generará una nueva contraseña temporal.
        </ConfirmModal>
      )}
      {modal?.type === 'password' && (
        <PasswordModal result={modal.result} recipientName={modal.recipientName} onClose={close} />
      )}
    </div>
  )
}
