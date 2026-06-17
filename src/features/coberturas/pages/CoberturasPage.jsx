import { useState, useEffect } from 'react'
import { getCoberturas, createCobertura, activarCobertura, cancelarCobertura, completarCobertura } from '../services/coberturasService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { getSucursales } from '../../sucursales/services/sucursalesService'
import './CoberturasPage.css'

const ESTADO_BADGE = {
  programada:  'badge-yellow',
  activa:      'badge-green',
  completada:  'badge-blue',
  cancelada:   'badge-red',
}

const JORNADA_LABEL = {
  manana:      'Mañana',
  tarde:       'Tarde',
  dia_completo:'Día completo',
}

export default function CoberturasPage() {
  const [coberturas, setCoberturas] = useState([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal]           = useState(null)

  useEffect(() => { loadData() }, [filtroEstado])

  async function loadData() {
    setLoading(true)
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      const data = await getCoberturas(params)
      setCoberturas(data.results ?? [])
      setTotal(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccion(id, accion) {
    try {
      if (accion === 'activar')   await activarCobertura(id)
      if (accion === 'cancelar')  await cancelarCobertura(id)
      if (accion === 'completar') await completarCobertura(id)
      await loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCreate(form) {
    await createCobertura(form)
    await loadData()
    setModal(null)
  }

  return (
    <div className="coberturas-page">
      <div className="page-header">
        <div>
          <h1>Coberturas temporales</h1>
          <p>{total} cobertura{total !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva cobertura
        </button>
      </div>

      <div className="toolbar">
        <select className="filtro-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="programada">Programadas</option>
          <option value="activa">Activas</option>
          <option value="completada">Completadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando coberturas...</div>
      ) : coberturas.length === 0 ? (
        <div className="empty-state">
          {filtroEstado ? 'Sin coberturas con ese estado.' : 'No hay coberturas registradas.'}
        </div>
      ) : (
        <div className="table-card">
          <table className="coberturas-table">
            <thead>
              <tr>
                <th>Reemplazo</th>
                <th>Titular</th>
                <th>Sucursal</th>
                <th>Fecha</th>
                <th>Jornada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {coberturas.map((c) => (
                <tr key={c.id_cobertura}>
                  <td className="td-nombre">{c.usuario_reemplazo?.nombre ?? '—'}</td>
                  <td>{c.usuario_titular?.nombre ?? <span className="td-empty">—</span>}</td>
                  <td>{c.sucursal_destino?.nombre ?? '—'}</td>
                  <td>{c.fecha}</td>
                  <td><span className="badge badge-tipo">{c.jornada_label ?? JORNADA_LABEL[c.jornada] ?? c.jornada}</span></td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[c.estado] ?? 'badge-tipo'}`}>
                      {c.estado_label ?? c.estado}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {c.estado === 'programada' && (
                        <button className="action-btn action-btn-green" title="Activar" onClick={() => handleAccion(c.id_cobertura, 'activar')}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      )}
                      {c.estado === 'activa' && (
                        <button className="action-btn action-btn-blue" title="Completar" onClick={() => handleAccion(c.id_cobertura, 'completar')}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                        </button>
                      )}
                      {(c.estado === 'programada' || c.estado === 'activa') && (
                        <button className="action-btn action-btn-danger" title="Cancelar" onClick={() => handleAccion(c.id_cobertura, 'cancelar')}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
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
        <CoberturaModal onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

/* ── Modal crear cobertura ── */

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CoberturaModal({ onSubmit, onClose }) {
  const [usuarios, setUsuarios]     = useState([])
  const [sucursales, setSucursales] = useState([])
  const [form, setForm] = useState({
    id_usuario_reemplazo: '',
    id_usuario_titular:   '',
    id_sucursal_destino:  '',
    fecha:    '',
    jornada:  'dia_completo',
    motivo:   '',
  })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([getUsuarios(), getSucursales()])
      .then(([u, s]) => { setUsuarios(u); setSucursales(s) })
      .catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = {
        id_usuario_reemplazo: Number(form.id_usuario_reemplazo),
        id_sucursal_destino:  Number(form.id_sucursal_destino),
        fecha:   form.fecha,
        jornada: form.jornada,
        motivo:  form.motivo,
      }
      if (form.id_usuario_titular) body.id_usuario_titular = Number(form.id_usuario_titular)
      await onSubmit(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const usuariosActivos = (Array.isArray(usuarios) ? usuarios : []).filter((u) => u.habilitado)

  return (
    <ModalWrapper title="Nueva cobertura" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Usuario reemplazo <span className="label-required">*</span></label>
          <select value={form.id_usuario_reemplazo} onChange={set('id_usuario_reemplazo')} required>
            <option value="">Seleccionar usuario</option>
            {usuariosActivos.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Usuario titular <span className="label-optional">(opcional)</span></label>
          <select value={form.id_usuario_titular} onChange={set('id_usuario_titular')}>
            <option value="">Sin titular</option>
            {usuariosActivos.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Sucursal destino <span className="label-required">*</span></label>
          <select value={form.id_sucursal_destino} onChange={set('id_sucursal_destino')} required>
            <option value="">Seleccionar sucursal</option>
            {sucursales.filter((s) => s.activa).map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Fecha <span className="label-required">*</span></label>
            <input type="date" value={form.fecha} onChange={set('fecha')} required />
          </div>
          <div className="form-group">
            <label>Jornada</label>
            <select value={form.jornada} onChange={set('jornada')}>
              <option value="dia_completo">Día completo</option>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Motivo <span className="label-optional">(opcional)</span></label>
          <input type="text" value={form.motivo} onChange={set('motivo')} placeholder="ej. descanso dominical" />
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear cobertura'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}
