import { useEffect, useState } from 'react'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import InventoryExecutionModal from '../components/InventoryExecutionModal'
import { getHistoryDetail, listHistory } from '../inventoryService'

function label(type) {
  return type === 'inventory_area' ? 'Inventario de área' : 'Inventario de sucursal'
}

export default function InventoryHistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [correction, setCorrection] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try { setHistory((await listHistory()).submissions ?? []) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }
  useEffect(() => { void Promise.resolve().then(load) }, [])
  async function openDetail(id) { try { setDetail((await getHistoryDetail(id)).submission) } catch (requestError) { setError(requestError.message) } }
  async function openCorrection(id) { const item = await getHistoryDetail(id); setCorrection(item.submission) }

  return <section className="tema-analiza tuvet-page"><PageHeader title="Historial de inventarios" description="Envíos disponibles según el alcance autorizado por el sistema." /><Aviso tipo="error">{error}</Aviso><EstadoCarga loading={loading} error={error} onRetry={load}>{history.length === 0 ? <p className="tuvet-muted">No hay inventarios disponibles.</p> : <div className="tuvet-ocurrencias">{history.map((item) => <article className="tuvet-card" key={item.id}><h2>{label(item.inventory_type)}</h2><p>Envío #{item.id} · versión {item.expected_version}</p><button className="tuvet-btn tuvet-btn-secondary" type="button" onClick={() => openDetail(item.id)}>Ver detalle</button>{item.can_correct === true && <button className="tuvet-btn" type="button" onClick={() => openCorrection(item.id)}>Corregir</button>}</article>)}</div>}</EstadoCarga>{detail && <section className="tuvet-card" aria-label="Detalle de inventario"><h2>{label(detail.inventory_type)}</h2><p>Alcance congelado: {JSON.stringify(detail.frozen_scope)}</p><p>Digest: {detail.frozen_scope_digest}</p><p>Versión esperada: {detail.expected_version}</p>{detail.revisions.map((revision) => <article key={revision.number}><h3>{revision.number === 1 ? 'Envío inicial' : `Corrección ${revision.number - 1}`}</h3><p>Autor: {revision.author_id} · Fecha: {revision.created_at}</p>{revision.comment && <p>Comentario: {revision.comment}</p>}{revision.correction_reason && <p>Motivo: {revision.correction_reason}</p>}<p>Digest: {revision.digest}</p><pre>{JSON.stringify(revision.rows, null, 2)}</pre></article>)}</section>}{correction && <InventoryExecutionModal occurrence={{ nombre: label(correction.inventory_type) }} mode={correction.inventory_type === 'inventory_area' ? 'area' : 'branch'} correction={correction} onClose={() => setCorrection(null)} onReload={() => openDetail(correction.id)} onSuccess={() => { setCorrection(null); void load() }} />}</section>
}
