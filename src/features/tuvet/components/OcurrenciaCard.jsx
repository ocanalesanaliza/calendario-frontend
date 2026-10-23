import { useState } from 'react'
import { descargarDocumento } from '../services/tuvetService'
import { formatTamano } from '../utils/archivos'
import {
  EVENTOS_OCURRENCIA,
  formatFecha,
  formatFechaHora,
  formatRetraso,
  nombrePersona,
} from '../utils/formato'
import { EstadoBadge } from './TuvetUi'

export default function OcurrenciaCard({ ocurrencia, mostrarGerente = false, acciones }) {
  const [abierta, setAbierta] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')
  const ultimoRechazo = [...(ocurrencia.eventos ?? [])].reverse().find((evento) => evento.tipo === 'rechazada')
  const retraso = formatRetraso(ocurrencia.retraso_minutos)

  async function descargar(documento) {
    setErrorDescarga('')
    try {
      await descargarDocumento(ocurrencia.id, documento)
    } catch (error) {
      setErrorDescarga(error.message)
    }
  }

  return (
    <article className={`tuvet-ocurrencia tuvet-ocurrencia-${ocurrencia.estado}`}>
      <div className="tuvet-ocurrencia-main">
        <div className="tuvet-ocurrencia-info">
          <h3>{ocurrencia.nombre}</h3>
          <p className="tuvet-muted">
            {ocurrencia.departamento?.nombre}
            {ocurrencia.plantilla?.nombre && ` · ${ocurrencia.plantilla.nombre}`}
            {mostrarGerente && ` · ${nombrePersona(ocurrencia.gerente_sucursal)}`}
          </p>
          <p className="tuvet-ocurrencia-fechas">
            Programada: {formatFecha(ocurrencia.fecha_programada)} · Límite: {formatFechaHora(ocurrencia.fecha_limite)}
          </p>
          <div className="tuvet-tags">
            <EstadoBadge estado={ocurrencia.estado} vencida={ocurrencia.vencida} />
            {ocurrencia.requiere_documento && <span className="tuvet-tag">Requiere documento</span>}
            {ocurrencia.requiere_aprobacion ? <span className="tuvet-tag">Requiere aprobación</span> : <span className="tuvet-tag">Sin aprobación</span>}
            {retraso && <span className="tuvet-tag tuvet-tag-retraso">Retraso: {retraso}</span>}
          </div>
          {ocurrencia.estado === 'pendiente' && ultimoRechazo && (
            <p className="tuvet-rechazo">
              <strong>Rechazada:</strong> {ultimoRechazo.comentario}
            </p>
          )}
        </div>
        <div className="tuvet-ocurrencia-acciones">
          {acciones}
          <button type="button" className="tuvet-btn tuvet-btn-link" onClick={() => setAbierta((valor) => !valor)} aria-expanded={abierta}>
            {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </div>
      </div>

      {abierta && (
        <div className="tuvet-ocurrencia-detalle">
          <div>
            <h4>Documentos</h4>
            {ocurrencia.documentos?.length ? (
              <ul className="tuvet-lista-simple">
                {ocurrencia.documentos.map((documento) => (
                  <li key={documento.id}>
                    <button type="button" className="tuvet-btn tuvet-btn-link" onClick={() => descargar(documento)}>
                      {documento.nombre}
                    </button>
                    <span className="tuvet-muted"> · {formatTamano(documento.tamano)} · {documento.subido_por?.nombre} · {formatFechaHora(documento.creado_en)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="tuvet-muted">Sin documentos.</p>}
            {errorDescarga && <p className="tuvet-aviso tuvet-aviso-error" role="alert">{errorDescarga}</p>}
          </div>
          <div>
            <h4>Historial</h4>
            {ocurrencia.eventos?.length ? (
              <ul className="tuvet-lista-simple">
                {ocurrencia.eventos.map((evento) => (
                  <li key={evento.id}>
                    <strong>{EVENTOS_OCURRENCIA[evento.tipo] ?? evento.tipo}</strong>
                    <span className="tuvet-muted"> · {evento.actor?.nombre} · {formatFechaHora(evento.creado_en)}</span>
                    {evento.comentario && <p className="tuvet-comentario">{evento.comentario}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="tuvet-muted">Sin movimientos.</p>}
          </div>
        </div>
      )}
    </article>
  )
}
