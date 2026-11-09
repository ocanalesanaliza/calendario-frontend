import { useEffect, useLayoutEffect, useState } from 'react'
import { Aviso, EstadoCarga, Field, FormSection, Modal } from '../../tuvet/components/TuvetUi'
import '../../tuvet/tuvet.css'
import { addDepositReceipt, allocateDepositReceipt, captureDepositClosure, declareNoDepositado, getDepositReport, openDepositReport, submitDepositReport } from '../services/depositService'
import './DepositDemo.css'
import './DepositDemoModal.css'

const formatAmount = (value) => `L ${new Intl.NumberFormat('es-HN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0))}`

const emptySales = { total_sales: '', cash_sales: '', card_sales: '', sales_discrepancy_reason: '' }
const emptyReceipt = { deposited_amount: '', reference: '', deposited_on: '' }
const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `deposit-${Date.now()}-${Math.random().toString(36).slice(2)}`

function salesDiscrepancy(values) {
  const amounts = [values.total_sales, values.cash_sales, values.card_sales]
  if (amounts.some((value) => !String(value ?? '').trim())) return null
  return Math.round((Number(values.total_sales) - Number(values.cash_sales) - Number(values.card_sales)) * 100) / 100
}

function reportFrom(response) {
  return response?.report ?? null
}
function messageFor(error) {
  if (error?.detail === 'deposit_api_disabled') return 'El registro de depósitos no está habilitado actualmente. No se realizó ningún cambio.'
  if (error?.status === 409) return 'El reporte cambió o ya no admite esta acción. Actualizamos la información para que puedas continuar.'
  const detail = String(error?.detail ?? '').toLowerCase()
  if (detail.includes('all presented closures require captured sales')) return 'Captura las ventas de todos los cierres presentados antes de declarar un cierre como no depositado o asignar comprobantes.'
  if (detail.includes('no_depositado_reason') || (detail.includes('reason') && (detail.includes('blank') || detail.includes('required')))) return 'Escribe un motivo para declarar el cierre como no depositado.'
  if (detail.includes('submitted') || detail.includes('draft-only') || detail.includes('draft only') || detail.includes('only draft')) return 'Este reporte ya fue enviado y no admite más cambios.'
  return 'No se pudo completar la acción. Revisa los datos e inténtalo de nuevo.'
}

const hasReportedAmount = (value) => value !== null && value !== undefined
const formatReportedAmount = (value) => hasReportedAmount(value) ? formatAmount(value) : 'No disponible'

function isValidReadiness(readiness) {
  return Boolean(readiness) && typeof readiness === 'object' && typeof readiness.ready_to_submit === 'boolean' && Array.isArray(readiness.blockers) && readiness.blockers.every((blocker) => blocker && typeof blocker.code === 'string')
}

function readinessMessage(blocker) {
  if (blocker?.code === 'closure_sales_missing') return `Captura las ventas del cierre ${blocker.closure_date}.`
  if (blocker?.code === 'closure_resolution_missing') return `Asigna un comprobante o declara que no hubo depósito para el cierre ${blocker.closure_date}.`
  if (blocker?.code === 'report_receipt_missing') return 'Agrega al menos un comprobante para poder enviar el reporte.'
  if (blocker?.code === 'receipt_unallocated_amount') {
    if (!blocker.reference && !hasReportedAmount(blocker.unallocated_amount)) return 'Asigna el monto disponible del comprobante antes de enviar el reporte.'
    const receipt = blocker.reference ? `Comprobante ${blocker.reference}: ` : 'Comprobante: '
    const amount = hasReportedAmount(blocker.unallocated_amount) ? `monto disponible ${formatReportedAmount(blocker.unallocated_amount)}. ` : ''
    return `${receipt}${amount}Asigna el monto restante antes de enviar.`
  }
  return 'El reporte tiene una validación pendiente. Actualiza e inténtalo nuevamente.'
}

function closurePreparation(closure, blockers, readinessValid) {
  if (!readinessValid) return { status: 'Preparación pendiente de actualizar.', resolved: false }
  if (blockers.some((item) => item.code === 'receipt_unallocated_amount')) return { status: 'Pendiente: hay un comprobante con monto disponible sin asignar.', resolved: false }
  const blocker = blockers.find((item) => String(item.closure_entry_id) === String(closure.id))
  if (blocker?.code === 'closure_sales_missing') return { status: 'Pendiente de capturar ventas.', resolved: false }
  if (blocker) return { status: 'Ventas capturadas; pendiente de resolver depósito.', resolved: false }
  if (closure.no_depositado_reason) return { status: 'Declarado como no depositado.', resolved: true }
  return { status: 'Resuelto según validación del reporte.', resolved: true }
}

function allocationForTarget(allocation, value) {
  const next = { ...(allocation ?? {}) }
  delete next.closure_entry_id
  delete next.historical_closure_id
  return value.startsWith('historical:')
    ? { ...next, historical_closure_id: value.slice('historical:'.length) }
    : { ...next, closure_entry_id: value }
}

function ConfirmationModal({ title, children, confirmLabel, onConfirm, onCancel, saving }) {
  return <Modal title={title} icon="archivo" className="tema-analiza deposit-confirmation" onClose={onCancel} footer={<><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button><button type="button" className="tuvet-btn" onClick={onConfirm} disabled={saving}>{saving ? 'Guardando…' : confirmLabel}</button></>}>
    <div className="deposit-confirmation-content">{children}</div>
  </Modal>
}

export function DepositDemoModal({ tarea, fecha, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [sales, setSales] = useState({})
  const [receipt, setReceipt] = useState(emptyReceipt)
  const [allocations, setAllocations] = useState({})
  const [reasons, setReasons] = useState({})
  const [declarationsOpen, setDeclarationsOpen] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [focusTarget, setFocusTarget] = useState('')
  const [focusAttempt, setFocusAttempt] = useState(0)
  const [confirmation, setConfirmation] = useState(null)
  const historicalClosures = report?.historical_pending_closures ?? []
  const selectableHistoricalClosures = historicalClosures.filter((closure) => Number(closure.outstanding_amount) > 0)

  useLayoutEffect(() => {
    if (focusTarget) document.querySelector(`[name="${focusTarget}"]`)?.focus()
  }, [focusAttempt, focusTarget])

  function clearFieldError(name) {
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function validateRequired(fields) {
    const invalid = fields.filter(({ value }) => !String(value ?? '').trim())
    const names = fields.map(({ name }) => name)
    setFieldErrors((current) => {
      const next = { ...current }
      names.forEach((name) => delete next[name])
      invalid.forEach(({ name, message }) => { next[name] = message })
      return next
    })
    if (invalid.length) {
      setFocusTarget(invalid[0].name)
      setFocusAttempt((current) => current + 1)
      return false
    }
    return true
  }

  async function recoverReport() {
    setLoading(true)
    setError('')
    try {
      const data = report?.id
        ? await getDepositReport(report.id)
        : await openDepositReport({ sucursal_tarea_id: tarea.id_sucursal_tarea })
      setReport(reportFrom(data))
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(async () => {
      try {
        const data = await openDepositReport({ sucursal_tarea_id: tarea.id_sucursal_tarea })
        if (!cancelled) setReport(reportFrom(data))
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [tarea.id_sucursal_tarea])

  async function mutate(action, operation) {
    if (!report) return
    setSaving(action)
    setError('')
    try {
      const data = await operation()
      setReport(reportFrom(data))
    } catch (requestError) {
      setError(messageFor(requestError))
      if (requestError?.status === 409 && requestError?.detail !== 'deposit_api_disabled') {
        try {
          const refreshed = await getDepositReport(report.id)
          setReport(reportFrom(refreshed))
        } catch {
          // The original error remains visible and the retry control stays available.
        }
      }
    } finally {
      setSaving('')
    }
  }

  function updateSales(entryId, field, value) {
    setSales((current) => ({ ...current, [entryId]: { ...(current[entryId] ?? emptySales), [field]: value } }))
    if (String(value).trim()) clearFieldError(`${field.replaceAll('_', '-')}-${entryId}`)
  }

  function submitSales(event, closure) {
    event.preventDefault()
    const values = sales[closure.id] ?? emptySales
    const discrepancy = salesDiscrepancy(values)
    if (!validateRequired([
      { name: `total-sales-${closure.id}`, value: values.total_sales, message: 'Ingresa las ventas totales.' },
      { name: `cash-sales-${closure.id}`, value: values.cash_sales, message: 'Ingresa las ventas en efectivo.' },
      { name: `card-sales-${closure.id}`, value: values.card_sales, message: 'Ingresa las ventas con tarjeta.' },
      ...(discrepancy ? [{ name: `sales-discrepancy-reason-${closure.id}`, value: values.sales_discrepancy_reason, message: 'Explica el descuadre de ventas.' }] : []),
    ])) return
    setConfirmation({ type: 'capture', closure, values: { ...values, sales_discrepancy_reason: discrepancy ? values.sales_discrepancy_reason.trim() : '' }, discrepancy })
  }

  function submitReceipt(event) {
    event.preventDefault()
    if (!validateRequired([
      { name: 'deposited-amount', value: receipt.deposited_amount, message: 'Ingresa el monto depositado.' },
      { name: 'deposit-reference', value: receipt.reference, message: 'Ingresa la referencia del depósito.' },
      { name: 'deposited-on', value: receipt.deposited_on, message: 'Selecciona la fecha de depósito.' },
    ])) return
    void mutate('receipt', async () => {
      const data = await addDepositReceipt(report.id, { ...receipt, expected_version: report.optimistic_version, idempotency_key: newIdempotencyKey() })
      setReceipt(emptyReceipt)
      return data
    })
  }

  function submitAllocation(event, receiptItem) {
    event.preventDefault()
    const values = allocations[receiptItem.id] ?? {}
    if (!validateRequired([
      { name: `closure-${receiptItem.id}`, value: values.closure_entry_id ?? values.historical_closure_id, message: 'Selecciona un cierre capturado.' },
      { name: `allocated-${receiptItem.id}`, value: values.allocated_amount, message: 'Ingresa el monto asignado.' },
    ])) return
    const closure = values.historical_closure_id
      ? historicalClosures.find((item) => item.id === values.historical_closure_id)
      : (report.closures ?? []).find((item) => String(item.id) === String(values.closure_entry_id))
    setConfirmation({ type: 'allocation', receipt: receiptItem, closure, values: { ...values } })
  }

  function submitNoDepositado(event, closure) {
    event.preventDefault()
    const reason = reasons[closure.id]?.trim()
    if (!validateRequired([{ name: `no-deposit-reason-${closure.id}`, value: reason, message: 'Explica el motivo de no depositado.' }])) return
    void mutate(`no-deposit-${closure.id}`, () => declareNoDepositado(report.id, closure.id, {
      reason,
      expected_version: report.optimistic_version,
      idempotency_key: newIdempotencyKey(),
    }))
  }

  const allSalesCaptured = (report?.closures ?? []).every((closure) => closure.sales_captured === true)
  const readinessValid = isValidReadiness(report?.readiness)
  const readinessBlockers = readinessValid ? report.readiness.blockers : [{ code: 'readiness_invalid' }]
  const hasFinancialBlocker = readinessBlockers.some((blocker) => blocker.code === 'receipt_unallocated_amount')
  const blockerClosureIds = new Set(readinessBlockers.filter((blocker) => blocker.closure_entry_id !== null && blocker.closure_entry_id !== undefined).map((blocker) => String(blocker.closure_entry_id)))
  const resolvedClosures = readinessValid ? (report?.closures ?? []).filter((closure) => !blockerClosureIds.has(String(closure.id))) : []
  const readyForReview = Boolean(report) && readinessValid && report.readiness.ready_to_submit === true && readinessBlockers.length === 0

  function confirmAction() {
    if (!confirmation) return
    if (confirmation.type === 'capture') {
      const { closure, values } = confirmation
      setConfirmation(null)
      void mutate(`capture-${closure.id}`, () => captureDepositClosure(report.id, closure.id, { ...values, expected_version: report.optimistic_version, idempotency_key: newIdempotencyKey() }))
      return
    }
    if (confirmation.type === 'allocation') {
      const { receipt: receiptItem, values } = confirmation
      setConfirmation(null)
      const target = values.historical_closure_id
        ? { historical_closure_id: values.historical_closure_id }
        : { closure_entry_id: Number(values.closure_entry_id) }
      void mutate(`allocation-${receiptItem.id}`, () => allocateDepositReceipt(report.id, receiptItem.id, { ...target, allocated_amount: values.allocated_amount, expected_version: report.optimistic_version, idempotency_key: newIdempotencyKey() }))
      return
    }
    setConfirmation(null)
    void mutate('submit', () => submitDepositReport(report.id, { expected_version: report.optimistic_version, idempotency_key: newIdempotencyKey() }))
  }

  const footer = <><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={Boolean(saving)}>Cerrar</button>{report?.state !== 'submitted' && <button type="button" className="tuvet-btn" onClick={(event) => { event.currentTarget.focus(); if (readyForReview) setConfirmation({ type: 'submit' }) }} disabled={!readyForReview || Boolean(saving)} aria-describedby={!readyForReview ? 'deposit-submit-blockers' : undefined} aria-busy={saving === 'submit'}>{saving === 'submit' ? 'Enviando reporte…' : 'Revisar y enviar reporte'}</button>}</>

  return <Modal title="Registrar depósito" subtitle={tarea.tarea?.nombre} icon="archivo" wide className="tema-analiza" onClose={onClose} footer={footer}>
    <div className="deposit-flow">
      <div className="deposit-flow-context" aria-label="Datos de la tarea">
        <span>Fecha: <strong>{fecha || 'No disponible'}</strong></span>
      </div>
      <EstadoCarga loading={loading} error={error && !report ? error : ''} onRetry={recoverReport} empty={!loading && !error && report && report.closures?.length === 0} emptyText="El reporte no contiene cierres proporcionados por el servidor.">
        {error && report && <Aviso tipo="error">{error} <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={recoverReport} disabled={Boolean(saving)}>Actualizar reporte</button></Aviso>}
        {report?.state === 'submitted' ? <Aviso tipo="success">El reporte fue enviado correctamente.</Aviso> : <>
          <section className="deposit-readiness" aria-labelledby="deposit-readiness-title" aria-live="polite">
            <h3 id="deposit-readiness-title">Preparación del reporte</h3>
            <div className="deposit-readiness-metrics"><span>Cierres presentados: {(report?.closures ?? []).length}</span><span>Ventas capturadas: {(report?.closures ?? []).filter((closure) => closure.sales_captured).length}</span>{!hasFinancialBlocker && <span>Cierres resueltos: {resolvedClosures.length}</span>}<span>Cierres pendientes: {hasFinancialBlocker ? 'Revisión requerida' : blockerClosureIds.size}</span></div>
            <p className={`deposit-readiness-state ${readyForReview ? 'is-ready' : ''}`} role="status">{readyForReview ? 'Listo para revisión' : 'Faltan acciones para enviar'}</p>
            {!readyForReview && <ul id="deposit-submit-blockers" className="deposit-readiness-blockers">{readinessBlockers.map((blocker, index) => <li key={`${blocker.code}-${blocker.closure_entry_id ?? index}`}>{readinessMessage(blocker)}</li>)}</ul>}
          </section>
          <FormSection title="Cierres" description="Registra solo los cierres proporcionados por el reporte.">
            {!allSalesCaptured && <p className="deposit-flow-notice" role="status">Captura las ventas de todos los cierres presentados antes de declarar un cierre como no depositado.</p>}
            <div className="deposit-flow-list">
              {(report?.closures ?? []).map((closure) => {
                const preparation = closurePreparation(closure, readinessBlockers, readinessValid)
                return <article className="deposit-flow-card" key={closure.id}>
                <h3>Cierre del {closure.closure_date}</h3>
                <p className={`deposit-closure-status ${preparation.resolved ? 'is-resolved' : ''}`} role="status">{preparation.status}</p>
                {closure.sales_captured && <><p role="status">Ventas capturadas: {formatReportedAmount(closure.total_sales)}. Efectivo: {formatReportedAmount(closure.cash_sales)}. Tarjeta: {formatReportedAmount(closure.card_sales)}.</p><div className="deposit-financial-context"><p>Ventas en efectivo: {formatReportedAmount(closure.cash_sales)}</p>{hasReportedAmount(closure.deposited_amount) && <p>Monto aplicado/depositado: {formatReportedAmount(closure.deposited_amount)}</p>}{hasReportedAmount(closure.outstanding_amount) && <p>Diferencia pendiente de depósito: {formatReportedAmount(closure.outstanding_amount)}</p>}{hasReportedAmount(closure.sales_discrepancy_amount) && <p>Descuadre de ventas: {formatReportedAmount(closure.sales_discrepancy_amount)}</p>}</div>{closure.sales_discrepancy_reason && <p role="status">Explicación del descuadre: {closure.sales_discrepancy_reason}</p>}</>}
                {closure.no_depositado_reason ? <p role="status">No depositado: {closure.no_depositado_reason}</p> : <>
                  {!closure.sales_captured &&
                  (() => {
                    const values = sales[closure.id] ?? emptySales
                    const discrepancy = salesDiscrepancy(values)
                    return <form onSubmit={(event) => submitSales(event, closure)} className="deposit-flow-form" noValidate>
                      <Field label="Ventas totales" required error={fieldErrors[`total-sales-${closure.id}`]}><input name={`total-sales-${closure.id}`} type="number" min="0" step="0.01" inputMode="decimal" value={values.total_sales} onChange={(event) => updateSales(closure.id, 'total_sales', event.target.value)} /></Field>
                      <Field label="Ventas con tarjeta" required error={fieldErrors[`card-sales-${closure.id}`]}><input name={`card-sales-${closure.id}`} type="number" min="0" step="0.01" inputMode="decimal" value={values.card_sales} onChange={(event) => updateSales(closure.id, 'card_sales', event.target.value)} /></Field>
                      <Field label="Ventas en efectivo" required error={fieldErrors[`cash-sales-${closure.id}`]}><input name={`cash-sales-${closure.id}`} type="number" min="0" step="0.01" inputMode="decimal" value={values.cash_sales} onChange={(event) => updateSales(closure.id, 'cash_sales', event.target.value)} /></Field>
                      {discrepancy ? <><Aviso tipo="warning">{`Descuadre de ventas: ${formatAmount(discrepancy)}. Las ventas totales no coinciden con efectivo más tarjeta.`}</Aviso><Field label="Explicación del descuadre" required error={fieldErrors[`sales-discrepancy-reason-${closure.id}`]}><input name={`sales-discrepancy-reason-${closure.id}`} type="text" value={values.sales_discrepancy_reason} onChange={(event) => updateSales(closure.id, 'sales_discrepancy_reason', event.target.value)} /></Field></> : null}
                      <button type="submit" className="tuvet-btn" onClick={(event) => event.currentTarget.focus()} disabled={Boolean(saving)} aria-busy={saving === `capture-${closure.id}`}>{saving === `capture-${closure.id}` ? 'Guardando ventas…' : 'Capturar ventas'}</button>
                    </form>
                  })()}
                  {declarationsOpen[closure.id] ? <form onSubmit={(event) => submitNoDepositado(event, closure)} className="deposit-flow-inline" noValidate>
                    <Field label="Motivo de no depositado" required error={fieldErrors[`no-deposit-reason-${closure.id}`]}><input name={`no-deposit-reason-${closure.id}`} type="text" value={reasons[closure.id] ?? ''} onChange={(event) => { setReasons((current) => ({ ...current, [closure.id]: event.target.value })); if (event.target.value.trim()) clearFieldError(`no-deposit-reason-${closure.id}`) }} /></Field>
                    <button type="submit" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(saving)} aria-busy={saving === `no-deposit-${closure.id}`}>{saving === `no-deposit-${closure.id}` ? 'Guardando declaración…' : 'Guardar declaración'}</button>
                  </form> : <button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={!allSalesCaptured || Boolean(saving)} onClick={() => setDeclarationsOpen((current) => ({ ...current, [closure.id]: true }))}>Declarar no depositado</button>}
                </>}
              </article>})}
            </div>
          </FormSection>
          {historicalClosures.length > 0 && <section className="deposit-historical-reconciliation" aria-labelledby="deposit-historical-reconciliation-title">
            <h3 id="deposit-historical-reconciliation-title">Conciliación de cierres pendientes</h3>
            <div className="deposit-flow-list">{historicalClosures.map((closure) => <article className="deposit-flow-card" key={closure.id}><h3>Cierre del {closure.closure_date}</h3><div className="deposit-pending-closure-metrics" data-testid="pending-closure-metrics" data-responsive-breakpoints="375 768 1024 1440"><div className="deposit-pending-closure-metric"><span>Efectivo del cierre</span><strong>{formatReportedAmount(closure.cash_sales)}</strong></div><div className="deposit-pending-closure-metric"><span>Monto ya aplicado</span><strong>{formatReportedAmount(closure.deposited_amount)}</strong></div><div className="deposit-pending-closure-metric"><span>Pendiente por aplicar</span><strong>{formatReportedAmount(closure.outstanding_amount)}</strong></div></div></article>)}</div>
          </section>}
          <FormSection title="Comprobantes" description="Agrega el comprobante y después asígnalo a un cierre capturado.">
            <form onSubmit={submitReceipt} className="deposit-flow-form" noValidate>
              <Field label="Monto depositado" required error={fieldErrors['deposited-amount']}><input name="deposited-amount" type="number" min="0" step="0.01" inputMode="decimal" value={receipt.deposited_amount} onChange={(event) => { setReceipt((current) => ({ ...current, deposited_amount: event.target.value })); if (event.target.value.trim()) clearFieldError('deposited-amount') }} /></Field>
              <Field label="Referencia" required error={fieldErrors['deposit-reference']}><input name="deposit-reference" type="text" value={receipt.reference} onChange={(event) => { setReceipt((current) => ({ ...current, reference: event.target.value })); if (event.target.value.trim()) clearFieldError('deposit-reference') }} /></Field>
              <Field label="Fecha de depósito" required error={fieldErrors['deposited-on']}><input name="deposited-on" type="date" value={receipt.deposited_on} onChange={(event) => { setReceipt((current) => ({ ...current, deposited_on: event.target.value })); if (event.target.value.trim()) clearFieldError('deposited-on') }} /></Field>
              <button type="submit" className="tuvet-btn" disabled={Boolean(saving)} aria-busy={saving === 'receipt'}>{saving === 'receipt' ? 'Agregando comprobante…' : 'Agregar comprobante'}</button>
            </form>
            {(report?.receipts ?? []).map((receiptItem) => <article className="deposit-flow-card" key={receiptItem.id}><h3>Comprobante {receiptItem.reference}</h3><p>{formatReportedAmount(receiptItem.deposited_amount)} · {receiptItem.deposited_on}</p><div className="deposit-financial-context"><p>Monto depositado: {formatReportedAmount(receiptItem.deposited_amount)}</p>{hasReportedAmount(receiptItem.allocated_amount) && <p>Monto asignado: {formatReportedAmount(receiptItem.allocated_amount)}</p>}{hasReportedAmount(receiptItem.unallocated_amount) && <p>Monto disponible: {formatReportedAmount(receiptItem.unallocated_amount)}</p>}</div>{(receiptItem.allocations ?? []).map((allocation, index) => { const closure = allocation.historical_closure_id ? historicalClosures.find((item) => item.id === allocation.historical_closure_id) : (report?.closures ?? []).find((item) => String(item.id) === String(allocation.closure_entry_id)); return <p key={allocation.id ?? `${allocation.historical_closure_id ?? allocation.closure_entry_id}-${index}`}>Asignado al cierre {closure?.closure_date ?? 'no disponible'}: {formatReportedAmount(allocation.allocated_amount)}</p> })}
              <form onSubmit={(event) => submitAllocation(event, receiptItem)} className="deposit-flow-inline" noValidate>
                <Field label="Cierre capturado" required error={fieldErrors[`closure-${receiptItem.id}`]}><select name={`closure-${receiptItem.id}`} value={(allocations[receiptItem.id] ?? {}).historical_closure_id ? `historical:${(allocations[receiptItem.id] ?? {}).historical_closure_id}` : (allocations[receiptItem.id] ?? {}).closure_entry_id ?? ''} onChange={(event) => { const value = event.target.value; setAllocations((current) => ({ ...current, [receiptItem.id]: allocationForTarget(current[receiptItem.id], value) })); if (value) clearFieldError(`closure-${receiptItem.id}`) }}><option value="">Selecciona un cierre</option><optgroup label="Cierres actuales">{(report?.closures ?? []).filter((closure) => closure.sales_captured).map((closure) => <option value={closure.id} key={closure.id}>{closure.closure_date}</option>)}</optgroup>{selectableHistoricalClosures.length > 0 && <optgroup label="Cierres pendientes históricos">{selectableHistoricalClosures.map((closure) => <option value={`historical:${closure.id}`} key={closure.id}>{closure.closure_date}</option>)}</optgroup>}</select></Field>
                <Field label="Monto asignado" required error={fieldErrors[`allocated-${receiptItem.id}`]}><input name={`allocated-${receiptItem.id}`} type="number" min="0" step="0.01" inputMode="decimal" value={(allocations[receiptItem.id] ?? {}).allocated_amount ?? ''} onChange={(event) => { setAllocations((current) => ({ ...current, [receiptItem.id]: { ...(current[receiptItem.id] ?? {}), allocated_amount: event.target.value } })); if (event.target.value.trim()) clearFieldError(`allocated-${receiptItem.id}`) }} /></Field>
                <button type="submit" className="tuvet-btn tuvet-btn-secondary" onClick={(event) => event.currentTarget.focus()} disabled={Boolean(saving)} aria-busy={saving === `allocation-${receiptItem.id}`}>Asignar comprobante</button>
              </form>
            </article>)}
          </FormSection>
        </>}
      </EstadoCarga>
    </div>
    {confirmation?.type === 'capture' && <ConfirmationModal title="Confirmar captura de ventas" confirmLabel="Confirmar captura" onCancel={() => setConfirmation(null)} onConfirm={confirmAction} saving={Boolean(saving)}><p>Cierre: <strong>{confirmation.closure.closure_date}</strong></p><p>Ventas totales: <strong>{formatAmount(confirmation.values.total_sales)}</strong></p><p>Efectivo: <strong>{formatAmount(confirmation.values.cash_sales)}</strong></p><p>Tarjeta: <strong>{formatAmount(confirmation.values.card_sales)}</strong></p>{confirmation.discrepancy ? <p>Descuadre: <strong>{formatAmount(confirmation.discrepancy)}</strong>. Explicación: {confirmation.values.sales_discrepancy_reason}</p> : null}<Aviso tipo="warning">Después de guardar, esta captura no podrá modificarse.</Aviso></ConfirmationModal>}
    {confirmation?.type === 'allocation' && <ConfirmationModal title="Confirmar asignación" confirmLabel="Confirmar asignación" onCancel={() => setConfirmation(null)} onConfirm={confirmAction} saving={Boolean(saving)}><p>Referencia: <strong>{confirmation.receipt.reference}</strong></p><p>Fecha: <strong>{confirmation.receipt.deposited_on}</strong></p><p>Monto disponible del comprobante: {formatReportedAmount(confirmation.receipt.unallocated_amount)}</p><p>Pendiente del cierre seleccionado: {formatReportedAmount(confirmation.closure?.outstanding_amount)}</p><p>Monto a asignar: {formatAmount(confirmation.values.allocated_amount)}</p><p>Cierre destino: <strong>{confirmation.closure?.closure_date}</strong></p><Aviso tipo="warning">Esta asignación no podrá modificarse.</Aviso></ConfirmationModal>}
    {confirmation?.type === 'submit' && <ConfirmationModal title="Revisar y enviar reporte" confirmLabel="Enviar reporte completo" onCancel={() => setConfirmation(null)} onConfirm={confirmAction} saving={Boolean(saving)}><header className="deposit-final-review-status"><h3>Listo para enviar</h3><p>Todos los comprobantes registrados fueron asignados.</p></header><section className="deposit-final-review-section" aria-labelledby="deposit-final-closures"><h3 id="deposit-final-closures">Cierres</h3><div className="deposit-final-review-cards">{(report?.closures ?? []).map((closure) => <article className="deposit-final-review-card" aria-label={`Cierre del ${closure.closure_date}`} key={closure.id}><h4>Cierre del {closure.closure_date}</h4><dl><div><dt>Monto aplicado/depositado</dt><dd>{formatReportedAmount(closure.deposited_amount)}</dd></div><div><dt>Diferencia pendiente de depósito</dt><dd>{formatReportedAmount(closure.outstanding_amount)}</dd></div></dl>{closure.no_depositado_reason && <p><strong>No depositado:</strong> {closure.no_depositado_reason}</p>}</article>)}</div></section><section className="deposit-final-review-section" aria-labelledby="deposit-final-receipts"><h3 id="deposit-final-receipts">Comprobantes</h3><div className="deposit-final-review-cards">{(report?.receipts ?? []).map((receiptItem) => <article className="deposit-final-review-card" aria-label={`Comprobante ${receiptItem.reference}`} key={receiptItem.id}><h4>Comprobante {receiptItem.reference}</h4><p>Fecha: {receiptItem.deposited_on ?? 'No disponible'}</p><dl><div><dt>Monto depositado</dt><dd>{formatReportedAmount(receiptItem.deposited_amount)}</dd></div><div><dt>Monto asignado</dt><dd>{formatReportedAmount(receiptItem.allocated_amount)}</dd></div><div><dt>Monto disponible</dt><dd>{formatReportedAmount(receiptItem.unallocated_amount)}</dd></div></dl></article>)}</div></section><Aviso tipo="warning">El envío del reporte es definitivo.</Aviso></ConfirmationModal>}
  </Modal>
}
