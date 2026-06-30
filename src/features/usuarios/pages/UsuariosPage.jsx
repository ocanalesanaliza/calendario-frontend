import { useState, useEffect } from 'react'
import { getUsuarios, createUsuario, updateUsuario, cambiarSucursal, desactivarUsuario, resetPasswordUsuario } from '../services/usuariosService'
import { getSucursales } from '../../sucursales/services/sucursalesService'
import './UsuariosPage.css'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [u, s] = await Promise.all([getUsuarios(), getSucursales()])
      setUsuarios(u)
      setSucursales(s)
    } finally {
      setLoading(false)
    }
  }

  function closeModal() { setModal(null) }

  async function handleCreate(form) {
    const data = await createUsuario(form)
    await loadData()
    setModal({ type: 'password', password: data.password_temporal, nombre: data.usuario.nombre })
  }

  async function handleEdit(id, form) {
    await updateUsuario(id, form)
    await loadData()
    closeModal()
  }

  async function handleCambiarSucursal(id, form) {
    await cambiarSucursal(id, form)
    await loadData()
    closeModal()
  }

  async function handleDesactivar(id) {
    await desactivarUsuario(id)
    await loadData()
    closeModal()
  }

  async function handleResetPassword(id) {
    const data = await resetPasswordUsuario(id)
    await loadData()
    setModal({ type: 'password', password: data.password_temporal, nombre: data.usuario.nombre })
  }

  return (
    <div className="usuarios-page">
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Cargando usuarios...</div>
      ) : usuarios.length === 0 ? (
        <div className="empty-state">No hay usuarios registrados.</div>
      ) : (
        <div className="table-card">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Sucursal</th>
                <th>Gerente</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id_usuario}>
                  <td className="td-nombre">{u.nombre}</td>
                  <td className="td-email">{u.email}</td>
                  <td>{u.sucursal_actual?.nombre ?? <span className="td-empty">—</span>}</td>
                  <td>{u.gerente_area_actual?.nombre ?? <span className="td-empty">—</span>}</td>
                  <td>
                    <div className="badges">
                      <span className={`badge ${u.habilitado ? 'badge-green' : 'badge-red'}`}>
                        {u.habilitado ? 'Activo' : 'Inactivo'}
                      </span>
                      {u.debe_cambiar_password && (
                        <span className="badge badge-yellow">Cambiar contraseña</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="action-btn"
                        title="Editar"
                        onClick={() => setModal({ type: 'editar', usuario: u })}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="action-btn"
                        title="Resetear contraseña"
                        onClick={() => setModal({ type: 'reset', usuario: u })}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                      </button>
                      <button
                        className="action-btn"
                        title="Cambiar sucursal"
                        onClick={() => setModal({ type: 'sucursal', usuario: u })}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </button>
                      {u.habilitado && (
                        <button
                          className="action-btn action-btn-danger"
                          title="Desactivar"
                          onClick={() => setModal({ type: 'desactivar', usuario: u })}
                        >
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

      {modal?.type === 'crear' && (
        <CrearModal
          sucursales={sucursales}
          onSubmit={handleCreate}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'editar' && (
        <EditarModal
          usuario={modal.usuario}
          onSubmit={(form) => handleEdit(modal.usuario.id_usuario, form)}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'sucursal' && (
        <CambiarSucursalModal
          usuario={modal.usuario}
          sucursales={sucursales}
          onSubmit={(form) => handleCambiarSucursal(modal.usuario.id_usuario, form)}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'desactivar' && (
        <DesactivarModal
          usuario={modal.usuario}
          onConfirm={() => handleDesactivar(modal.usuario.id_usuario)}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'reset' && (
        <ResetModal
          usuario={modal.usuario}
          onConfirm={() => handleResetPassword(modal.usuario.id_usuario)}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'password' && (
        <PasswordModal
          nombre={modal.nombre}
          password={modal.password}
          onClose={closeModal}
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

function CrearModal({ sucursales, onSubmit, onClose }) {
  const [form, setForm] = useState({ nombre: '', email: '', id_sucursal: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit({ ...form, id_sucursal: Number(form.id_sucursal) })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title="Nuevo usuario" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="form-group">
          <label>Sucursal</label>
          <select value={form.id_sucursal} onChange={set('id_sucursal')} required>
            <option value="">Seleccionar sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
            ))}
          </select>
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function EditarModal({ usuario, onSubmit, onClose }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    email: usuario.email,
    habilitado: usuario.habilitado,
  })
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
    <ModalWrapper title="Editar usuario" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="form-group form-group-inline">
          <label>Habilitado</label>
          <input
            type="checkbox"
            checked={form.habilitado}
            onChange={(e) => setForm((f) => ({ ...f, habilitado: e.target.checked }))}
          />
        </div>
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

function CambiarSucursalModal({ usuario, sucursales, onSubmit, onClose }) {
  const [form, setForm] = useState({
    id_sucursal: usuario.sucursal_actual?.id_sucursal ?? '',
    fecha_inicio: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = { id_sucursal: Number(form.id_sucursal) }
      if (form.fecha_inicio) body.fecha_inicio = form.fecha_inicio
      await onSubmit(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title={`Cambiar sucursal — ${usuario.nombre}`} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nueva sucursal</label>
          <select value={form.id_sucursal} onChange={set('id_sucursal')} required>
            <option value="">Seleccionar sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Fecha de inicio <span className="label-optional">(opcional)</span></label>
          <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Cambiando...' : 'Cambiar sucursal'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function DesactivarModal({ usuario, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title="Desactivar usuario" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          ¿Estás seguro que deseas desactivar a <strong>{usuario.nombre}</strong>?
          El usuario no podrá iniciar sesión y se cerrará su asignación de sucursal.
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

function ResetModal({ usuario, onConfirm, onClose }) {
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
          Se generará una nueva contraseña temporal para <strong>{usuario.nombre}</strong>. El usuario deberá cambiarla al iniciar sesión.
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
    <ModalWrapper title="Usuario creado" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          El usuario <strong>{nombre}</strong> fue creado. Comparte esta contraseña temporal — no se volverá a mostrar.
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
