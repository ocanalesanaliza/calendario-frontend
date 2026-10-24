import { useCallback, useEffect, useState } from 'react'
import { getConfiguracion, updateConfiguracion } from '../services/configuracionService'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Avatar, Aviso, EstadoCarga, Icono, PageHeader } from '../../tuvet/components/TuvetUi'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './ConfiguracionPage.css'
import './ConfiguracionKit.css'

// Lista compacta: nombre corto en la fila y la explicación larga en la (i).
// `fabrica` replica los default del modelo ConfiguracionSolicitudes del backend; si cambian allí, cambiarlos aquí.
const CAMPOS = [
  {
    key: 'trabajo_campo_dias_futuro',
    label: 'Trabajo de campo a futuro',
    ayuda: 'Máximo de días a futuro para solicitar trabajo de campo.',
    fabrica: 5,
  },
  {
    key: 'vacacion_programada_dias_futuro',
    label: 'Vacaciones a futuro',
    ayuda: 'Máximo de días a futuro para solicitar una vacación programada.',
    fabrica: 30,
  },
  {
    key: 'situacion_especial_dias_atras',
    label: 'Permisos hacia atrás',
    ayuda: 'Máximo de días hacia atrás para registrar un permiso extraordinario u otra situación especial.',
    fabrica: 1,
  },
  {
    key: 'situacion_especial_dias_futuro',
    label: 'Permisos a futuro',
    ayuda: 'Máximo de días a futuro para registrar un permiso extraordinario u otra situación especial.',
    fabrica: 15,
  },
  {
    key: 'solicitud_dias_limite_aceptar',
    label: 'Vencen sin respuesta en',
    ayuda: 'Si una solicitud de trabajo de campo o vacación programada sigue pendiente pasados estos días, se cierra sola (estado "Vencida") al correr el mantenimiento.',
    fabrica: 1,
  },
]

const mismoValor = (a, b) => String(a ?? '') === String(b ?? '')

function validar(valor) {
  if (valor === '' || valor === null || valor === undefined) return 'Escribe un número de días (0 o más).'
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 0) return 'Usa un número entero de 0 o más, sin decimales.'
  return ''
}

const formatoFecha = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const formatoFechaHora = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

// Fecha de hoy desplazada N días; null si el valor no es válido.
function fechaDesdeHoy(valor, signo, hoy) {
  if (validar(valor)) return null
  if (Number(valor) === 0) return 'hoy'
  const fecha = new Date(hoy)
  fecha.setDate(fecha.getDate() + signo * Number(valor))
  return `el ${formatoFecha.format(fecha)}`
}

function haceCuanto(iso, ahora) {
  const minutos = Math.round((new Date(iso) - ahora) / 60000)
  if (Math.abs(minutos) < 60) return formatoRelativo.format(minutos, 'minute')
  const horas = Math.round(minutos / 60)
  if (Math.abs(horas) < 24) return formatoRelativo.format(horas, 'hour')
  const dias = Math.round(horas / 24)
  if (Math.abs(dias) < 30) return formatoRelativo.format(dias, 'day')
  const meses = Math.round(dias / 30)
  if (Math.abs(meses) < 12) return formatoRelativo.format(meses, 'month')
  return formatoRelativo.format(Math.round(meses / 12), 'year')
}

function UltimaActualizacion({ configuracion }) {
  const persona = configuracion.actualizado_por
  return (
    <section className="tuvet-card ck-panel" aria-labelledby="ck-ultima">
      <h2 id="ck-ultima" className="ck-panel-titulo">Última actualización</h2>
      {persona ? (
        <div className="ck-persona">
          <Avatar nombre={persona.nombre} />
          <div className="ck-persona-texto">
            <strong>{persona.nombre}</strong>
            {configuracion.updated_at && (
              <>
                <span className="ck-persona-cuando">{haceCuanto(configuracion.updated_at, new Date())}</span>
                <span className="tuvet-hint">{formatoFechaHora.format(new Date(configuracion.updated_at))}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="tuvet-hint ck-sin-cambios">Nadie ha modificado estos valores todavía; son los de fábrica.</p>
      )}
      <p className="ck-permiso">
        <Icono nombre="llave" className="ck-permiso-icono" />
        Solo el admin maestro puede modificar estos valores. Aplican a todas las sucursales y gerentes.
      </p>
    </section>
  )
}

function AsiQuedaHoy({ form }) {
  const hoy = new Date()
  const filas = [
    { icono: 'calendario', texto: 'Trabajo de campo', detalle: 'se puede pedir hasta', fecha: fechaDesdeHoy(form.trabajo_campo_dias_futuro, 1, hoy) },
    { icono: 'calendario', texto: 'Vacaciones', detalle: 'se pueden pedir hasta', fecha: fechaDesdeHoy(form.vacacion_programada_dias_futuro, 1, hoy) },
    {
      icono: 'alerta',
      texto: 'Permisos',
      detalle: 'se registran desde',
      fecha: fechaDesdeHoy(form.situacion_especial_dias_atras, -1, hoy),
      fechaFin: fechaDesdeHoy(form.situacion_especial_dias_futuro, 1, hoy),
    },
    { icono: 'reloj', texto: 'Una solicitud de hoy', detalle: 'vence sin respuesta', fecha: fechaDesdeHoy(form.solicitud_dias_limite_aceptar, 1, hoy) },
  ]
  return (
    <section className="tuvet-card ck-panel" aria-labelledby="ck-hoy">
      <h2 id="ck-hoy" className="ck-panel-titulo">Así queda hoy</h2>
      <p className="tuvet-hint ck-panel-sub">Con los valores de la lista, a partir del {formatoFecha.format(hoy)}.</p>
      <ul className="ck-hoy">
        {filas.map((fila) => (
          <li key={fila.texto}>
            <Icono nombre={fila.icono} className="ck-hoy-icono" />
            <span>
              <strong>{fila.texto}</strong> {fila.detalle}{' '}
              <span className="ck-fecha">{fila.fecha ?? '—'}</span>
              {fila.fechaFin !== undefined && <> hasta <span className="ck-fecha">{fila.fechaFin ?? '—'}</span></>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ConfiguracionPage() {
  const [form, setForm]       = useState(null)
  const [guardado, setGuardado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [errorCarga, setErrorCarga] = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [errores, setErrores] = useState({})

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorCarga('')
    try {
      const data = await getConfiguracion()
      setForm(data)
      setGuardado(data)
    } catch (err) {
      setErrorCarga(err.message || 'No se pudo cargar la configuración.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  function set(key) {
    return (e) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrores((actual) => ({ ...actual, [key]: undefined }))
      setSuccess('')
    }
  }

  // Solo rellena el formulario; no se aplica hasta pulsar Guardar.
  function restaurarFabrica() {
    setForm((f) => ({ ...f, ...Object.fromEntries(CAMPOS.map(({ key, fabrica }) => [key, fabrica])) }))
    setErrores({})
    setSuccess('')
  }

  const distintoDeFabrica = form ? CAMPOS.some(({ key, fabrica }) => !mismoValor(form[key], fabrica)) : false

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const nuevosErrores = Object.fromEntries(
      CAMPOS.map(({ key }) => [key, validar(form[key])]).filter(([, mensaje]) => mensaje),
    )
    setErrores(nuevosErrores)
    const primero = CAMPOS.find(({ key }) => nuevosErrores[key])
    if (primero) {
      document.getElementById(`cfg-${primero.key}`)?.focus()
      return
    }
    setSaving(true)
    try {
      const body = Object.fromEntries(
        CAMPOS.map(({ key }) => [key, Number(form[key])])
      )
      const data = await updateConfiguracion(body)
      setForm(data.configuracion)
      setGuardado(data.configuracion)
      setSuccess('Configuración guardada correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tema-analiza tuvet-page configuracion-kit">
      <PageHeader
        title="Configuración"
        description="Cuántos días antes o después se pueden pedir trabajos de campo, vacaciones y permisos."
      />

      <EstadoCarga loading={loading} error={errorCarga} onRetry={loadData} empty={!form} emptyText="No hay configuración disponible.">
        {form && (
          <div className="ck-layout">
            <div className="ck-principal">
              <form className="tuvet-card ck-lista" onSubmit={handleSubmit} noValidate>
                <div className="ck-lista-titulo">
                  <h2 className="ck-panel-titulo">Ventanas de fecha</h2>
                  {distintoDeFabrica && (
                    <button type="button" className="tuvet-btn tuvet-btn-ghost ck-fabrica" onClick={restaurarFabrica} disabled={saving}>
                      Restaurar valores de fábrica
                    </button>
                  )}
                </div>
                {CAMPOS.map(({ key, label, ayuda, fabrica }) => (
                  <div key={key} className={`ck-fila ${errores[key] ? 'has-error' : ''}`}>
                    <label className="ck-nombre" htmlFor={`cfg-${key}`}>{label}</label>
                    <span className="ck-info" tabIndex={0} role="button" aria-label={`Qué significa ${label}`} aria-describedby={`cfg-${key}-ayuda`}>
                      <Icono nombre="info" className="ck-info-icono" />
                      <span id={`cfg-${key}-ayuda`} role="tooltip" className="ck-tip">{ayuda} Valor de fábrica: {fabrica} días.</span>
                    </span>
                    {guardado && !mismoValor(form[key], guardado[key]) && (
                      <span className="ck-antes">antes: {guardado[key]}</span>
                    )}
                    <input
                      id={`cfg-${key}`}
                      className="ck-num"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={form[key] ?? ''}
                      onChange={set(key)}
                      disabled={saving}
                      aria-invalid={errores[key] ? true : undefined}
                      aria-describedby={errores[key] ? `cfg-${key}-error` : undefined}
                    />
                    <span className="ck-dias" aria-hidden="true">días</span>
                    {errores[key] && (
                      <span id={`cfg-${key}-error`} className="tuvet-field-error ck-error" role="alert">
                        <Icono nombre="error" className="tuvet-field-error-icon" />{errores[key]}
                      </span>
                    )}
                  </div>
                ))}
                <div className="ck-pie">
                  <button type="submit" className="tuvet-btn" disabled={saving} aria-busy={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>

              <Aviso tipo="error">{error}</Aviso>
              <Aviso tipo="success">{success}</Aviso>
            </div>

            <aside className="ck-lateral" aria-label="Resumen">
              <UltimaActualizacion configuracion={form} />
              <AsiQuedaHoy form={form} />
            </aside>
          </div>
        )}
      </EstadoCarga>
    </div>
  )
}
