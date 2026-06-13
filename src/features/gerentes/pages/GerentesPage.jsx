import { useState, useEffect } from 'react'
import { getGerentes, createGerente } from '../services/gerentesService'
import './GerentesPage.css'

export default function GerentesPage() {
  const [gerentes, setGerentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'crear' && (
        <CrearModal
          onSubmit={handleCreate}
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
    <div className="modal-overlay" onClick={onClose}>
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
  const [form, setForm] = useState({ nombre: '', email: '' })
  const [error, setError] = useState('')
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

function PasswordModal({ nombre, password, onClose }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ModalWrapper title="Gerente creado" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          El gerente <strong>{nombre}</strong> fue creado. Comparte esta contraseña temporal — no se volverá a mostrar.
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
