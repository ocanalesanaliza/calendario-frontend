import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import { getGOEvidence } from '../goStructuredEvidenceService'
import '../../tuvet/tuvet.css'
import './GOEvidencePage.css'

function label(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function valueKey(value, index) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value.id ?? value.reference ?? index
  return index
}

function ReadOnlyValue({ value }) {
  if (value === null || value === undefined || value === '') return <span>—</span>
  if (Array.isArray(value)) return value.length ? <ul className="go-structured-evidence__list">{value.map((item, index) => <li key={valueKey(item, index)}><ReadOnlyValue value={item} /></li>)}</ul> : <span>—</span>
  if (typeof value === 'object') return <dl className="go-structured-evidence__fields">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{label(key)}</dt><dd><ReadOnlyValue value={entry} /></dd></div>)}</dl>
  return <span>{String(value)}</span>
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

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setEvidence(await getGOEvidence(reference))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [reference])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const detail = evidence?.[evidenceKey] ?? evidence
  return <main className="tema-analiza tuvet-page go-structured-evidence">
    <PageHeader title={title} description="Consulta GO de solo lectura." />
    <EstadoCarga loading={loading} error={error} onRetry={load} empty={!loading && !error && !detail} emptyText="No hay evidencia disponible para esta referencia.">
      {!loading && !error && detail && <section className="go-structured-evidence__content" aria-label={title}><ReadOnlyValue value={detail} /></section>}
    </EstadoCarga>
  </main>
}
