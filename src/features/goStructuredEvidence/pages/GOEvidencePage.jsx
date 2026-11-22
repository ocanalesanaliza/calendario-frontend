import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import { getGOEvidence } from '../goStructuredEvidenceService'
import '../../tuvet/tuvet.css'
import './GOEvidencePage.css'

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function date(value, withTime = false) {
  if (!value) return '—'
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  if (Number.isNaN(parsed.getTime())) return display(value)
  return new Intl.DateTimeFormat('es-HN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(parsed)
}

function amount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed) : display(value)
}

function money(value) {
  const formatted = amount(value)
  return formatted === '—' ? formatted : `L ${formatted}`
}

function valueFrom(object, ...keys) {
  return keys.map((key) => object?.[key]).find((value) => value !== null && value !== undefined && value !== '')
}

function BranchSummary({ branch, dateLabel, dateValue, taskName }) {
  const code = valueFrom(branch, 'code', 'branch_code')
  const name = valueFrom(branch, 'name', 'branch_name')
  return <section className="go-structured-evidence__summary" aria-label="Resumen de evidencia">
    <div><span>Sucursal</span><strong>{display(name)}</strong>{code && <small>{code}</small>}</div>
    {dateValue && <div><span>{dateLabel}</span><strong>{date(dateValue)}</strong></div>}
    {taskName && <div><span>Tarea</span><strong>{display(taskName)}</strong></div>}
  </section>
}

function inventorySummary(rows) {
  return rows.reduce((summary, row) => {
    const difference = Number(valueFrom(row, 'difference', 'variance'))
    const physicalStock = Number(valueFrom(row, 'physical_stock', 'counted_stock'))
    return {
      products: summary.products + 1,
      differences: summary.differences + (Number.isFinite(difference) && difference !== 0 ? 1 : 0),
      counted: summary.counted + (Number.isFinite(physicalStock) ? physicalStock : 0),
    }
  }, { products: 0, differences: 0, counted: 0 })
}

function InventoryEvidence({ detail }) {
  const branch = detail?.branch ?? { code: detail?.branch_code, name: detail?.branch_name }
  const revisions = Array.isArray(detail?.revisions) ? detail.revisions : []
  return <div className="go-structured-evidence__stack">
    <BranchSummary branch={branch} dateLabel="Fecha de ejecución" dateValue={detail?.execution_date} taskName={detail?.task_name} />
    {revisions.map((revision, index) => {
      const rows = Array.isArray(revision?.rows) ? revision.rows : []
      const summary = inventorySummary(rows)
      return <section className="go-structured-evidence__panel" key={revision?.number ?? index}>
        <header className="go-structured-evidence__panel-header"><div><h2>Revisión {display(revision?.number ?? index + 1)}</h2>{revision?.submitted_at && <p>Enviada {date(revision.submitted_at, true)}</p>}</div><span className="go-structured-evidence__status">Solo lectura</span></header>
        {rows.length > 0 ? <><section className="go-structured-evidence__inventory-summary" aria-label="Resumen de la revisión"><div><span>Productos revisados</span><strong>{summary.products}</strong></div><div className={summary.differences ? 'go-structured-evidence__inventory-kpi--attention' : 'go-structured-evidence__inventory-kpi--match'}><span>Con diferencia</span><strong>{summary.differences}</strong></div><div><span>Unidades contadas</span><strong>{summary.counted}</strong></div></section><div className="go-structured-evidence__table-wrap"><table className="go-structured-evidence__table"><thead><tr><th>Producto</th><th>Stock de sistema</th><th>Conteo físico</th><th>Diferencia</th></tr></thead><tbody>{rows.map((row, rowIndex) => {
          const difference = valueFrom(row, 'difference', 'variance')
          const numericDifference = Number(difference)
          const product = typeof row?.product === 'object' ? valueFrom(row.product, 'name', 'label', 'code') : valueFrom(row, 'product', 'product_name', 'name')
          const systemStock = valueFrom(row, 'stock', 'system_stock', 'expected_stock')
          return <tr key={row?.id ?? rowIndex}><td title={display(product)}>{display(product)}</td><td className="go-structured-evidence__number">{systemStock === undefined ? 'No informado' : display(systemStock)}</td><td className="go-structured-evidence__number">{display(valueFrom(row, 'physical_stock', 'counted_stock'))}</td><td className={`go-structured-evidence__number ${Number.isFinite(numericDifference) && numericDifference !== 0 ? `go-structured-evidence__difference--${numericDifference > 0 ? 'positive' : 'negative'}` : 'go-structured-evidence__difference--match'}`}>{display(difference)}</td></tr>
        })}</tbody></table></div></> : <p className="go-structured-evidence__empty">Esta revisión no tiene líneas de inventario disponibles.</p>}
        {(revision?.comment || revision?.correction_reason) && <section className="go-structured-evidence__notes">{revision?.comment && <div><h3>Comentario de GA</h3><p>{revision.comment}</p></div>}{revision?.correction_reason && <div><h3>Motivo de corrección</h3><p>{revision.correction_reason}</p></div>}</section>}
      </section>
    })}
  </div>
}

const metricLabels = [
  ['total_sales', 'Ventas totales'], ['cash_sales', 'Ventas en efectivo'], ['card_sales', 'Ventas con tarjeta'],
  ['deposited_amount', 'Monto reportado'], ['outstanding_amount', 'Monto pendiente'], ['sales_discrepancy_amount', 'Diferencia de ventas'],
]

function decisionLabel(value) {
  return ({ conforme: 'Conforme', approved: 'Conforme', pendiente: 'Pendiente', pending: 'Pendiente', observado: 'Con observaciones', con_observacion: 'Con observaciones', con_observaciones: 'Con observaciones', rejected: 'Con observaciones' })[value] ?? display(value)
}

function decisionTone(value) {
  return ['observado', 'con_observacion', 'con_observaciones', 'rejected'].includes(value) ? 'attention' : ''
}

function metricNeedsAttention(key, value) {
  return ['outstanding_amount', 'sales_discrepancy_amount'].includes(key) && Number(value) !== 0
}

function DepositTimeline({ closure, receipts }) {
  const orderedReceipts = [...receipts].sort((left, right) => String(valueFrom(left, 'deposited_at', 'deposited_on') ?? '').localeCompare(String(valueFrom(right, 'deposited_at', 'deposited_on') ?? '')))
  return <section className="go-structured-evidence__timeline-section" aria-label="Línea de depósitos"><h3>Línea de depósitos</h3><ol className="go-structured-evidence__timeline"><li><time>{date(valueFrom(closure, 'closure_date', 'date'))}</time><div><span>Cierre de ventas</span><strong>{money(closure?.cash_sales)}</strong><p>Venta en efectivo registrada al cierre.</p></div></li>{orderedReceipts.map((receipt, receiptIndex) => {
    const receiptAmount = valueFrom(receipt, 'amount', 'deposited_amount')
    const depositedOn = valueFrom(receipt, 'deposited_at', 'deposited_on')
    return <li key={receipt?.id ?? receipt?.reference ?? receiptIndex}><time>{date(depositedOn)}</time><div><span>Depósito registrado</span><strong>{money(receiptAmount)}</strong><p>Comprobante {display(valueFrom(receipt, 'reference', 'number'))}</p></div></li>
  })}</ol>{!orderedReceipts.length && <p className="go-structured-evidence__empty">No hay comprobantes disponibles.</p>}</section>
}

function DepositCase({ item, index }) {
  const closure = item?.closure ?? item ?? {}
  const receipts = Array.isArray(closure?.receipts) ? closure.receipts : []
  const reconciliation = closure?.reconciliation ?? {}
  const hasReconciliationDetail = Boolean(reconciliation?.ga_comment || closure?.sales_discrepancy_reason || closure?.no_deposit_reason)
  return <article className="go-structured-evidence__panel">
    <header className="go-structured-evidence__panel-header"><div><h2>{display(valueFrom(item, 'branch_name', 'name') ?? `Sucursal ${index + 1}`)}</h2><p>{display(valueFrom(item, 'branch_code', 'code'))} · Cierre {date(valueFrom(closure, 'closure_date', 'date'))}</p></div>{reconciliation?.decision && <span className={`go-structured-evidence__status ${decisionTone(reconciliation.decision) ? `go-structured-evidence__status--${decisionTone(reconciliation.decision)}` : ''}`}>{decisionLabel(reconciliation.decision)}</span>}</header>
    <section aria-labelledby={`deposit-summary-${index}`}><h3 id={`deposit-summary-${index}`}>Resumen del cierre</h3><div className="go-structured-evidence__metrics">{metricLabels.map(([key, label]) => closure?.[key] !== null && closure?.[key] !== undefined && <div key={key} className={metricNeedsAttention(key, closure[key]) ? 'go-structured-evidence__metric--attention' : undefined}><span>{label}</span><strong>{money(closure[key])}</strong></div>)}</div></section>
    <div className={`go-structured-evidence__detail-grid ${hasReconciliationDetail ? '' : 'go-structured-evidence__detail-grid--single'}`}>
      <DepositTimeline closure={closure} receipts={receipts} />
      {hasReconciliationDetail && <section><h3>Conciliación</h3>{reconciliation?.ga_comment && <Aviso tipo={decisionTone(reconciliation.decision) ? 'warning' : 'info'}>Observación de GA: {reconciliation.ga_comment}</Aviso>}<dl className="go-structured-evidence__facts">{closure?.sales_discrepancy_reason && <div><dt>Motivo de diferencia</dt><dd>{closure.sales_discrepancy_reason}</dd></div>}{closure?.no_deposit_reason && <div><dt>Motivo sin depósito</dt><dd>{closure.no_deposit_reason}</dd></div>}</dl></section>}
    </div>
  </article>
}

function DepositEvidence({ detail }) {
  const receipts = Array.isArray(detail?.receipts) ? detail.receipts : []
  const decisions = Array.isArray(detail?.decisions) ? detail.decisions : []
  const cases = Array.isArray(detail?.closures) ? detail.closures.map((closure) => {
    const decision = decisions.find((item) => item?.branch_code === closure?.branch_code && item?.closure_date === closure?.closure_date)
    const branchName = typeof closure?.branch_name === 'string' ? closure.branch_name.trim() : ''
    return {
      branch_code: closure?.branch_code,
      branch_name: branchName || `Sucursal ${display(closure?.branch_code)}`,
      closure: { ...closure, receipts: receipts.filter((item) => item?.branch_code === closure?.branch_code), reconciliation: decision ? { decision: decision.decision, ga_comment: decision.comment } : null },
    }
  }) : []
  return <div className="go-structured-evidence__stack">{detail?.origin_date && <p className="go-structured-evidence__origin">Evidencia originada el <strong>{date(detail.origin_date)}</strong></p>}{cases.map((item, index) => <DepositCase item={item} index={index} key={item?.id ?? `${item?.branch_code ?? 'branch'}-${index}`} />)}</div>
}

function errorMessage(error) {
  if (error?.status === 403) return 'No tienes autorización para consultar esta evidencia.'
  if (error?.status === 404) return 'La evidencia solicitada ya no está disponible.'
  return 'No fue posible cargar la evidencia solicitada.'
}

export default function GOEvidencePage({ title, evidenceKey }) {
  const { reference } = useParams()
  const [evidence, setEvidence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setEvidence(await getGOEvidence(reference)) } catch (requestError) { setError(errorMessage(requestError)) } finally { setLoading(false) } }, [reference])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const detail = evidence?.[evidenceKey] ?? evidence
  const content = evidenceKey === 'inventory' ? <InventoryEvidence detail={detail} /> : <DepositEvidence detail={detail} />
  return <main className="tema-analiza tuvet-page go-structured-evidence"><PageHeader title={title} description="Consulta GO de solo lectura." /><EstadoCarga loading={loading} error={error} onRetry={load} empty={!loading && !error && !detail} emptyText="No hay evidencia disponible para esta referencia.">{!loading && !error && detail && <section className="go-structured-evidence__content" aria-label={title}>{content}</section>}</EstadoCarga></main>
}
