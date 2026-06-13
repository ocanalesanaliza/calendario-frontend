import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlantillas, createPlantilla, desactivarPlantilla } from '../services/plantillasService'
import './PlantillasPage.css'

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getPlantillas()
      setPlantillas(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form) {
    await createPlantilla(form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarPlantilla(id)
    await loadData()
    setModal(null)
  }

  function formatFecha(iso) {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="plantillas-page">
      <div className="page-header">
        <div>
          <h1>Plantillas</h1>
          <p>{plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''} registrada{plantillas.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva plantilla
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Cargando plantillas...</div>
      ) : plantillas.length === 0 ? (
        <div className="empty-state">No hay plantillas registradas.</div>
      ) : (
        <div className="table-card">
          <table className="plantillas-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Tareas</th>
                <th>Creada por</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plantillas.map((p) => (
                <tr key={p.id_plantilla} className="clickable-row" onClick={() => navigate(`/plantillas/${p.id_plantilla}`)}>
                  <td className="td-nombre">{p.nombre}</td>
                  <td className="td-desc">{p.descripcion || <span className="td-empty">—</span>}</td>
                  <td><span className="tareas-count">{p.total_tareas}</span></td>
                  <td>{p.creada_por?.nombre ?? <span className="td-empty">—</span>}</td>
                  <td className="td-fecha">{formatFecha(p.created_at)}</td>
                  <td>
                    <span className={`badge ${p.activa ? 'badge-green' : 'badge-red'}`}>
                      {p.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button
                        className="action-btn"
                        title="Ver detalle"
                        onClick={() => navigate(`/plantillas/${p.id_plantilla}`)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {p.activa && (
                        <button
                          className="action-btn action-btn-danger"
                          title="Desactivar"
                          onClick={() => setModal({ type: 'desactivar', plantilla: p })}
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

      {modal?.type === 'desactivar' && (
        <DesactivarModal
          plantilla={modal.plantilla}
          onConfirm={() => handleDesactivar(modal.plantilla.id_plantilla)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

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
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
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
    <ModalWrapper title="Nueva plantilla" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Descripción <span className="label-optional">(opcional)</span></label>
          <textarea rows={3} value={form.descripcion} onChange={set('descripcion')} />
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear plantilla'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function DesactivarModal({ plantilla, onConfirm, onClose }) {
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
    <ModalWrapper title="Desactivar plantilla" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          ¿Estás seguro que deseas desactivar <strong>{plantilla.nombre}</strong>?
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
