// Utilidades de color (mismas fórmulas WCAG que el backend en branding_palette.py).

export const MIN_CONTRASTE = 4.5

// Parejas texto/fondo revisadas; deben coincidir con CONTRAST_PAIRS del backend.
export const PAREJAS_CONTRASTE = [
  ['color_texto', 'color_fondo', 'Texto principal sobre el fondo'],
  ['color_texto', 'color_superficie', 'Texto principal sobre tarjetas'],
  ['color_texto_secundario', 'color_superficie', 'Texto secundario sobre tarjetas'],
  ['color_menu_texto', 'color_menu_fondo', 'Texto del menú'],
  ['color_menu_activo_texto', 'color_menu_fondo', 'Opción activa del menú'],
  ['color_boton_primario_texto', 'color_boton_primario', 'Texto del botón principal'],
  ['color_boton_secundario_texto', 'color_boton_secundario', 'Texto del botón secundario'],
  ['color_boton_peligro_texto', 'color_boton_peligro', 'Texto del botón de peligro'],
]

export function esHexValido(valor) {
  return typeof valor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(valor.trim())
}

function rgb(hex) {
  const limpio = hex.replace('#', '')
  return [0, 2, 4].map((indice) => parseInt(limpio.slice(indice, indice + 2), 16))
}

function hex(canales) {
  return `#${canales.map((canal) => Math.max(0, Math.min(255, Math.round(canal))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function mezclar(primero, segundo, peso) {
  const a = rgb(primero)
  const b = rgb(segundo)
  return hex(a.map((valor, indice) => valor + (b[indice] - valor) * peso))
}

export function rgba(color, alfa) {
  const [r, g, b] = rgb(color)
  return `rgba(${r}, ${g}, ${b}, ${alfa})`
}

function luminancia(color) {
  const [r, g, b] = rgb(color).map((valor) => {
    const canal = valor / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(primero, segundo) {
  if (!esHexValido(primero) || !esHexValido(segundo)) return null
  const [claro, oscuro] = [luminancia(primero), luminancia(segundo)].sort((x, y) => y - x)
  return Math.round(((claro + 0.05) / (oscuro + 0.05)) * 100) / 100
}

// Contraste de cada campo de texto, indexado por el campo de texto.
export function revisarContrastes(valores) {
  const resultado = {}
  for (const [texto, fondo, etiqueta] of PAREJAS_CONTRASTE) {
    const razon = contraste(valores?.[texto], valores?.[fondo])
    if (razon === null) continue
    const actual = resultado[texto]
    // Un mismo texto puede revisarse sobre dos fondos: se queda el peor caso.
    if (!actual || razon < actual.razon) resultado[texto] = { razon, fondo, etiqueta, ok: razon >= MIN_CONTRASTE }
  }
  return resultado
}
