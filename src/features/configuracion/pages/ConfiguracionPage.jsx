import { useState, useEffect } from 'react'
import { getConfiguracion, updateConfiguracion } from '../services/configuracionService'
import './ConfiguracionPage.css'

const CAMPOS = [
  {
    key: 'trabajo_campo_dias_futuro',
    label: 'Trabajo de campo — días a futuro',
    ayuda: 'Máximo de días a futuro para solicitar trabajo de campo.',
  },
  {
    key: 'vacacion_programada_dias_futuro',
    label: 'Vacaciones programadas — días a futuro',
    ayuda: 'Máximo de días a futuro para solicitar una vacación programada.',
  },
  {
    key: 'situacion_especial_dias_atras',
    label: 'Permiso extraordinario — días atrás',
    ayuda: 'Máximo de días hacia atrás para registrar un permiso extraordinario u otra situación especial.',
  },
  {
    key: 'situacion_especial_dias_futuro',
    label: 'Permiso extraordinario — días a futuro',
    ayuda: 'Máximo de días a futuro para registrar un permiso extraordinario u otra situación especial.',
  },
  {
    key: 'solicitud_dias_limite_aceptar',
    label: 'Días límite para aceptar',
    ayuda: 'Si una solicitud de trabajo de campo o vacación programada sigue pendiente pasados estos días, se cierra sola (estado "Vencida") al correr el mantenimiento.',
  },
]

export default function ConfiguracionPage() {
  const [form, setForm]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const data = await getConfiguracion()
      setForm(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const body = Object.fromEntries(
        CAMPOS.map(({ key }) => [key, Number(form[key])])
      )
      const data = await updateConfiguracion(body)
      setForm(data.configuracion)
      setSuccess('Configuración guardada correctamente.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="configuracion-page">
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p>Ventanas de fecha para solicitudes de trabajo de campo, vacaciones y permisos.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Cargando configuración...</div>
      ) : (
        <div className="config-card">
          <form className="config-form" onSubmit={handleSubmit}>
            {CAMPOS.map(({ key, label, ayuda }) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input
                  type="number"
                  min="0"
                  value={form?.[key] ?? ''}
                  onChange={set(key)}
                  required
                />
                <p className="form-help">{ayuda}</p>
              </div>
            ))}

            {error && <p className="modal-error">{error}</p>}
            {success && <p className="config-success">{success}</p>}

            {form?.actualizado_por && (
              <p className="config-meta">
                Última actualización por {form.actualizado_por.nombre} el{' '}
                {new Date(form.updated_at).toLocaleString()}
              </p>
            )}

            <div className="config-footer">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
