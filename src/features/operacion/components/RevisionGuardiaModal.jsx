import { useEffect, useState } from 'react'
import { getRevisionGuardia, guardarRevisionGuardia } from '../services/revisionesGuardiaService'
import './RevisionGuardiaModal.css'

const UNIFORME = [
  ['botas', 'Botas'],
  ['zapatillas', 'Zapatillas'],
  ['tenis', 'Tenis'],
  ['camisa_con_logo', 'Camisa con logo'],
  ['pantalon_tela', 'Pantalón de tela'],
  ['pantalon_jean', 'Pantalón jean'],
  ['gorra', 'Gorra'],
]

const EQUIPAMIENTO = [
  ['porta_carnet', 'Porta carnet'],
  ['revolver', 'Revólver'],
  ['escopeta', 'Escopeta'],
  ['tolete', 'Tolete'],
  ['libro_novedades', 'Libro de novedades'],
]

function valoresBooleanos(campos, source = {}) {
  return Object.fromEntries(campos.map(([key]) => [key, source[key] === true]))
}

function crearGuardia(numeroGuardia, source = {}) {
  return {
    numero_guardia: numeroGuardia,
    primer_nombre: source.primer_nombre ?? '',
    segundo_nombre: source.segundo_nombre ?? '',
    primer_apellido: source.primer_apellido ?? '',
    segundo_apellido: source.segundo_apellido ?? '',
    identidad: source.identidad ?? '',
    telefono: source.telefono ?? '',
    uniforme: valoresBooleanos(UNIFORME, source.uniforme),
    equipamiento: valoresBooleanos(EQUIPAMIENTO, source.equipamiento),
  }
}

function soloDigitos(value) {
  return value.replace(/\D/g, '')
}

export function RevisionGuardiaModal({ tarea, fecha, onClose, onSaved }) {
  const idSucursalTarea = tarea.revision_guardia?.id_sucursal_tarea ?? tarea.id_sucursal_tarea
  const [formulario, setFormulario] = useState(null)
  const [guardias, setGuardias] = useState([])
  const [reportandoAusencia, setReportandoAusencia] = useState(false)
  const [notaAusencia, setNotaAusencia] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    getRevisionGuardia(idSucursalTarea, fecha)
      .then((data) => {
        if (!vigente) return
        const requeridos = data.guardias_requeridos
          ?? Array.from({ length: data.numero_guardias ?? 0 }, (_, index) => index + 1)
        const existentes = data.revision?.guardias ?? []
        setFormulario(data)
        setNotaAusencia(data.revision?.notas ?? '')
        setGuardias(requeridos.map((numero) => crearGuardia(
          numero,
          existentes.find((guardia) => guardia.numero_guardia === numero),
        )))
        setLoading(false)
      })
      .catch((err) => {
        if (vigente) { setError(err.message); setLoading(false) }
      })
    return () => { vigente = false }
  }, [idSucursalTarea, fecha])

  function setCampo(index, campo, value) {
    setGuardias((current) => current.map((guardia, guardiaIndex) => (
      guardiaIndex === index ? { ...guardia, [campo]: value } : guardia
    )))
  }

  function setVerificacion(index, grupo, campo, value) {
    setGuardias((current) => current.map((guardia, guardiaIndex) => (
      guardiaIndex === index
        ? { ...guardia, [grupo]: { ...guardia[grupo], [campo]: value } }
        : guardia
    )))
  }

  function validar() {
    const requeridos = formulario.guardias_requeridos
      ?? Array.from({ length: formulario.numero_guardias ?? 0 }, (_, index) => index + 1)
    const consecutivos = formulario.numero_guardias >= 1
      && formulario.numero_guardias <= 4
      && requeridos.length === formulario.numero_guardias
      && requeridos.every((numero, index) => numero === index + 1)
    if (!consecutivos || guardias.length !== requeridos.length) {
      return 'La configuración de guardias no es válida. Actualiza la página e inténtalo de nuevo.'
    }
    for (const guardia of guardias) {
      if (!guardia.primer_nombre.trim() || !guardia.primer_apellido.trim() || !guardia.identidad.trim()) {
        return `Completa el primer nombre, primer apellido e identidad del guardia ${guardia.numero_guardia}.`
      }
      if (soloDigitos(guardia.identidad).length !== 13) {
        return `La identidad del guardia ${guardia.numero_guardia} debe contener 13 dígitos.`
      }
    }
    const identidades = guardias.map((guardia) => soloDigitos(guardia.identidad))
    if (new Set(identidades).size !== identidades.length) {
      return 'No se permiten identidades repetidas dentro de la misma revisión.'
    }
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!formulario?.puede_guardar || saving) return
    const validationError = validar()
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        id_sucursal_tarea: Number(idSucursalTarea),
        fecha: formulario.fecha,
        guardias: guardias.map((guardia) => ({
          ...guardia,
          primer_nombre: guardia.primer_nombre.trim(),
          segundo_nombre: guardia.segundo_nombre.trim(),
          primer_apellido: guardia.primer_apellido.trim(),
          segundo_apellido: guardia.segundo_apellido.trim(),
          identidad: guardia.identidad.trim(),
          telefono: guardia.telefono.trim(),
        })),
      }
      const result = await guardarRevisionGuardia(payload)
      await onSaved(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleGuardarAusencia() {
    if (!formulario?.puede_guardar || saving) return
    const notas = notaAusencia.trim()
    if (!notas) {
      setError('La nota es requerida cuando el guardia no se presentó.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await guardarRevisionGuardia({
        id_sucursal_tarea: Number(idSucursalTarea),
        fecha: formulario.fecha,
        no_se_presento_guardia: true,
        notas,
      })
      await onSaved(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const puedeGuardar = formulario?.puede_guardar === true
  const ausenciaRegistrada = formulario?.revision?.no_se_presento_guardia === true

  return (
    <div className="modal-overlay revision-guardia-overlay">
      <div className="modal revision-guardia-modal" role="dialog" aria-modal="true" aria-label="Revisión de Guardia">
        <div className="modal-header">
          <div>
            <h2>Revisión de Guardia</h2>
            {formulario?.fecha && <p>{formulario.fecha}</p>}
          </div>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose} disabled={saving}>×</button>
        </div>

        {loading ? (
          <div className="revision-guardia-status">Cargando formulario...</div>
        ) : !formulario ? (
          <div className="revision-guardia-status">No se pudo cargar el formulario.</div>
        ) : (
          <form className="revision-guardia-form" onSubmit={handleSubmit}>
            {!puedeGuardar && !ausenciaRegistrada && (
              <p className="revision-guardia-notice">
                {formulario.motivo_no_disponible || 'Esta revisión no está disponible para registro.'}
              </p>
            )}

            {ausenciaRegistrada && (
              <div className="revision-guardia-ausencia-registrada">
                <strong>No se presentó guardia.</strong>
                <span>Nota: {formulario.revision.notas}</span>
                <small>Esta tarea se registró como realizada y sumó su peso completo.</small>
              </div>
            )}

            {reportandoAusencia && !ausenciaRegistrada && (
              <div className="revision-guardia-ausencia-form">
                <p>La tarea se mostrará como realizada, sumará su peso completo y la nota será visible para el gerente.</p>
                <label htmlFor="revision-guardia-nota-ausencia">Nota *</label>
                <textarea
                  id="revision-guardia-nota-ausencia"
                  value={notaAusencia}
                  onChange={(event) => setNotaAusencia(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Explica por qué no se presentó el guardia..."
                  disabled={saving}
                />
                <small>{notaAusencia.length}/500</small>
              </div>
            )}

            {!reportandoAusencia && !ausenciaRegistrada && (
              <div className="guardia-cards">
                {guardias.map((guardia, index) => (
                  <fieldset key={guardia.numero_guardia} className="guardia-fieldset" disabled={!puedeGuardar || saving}>
                    <legend>Guardia {guardia.numero_guardia}</legend>
                <div className="guardia-datos-grid">
                  <label>Primer nombre *<input value={guardia.primer_nombre} onChange={(e) => setCampo(index, 'primer_nombre', e.target.value)} required /></label>
                  <label>Segundo nombre<input value={guardia.segundo_nombre} onChange={(e) => setCampo(index, 'segundo_nombre', e.target.value)} /></label>
                  <label>Primer apellido *<input value={guardia.primer_apellido} onChange={(e) => setCampo(index, 'primer_apellido', e.target.value)} required /></label>
                  <label>Segundo apellido<input value={guardia.segundo_apellido} onChange={(e) => setCampo(index, 'segundo_apellido', e.target.value)} /></label>
                  <label>Identidad *<input value={guardia.identidad} onChange={(e) => setCampo(index, 'identidad', e.target.value)} placeholder="0801-2000-12345" inputMode="numeric" required /></label>
                  <label>Teléfono<input value={guardia.telefono} onChange={(e) => setCampo(index, 'telefono', e.target.value)} placeholder="9999-0000" inputMode="tel" /></label>
                </div>

                <div className="guardia-check-section">
                  <p>Uniforme</p>
                  <div className="guardia-check-grid">
                    {UNIFORME.map(([key, label]) => (
                      <label key={key}><input type="checkbox" checked={guardia.uniforme[key]} onChange={(e) => setVerificacion(index, 'uniforme', key, e.target.checked)} />{label}</label>
                    ))}
                  </div>
                </div>

                <div className="guardia-check-section">
                  <p>Equipamiento</p>
                  <div className="guardia-check-grid">
                    {EQUIPAMIENTO.map(([key, label]) => (
                      <label key={key}><input type="checkbox" checked={guardia.equipamiento[key]} onChange={(e) => setVerificacion(index, 'equipamiento', key, e.target.checked)} />{label}</label>
                    ))}
                  </div>
                </div>
                  </fieldset>
                ))}
              </div>
            )}

            {error && <p role="alert" className="modal-error">{error}</p>}
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cerrar</button>
              {puedeGuardar && !reportandoAusencia && (
                <>
                  <button
                    type="button"
                    className="btn-no-presento"
                    onClick={() => { setReportandoAusencia(true); setError('') }}
                    disabled={saving}
                  >
                    No se presentó guardia
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar revisión'}
                  </button>
                </>
              )}
              {puedeGuardar && reportandoAusencia && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setReportandoAusencia(false); setError('') }}
                    disabled={saving}
                  >
                    Volver al formulario
                  </button>
                  <button type="button" className="btn-primary" onClick={handleGuardarAusencia} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar ausencia'}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
        {!loading && !formulario && error && <p role="alert" className="modal-error revision-guardia-load-error">{error}</p>}
      </div>
    </div>
  )
}
