import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { calculateSummary, getCountDetails, parseInventoryWorkbook } from '../inventoryImport'
import '../styles/InventarioDemo.css'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_VISIBLE_ROWS = 500

const formatCurrency = (amount) => `L ${new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount ?? 0)}`

export default function InventarioDemoPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [counts, setCounts] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const isComplete = counts.length > 0 && counts.every(({ product, physicalStock, expirationDate }) => {
    const details = getCountDetails(product, physicalStock, expirationDate)
    return details.isPhysicalValid && details.isExpirationValid
  })
  const summary = calculateSummary(counts)

  async function handleFile(event) {
    const file = event.target.files?.[0]
    setError('')
    setMessage('')
    setConfirmed(false)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Seleccione únicamente un archivo .xlsx.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('El archivo supera el límite de 5 MB.')
      return
    }
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const products = parseInventoryWorkbook(workbook)
      if (products.length > MAX_VISIBLE_ROWS) throw new Error(`El archivo contiene más de ${MAX_VISIBLE_ROWS} productos con existencia.`)
      setCounts(products.map((product) => ({ product, physicalStock: '', expirationDate: '' })))
      setMessage(products.length ? `${products.length} productos listos para conteo.` : 'El archivo es válido, pero no contiene productos con existencia mayor que cero.')
    } catch (importError) {
      setCounts([])
      setError(importError instanceof Error ? importError.message : 'No fue posible leer el archivo local.')
    }
  }

  function updateCount(index, field, value) {
    setCounts((current) => current.map((count, currentIndex) => currentIndex === index ? { ...count, [field]: value } : count))
    setConfirmed(false)
  }

  function reset() {
    setCounts([])
    setError('')
    setMessage('')
    setConfirmed(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function confirm() {
    if (!isComplete) return
    setConfirmed(true)
  }

  return (
    <section className="inventory-demo-page" aria-labelledby="inventory-demo-title">
      <header className="inventory-demo-header">
        <div><h1 id="inventory-demo-title">Conteo de inventario</h1><p>Cargue un XLSX local y registre el conteo físico.</p></div>
        <button type="button" className="inventory-demo-secondary" onClick={() => navigate('/')}>Cancelar y salir</button>
      </header>

      
      <div className="inventory-demo-upload">
        <label htmlFor="inventory-file">Archivo XLSX de inventario (máximo 5 MB)</label>
        <input ref={inputRef} id="inventory-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} />
        <p>Encabezados requeridos: Codigo Producto, Producto, Costo, Sucursal, Punto de Reorden y Existencia.</p>
      </div>
      {error && <p className="inventory-demo-error" role="alert">{error}</p>}
      {message && <p className="inventory-demo-message" aria-live="polite">{message}</p>}

      {counts.length > 0 && <>
        <div className="inventory-demo-table-wrap" tabIndex="0" aria-label="Tabla de conteo de inventario; desplácese horizontalmente si es necesario">
          <table className="inventory-demo-table">
            <thead><tr><th>Codigo</th><th>Producto</th><th>Sucursal</th><th>Esperado</th><th>Existencia física</th><th>Vencimiento manual</th><th>Diferencia</th><th>Estado</th><th>Impacto</th></tr></thead>
            <tbody>{counts.map((count, index) => {
              const details = getCountDetails(count.product, count.physicalStock, count.expirationDate)
              return <tr key={count.product.code}>
                <td>{count.product.code}</td><td>{count.product.product}</td><td>{count.product.branch}</td><td>{count.product.systemStock}</td>
                <td><label className="sr-only" htmlFor={`physical-${index}`}>Existencia física para {count.product.product}</label><input id={`physical-${index}`} type="number" min="0" step="any" inputMode="decimal" value={count.physicalStock} onChange={(event) => updateCount(index, 'physicalStock', event.target.value)} aria-invalid={count.physicalStock !== '' && !details.isPhysicalValid} /></td>
                <td><label className="sr-only" htmlFor={`expiration-${index}`}>Vencimiento para {count.product.product}</label><input id={`expiration-${index}`} type="date" value={count.expirationDate} onChange={(event) => updateCount(index, 'expirationDate', event.target.value)} /></td>
                <td>{details.difference ?? '—'}</td><td>{details.status ? <span className={`inventory-demo-status ${details.status}`}>{details.status}</span> : '—'}</td><td>{details.impact === null ? '—' : formatCurrency(details.impact)}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
        <div className="inventory-demo-summary" aria-live="polite"><div><span>Impacto por faltantes</span><strong>{formatCurrency(summary.shortageImpact)}</strong></div><div><span>Impacto por sobrantes</span><strong>{formatCurrency(summary.surplusImpact)}</strong></div><div><span>Impacto neto firmado</span><strong>{formatCurrency(summary.netImpact)}</strong></div></div>
        <footer className="inventory-demo-actions"><button type="button" className="inventory-demo-secondary" onClick={reset}>Reiniciar</button><button type="button" className="inventory-demo-primary" disabled={!isComplete} onClick={confirm}>Confirmar resumen local</button></footer>
        {!isComplete && <p className="inventory-demo-help" aria-live="polite">Complete una existencia física no negativa y una fecha de vencimiento manual para cada producto visible.</p>}
        {confirmed && <section className="inventory-demo-confirmation" role="status"><h2>Resumen confirmado localmente</h2><p>Esta es una demostración no operativa. No se almacenó ni se envió ningún dato.</p><p>{counts.length} productos revisados. Impacto neto: <strong>{formatCurrency(summary.netImpact)}</strong>.</p></section>}
      </>}
    </section>
  )
}
