import { useState, useEffect } from 'react'
import { getGerentes, createGerente, updateGerente, desactivarGerente, resetPasswordGerente } from '../services/gerentesService'
import './GerentesPage.css'

export default function GerentesPage() {
  const [gerentes, setGerentes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getGerentes()
      setGerentes(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form) {
    const data = await createGerente(form)
    await loadData()
    setModal({ type: 'password', password: data.password_temporal, nombre: data.gerente_area.nombre })
  }

  async function handleEdit(id, form) {
    await updateGerente(id, form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarGerente(id)
    await loadData()
    setModal(null)
  }

  async function handleResetPassword(id) {
    const data = await resetPasswordGerente(id)
    await loadData()
    setModal({ type: 'password', password: data.password_temporal, nombre: data.gerente_area.nombre })
  }

  return (
    <div className="gerentes-page">
      <div className="page-header">
        <div>
          <h1>Gerentes de área</h1>
          <p>{gerentes.length} gerente{gerentes.length !== 1 ? 's' : ''} registrado{gerentes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo gerente
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Cargando gerentes...</div>
      ) : gerentes.length === 0 ? (
        <div className="empty-state">No hay gerentes registrados.</div>
      ) : (
        <div className="table-card">
          <table className="gerentes-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gerentes.map((g) => (
                <tr key={g.id_gerente_area}>
                  <td>
                    <div className="gerente-cell">
                      <div className={`gerente-avatar ${g.es_admin_maestro ? 'avatar-admin' : ''}`}>
                        {g.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="td-nombre">{g.nombre}</span>
                    </div>
                  </td>
                  <td className="td-email">{g.email}</td>
                  <td>
                    <span className={`badge ${g.es_admin_maestro ? 'badge-purple' : 'badge-blue'}`}>
                      {g.es_admin_maestro ? 'Admin maestro' : 'Gerente de área'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${g.activo ? 'badge-green' : 'badge-red'}`}>
                      {g.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="action-btn"
                        title="Editar"
                        onClick={() => setModal({ type: 'editar', gerente: g })}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="action-btn"
                        title="Resetear contraseña"
                        onClick={() => setModal({ type: 'reset', gerente: g })}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                      </button>
                      {g.activo && (
                        <button
                          className="action-btn action-btn-danger"
                          title="Desactivar"
                          onClick={() => setModal({ type: 'desactivar', gerente: g })}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
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

      {modal?.type === 'crear' && (
        <CrearModal onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <EditarModal
          gerente={modal.gerente}
          onSubmit={(form) => handleEdit(modal.gerente.id_gerente_area, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal
          gerente={modal.gerente}
          onConfirm={() => handleDesactivar(modal.gerente.id_gerente_area)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetModal
          gerente={modal.gerente}
          onConfirm={() => handleResetPassword(modal.gerente.id_gerente_area)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'password' && (
        <PasswordModal
          nombre={modal.nombre}
          password={modal.password}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

/* ── Modales ── */

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CrearModal({ onSubmit, onClose }) {
  const [form, setForm]     = useState({ nombre: '', email: '', es_admin_maestro: false })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title="Nuevo gerente de área" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.es_admin_maestro}
            onChange={(e) => setForm((f) => ({ ...f, es_admin_maestro: e.target.checked }))}
          />
          Es admin maestro
        </label>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear gerente'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function EditarModal({ gerente, onSubmit, onClose }) {
  const [form, setForm] = useState({
    nombre:          gerente.nombre,
    email:           gerente.email,
    es_admin_maestro: gerente.es_admin_maestro,
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title={`Editar — ${gerente.nombre}`} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.es_admin_maestro}
            onChange={(e) => setForm((f) => ({ ...f, es_admin_maestro: e.target.checked }))}
          />
          Es admin maestro
        </label>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function DesactivarModal({ gerente, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <ModalWrapper title="Desactivar gerente" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          ¿Deseas desactivar a <strong>{gerente.nombre}</strong>?
          {gerente.es_admin_maestro && (
            <span className="modal-warn"> Este gerente es admin maestro — el sistema no permite desactivar al último admin activo.</span>
          )}
        </p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Desactivando...' : 'Desactivar'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function ResetModal({ gerente, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <ModalWrapper title="Resetear contraseña" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          Se generará una nueva contraseña temporal para <strong>{gerente.nombre}</strong>. El usuario deberá cambiarla al iniciar sesión.
        </p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Procesando...' : 'Resetear'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function PasswordModal({ nombre, password, onClose }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ModalWrapper title="Contraseña temporal" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          Contraseña temporal para <strong>{nombre}</strong> — no se volverá a mostrar.
        </p>
        <div className="password-box">
          <span>{password}</span>
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
