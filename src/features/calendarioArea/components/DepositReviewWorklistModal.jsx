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
  return new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))
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
          <dl>
            <div><dt>Sucursal</dt><dd>{caseItem?.branch_code}</dd></div>
            <div><dt>Fecha de cierre</dt><dd>{caseItem?.closure_date}</dd></div>
            <div><dt>Ventas totales</dt><dd>{formatAmount(closure?.total_sales)}</dd></div>
            <div><dt>Ventas en efectivo</dt><dd>{formatAmount(closure?.cash_sales)}</dd></div>
            <div><dt>Ventas con tarjeta</dt><dd>{formatAmount(closure?.card_sales)}</dd></div>
            <div><dt>Monto aplicado</dt><dd>{formatAmount(closure?.deposited_amount)}</dd></div>
            <div><dt>Diferencia pendiente</dt><dd>{formatAmount(closure?.outstanding_amount)}</dd></div>
            {closure?.no_depositado_reason && <div><dt>Motivo de no depósito</dt><dd>{closure.no_depositado_reason}</dd></div>}
          </dl>
          <section aria-labelledby="deposit-review-receipts-title">
            <h3 id="deposit-review-receipts-title">Comprobantes aplicables</h3>
            {detail.receipts?.length ? <ul>{detail.receipts.map((receipt) => <li key={`${receipt.reference}-${receipt.deposited_on}`}><strong>{receipt.reference}</strong> · {receipt.deposited_on} · Monto aplicado: {formatAmount(receipt.allocated_amount)}</li>)}</ul> : <p>No hay comprobantes aplicables para este cierre.</p>}
          </section>
        </>}
      </div>
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
      setCommentError('El comentario es obligatorio para registrar que no hay un depósito revisado.')
      return
    }
    void saveDecision(commentCase, 'sin_registro_revisado', trimmedComment)
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
                  {caseItem.classification === 'report_available' && <><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => openDetail(caseItem)} aria-label={`Ver depósito para ${caseItem.branch_code}`}>Ver depósito</button><button type="button" className="tuvet-btn" disabled={Boolean(savingCaseId)} onClick={() => void saveDecision(caseItem, 'conforme')} aria-label={`Conforme para ${caseItem.branch_code}`}>Conforme</button><button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(savingCaseId)} onClick={() => void saveDecision(caseItem, 'con_observacion')} aria-label={`Con observación para ${caseItem.branch_code}`}>Con observación</button></>}
                  {caseItem.classification === 'sin_registro' && <button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(savingCaseId)} onClick={() => openComment(caseItem)} aria-label={`Sin registro revisado para ${caseItem.branch_code}`}>Sin registro revisado</button>}
                </div>}
              </article>)}
            </div>
          )}
          {commentCase && <form className="deposit-review-worklist__comment" onSubmit={submitComment}>
            <FormSection title="Comentario de revisión" description={`Describe la ausencia de registro para ${commentCase.branch_code}.`}>
              <Field label="Comentario" required error={commentError} hint="Este comentario queda asociado a la decisión.">
                <textarea id="deposit-review-comment" ref={commentRef} value={comment} disabled={Boolean(savingCaseId)} onChange={(event) => { setComment(event.target.value); setCommentError('') }} />
              </Field>
            </FormSection>
            <div className="deposit-review-worklist__actions"><button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(savingCaseId)} onClick={() => setCommentCase(null)}>Cancelar</button><button type="submit" className="tuvet-btn" disabled={Boolean(savingCaseId)} aria-busy={Boolean(savingCaseId)}>{savingCaseId ? 'Guardando...' : 'Guardar decisión'}</button></div>
          </form>}
          {detailCase && <DepositDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={closeDetail} onRetry={() => void loadDetail(detailCase)} />}
        </>}
      </div>
    </Modal>
  )
}
