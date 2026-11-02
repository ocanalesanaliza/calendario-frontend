import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso, Field, FormSection, Modal } from '../../tuvet/components/TuvetUi'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import { getDepositReviewWorklist, recordDepositReviewDecision } from '../../calendarArea/services/depositReviewWorklistService'

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

export default function DepositReviewWorklistModal({ occurrenceVirtualId, onClose, onTerminal }) {
  const [worklist, setWorklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCaseId, setSavingCaseId] = useState(null)
  const [commentCase, setCommentCase] = useState(null)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
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
    <Modal title="Revisión de depósitos" subtitle="Casos congelados por la ocurrencia histórica del calendario." icon="info" wide onClose={onClose}>
      <div className="deposit-review-worklist">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {loading && <div className="deposit-review-worklist__loading" role="status" aria-busy="true"><span className="tuvet-skeleton" /><span className="tuvet-skeleton" /><span className="sr-only">Cargando revisión de depósitos...</span></div>}
        {!loading && !worklist && <Aviso tipo="error">No se pudo cargar la revisión. <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => void loadWorklist()}>Reintentar</button></Aviso>}
        {!loading && worklist && <>
          <HistoricalContext worklist={worklist} />
          {isTerminal(worklist) ? <Aviso tipo="success">{terminalMessage(worklist)}</Aviso> : (
            <div className="deposit-review-worklist__cases">
              {worklist.cases?.length === 0 && <Aviso tipo="info">No hay casos pendientes para esta revisión.</Aviso>}
              {worklist.cases?.map((caseItem) => <article className="deposit-review-worklist__case" key={caseItem.id}>
                <header><h3>{caseItem.branch_code}</h3><p>Cierre: {caseItem.closure_date}</p></header>
                <dl><div><dt>Clasificación</dt><dd>{caseItem.classification}</dd></div><div><dt>Decisión</dt><dd>{caseItem.decision ?? 'Pendiente'}</dd></div></dl>
                {!caseItem.decision && <div className="deposit-review-worklist__actions">
                  <button type="button" className="tuvet-btn" disabled={Boolean(savingCaseId)} onClick={() => void saveDecision(caseItem, 'conforme')} aria-label={`Conforme para ${caseItem.branch_code}`}>Conforme</button>
                  <button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={Boolean(savingCaseId)} onClick={() => void saveDecision(caseItem, 'con_observacion')} aria-label={`Con observación para ${caseItem.branch_code}`}>Con observación</button>
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
        </>}
      </div>
    </Modal>
  )
}
