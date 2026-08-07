import { useState } from 'react'
import { createTrabajoCampo } from '../services/trabajosCampoService'

export default function TrabajoCampoModal({ onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    fecha:   hoy,
    jornada: 'manana',
    motivo:  '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createTrabajoCampo({
        fecha:   form.fecha,
        jornada: form.jornada,
        motivo:  form.motivo || undefined,
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
          <h2>Nueva solicitud de trabajo de campo</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={form.fecha} min={hoy} onChange={set('fecha')} required />
          </div>
          <div className="form-group">
            <label>Jornada</label>
            <select value={form.jornada} onChange={set('jornada')} required>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
          <div className="form-group">
            <label>Motivo <span className="label-optional">(opc.)</span></label>
            <input type="text" value={form.motivo} onChange={set('motivo')} placeholder="ej. Visita externa aprobada" />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Solicitar trabajo de campo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
