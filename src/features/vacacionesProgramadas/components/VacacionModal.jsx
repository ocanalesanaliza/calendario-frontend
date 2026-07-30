import { useState } from 'react'
import { crearSolicitudVacacion } from '../services/vacacionesProgramadasService'

export default function VacacionModal({ onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    fecha_inicio: hoy,
    fecha_fin:    '',
    motivo:       '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await crearSolicitudVacacion({
        fecha_inicio: form.fecha_inicio,
        fecha_fin:    form.fecha_fin || form.fecha_inicio,
        motivo:       form.motivo || undefined,
      })
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nueva solicitud de vacaciones programadas</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} min={hoy} onChange={set('fecha_inicio')} required />
            </div>
            <div className="form-group">
              <label>Fecha fin <span className="label-optional">(opcional)</span></label>
              <input type="date" value={form.fecha_fin} min={form.fecha_inicio || hoy} onChange={set('fecha_fin')} />
            </div>
          </div>
          <div className="form-group">
            <label>Motivo <span className="label-optional">(opc.)</span></label>
            <input type="text" value={form.motivo} onChange={set('motivo')} placeholder="ej. Viaje familiar" />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Solicitar vacaciones'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
