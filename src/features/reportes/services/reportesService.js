import { apiRequest } from '../../../services/apiClient'

const BASE_URL = import.meta.env.VITE_API_URL

export async function generarReporteJson(body) {
  const res = await apiRequest('/api/reportes/rendimiento/generar/', {
    method: 'POST',
    body: JSON.stringify({ ...body, formato: 'json' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail))
  return data
}

export async function generarReportePdf(body) {
  const access = localStorage.getItem('access')
  const res = await fetch(`${BASE_URL}/api/reportes/rendimiento/generar/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body: JSON.stringify({ ...body, formato: 'pdf' }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Error al generar PDF')
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : 'reporte_rendimiento.pdf'
  const correos = parseInt(res.headers.get('X-Correos-Enviados') || '0', 10)
  return { blob, filename, correos }
}
