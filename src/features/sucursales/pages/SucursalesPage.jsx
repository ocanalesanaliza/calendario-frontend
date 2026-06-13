import { useState, useEffect } from 'react'
import { getSucursales, createSucursal, updateSucursal, desactivarSucursal } from '../services/sucursalesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import './SucursalesPage.css'

export default function SucursalesPage() {
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)

  const perfil = JSON.parse(localStorage.getItem('perfil') || '{}')
  const esAdmin = perfil.es_admin_maestro === true

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getSucursales()
      setSucursales(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form) {
    await createSucursal(form)
    await loadData()
    setModal(null)
  }

  async function handleEdit(id, form) {
    await updateSucursal(id, form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarSucursal(id)
    await loadData()
    setModal(null)
  }

  const filtradas = sucursales.filter((s) =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.codigo.toLowerCase().includes(busqueda.toLowerCase())
  )

  const activas = sucursales.filter((s) => s.activa).length

  return (
    <div className="sucursales-page">
      <div className="page-header">
        <div>
          <h1>Sucursales</h1>
          <p>{activas} activa{activas !== 1 ? 's' : ''} de {sucursales.length} en total</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva sucursal
        </button>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Cargando sucursales...</div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          {busqueda ? 'Sin resultados para tu búsqueda.' : 'No hay sucursales registradas.'}
        </div>
      ) : (
        <div className="table-card">
          <table className="sucursales-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Gerente de área</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={s.id_sucursal}>
                  <td className="td-nombre">{s.nombre}</td>
                  <td><span className="codigo">{s.codigo}</span></td>
                  <td>
                    {s.gerente_area ? (
                      <div className="gerente-cell">
                        <div className="gerente-avatar">{s.gerente_area.nombre.charAt(0).toUpperCase()}</div>
                        <span>{s.gerente_area.nombre}</span>
                      </div>
                    ) : <span className="td-empty">—</span>}
                  </td>
                  <td>
                    <span className={`badge ${s.activa ? 'badge-green' : 'badge-red'}`}>
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" title="Editar" onClick={() => setModal({ type: 'editar', sucursal: s })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {s.activa && (
                        <button className="action-btn action-btn-danger" title="Desactivar" onClick={() => setModal({ type: 'desactivar', sucursal: s })}>
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
        <SucursalModal esAdmin={esAdmin} onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <SucursalModal
          esAdmin={esAdmin}
          inicial={modal.sucursal}
          onSubmit={(form) => handleEdit(modal.sucursal.id_sucursal, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal
          nombre={modal.sucursal.nombre}
          onConfirm={() => handleDesactivar(modal.sucursal.id_sucursal)}
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

function SucursalModal({ esAdmin, inicial, onSubmit, onClose }) {
  const [gerentes, setGerentes] = useState([])
  const [form, setForm] = useState({
    nombre:          inicial?.nombre ?? '',
    codigo:          inicial?.codigo ?? '',
    id_gerente_area: inicial?.gerente_area?.id_gerente_area ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (esAdmin) getGerentes().then(setGerentes).catch(() => {})
  }, [esAdmin])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = { nombre: form.nombre, codigo: form.codigo }
      if (esAdmin && form.id_gerente_area) body.id_gerente_area = Number(form.id_gerente_area)
      await onSubmit(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title={inicial ? 'Editar sucursal' : 'Nueva sucursal'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Código</label>
          <input type="text" value={form.codigo} onChange={set('codigo')} required placeholder="ej. CENTRO-001" />
        </div>
        {esAdmin && (
          <div className="form-group">
            <label>Gerente de área {!inicial && <span className="label-required">*</span>}</label>
            <select value={form.id_gerente_area} onChange={set('id_gerente_area')} required={!inicial}>
              <option value="">Seleccionar gerente</option>
              {gerentes.filter((g) => g.activo).map((g) => (
                <option key={g.id_gerente_area} value={g.id_gerente_area}>{g.nombre}</option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear sucursal'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function DesactivarModal({ nombre, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <ModalWrapper title="Desactivar sucursal" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">¿Deseas desactivar la sucursal <strong>{nombre}</strong>?</p>
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
