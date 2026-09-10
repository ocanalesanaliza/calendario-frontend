export const DIAS_SEMANA = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
]

const NOMBRES_DIAS = {
  lunes: '1', martes: '2', miercoles: '3', miércoles: '3', jueves: '4',
  viernes: '5', sabado: '6', sábado: '6', domingo: '7',
}

export const DIAS_MES = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: `Día ${index + 1}`,
}))

export const RECURRENCIA_LABEL = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  'mensual-dias': 'Mensual',
  'solo-sabado': 'Solo sábado',
  'lunes-a-sabado': 'Lunes a sábado',
  variable: 'Configuración especial',
  manual: 'Sin recurrencia automática',
}

export const TIPOS_CATALOGO = [
  'diario', 'semanal', 'quincenal', 'mensual-dias', 'solo-sabado', 'lunes-a-sabado',
]

export function normalizarValorRecurrencia(tipo, valor) {
  if (!valor) return ''
  const valores = String(valor).replaceAll(';', ',').split(',')
    .map((item) => item.trim().toLowerCase()).filter(Boolean)

  if (tipo === 'semanal') {
    return ordenarValores(valores.map((item) => NOMBRES_DIAS[item] ?? item), 7)
  }
  if (tipo === 'quincenal' || tipo === 'mensual-dias') {
    return ordenarValores(valores, 31)
  }
  return String(valor)
}

export function validarValorRecurrencia(tipo, valor) {
  const seleccionados = separarValores(normalizarValorRecurrencia(tipo, valor))
  if (tipo === 'semanal' && seleccionados.length === 0) {
    return 'Selecciona al menos un día de la semana.'
  }
  if (tipo === 'mensual-dias' && seleccionados.length === 0) {
    return 'Selecciona al menos un día del mes.'
  }
  return ''
}

export function recurrenciaDesdeReglas(reglas = []) {
  const activas = reglas.filter((regla) => regla.activa !== false)
  if (activas.length !== 1) {
    return { tipo: activas.length === 0 ? 'manual' : 'especial', valor: '', especial: activas.length > 1 }
  }

  const regla = activas[0]
  if (regla.tipo === 'semanal') {
    const valor = normalizarValorRecurrencia('semanal', regla.dias_semana)
    if (valor === '6') return { tipo: 'solo-sabado', valor: '', especial: false }
    if (valor === '1,2,3,4,5,6') return { tipo: 'lunes-a-sabado', valor: '', especial: false }
    return { tipo: 'semanal', valor, especial: false }
  }
  if (regla.tipo === 'quincenal' || regla.tipo === 'mensual-dias') {
    return { tipo: regla.tipo, valor: normalizarValorRecurrencia(regla.tipo, regla.dias_mes), especial: false }
  }
  if (regla.tipo === 'diario' || regla.tipo === 'manual') {
    return { tipo: regla.tipo, valor: '', especial: false }
  }
  return { tipo: 'especial', valor: '', especial: true }
}

export function construirReglasRecurrencia(tipo, valor, reglaExistente = null) {
  const reglaBase = {
    politica_dia_no_laborable: reglaExistente?.politica_dia_no_laborable || 'omitir',
    activa: true,
  }
  if (reglaExistente?.fecha_inicio) reglaBase.fecha_inicio = reglaExistente.fecha_inicio
  if (typeof reglaExistente?.cuenta_en_rendimiento === 'boolean') {
    reglaBase.cuenta_en_rendimiento = reglaExistente.cuenta_en_rendimiento
  }
  if (tipo === 'manual') return [{ ...reglaBase, tipo: 'manual' }]
  if (tipo === 'diario') return [{ ...reglaBase, tipo: 'diario' }]
  if (tipo === 'solo-sabado') return [{ ...reglaBase, tipo: 'semanal', dias_semana: '6' }]
  if (tipo === 'lunes-a-sabado') {
    return [{ ...reglaBase, tipo: 'semanal', dias_semana: '1,2,3,4,5,6' }]
  }
  if (tipo === 'semanal') {
    return [{ ...reglaBase, tipo: 'semanal', dias_semana: normalizarValorRecurrencia(tipo, valor) }]
  }
  if (tipo === 'quincenal' || tipo === 'mensual-dias') {
    return [{ ...reglaBase, tipo, dias_mes: normalizarValorRecurrencia(tipo, valor) }]
  }
  return null
}

export function obtenerLabelReglas(reglas = [], fallback = '—') {
  const labels = reglas.filter((regla) => regla.activa !== false)
    .map((regla) => regla.label).filter(Boolean)
  return labels.length ? labels.join(' · ') : fallback
}

export function separarValores(valor) {
  return String(valor || '').split(',').map((item) => item.trim()).filter(Boolean)
}

export function ordenarValores(valores, maximo) {
  return [...new Set(valores)]
    .filter((item) => /^\d+$/.test(item) && Number(item) >= 1 && Number(item) <= maximo)
    .sort((a, b) => Number(a) - Number(b)).join(',')
}
