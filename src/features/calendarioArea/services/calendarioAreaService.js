import { apiRequest } from '../../../services/apiClient'

export async function getMonthlyAreaOccurrences(month) {
  const res = await apiRequest(`/api/calendar/my-area/monthly-occurrences/?month=${encodeURIComponent(month)}`)
  const data = await res.json()

  if (!res.ok) throw new Error(data.detail || 'No se pudo cargar el calendario del área.')

  return data
}
