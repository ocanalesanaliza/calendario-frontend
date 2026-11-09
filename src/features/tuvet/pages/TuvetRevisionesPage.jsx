import { useCallback, useEffect, useRef, useState } from 'react'
import OcurrenciaCard from '../components/OcurrenciaCard'
import { Aviso, EstadoCarga, Field, MesSelector, Modal, PageHeader } from '../components/TuvetUi'
import { aprobarOcurrencia, getRevisiones, listItems, rechazarOcurrencia } from '../services/tuvetService'
import { ESTADOS_OCURRENCIA, mesActual, nombrePersona } from '../utils/formato'
import { enfocarPrimerError, erroresDelServidor } from '../utils/formularios'

const MAX_COMENTARIO = 1000

function RechazarModal({ ocurrencia, onClose, onRechazada }) {
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const formRef = useRef(null)

  async function enviar(event) {
    event.preventDefault()
    setErrorGeneral('')
    const texto = comentario.trim()
    if (!texto) {
      setError('Indica el motivo del rechazo para que el gerente sepa qué debe corregir.')
      enfocarPrimerError(formRef.current)
      return
    }
    setEnviando(true)
    setError('')
    try {
      onRechazada(await rechazarOcurrencia(ocurrencia.id, texto))
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['comentario'])
      setError(porCampo.comentario ?? '')
      setErrorGeneral(general)
      setEnviando(false)
    }
  }

  return (
    <Modal
      title="Rechazar tarea"
      subtitle={`${ocurrencia.nombre} · ${nombrePersona(ocurrencia.gerente_sucursal)}`}
      icon="rechazar"
      tone="danger"
      onClose={enviando ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="submit" form="tuvet-rechazar-form" className="tuvet-btn tuvet-btn-danger-solid" disabled={enviando} aria-busy={enviando}>{enviando ? 'Rechazando...' : 'Rechazar'}</button>
        </>
      )}
    >
      <form id="tuvet-rechazar-form" ref={formRef} className="tuvet-form" onSubmit={enviar} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>
        <Aviso tipo="warning">La tarea volverá a pendiente y el gerente de sucursal deberá realizarla de nuevo.</Aviso>
        <Field label="Motivo del rechazo" required error={error} hint="El gerente de sucursal verá este comentario.">
          <textarea
            value={comentario}
            maxLength={MAX_COMENTARIO}
            rows={4}
            onChange={(event) => { setComentario(event.target.value); if (error) setError('') }}
            disabled={enviando}
            placeholder="Ej. El documento está incompleto, falta la firma del responsable."
          />
        </Field>
        <span className="tuvet-char-count" aria-live="polite">{comentario.length}/{MAX_COMENTARIO}</span>
      </form>
    </Modal>
  )
}

export default function TuvetRevisionesPage() {
  const [mes, setMes] = useState(mesActual)
  const [estado, setEstado] = useState('en_revision')
  const [ocurrencias, setOcurrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [aprobando, setAprobando] = useState(null)
  const [rechazando, setRechazando] = useState(null)
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    const actual = ++peticion.current
    setLoading(true)
    setError('')
    try {
      const data = await getRevisiones(mes.year, mes.month, estado)
      if (actual === peticion.current) setOcurrencias(listItems(data))
    } catch (err) {
      if (actual === peticion.current) setError(err.message)
    } finally {
      if (actual === peticion.current) setLoading(false)
    }
  }, [mes, estado])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  function actualizar(ocurrencia, mensaje) {
    setOcurrencias((lista) => (
      ocurrencia.estado === estado
        ? lista.map((item) => (item.id === ocurrencia.id ? ocurrencia : item))
        : lista.filter((item) => item.id !== ocurrencia.id)
    ))
    setAviso(mensaje)
    void cargar()
  }

  async function aprobar(ocurrencia) {
    setAprobando(ocurrencia.id)
    setAviso('')
    setErrorAccion('')
    try {
      actualizar(await aprobarOcurrencia(ocurrencia.id), 'Tarea aprobada.')
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setAprobando(null)
    }
  }

  function onRechazada(ocurrencia) {
    setRechazando(null)
    actualizar(ocurrencia, 'Tarea rechazada. Volvió a pendiente.')
  }

  return (
    <div className="tuvet-page">
      <PageHeader title="Revisiones" description="Tareas marcadas por los gerentes de sucursal que esperan tu visto bueno.">
        <label className="tuvet-field tuvet-field-inline">
          Estado
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            {Object.entries(ESTADOS_OCURRENCIA).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </label>
        <MesSelector value={mes} onChange={setMes} />
      </PageHeader>

      <Aviso tipo="success">{aviso}</Aviso>
      <Aviso tipo="error">{errorAccion}</Aviso>

      <EstadoCarga loading={loading} error={error} onRetry={cargar} empty={!ocurrencias.length} emptyText="No hay tareas en este estado para el mes seleccionado.">
        <div className="tuvet-ocurrencias">
          {ocurrencias.map((ocurrencia) => (
            <OcurrenciaCard
              key={ocurrencia.id}
              ocurrencia={ocurrencia}
              mostrarGerente
              acciones={ocurrencia.estado === 'en_revision' && (
                <>
                  <button type="button" className="tuvet-btn" onClick={() => aprobar(ocurrencia)} disabled={aprobando === ocurrencia.id}>
                    {aprobando === ocurrencia.id ? 'Aprobando...' : 'Aprobar'}
                  </button>
                  <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => { setAviso(''); setRechazando(ocurrencia) }} disabled={aprobando === ocurrencia.id}>
                    Rechazar
                  </button>
                </>
              )}
            />
          ))}
        </div>
      </EstadoCarga>

      {rechazando && <RechazarModal ocurrencia={rechazando} onClose={() => setRechazando(null)} onRechazada={onRechazada} />}
    </div>
  )
}
