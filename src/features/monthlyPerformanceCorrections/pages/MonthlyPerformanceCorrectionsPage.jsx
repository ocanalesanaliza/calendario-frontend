import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Aviso, EstadoCarga, Field, FormSection, OptionCards, PageHeader } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError, erroresDelServidor } from '../../tuvet/utils/formularios'
import SystemsPerformanceHistoryPage from '../../performanceHistory/pages/SystemsPerformanceHistoryPage'
import { createMonthlyPerformanceCorrection, getMonthlyPerformanceCorrectionAudit, validateMonthlyPerformanceCorrection } from '../services/monthlyPerformanceCorrectionsService'
import '../../tuvet/tuvet.css'
import './MonthlyPerformanceCorrectionsPage.css'

const MODES = [
  { value: 'recalculo_por_defecto', label: 'Recalcular desde evidencia preservada', description: 'Reconstruye el resultado desde la evidencia disponible.' },
  { value: 'ajuste_manual_excepcional', label: 'Ajuste manual excepcional', description: 'Registra pesos excepcionales con una justificación.' },
  { value: 'correccion_de_dato_fuente', label: 'Corrección de dato fuente', description: 'Corrige pesos derivados de un dato fuente.' },
]
const MODE_LABELS = Object.fromEntries(MODES.map((mode) => [mode.value, mode.label]))

function display(value) { return value === null || value === undefined || value === '' ? 'No aplica' : value }
function summaryLines(summary = {}) {
  return [
    ['Área', display(summary.area)], ['Responsabilidad', display(summary.responsibility)], ['Mes', display(summary.period)],
    ['Estado', display(summary.state)], ['Versión', display(summary.version)], ['Peso esperado', display(summary.expected_weight)],
    ['Peso acreditado', display(summary.credited_weight)], ['Porcentaje', summary.percentage === null || summary.percentage === undefined ? 'No aplica' : `${summary.percentage}%`],
  ]
}

function localErrors({ reason, classification, expectedWeight, creditedWeight }) {
  const errors = {}
  if (!classification) errors.classification = 'Selecciona un tipo de corrección.'
  if (!reason.trim() || reason.trim().length > 500) errors.reason = 'Describe el motivo con entre 1 y 500 caracteres que no sean espacios.'
  if (classification !== 'recalculo_por_defecto') {
    const expected = expectedWeight === '' ? null : Number(expectedWeight)
    const credited = creditedWeight === '' ? null : Number(creditedWeight)
    if (expected !== null && (!Number.isFinite(expected) || expected <= 0)) errors.expectedWeight = 'El peso esperado debe ser mayor que cero.'
    if (credited !== null && (!Number.isFinite(credited) || credited < 0 || (expected !== null && credited > expected))) errors.creditedWeight = 'El peso acreditado debe estar entre cero y el peso esperado.'
    if (expected === null && credited === null) errors.adjustment = 'Indica al menos un peso válido para el ajuste manual.'
  }
  return errors
}

function errorMessage(error) {
  if (error?.status === 403) return 'No tienes autorización para realizar correcciones excepcionales. El servidor mantiene la autorización.'
  if (error?.status === 404) return 'El rendimiento seleccionado ya no está disponible. Vuelve a buscarlo.'
  if (error?.payload?.code === 'idempotency_key_reused' || error?.status === 409) return 'Esta confirmación ya se usó con datos distintos. Revisa el resultado o inicia una nueva corrección.'
  if (error?.status === 412) return 'El rendimiento cambió antes de confirmar. Revisa la versión más reciente y valida de nuevo.'
  return 'No fue posible procesar la solicitud. Revisa los datos e inténtalo de nuevo.'
}

export default function MonthlyPerformanceCorrectionsPage() {
  const location = useLocation()
  const initialTarget = location.state?.target?.snapshotId ? location.state.target : null
  const [target, setTarget] = useState(initialTarget)
  const [classification, setClassification] = useState('recalculo_por_defecto')
  const [reason, setReason] = useState('')
  const [expectedWeight, setExpectedWeight] = useState('')
  const [creditedWeight, setCreditedWeight] = useState('')
  const [errors, setErrors] = useState({})
  const [proposal, setProposal] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [notice, setNotice] = useState('')
  const [validating, setValidating] = useState(false)
  const [audit, setAudit] = useState([])
  const [auditError, setAuditError] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [commandKey, setCommandKey] = useState(null)
  const formRef = useRef(null)
  const [confirmar, dialogo] = useConfirmacion()

  const percentage = useMemo(() => {
    const expected = Number(expectedWeight); const credited = Number(creditedWeight)
    return Number.isFinite(expected) && expected > 0 && Number.isFinite(credited) && credited >= 0 ? ((credited / expected) * 100).toFixed(2) : '—'
  }, [expectedWeight, creditedWeight])

  const clearPending = () => { setCommandKey(null); setProposal(null); setReceipt(null) }
  const update = (setter) => (value) => { setter(value); clearPending() }
  const selectTarget = (nextTarget) => { clearPending(); setTarget(nextTarget) }

  useEffect(() => {
    if (!target?.snapshotId) return
    Promise.resolve().then(() => { setAuditLoading(true); setAuditError('') })
    getMonthlyPerformanceCorrectionAudit(target.snapshotId)
      .then((data) => setAudit(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => setAuditError('No fue posible cargar el historial de correcciones.'))
      .finally(() => setAuditLoading(false))
  }, [target])

  function payload() {
    const result = { target_snapshot_id: target.snapshotId, classification, reason: reason.trim(), idempotency_key: commandKey }
    if (classification !== 'recalculo_por_defecto') {
      result.adjustment = {}
      if (expectedWeight !== '') result.adjustment.expected_weight = expectedWeight
      if (creditedWeight !== '') result.adjustment.credited_weight = creditedWeight
    }
    return result
  }

  async function validate(event) {
    event.preventDefault(); setNotice('')
    const nextErrors = localErrors({ reason, classification, expectedWeight, creditedWeight })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { enfocarPrimerError(formRef.current); return }
    setValidating(true)
    try {
      const idempotencyKey = crypto.randomUUID()
      setCommandKey(idempotencyKey)
      setProposal(await validateMonthlyPerformanceCorrection({ ...payload(), idempotency_key: idempotencyKey }))
    }
    catch (error) {
      if ([409, 412].includes(error?.status) || error?.payload?.code === 'idempotency_key_reused') clearPending()
      setNotice(errorMessage(error))
      if (error?.status === 422) {
        const { porCampo } = erroresDelServidor(error, ['reason', 'expected_weight', 'credited_weight'])
        setErrors({ reason: porCampo.reason, expectedWeight: porCampo.expected_weight, creditedWeight: porCampo.credited_weight, ...(Object.keys(porCampo).length ? {} : { reason: 'Revisa el motivo y los pesos indicados.' }) })
      }
    }
    finally { setValidating(false) }
  }

  async function confirmWrite() {
    try {
      const result = await createMonthlyPerformanceCorrection(payload())
      setReceipt(result?.receipt ?? result?.t8_receipt ?? result)
      setNotice('La corrección se registró de forma segura.')
      const refreshed = await getMonthlyPerformanceCorrectionAudit(target.snapshotId)
      setAudit(Array.isArray(refreshed) ? refreshed : (refreshed?.results ?? []))
    } catch (error) {
      if ([409, 412].includes(error?.status) || error?.payload?.code === 'idempotency_key_reused') clearPending()
      throw new Error(errorMessage(error), { cause: error })
    }
  }

  if (!target) return <main className="tema-analiza tuvet-page monthly-performance-corrections" data-responsive-breakpoints="375 768 1024 1440"><PageHeader title="Correcciones de rendimiento" description="Selecciona un cierre definitivo para iniciar una corrección excepcional." /><Aviso tipo="info">Solo se pueden corregir resultados definitivos con evidencia de cierre.</Aviso><SystemsPerformanceHistoryPage selectionMode onSelectTarget={selectTarget} /></main>

  return <main className="tema-analiza tuvet-page monthly-performance-corrections" data-responsive-breakpoints="375 768 1024 1440">
    <PageHeader title="Correcciones de rendimiento" description="La autorización final permanece en el servidor." />
    {notice && <Aviso tipo={receipt ? 'success' : 'error'}>{notice}</Aviso>}
    <section className="mpc-summary" aria-label="Rendimiento seleccionado"><h2>Rendimiento seleccionado</h2><dl>{summaryLines(target.summary).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <form ref={formRef} className="tuvet-form" onSubmit={validate} noValidate>
      <FormSection title="Tipo de corrección" description="Elige una sola clasificación."><OptionCards name="classification" label="Tipo de corrección" value={classification} onChange={update(setClassification)} options={MODES} />{errors.classification && <Aviso tipo="error">{errors.classification}</Aviso>}</FormSection>
      <FormSection title="Motivo"><Field label="Motivo" required full error={errors.reason} hint="Entre 1 y 500 caracteres."><textarea value={reason} onChange={(event) => update(setReason)(event.target.value)} maxLength="500" /></Field></FormSection>
      {classification !== 'recalculo_por_defecto' && <FormSection title="Pesos manuales" description="No se admite No aplica para un ajuste manual."><div className="mpc-weights"><Field label="Peso esperado" error={errors.expectedWeight}><input inputMode="decimal" value={expectedWeight} onChange={(event) => update(setExpectedWeight)(event.target.value)} /></Field><Field label="Peso acreditado" error={errors.creditedWeight}><input inputMode="decimal" value={creditedWeight} onChange={(event) => update(setCreditedWeight)(event.target.value)} /></Field><Field label="Porcentaje derivado"><input value={percentage === '—' ? '—' : `${percentage}%`} readOnly /></Field></div>{errors.adjustment && <Aviso tipo="error">{errors.adjustment}</Aviso>}</FormSection>}
      <button className="tuvet-btn" type="submit" disabled={validating}>{validating ? 'Validando…' : 'Validar corrección'}</button>
    </form>
    {proposal?.valid && <section className="mpc-proposal" aria-live="polite"><h2>Resultado propuesto</h2><dl>{summaryLines({ ...proposal.proposed_successor, period: target.summary?.period, area: target.summary?.area, responsibility: target.summary?.responsibility }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button type="button" className="tuvet-btn" onClick={() => confirmar({ title: 'Confirmar corrección excepcional', message: `Se agregará una corrección para ${target.summary?.area ?? 'el rendimiento seleccionado'}. Motivo: ${reason.trim()}`, detail: 'El resultado se conserva como una nueva revisión y no modifica el registro original.', confirmLabel: 'Confirmar corrección', accion: confirmWrite })}>Confirmar corrección</button></section>}
    {receipt && <section className="mpc-receipt" aria-live="polite"><h2>Comprobante de corrección</h2><p>La corrección fue registrada. Conserva el resultado propuesto y su historial de revisiones.</p>{receipt?.replayed === true && <p>Se mostró el mismo comprobante de una confirmación ya registrada.</p>}</section>}
    <section className="mpc-audit"><h2>Historial de correcciones</h2><EstadoCarga loading={auditLoading} error={auditError} empty={!auditLoading && !auditError && audit.length === 0} emptyText="No hay correcciones registradas para este cierre."><ol>{[...audit].sort((left, right) => Number(left?.version ?? 0) - Number(right?.version ?? 0)).map((item, index) => { const auditReceipt = item?.t8_receipt; const classification = auditReceipt?.classification ?? auditReceipt?.type; return <li key={item?.version ?? index}><strong>Revisión {display(item?.version)}</strong><span> · {display(item?.state)} · Peso esperado: {display(item?.expected_weight)} · Peso acreditado: {display(item?.credited_weight)} · {display(item?.percentage)}%</span>{auditReceipt === null ? <p>Sin comprobante de corrección T8: revisión original o heredada.</p> : <dl><div><dt>Tipo de corrección</dt><dd>{display(MODE_LABELS[classification] ?? classification)}</dd></div><div><dt>Motivo</dt><dd>{display(auditReceipt?.reason)}</dd></div><div><dt>Registrada</dt><dd>{display(auditReceipt?.timestamp ?? auditReceipt?.created_at)}</dd></div></dl>}</li> })}</ol></EstadoCarga></section>
    {dialogo}
  </main>
}
