import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso, Field, FormSection, Modal } from '../../tuvet/components/TuvetUi'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import { getDepositReviewDetail, getDepositReviewWorklist, recordDepositReviewDecision } from '../../calendarArea/services/depositReviewWorklistService'

const classificationLabels = {
  report_available: 'Depósito enviado',
  pending: 'Pendiente de envío',
  sin_registro: 'Sin registro',
}

const decisionLabels = {
  conforme: 'Conforme',
  con_observacion: 'Con observación',
  sin_registro_revisado: 'Sin registro revisado',
}

function formatAmount(value) {
  return `L ${new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))}`
}

function isTerminal(worklist) {
  return ['resolved', 'no_aplicable'].includes(worklist?.state) || ['resolved', 'no_aplicable'].includes(worklist?.terminal?.state)
}

function terminalMessage(worklist) {
  return worklist?.state === 'no_aplicable' || worklist?.terminal?.state === 'no_aplicable'
    ? 'No hubo casos aplicables para esta revisión de depósitos.'
    : 'La revisión de depósitos quedó resuelta.'
}

function requestMessage(error) {
  if (error?.status === 403) return 'No tienes acceso a esta revisión de depósitos.'
  if (error?.status === 404) return 'La revisión de depósitos ya no está disponible.'
  if (error?.status === 400) return `No se pudo guardar la decisión: ${error.message}`
  if (error?.detail === 'deposit_api_disabled' || error?.message === 'deposit_api_disabled') return 'La revisión de depósitos no está disponible en este momento.'
  return error?.message || 'No se pudo completar la operación. Intenta nuevamente.'
}

function detailMessage() {
  return 'No se pudo cargar el detalle del depósito. Intenta nuevamente o cierra este detalle.'
}

function HistoricalContext({ worklist }) {
  const context = worklist.historical_context ?? {}
  return (
    <dl className="deposit-review-worklist__context">
      <div><dt>Origen histórico</dt><dd>{worklist.origin_date}</dd></div>
      <div><dt>Programada</dt><dd>{context.scheduled_on}</dd></div>
      <div><dt>Aplicada</dt><dd>{context.effective_on}</dd></div>
      <div><dt>Mes de atribución</dt><dd>{context.attribution_month}</dd></div>
    </dl>
  )
}

function DepositDetailModal({ detail, loading, error, onClose, onRetry }) {
  const closure = detail?.closure
  const caseItem = detail?.case
  const branchName = caseItem?.branch_name || caseItem?.branch_code
  const hasSalesDiscrepancy = closure?.sales_discrepancy_amount && closure.sales_discrepancy_amount !== '0.00'
  return (
    <Modal
      title="Detalle del depósito"
      subtitle="Información enviada por la GS; solo lectura."
      icon="archivo"
      wide
      onClose={onClose}
      footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} aria-label="Cerrar detalle del depósito">Cerrar detalle</button>}
    >
      <div className="deposit-review-worklist__detail">
        {loading && <div role="status" aria-busy="true"><span className="tuvet-skeleton" /><span className="sr-only">Cargando detalle del depósito...</span></div>}
        {error && <Aviso tipo="error">{error} <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onRetry}>Reintentar detalle del depósito</button></Aviso>}
        {!loading && !error && detail && <>
          <header className="deposit-review-worklist__detail-heading">
            <h3>{branchName}</h3>
            <p>{caseItem?.branch_code} · Cierre {caseItem?.closure_date}</p>
          </header>
          <section aria-labelledby="deposit-review-summary-title">
            <h3 id="deposit-review-summary-title">Resumen del cierre</h3>
            <dl className="deposit-review-worklist__detail-summary">
            <div><dt>Ventas totales</dt><dd>{formatAmount(closure?.total_sales)}</dd></div>
            <div><dt>Ventas en efectivo</dt><dd>{formatAmount(closure?.cash_sales)}</dd></div>
            <div><dt>Ventas con tarjeta</dt><dd>{formatAmount(closure?.card_sales)}</dd></div>
              <div><dt>Monto aplicado</dt><dd>{formatAmount(closure?.deposited_amount)}</dd></div>
              <div className="deposit-review-worklist__outstanding"><dt>Diferencia pendiente</dt><dd>{formatAmount(closure?.outstanding_amount)}</dd></div>
              {closure?.no_depositado_reason && <div><dt>Motivo de no depósito</dt><dd>{closure.no_depositado_reason}</dd></div>}
            </dl>
          </section>
          {hasSalesDiscrepancy && <section className="deposit-review-worklist__sales-discrepancy" aria-labelledby="deposit-review-sales-discrepancy-title">
            <h3 id="deposit-review-sales-discrepancy-title">Descuadre de ventas</h3>
            <dl>
              <div><dt>Descuadre de ventas</dt><dd>{formatAmount(closure.sales_discrepancy_amount)}</dd></div>
              <div><dt>Explicación del descuadre</dt><dd>{closure.sales_discrepancy_reason || 'Sin explicación registrada.'}</dd></div>
            </dl>
          </section>}
          <section aria-labelledby="deposit-review-receipts-title">
            <h3 id="deposit-review-receipts-title">Comprobantes aplicables</h3>
            {detail.receipts?.length ? <ul className="deposit-review-worklist__receipts">{detail.receipts.map((receipt) => <li key={`${receipt.reference}-${receipt.deposited_on}`}><dl><div><dt>Referencia</dt><dd>{receipt.reference}</dd></div><div><dt>Fecha de depósito</dt><dd>{receipt.deposited_on}</dd></div><div><dt>Monto aplicado a este cierre</dt><dd>{formatAmount(receipt.allocated_amount)}</dd></div></dl></li>)}</ul> : <p>No hay comprobantes aplicables para este cierre.</p>}
          </section>
        </>}
      </div>
    </Modal>
  )
}

function CommentDecisionModal({ caseItem, comment, commentError, saving, commentRef, onChange, onCancel, onSubmit }) {
  const isObservation = caseItem.classification === 'report_available'
  const title = isObservation ? 'Registrar observación' : 'Sin registro revisado'
  const description = isObservation
    ? `Describe la observación para ${caseItem.branch_code}.`
    : `Describe la ausencia de registro para ${caseItem.branch_code}.`
  return (
    <Modal title={title} subtitle="El comentario es obligatorio." icon="info" onClose={onCancel} footer={<><button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" form="deposit-review-comment-form" className="tuvet-btn" disabled={saving} aria-busy={saving}>{saving ? 'Guardando...' : isObservation ? 'Guardar observación' : 'Guardar decisión'}</button></>}>
      <form id="deposit-review-comment-form" className="deposit-review-worklist__comment" onSubmit={onSubmit}>
        <FormSection title="Comentario de revisión" description={description}>
          <Field label="Comentario" required error={commentError} hint="Este comentario queda asociado a la decisión.">
            <textarea id="deposit-review-comment" ref={commentRef} value={comment} disabled={saving} onChange={onChange} />
          </Field>
        </FormSection>
      </form>
    </Modal>
  )
}

export default function DepositReviewWorklistModal({ occurrenceVirtualId, onClose, onTerminal }) {
  const [worklist, setWorklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCaseId, setSavingCaseId] = useState(null)
  const [commentCase, setCommentCase] = useState(null)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [detailCase, setDetailCase] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const commentRef = useRef(null)

  const loadWorklist = useCallback(async (keepError = false) => {
    setLoading(true)
    if (!keepError) setError('')
    try {
      setWorklist(await getDepositReviewWorklist(occurrenceVirtualId))
    } catch (requestError) {
      setError(requestMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [occurrenceVirtualId])

  useEffect(() => {
    void Promise.resolve().then(loadWorklist)
  }, [loadWorklist])

  useEffect(() => {
    if (commentError) commentRef.current?.focus()
  }, [commentError])

  function openComment(caseItem) {
    setCommentCase(caseItem)
    setComment('')
    setCommentError('')
  }

  const loadDetail = useCallback(async (caseItem) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      setDetail(await getDepositReviewDetail(occurrenceVirtualId, caseItem.id))
    } catch {
      setDetailError(detailMessage())
    } finally {
      setDetailLoading(false)
    }
  }, [occurrenceVirtualId])

  function openDetail(caseItem) {
    setDetailCase(caseItem)
    setDetail(null)
    void loadDetail(caseItem)
  }

  function closeDetail() {
    setDetailCase(null)
    setDetail(null)
    setDetailError('')
  }

  async function saveDecision(caseItem, decision, submittedComment = '') {
    if (savingCaseId) return
    setSavingCaseId(caseItem.id)
    setError('')
    try {
      const response = await recordDepositReviewDecision(occurrenceVirtualId, caseItem.id, {
        decision,
        comment: submittedComment,
        idempotency_key: createIdempotencyKey(),
      })
      const nextWorklist = response.worklist
      setWorklist(nextWorklist)
      setCommentCase(null)
      if (isTerminal(nextWorklist)) onTerminal(nextWorklist)
    } catch (requestError) {
      if (requestError?.status === 409) {
        setError('La revisión cambió o ya fue resuelta. Se recargó la bandeja.')
        await loadWorklist(true)
      } else {
        setError(requestMessage(requestError))
      }
    } finally {
      setSavingCaseId(null)
    }
  }

  function submitComment(event) {
    event.preventDefault()
    const trimmedComment = comment.trim()
    if (!trimmedComment) {
      setCommentError(commentCase.classification === 'report_available'
        ? 'El comentario es obligatorio para registrar una observación.'
        : 'El comentario es obligatorio para registrar que no hay un depósito revisado.')
      return
    }
    const decision = commentCase.classification === 'report_available' ? 'con_observacion' : 'sin_registro_revisado'
    void saveDecision(commentCase, decision, trimmedComment)
  }

  return (
    <Modal title="Revisión de depósitos" subtitle="Muestra Sucursales y cierres actualmente aplicables a esta revisión dinámica." icon="info" wide onClose={onClose}>
      <div className="deposit-review-worklist">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {loading && <div className="deposit-review-worklist__loading" role="status" aria-busy="true"><span className="tuvet-skeleton" /><span className="tuvet-skeleton" /><span className="sr-only">Cargando revisión de depósitos...</span></div>}
        {!loading && !worklist && <Aviso tipo="error">No se pudo cargar la revisión. <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => void loadWorklist()}>Reintentar</button></Aviso>}
        {!loading && worklist && <>
          <HistoricalContext worklist={worklist} />
          {isTerminal(worklist) ? <Aviso tipo="success">{terminalMessage(worklist)}</Aviso> : (
            <div className="deposit-review-worklist__cases">
              {worklist.cases?.length === 0 && <Aviso tipo="info">No hay Sucursales o cierres aplicables para esta revisión en este momento.</Aviso>}
              {worklist.cases?.map((caseItem) => <article className="deposit-review-worklist__case" key={caseItem.id}>
                <header><h3>{caseItem.branch_code}</h3><p>Cierre: {caseItem.closure_date}</p></header>
                <dl><div><dt>Clasificación</dt><dd>{classificationLabels[caseItem.classification] ?? 'No disponible'}</dd></div><div><dt>Decisión</dt><dd>{caseItem.decision ? (decisionLabels[caseItem.decision] ?? 'No disponible') : 'Pendiente'}</dd></div></dl>
                {!caseItem.decision && <div className="deposit-review-worklist__actions">
                  {caseItem.classification === 'report_available' && <><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => openDetail(caseItem)} aria-label={`Ver depósito para ${caseItem.branch_code}`}>Ver depósito</button><button type="button" className="tuvet-btn" disabled={Boolean(savingCaseId)} onClick={() => void saveDecision(caseItem, 'conforme')} aria-label={`Conforme para ${caseItem.branch_code}`}>Conforme</button><button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(savingCaseId)} onClick={() => openComment(caseItem)} aria-label={`Con observación para ${caseItem.branch_code}`}>Con observación</button></>}
                  {caseItem.classification === 'sin_registro' && <button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(savingCaseId)} onClick={() => openComment(caseItem)} aria-label={`Sin registro revisado para ${caseItem.branch_code}`}>Sin registro revisado</button>}
                </div>}
              </article>)}
            </div>
          )}
          {commentCase && <CommentDecisionModal caseItem={commentCase} comment={comment} commentError={commentError} saving={Boolean(savingCaseId)} commentRef={commentRef} onChange={(event) => { setComment(event.target.value); setCommentError('') }} onCancel={() => setCommentCase(null)} onSubmit={submitComment} />}
          {detailCase && <DepositDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={closeDetail} onRetry={() => void loadDetail(detailCase)} />}
        </>}
      </div>
    </Modal>
  )
}
