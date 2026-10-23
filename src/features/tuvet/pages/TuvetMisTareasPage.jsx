import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import OcurrenciaCard from '../components/OcurrenciaCard'
import { Aviso, EstadoCarga, FileDrop, FormSection, Icono, Modal, PageHeader } from '../components/TuvetUi'
import { getMisTareas, listItems, marcarOcurrencia } from '../services/tuvetService'
import { ACCEPT_EVIDENCIA, construirDocumento, formatTamano, validarArchivoEvidencia } from '../utils/archivos'
import { ESTADOS_OCURRENCIA, formatFecha } from '../utils/formato'
import { enfocarPrimerError, erroresDelServidor } from '../utils/formularios'
import {
  PERIODOS,
  agruparPorDia,
  aIso,
  desdeIso,
  enRango,
  hoyIso,
  moverPeriodo,
  puedeMarcarse,
  rangoPeriodo,
} from '../utils/periodos'

const FILTROS = ['todas', 'pendiente', 'en_revision', 'aprobada', 'cancelada']

function MarcarModal({ ocurrencia, onClose, onMarcada }) {
  const [archivo, setArchivo] = useState(null)
  const [errorDocumento, setErrorDocumento] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const formRef = useRef(null)

  function seleccionar(file) {
    setArchivo(file)
    setErrorDocumento(file ? validarArchivoEvidencia(file).error ?? '' : '')
  }

  async function enviar(event) {
    event.preventDefault()
    setErrorGeneral('')
    if (ocurrencia.requiere_documento && !archivo) {
      setErrorDocumento('Esta tarea requiere adjuntar un documento. Arrastra o selecciona el archivo de evidencia.')
      enfocarPrimerError(formRef.current)
      return
    }
    if (archivo && validarArchivoEvidencia(archivo).error) {
      enfocarPrimerError(formRef.current)
      return
    }
    setEnviando(true)
    try {
      const documento = archivo ? await construirDocumento(archivo) : undefined
      onMarcada(await marcarOcurrencia(ocurrencia.id, documento))
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['documento'])
      setErrorDocumento(porCampo.documento ?? '')
      setErrorGeneral(general)
      setEnviando(false)
    }
  }

  return (
    <Modal
      title="Marcar como realizada"
      subtitle={`${ocurrencia.nombre} · ${formatFecha(ocurrencia.fecha_programada)}`}
      icon="tarea"
      tone="success"
      onClose={enviando ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="submit" form="tuvet-marcar-form" className="tuvet-btn" disabled={enviando} aria-busy={enviando}>{enviando ? 'Enviando...' : 'Marcar realizada'}</button>
        </>
      )}
    >
      <form id="tuvet-marcar-form" ref={formRef} className="tuvet-form" onSubmit={enviar} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>
        {ocurrencia.vencida && <Aviso tipo="warning">La tarea está vencida. Quedará registrado el tiempo de retraso.</Aviso>}
        <FormSection
          title={ocurrencia.requiere_documento ? 'Evidencia (obligatoria)' : 'Evidencia (opcional)'}
          description="PDF, PNG, JPG o DOCX. Máximo 5 MB."
        >
          <FileDrop
            accept={ACCEPT_EVIDENCIA}
            file={archivo}
            onChange={seleccionar}
            disabled={enviando}
            formatSize={formatTamano}
            hint="Arrastra o selecciona un archivo"
            invalid={Boolean(errorDocumento)}
            describedBy={errorDocumento ? 'tuvet-documento-error' : undefined}
          />
          {errorDocumento && <span id="tuvet-documento-error" className="tuvet-field-error" role="alert">{errorDocumento}</span>}
        </FormSection>
        <Aviso tipo="info">
          {ocurrencia.requiere_aprobacion
            ? 'Al marcarla quedará en revisión hasta que el encargado la apruebe.'
            : 'Esta tarea no requiere aprobación: quedará aprobada al marcarla.'}
        </Aviso>
      </form>
    </Modal>
  )
}

const VACIO_POR_PERIODO = {
  dia: 'No tienes tareas programadas para este día.',
  semana: 'No tienes tareas programadas esta semana.',
  mes: 'No tienes tareas programadas este mes.',
}

function PeriodoSelector({ periodo, titulo, incluyeHoy, onPeriodo, onMover, onHoy }) {
  return (
    <div className="tv-periodo">
      <div className="tv-vistas" role="group" aria-label="Periodo">
        {Object.values(PERIODOS).map((item) => (
          <button
            key={item.clave}
            type="button"
            className={`tv-vista ${periodo === item.clave ? 'is-active' : ''}`}
            aria-pressed={periodo === item.clave}
            onClick={() => onPeriodo(item.clave)}
          >
            {item.etiqueta}
          </button>
        ))}
      </div>
      <div className="tuvet-mes-selector" role="group" aria-label="Navegar por el periodo">
        <button type="button" className="tuvet-btn tuvet-btn-secondary tuvet-btn-icon" onClick={() => onMover(-1)} aria-label="Periodo anterior">‹</button>
        <span className="tv-periodo-titulo" aria-live="polite">{titulo}</span>
        <button type="button" className="tuvet-btn tuvet-btn-secondary tuvet-btn-icon" onClick={() => onMover(1)} aria-label="Periodo siguiente">›</button>
      </div>
      {!incluyeHoy && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onHoy}>Hoy</button>}
    </div>
  )
}

function AccionTarea({ ocurrencia, onMarcar }) {
  if (ocurrencia.estado === 'en_revision') return <span className="tuvet-muted">Esperando revisión</span>
  if (ocurrencia.estado !== 'pendiente') return null
  if (!puedeMarcarse(ocurrencia)) {
    // El backend rechaza marcar antes de la fecha programada: no se ofrece el botón.
    return (
      <span className="tv-no-disponible">
        <Icono nombre="info" className="tuvet-badge-icon" />
        Disponible desde {formatFecha(ocurrencia.fecha_programada)}
      </span>
    )
  }
  return <button type="button" className="tuvet-btn" onClick={() => onMarcar(ocurrencia)}>Marcar realizada</button>
}

export default function TuvetMisTareasPage() {
  const [params, setParams] = useSearchParams()
  const periodo = PERIODOS[params.get('periodo')] ? params.get('periodo') : 'dia'
  const ancla = desdeIso(params.get('fecha')) ?? new Date()
  const rango = rangoPeriodo(periodo, ancla)
  const clavesMeses = rango.meses.map((item) => `${item.year}-${item.month}`).join(',')

  const [ocurrencias, setOcurrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [marcando, setMarcando] = useState(null)
  const [aviso, setAviso] = useState('')
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    const actual = ++peticion.current
    setLoading(true)
    setError('')
    try {
      // Una semana puede cruzar dos meses: se consultan ambos y se combinan sin duplicados.
      const meses = clavesMeses.split(',').map((clave) => clave.split('-').map(Number))
      const respuestas = await Promise.all(meses.map(([year, month]) => getMisTareas(year, month)))
      const unicas = new Map(respuestas.flatMap(listItems).map((item) => [item.id, item]))
      if (actual === peticion.current) setOcurrencias([...unicas.values()])
    } catch (err) {
      if (actual === peticion.current) setError(err.message)
    } finally {
      if (actual === peticion.current) setLoading(false)
    }
  }, [clavesMeses])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  const hoy = hoyIso()
  const delPeriodo = useMemo(() => ocurrencias.filter((item) => enRango(item, rango)), [ocurrencias, rango.desde, rango.hasta]) // eslint-disable-line react-hooks/exhaustive-deps
  // En la vista de hoy también se muestran las pendientes vencidas de días anteriores, para que no queden ocultas.
  const atrasadas = useMemo(
    () => (periodo === 'dia' && rango.desde === hoy
      ? ocurrencias.filter((item) => item.estado === 'pendiente' && item.vencida && item.fecha_programada < hoy)
        .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))
      : []),
    [ocurrencias, periodo, rango.desde, hoy],
  )

  const resumen = useMemo(() => {
    const vigentes = [...atrasadas, ...delPeriodo].filter((item) => item.estado !== 'cancelada')
    return {
      pendientes: vigentes.filter((item) => item.estado === 'pendiente' && !item.vencida).length,
      vencidas: vigentes.filter((item) => item.vencida).length,
      enRevision: vigentes.filter((item) => item.estado === 'en_revision').length,
      aprobadas: vigentes.filter((item) => item.estado === 'aprobada').length,
    }
  }, [atrasadas, delPeriodo])

  const filtrar = (lista) => (filtro === 'todas' ? lista : lista.filter((item) => item.estado === filtro))
  const visibles = filtrar(delPeriodo)
  const atrasadasVisibles = filtrar(atrasadas)
  const grupos = periodo === 'dia' ? [{ fecha: rango.desde, titulo: null, items: visibles }] : agruparPorDia(visibles)

  function actualizarUrl(cambios) {
    const siguientes = new URLSearchParams(params)
    Object.entries(cambios).forEach(([clave, valor]) => (valor ? siguientes.set(clave, valor) : siguientes.delete(clave)))
    setParams(siguientes, { replace: true })
  }

  function iniciarMarcado(ocurrencia) {
    setAviso('')
    setMarcando(ocurrencia)
  }

  function onMarcada(actualizada) {
    setOcurrencias((lista) => lista.map((item) => (item.id === actualizada.id ? actualizada : item)))
    setMarcando(null)
    setAviso(actualizada.estado === 'aprobada' ? 'Tarea marcada y aprobada.' : 'Tarea enviada a revisión.')
    void cargar()
  }

  const tarjeta = (ocurrencia) => (
    <OcurrenciaCard key={ocurrencia.id} ocurrencia={ocurrencia} acciones={<AccionTarea ocurrencia={ocurrencia} onMarcar={iniciarMarcado} />} />
  )

  return (
    <div className="tuvet-page">
      <PageHeader title="Mis tareas" description="Tareas asignadas por los encargados de departamento.">
        <PeriodoSelector
          periodo={periodo}
          titulo={rango.titulo}
          incluyeHoy={rango.incluyeHoy}
          onPeriodo={(clave) => actualizarUrl({ periodo: clave === 'dia' ? null : clave })}
          onMover={(pasos) => actualizarUrl({ fecha: aIso(moverPeriodo(periodo, ancla, pasos)) })}
          onHoy={() => actualizarUrl({ fecha: null })}
        />
      </PageHeader>

      <div className="tuvet-resumen">
        <div><span>{resumen.pendientes}</span>Pendientes</div>
        <div><span>{resumen.vencidas}</span>Vencidas</div>
        <div><span>{resumen.enRevision}</span>En revisión</div>
        <div><span>{resumen.aprobadas}</span>Aprobadas</div>
      </div>

      <div className="tuvet-filtros" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((valor) => (
          <button key={valor} type="button" className={`tuvet-chip ${filtro === valor ? 'active' : ''}`} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
            {valor === 'todas' ? 'Todas' : ESTADOS_OCURRENCIA[valor]}
          </button>
        ))}
      </div>

      <Aviso tipo="success">{aviso}</Aviso>

      <EstadoCarga loading={loading} error={error} onRetry={cargar}>
        {atrasadasVisibles.length > 0 && (
          <section className="tv-grupo-dia tv-grupo-atrasadas" aria-labelledby="tv-atrasadas">
            <h2 id="tv-atrasadas" className="tv-grupo-titulo">
              <Icono nombre="alerta" className="tuvet-badge-icon" />
              Atrasadas ({atrasadasVisibles.length})
              <span className="tuvet-hint">Vencieron sin marcarse; aún puedes completarlas.</span>
            </h2>
            <div className="tuvet-ocurrencias">{atrasadasVisibles.map(tarjeta)}</div>
          </section>
        )}

        {visibles.length ? grupos.map((grupo) => (
          <section key={grupo.fecha} className="tv-grupo-dia" aria-label={grupo.titulo ?? rango.titulo}>
            {grupo.titulo && (
              <h2 className={`tv-grupo-titulo ${grupo.esHoy ? 'tv-grupo-hoy' : ''}`}>
                {grupo.titulo}
                <span className="tuvet-hint">{grupo.items.length} tarea(s)</span>
              </h2>
            )}
            <div className="tuvet-ocurrencias">{grupo.items.map(tarjeta)}</div>
          </section>
        )) : (
          <div className="tuvet-empty">
            <Icono nombre="vacio" className="tuvet-empty-icon" />
            <p>{filtro === 'todas' ? VACIO_POR_PERIODO[periodo] : 'No hay tareas con ese estado en este periodo.'}</p>
            {periodo === 'dia' && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => actualizarUrl({ periodo: 'semana' })}>Ver la semana</button>}
          </div>
        )}
      </EstadoCarga>

      {marcando && <MarcarModal ocurrencia={marcando} onClose={() => setMarcando(null)} onMarcada={onMarcada} />}
    </div>
  )
}
