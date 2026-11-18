import { useEffect, useRef, useState } from 'react'
import { Aviso, EstadoCarga, Field, FormSection } from '../../tuvet/components/TuvetUi'
import { correctGAMonthlyEvaluation, createGAMonthlyEvaluation, getGAMonthlyEvaluationHistory, getGAMonthlyEvaluations } from '../services/gaMonthlyEvaluationsService'

function messageFor(error) {
  if (error?.status === 403) return 'No tienes autorización para esta evaluación. El servidor mantiene la autorización.'
  if (error?.status === 409) {
    if (error?.payload?.detail === 'monthly_snapshot_not_closed') return 'El cierre mensual definitivo todavía no está disponible.'
    if (error?.payload?.detail === 'evaluation_already_exists' || error?.payload?.detail === 'stale_evaluation_revision') return 'La evaluación cambió. Revisa la versión vigente antes de continuar.'
    return 'La clave de este comando ya se usó con datos distintos. Revisa el resultado e inicia un comando nuevo.'
  }
  return 'No fue posible guardar la evaluación. Inténtalo nuevamente.'
}

function localErrors({ score, reason, correcting }) {
  const errors = {}
  const parsed = Number(score)
  if (!score.trim() || !Number.isFinite(parsed) || parsed < 0 || parsed > 100 || !/^\d{1,3}(?:\.\d{1,2})?$/.test(score.trim())) errors.score = 'La nota debe estar entre 0 y 100 y tener hasta dos decimales.'
  if (correcting && (!reason.trim() || reason.trim().length > 500)) errors.reason = 'El motivo es obligatorio y debe tener como máximo 500 caracteres.'
  return errors
}

function issuerName(evaluation) {
  return evaluation?.issuer_go?.name || 'GO emisor no disponible'
}

export default function GAMonthlyEvaluationPanel({ gaId, month, mode = 'go' }) {
  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formMode, setFormMode] = useState(null)
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')
  const commandKey = useRef(null)
  const canEdit = mode === 'go'
  const canViewHistory = mode === 'go' || mode === 'systems'

  const load = async () => {
    setLoading(true); setLoadError('')
    try {
      const data = await getGAMonthlyEvaluations({ gaId: mode === 'ga' ? undefined : gaId, month })
      setEvaluation(Array.isArray(data?.evaluations) ? data.evaluations[0] ?? null : null)
    } catch (error) {
      setLoadError(messageFor(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [gaId, month, mode])

  function openForm(nextMode) {
    setFormMode(nextMode)
    setScore(nextMode === 'correct' ? String(evaluation?.score ?? '') : '')
    setComment(nextMode === 'correct' ? evaluation?.comment ?? '' : '')
    setReason(''); setErrors({}); setNotice(''); commandKey.current = null
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = localErrors({ score, reason, correcting: formMode === 'correct' })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true); setNotice('')
    if (!commandKey.current) commandKey.current = crypto.randomUUID()
    try {
      const payload = { score: score.trim(), comment: comment.trim(), idempotency_key: commandKey.current }
      const result = formMode === 'correct'
        ? await correctGAMonthlyEvaluation(evaluation.id, { ...payload, reason: reason.trim() })
        : await createGAMonthlyEvaluation({ ...payload, ga_id: gaId, month })
      setEvaluation(result?.evaluation ?? evaluation)
      setFormMode(null); setNotice(formMode === 'correct' ? 'La corrección fue registrada.' : 'La evaluación fue registrada.')
      commandKey.current = null
    } catch (error) {
      if (error?.status === 422) {
        const fields = error?.fields ?? {}
        setErrors({ score: fields.score ? 'Revisa la nota indicada.' : '', comment: fields.comment ? 'El comentario debe tener como máximo 500 caracteres.' : '', reason: fields.reason ? 'Revisa el motivo indicado.' : '' })
      }
      if (error?.status === 409) commandKey.current = null
      setNotice(messageFor(error))
    } finally {
      setSaving(false)
    }
  }

  async function openHistory() {
    setHistoryError('')
    try {
      const data = await getGAMonthlyEvaluationHistory(evaluation.id)
      setHistory(Array.isArray(data?.history) ? data.history : [])
    } catch (error) {
      setHistoryError(messageFor(error))
    }
  }

  return <section className="ga-monthly-evaluation" aria-label="Evaluación mensual GO a GA">
    <h2>Evaluación mensual</h2>
    <EstadoCarga loading={loading} error={loadError} onRetry={load} empty={!loading && !loadError && !evaluation} emptyText="No hay evaluación mensual vigente.">
      {evaluation && <dl><div><dt>Nota</dt><dd>{evaluation.score}</dd></div>{evaluation.comment ? <div><dt>Comentario</dt><dd>{evaluation.comment}</dd></div> : null}<div><dt>Emitida por</dt><dd>{issuerName(evaluation)}</dd></div></dl>}
    </EstadoCarga>
    {notice && <Aviso tipo="error">{notice}</Aviso>}
    {canViewHistory && !loading && !loadError && !formMode && evaluation && <div className="ga-monthly-evaluation-actions">{canEdit && <button type="button" className="tuvet-btn" onClick={() => openForm('correct')}>Corregir evaluación</button>}<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => void openHistory()}>Ver historial completo</button></div>}
    {canEdit && !loading && !loadError && !formMode && !evaluation && <div className="ga-monthly-evaluation-actions"><button type="button" className="tuvet-btn" onClick={() => openForm('create')}>Emitir evaluación</button></div>}
    {formMode && <form className="tuvet-form" onSubmit={submit} noValidate>
      <FormSection title={formMode === 'correct' ? 'Corregir evaluación' : 'Emitir evaluación'} description="La autorización y el cierre definitivo se verifican en el servidor.">
        <Field label="Nota" required error={errors.score}><input aria-label="Nota" aria-invalid={Boolean(errors.score)} inputMode="decimal" value={score} onChange={(event) => { setScore(event.target.value); setErrors((current) => ({ ...current, score: '' })) }} /></Field>
        <Field label="Comentario" error={errors.comment} hint="Opcional, máximo 500 caracteres."><textarea maxLength="500" value={comment} onChange={(event) => setComment(event.target.value)} /></Field>
        {formMode === 'correct' && <Field label="Motivo de la corrección" required error={errors.reason} hint="Obligatorio, máximo 500 caracteres."><textarea aria-label="Motivo de la corrección" aria-invalid={Boolean(errors.reason)} maxLength="500" value={reason} onChange={(event) => { setReason(event.target.value); setErrors((current) => ({ ...current, reason: '' })) }} /></Field>}
      </FormSection>
      <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setFormMode(null)} disabled={saving}>Cancelar</button>
      <button type="submit" className="tuvet-btn" disabled={saving}>{saving ? 'Guardando…' : formMode === 'correct' ? 'Guardar corrección' : 'Guardar evaluación'}</button>
    </form>}
    {canViewHistory && historyError && <Aviso tipo="error">{historyError}</Aviso>}
    {canViewHistory && history && <section aria-label="Historial completo de evaluación"><h3>Historial completo</h3><ol>{history.map((item, index) => <li key={item?.id ?? index}><strong>Versión {item?.version ?? '—'}</strong><span> · Nota: {item?.score ?? '—'}</span>{item?.comment ? <p>{item.comment}</p> : null}{item?.reason ? <p>{item.reason}</p> : null}</li>)}</ol></section>}
  </section>
}
