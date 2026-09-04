import { useEffect, useState } from 'react'
import { createGerenteOperaciones, getGerentesOperaciones } from '../services/gerentesOperacionesService'
import './GerentesOperacionesPage.css'

function areasText(areas) {
  if (!areas?.length) return 'Sin áreas asignadas'
  return areas.map((area) => area.codigo || area.nombre).join(', ')
}

function CreateModal({ areas, onClose, onSubmit }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [areaIds, setAreaIds] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canSelectAreas = Array.isArray(areas)

  function toggleArea(areaId) {
    setAreaIds((current) => current.includes(areaId)
      ? current.filter((id) => id !== areaId)
      : [...current, areaId])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const form = { nombre: nombre.trim(), email: email.trim() }
      if (canSelectAreas) form.area_ids = areaIds
      await onSubmit(form)
    } catch (requestError) {
      setError(requestError.message || 'No se pudo crear el gerente de operaciones.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="go-modal-backdrop" role="presentation">
      <section className="go-modal" role="dialog" aria-modal="true" aria-labelledby="go-create-title">
        <div className="go-modal-header">
          <h2 id="go-create-title">Nuevo gerente de operaciones</h2>
          <button type="button" className="go-icon-button" onClick={onClose} disabled={submitting} aria-label="Cerrar">×</button>
        </div>
        <form className="go-modal-form" onSubmit={handleSubmit}>
          <div className="go-form-group">
            <label htmlFor="go-nombre">Nombre</label>
            <input id="go-nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} required autoComplete="name" />
          </div>
          <div className="go-form-group">
            <label htmlFor="go-email">Correo electrónico</label>
            <input id="go-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          {canSelectAreas && (
            <fieldset className="go-area-selector">
              <legend>Áreas</legend>
              {areas.length === 0 ? (
                <p>No hay áreas disponibles.</p>
              ) : areas.map((area) => (
                <label key={area.id} className="go-area-option">
                  <input type="checkbox" checked={areaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />
                  {area.codigo} — {area.nombre}
                </label>
              ))}
            </fieldset>
          )}
          {error && <p className="go-form-error" role="alert">{error}</p>}
          <div className="go-modal-actions">
            <button type="button" className="go-btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="go-btn-primary" disabled={submitting}>{submitting ? 'Creando...' : 'Crear gerente'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function PasswordModal({ created, onClose }) {
  const deliveryPending = created.notification_delivery_status === 'notification_delivery_pending_retry'
  const [copyStatus, setCopyStatus] = useState('idle')

  async function copyPassword() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(created.password_temporal)
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <div className="go-modal-backdrop" role="presentation">
      <section className="go-modal" role="dialog" aria-modal="true" aria-labelledby="go-password-title">
        <div className="go-modal-header">
          <h2 id="go-password-title">Cuenta creada</h2>
          <button type="button" className="go-icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p>La cuenta de {created.nombre} fue creada. Copia esta contraseña temporal ahora.</p>
        <p className="go-password" aria-label="Contraseña temporal">{created.password_temporal}</p>
        <button type="button" className="go-copy-btn" onClick={copyPassword}>Copiar contraseña</button>
        {copyStatus === 'success' && <p className="go-copy-success" role="status">¡Copiado!</p>}
        {copyStatus === 'error' && <p className="go-copy-error" role="alert">No se pudo copiar la contraseña. Cópiala manualmente.</p>}
        <p className="go-password-warning">La persona deberá cambiar esta contraseña en su primer acceso.</p>
        {deliveryPending && <p className="go-delivery-warning" role="status">La cuenta fue creada, pero el correo no se entregó correctamente. Comparte la contraseña temporal por un canal seguro.</p>}
        <div className="go-modal-actions"><button type="button" className="go-btn-primary" onClick={onClose}>Entendido</button></div>
      </section>
    </div>
  )
}

export default function GerentesOperacionesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      setData(await getGerentesOperaciones())
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar los gerentes de operaciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  async function handleCreate(form) {
    const result = await createGerenteOperaciones(form)
    setCreating(false)
    setCreated(result)
    void loadData()
  }

  const gerentes = data?.results ?? []

  return (
    <div className="go-page">
      <div className="go-page-header">
        <div>
          <h1>Gerentes de operaciones</h1>
          {!loading && !error && <p>{data?.count ?? gerentes.length} gerente{(data?.count ?? gerentes.length) !== 1 ? 's' : ''} registrado{(data?.count ?? gerentes.length) !== 1 ? 's' : ''}</p>}
        </div>
        <button className="go-btn-primary" onClick={() => setCreating(true)} disabled={loading}>
          Nuevo gerente
        </button>
      </div>

      {loading ? <div className="go-loading-state" role="status">Cargando gerentes de operaciones...</div>
        : error ? <div className="go-error-state" role="alert"><p>{error}</p><button type="button" className="go-btn-secondary" onClick={loadData}>Reintentar</button></div>
          : gerentes.length === 0 ? <div className="go-empty-state">No hay gerentes de operaciones registrados.</div>
            : <div className="go-table-card go-table-wrapper"><table className="go-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Cambio de contraseña</th><th>Áreas vigentes</th><th>Acciones</th></tr></thead>
              <tbody>{gerentes.map((gerente) => <tr key={gerente.id}>
                <td className="go-td-nombre">{gerente.nombre}</td>
                <td className="go-td-email">{gerente.email}</td>
                <td><span className={`go-badge ${gerente.activo ? 'go-badge-green' : 'go-badge-red'}`}>{gerente.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>{gerente.debe_cambiar_password ? <span className="go-badge go-badge-yellow">Pendiente</span> : 'Al día'}</td>
                <td>{areasText(gerente.areas)}</td>
                <td>
                    <div className="row-actions">
                      <button
                        className="action-btn"
                        title="Editar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="action-btn"
                        title="Resetear contraseña"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                      </button>
                        <button
                          className="action-btn action-btn-danger"
                          title="Desactivar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </button>
                    </div>
                  </td>
              </tr>)}</tbody>
            </table></div>}

      {creating && <CreateModal areas={data?.areas_disponibles} onClose={() => setCreating(false)} onSubmit={handleCreate} />}
      {created && <PasswordModal created={created} onClose={() => setCreated(null)} />}
    </div>
  )
}
