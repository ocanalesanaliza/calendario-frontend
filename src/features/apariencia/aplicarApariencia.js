import { esHexValido, mezclar, rgba } from './utils/color'

const STYLE_ID = 'apariencia-empresa'
const FONT_LINK_ID = 'apariencia-fuente'

// Cada calendario tiene su propia apariencia: los selectores la limitan a sus pantallas.
//  - tareas (Analiza): páginas .tema-analiza y el layout que no es de Tuvet.
//  - tuvet: todo lo que cuelga de .tuvet-app (su layout lleva .layout.tuvet-app).
const SELECTORES = {
  tareas: { kit: 'html:root .tema-analiza', layout: 'html:root .layout:not(.tuvet-app)' },
  tuvet: { kit: 'html:root .tuvet-app', layout: 'html:root .layout.tuvet-app' },
}

export function moduloDe(valor) {
  return valor === 'tuvet' ? 'tuvet' : 'tareas'
}
const NEGRO = '#000000'
const BLANCO = '#FFFFFF'

// Solo se cargan familias de esta lista (la misma que valida el backend).
export const FUENTES_PERMITIDAS = [
  'Plus Jakarta Sans', 'Inter', 'Poppins', 'Montserrat', 'Nunito Sans', 'Roboto',
  'Open Sans', 'Lato', 'Source Sans 3', 'DM Sans', 'Work Sans', 'Manrope',
]

export function pilaFuente(fuente) {
  const familia = FUENTES_PERMITIDAS.includes(fuente) ? fuente : 'Plus Jakarta Sans'
  return `'${familia}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
}

export function urlFuente(fuente) {
  if (!FUENTES_PERMITIDAS.includes(fuente)) return null
  return `https://fonts.googleapis.com/css2?family=${fuente.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`
}

function completo(apariencia) {
  return apariencia && Object.entries(apariencia)
    .filter(([campo]) => campo.startsWith('color_'))
    .every(([, valor]) => esHexValido(valor))
}

/*
 * Traduce la apariencia guardada a los tokens que ya usa el frontend, solo en su calendario:
 *  - --tv-* del kit compartido (.tema-analiza en Analiza o .tuvet-app en Tuvet),
 *  - --nav-* del menú (Layout.css), más los botones (--tv-btn-*).
 * `html:root` sube la especificidad para ganar a las reglas de tuvet.css y Layout.css.
 */
export function construirCss(a, moduloCalendario = 'tareas') {
  if (!completo(a)) return ''
  const { kit, layout } = SELECTORES[moduloDe(moduloCalendario)]
  const fuente = pilaFuente(a.fuente)
  const tokens = {
    '--tv-primary': a.color_primario,
    '--tv-primary-hover': a.color_primario_hover,
    '--tv-primary-accent': mezclar(a.color_primario, BLANCO, 0.15),
    '--tv-primary-soft': mezclar(a.color_primario, BLANCO, 0.85),
    '--tv-primary-softer': mezclar(a.color_primario, BLANCO, 0.94),
    '--tv-primary-border': mezclar(a.color_primario, BLANCO, 0.7),
    '--tv-primary-text': a.color_primario_hover,
    '--tv-ring': rgba(a.color_primario, 0.28),
    '--tv-accent': a.color_acento,
    '--tv-accent-soft': mezclar(a.color_acento, BLANCO, 0.85),
    '--tv-accent-text': mezclar(a.color_acento, NEGRO, 0.35),
    '--tv-bg': a.color_fondo,
    '--tv-surface': a.color_superficie,
    '--tv-surface-muted': mezclar(a.color_superficie, a.color_texto, 0.03),
    '--tv-surface-sunken': mezclar(a.color_superficie, a.color_texto, 0.06),
    '--tv-fg': a.color_texto,
    '--tv-text': mezclar(a.color_texto, a.color_texto_secundario, 0.5),
    '--tv-muted': a.color_texto_secundario,
    '--tv-subtle': mezclar(a.color_texto_secundario, a.color_superficie, 0.2),
    '--tv-border': a.color_borde,
    '--tv-border-strong': mezclar(a.color_borde, a.color_texto, 0.15),
    '--tv-danger': a.color_boton_peligro,
    '--tv-danger-hover': mezclar(a.color_boton_peligro, NEGRO, 0.15),
    '--tv-danger-text': a.color_error,
    '--tv-danger-soft': mezclar(a.color_error, BLANCO, 0.88),
    '--tv-success-text': a.color_exito,
    '--tv-success-soft': mezclar(a.color_exito, BLANCO, 0.86),
    '--tv-warning-text': a.color_advertencia,
    '--tv-warning-soft': mezclar(a.color_advertencia, BLANCO, 0.86),
    '--tv-btn-primary-bg': a.color_boton_primario,
    '--tv-btn-primary-fg': a.color_boton_primario_texto,
    '--tv-btn-primary-hover': mezclar(a.color_boton_primario, NEGRO, 0.15),
    '--tv-btn-secondary-bg': a.color_boton_secundario,
    '--tv-btn-secondary-fg': a.color_boton_secundario_texto,
    '--tv-btn-danger-bg': a.color_boton_peligro,
    '--tv-btn-danger-fg': a.color_boton_peligro_texto,
    '--tv-font': fuente,
  }
  const nav = {
    '--nav-bg': a.color_menu_fondo,
    '--nav-surface': mezclar(a.color_menu_fondo, BLANCO, 0.08),
    '--nav-border': mezclar(a.color_menu_fondo, BLANCO, 0.08),
    '--nav-border-strong': mezclar(a.color_menu_fondo, BLANCO, 0.18),
    '--nav-text': a.color_menu_texto,
    '--nav-text-muted': mezclar(a.color_menu_texto, a.color_menu_fondo, 0.25),
    '--nav-text-strong': mezclar(a.color_menu_texto, BLANCO, 0.6),
    '--nav-accent': a.color_menu_activo,
    '--nav-accent-strong': a.color_boton_primario,
    '--nav-accent-light': a.color_menu_activo,
    '--nav-accent-text': a.color_menu_activo_texto,
    '--nav-accent-bg': rgba(a.color_menu_activo, 0.18),
    '--nav-focus': a.color_menu_activo_texto,
    '--nav-font': fuente,
  }
  const bloque = (vars) => Object.entries(vars).map(([nombre, valor]) => `  ${nombre}: ${valor};`).join('\n')
  return [
    `${kit} {\n${bloque(tokens)}\n}`,
    `${layout} {\n${bloque(nav)}\n  background: ${a.color_fondo};\n}`,
    `${layout} .nav-item.active { background: var(--nav-accent-bg); color: var(--nav-accent-text); }`,
    `${layout} .nav-item:focus-visible { outline-color: var(--nav-accent-light); }`,
    `${layout} .topbar-brand svg { stroke: var(--nav-accent-light); }`,
    `${layout} .user-avatar,\n${layout} .sidebar-user-avatar { background: ${a.color_boton_primario}; color: ${a.color_boton_primario_texto}; }`,
  ].join('\n\n')
}

// Aplica (o quita, con null) la apariencia de un calendario. Devuelve el CSS aplicado.
export function aplicarApariencia(apariencia, moduloCalendario = 'tareas', doc = document) {
  const clave = moduloDe(moduloCalendario)
  const styleId = `${STYLE_ID}-${clave}`
  const fontId = `${FONT_LINK_ID}-${clave}`
  const css = construirCss(apariencia, clave)
  let style = doc.getElementById(styleId)
  if (!css) {
    style?.remove()
    doc.getElementById(fontId)?.remove()
    return ''
  }
  if (!style) {
    style = doc.createElement('style')
    style.id = styleId
  }
  style.textContent = css
  // Siempre al final del <head> para ganar a las hojas que Vite añade después.
  doc.head.appendChild(style)

  const href = urlFuente(apariencia.fuente)
  let link = doc.getElementById(fontId)
  if (href && apariencia.fuente !== 'Plus Jakarta Sans') {
    if (!link) {
      link = doc.createElement('link')
      link.id = fontId
      link.rel = 'stylesheet'
      doc.head.appendChild(link)
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  } else {
    link?.remove()
  }
  return css
}
