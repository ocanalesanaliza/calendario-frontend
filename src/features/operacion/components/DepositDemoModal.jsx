import { useState } from 'react'
import './DepositDemo.css'

const formatAmount = (value) => `L ${new Intl.NumberFormat('es-HN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0))}`

export function DepositDemoModal({ tarea, fecha, sucursal, onClose }) {
  const [form, setForm] = useState({ totalSales: '', cashSales: '', depositedCash: '', reference: '', depositedAt: '', attachment: null })
  const [submitted, setSubmitted] = useState(false)
  const totalSales = Number(form.totalSales)
  const cashSales = Number(form.cashSales)
  const invalidCashSales = form.cashSales !== '' && form.totalSales !== '' && cashSales > totalSales
  const requiredComplete = ['totalSales', 'cashSales', 'depositedCash', 'reference', 'depositedAt'].every((field) => form[field] !== '')

  function updateField(event) {
    const { name, value, files } = event.target
    setForm((current) => ({ ...current, [name]: files ? files[0] ?? null : value }))
    setSubmitted(false)
  }

  function submit(event) {
    event.preventDefault()
    if (!requiredComplete || invalidCashSales) return
    setSubmitted(true)
  }

  return (
    <div className="deposit-demo-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="deposit-demo-modal" role="dialog" aria-modal="true" aria-labelledby="deposit-demo-title">
        <header>
          <div>

            <h2 id="deposit-demo-title">Registrar depósito</h2>
          </div>
          <button type="button" className="deposit-demo-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>

        <div className="deposit-demo-context" aria-label="Datos de la tarea">
          <div><span>Tarea</span><strong>{tarea.tarea?.nombre}</strong></div>
          <div><span>Sucursal</span><strong>{sucursal}</strong></div>
          <div><span>Fecha de conciliación</span><strong>{fecha}</strong></div>
          <div><span>Límite</span><strong>{tarea.hora_fin_registro || 'Pendiente de confirmar'}</strong></div>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="deposit-demo-grid">
            <label htmlFor="total-sales">Ventas totales</label>
            <input id="total-sales" name="totalSales" type="number" min="0" step="0.01" inputMode="decimal" value={form.totalSales} onChange={updateField} required />
            <label htmlFor="cash-sales">Ventas en efectivo</label>
            <div>
              <input id="cash-sales" name="cashSales" type="number" min="0" step="0.01" inputMode="decimal" value={form.cashSales} onChange={updateField} aria-describedby={invalidCashSales ? 'cash-sales-error' : undefined} aria-invalid={invalidCashSales} required />
              {invalidCashSales && <span id="cash-sales-error" className="deposit-demo-error" role="alert">Las ventas en efectivo no pueden superar las ventas totales.</span>}
            </div>
            <label htmlFor="deposited-cash">Efectivo depositado</label>
            <input id="deposited-cash" name="depositedCash" type="number" min="0" step="0.01" inputMode="decimal" value={form.depositedCash} onChange={updateField} required />
            <label htmlFor="deposit-reference">Referencia</label>
            <input id="deposit-reference" name="reference" type="text" value={form.reference} onChange={updateField} required />
            <label htmlFor="deposited-at">Fecha real de depósito</label>
            <input id="deposited-at" name="depositedAt" type="date" value={form.depositedAt} onChange={updateField} required />
            <label htmlFor="deposit-attachment">Adjunto (opcional)</label>
            <input id="deposit-attachment" name="attachment" type="file" accept="image/*,application/pdf" onChange={updateField} />
          </div>

          <div className="deposit-demo-summary" aria-live="polite">
            Diferencia estimada: <strong>{formatAmount(totalSales - Number(form.depositedCash || 0))}</strong>
          </div>
          {submitted && <p className="deposit-demo-success" role="alert">El depósito se envió para revisión a su gerente de área.</p>}
          <footer>
            <button type="button" className="deposit-demo-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="deposit-demo-primary" disabled={!requiredComplete || invalidCashSales}>Enviar para revisión</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

const pendingDeposits = [
  {
    branch: 'Sucursal Tres Caminos',
    reconciliationDate: '2026-09-05',
    deadline: '18:00',
    manager: 'María González',
    totalSales: 12500,
    cashSales: 7800,
    depositedCash: 7600,
    reference: 'DEP-20260905-001',
  },
  {
    branch: 'Sucursal Morazán',
    reconciliationDate: '2026-09-05',
    deadline: '18:30',
    manager: 'Carlos Hernández',
    totalSales: 9800,
    cashSales: 6150,
    depositedCash: 6150,
    reference: 'DEP-20260905-002',
  },
]

export function DepositReviewDemo() {
  const [selectedDeposit, setSelectedDeposit] = useState(null)
  const [correction, setCorrection] = useState(false)
  const [comment, setComment] = useState('')
  const [feedback, setFeedback] = useState('')
  const difference = selectedDeposit ? selectedDeposit.cashSales - selectedDeposit.depositedCash : 0

  function openReview(deposit) {
    setSelectedDeposit(deposit)
    setCorrection(false)
    setComment('')
    setFeedback('')
  }

  function closeReview() {
    setSelectedDeposit(null)
  }

  function requestCorrection() {
    if (!comment.trim()) return
    setFeedback('La solicitud de corrección fue enviada al gerente de sucursal.')
  }

  return (
    <div className="deposit-review-page">
      <div className="page-header">
        <div><h1>Mis tareas</h1><p>Revisión demostrativa de depósitos pendientes del día.</p></div>
      </div>
      {pendingDeposits.map((deposit, index) => (
        <div key={deposit.reference} className="deposit-review-card">
          <div><span className="badge badge-yellow">Pendiente de revisión</span><h2>Revisión de depósito de sucursal</h2><p>{deposit.branch} · {deposit.reconciliationDate} · Límite {deposit.deadline}</p></div>
          <button className="btn-primary-sm" aria-label={index === 0 ? undefined : `Revisar depósito de ${deposit.branch}`} onClick={() => openReview(deposit)}>Revisar depósito</button>
        </div>
      ))}
      {selectedDeposit && (
        <div className="deposit-demo-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeReview()}>
          <section className="deposit-demo-modal" role="dialog" aria-modal="true" aria-labelledby="review-demo-title">
            <header><div><h2 id="review-demo-title">Revisar depósito pendiente</h2></div><button type="button" className="deposit-demo-close" aria-label="Cerrar" onClick={closeReview}>×</button></header>
            <dl className="deposit-review-details">
              <div><dt>Sucursal</dt><dd>{selectedDeposit.branch}</dd></div><div><dt>Fecha de conciliación</dt><dd>{selectedDeposit.reconciliationDate}</dd></div><div><dt>Gerente de sucursal responsable</dt><dd>{selectedDeposit.manager}</dd></div><div><dt>Ventas totales</dt><dd>{formatAmount(selectedDeposit.totalSales)}</dd></div><div><dt>Ventas en efectivo</dt><dd>{formatAmount(selectedDeposit.cashSales)}</dd></div><div><dt>Efectivo depositado</dt><dd>{formatAmount(selectedDeposit.depositedCash)}</dd></div><div><dt>Diferencia</dt><dd>{formatAmount(difference)}</dd></div><div><dt>Referencia</dt><dd>{selectedDeposit.reference}</dd></div><div><dt>Previsualización de puntaje</dt><dd>50 / 100 (sujeto a aprobación)</dd></div>
            </dl>
            {feedback && <p className="deposit-demo-success" role="alert">{feedback}</p>}
            {correction && <div className="deposit-correction"><label htmlFor="correction-comment">Comentario de corrección</label><textarea id="correction-comment" value={comment} onChange={(event) => setComment(event.target.value)} required />{!comment.trim() && <p className="deposit-demo-error">El comentario es obligatorio para solicitar corrección.</p>}<button className="deposit-demo-secondary" onClick={requestCorrection} disabled={!comment.trim()}>Enviar solicitud de corrección</button></div>}
            <footer><button type="button" className="deposit-demo-secondary" onClick={() => setCorrection(true)}>Solicitar corrección</button><button type="button" className="deposit-demo-primary" onClick={() => setFeedback('El depósito fue aprobado.')}>Aprobar</button></footer>
          </section>
        </div>
      )}
    </div>
  )
}
