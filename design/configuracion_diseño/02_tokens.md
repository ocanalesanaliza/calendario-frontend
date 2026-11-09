# 02 · Tokens de diseño

Los colores, tamaños y tiempos se definen **una vez** como variables CSS y las reglas los consumen por nombre.

## Tuvet (`src/features/tuvet/tuvet.css`, ámbito `.tuvet-app`)

### Color

| Token | Valor | Uso |
|---|---|---|
| `--tv-primary` | `#0F766E` | Botones principales, selección, barra "en meta". |
| `--tv-primary-hover` | `#115E59` | Botón principal al pasar el ratón. |
| `--tv-primary-accent` | `#0D9488` | Anillo de foco y acentos no textuales. **No** usar como fondo de texto blanco. |
| `--tv-primary-soft` / `-softer` | `#CCFBF1` / `#F0FDFA` | Fondos de selección, avatares, insignias. |
| `--tv-primary-border` | `#99F6E4` | Bordes de elementos seleccionados. |
| `--tv-primary-text` | `#115E59` | Texto de marca sobre fondos claros. |
| `--tv-ring` | `rgba(13,148,136,.28)` | Halo de foco en campos. |
| `--tv-accent` / `-soft` / `-text` | `#EA580C` / `#FFEDD5` / `#9A3412` | Urgencia "vence hoy" y retrasos. |
| `--tv-bg` | `#F4F8F8` | Fondo de la aplicación. |
| `--tv-surface` / `-muted` / `-sunken` | `#FFFFFF` / `#F8FAFC` / `#F1F5F9` | Tarjetas, cuerpo de modales, pistas de barras. |
| `--tv-fg` / `--tv-text` / `--tv-muted` / `--tv-subtle` | `#0F172A` / `#334155` / `#475569` / `#64748B` | Títulos, texto, secundario, ayudas. |
| `--tv-border` / `-strong` | `#E2E8F0` / `#CBD5E1` | Bordes. |
| `--tv-danger` / `-hover` / `-soft` / `-text` | `#DC2626` / `#B91C1C` / `#FEE2E2` / `#B91C1C` | Acciones destructivas, vencidas, errores. |
| `--tv-success-soft` / `-text` | `#DCFCE7` / `#166534` | Aprobadas, "en meta". |
| `--tv-warning-soft` / `-text` | `#FEF9C3` / `#854D0E` | Pendientes, "cerca de la meta", próximos días. |
| `--tv-chart-high` / `-mid` / `-low` | `#16A34A` / `#D97706` / `#DC2626` | Barras de rendimiento por nivel. |
| `--tv-state-approved` / `-review` / `-pending` / `-overdue` | `#0F766E` / `#5EEAD4` / `#CBD5E1` / `#DC2626` | Barra apilada de estados. Difieren también en luminosidad, no solo en tono. |
| `--tv-board-bg` | `#EAF1F1` | Fondo de las columnas del tablero. |

### Tipografía

- Familia: **Plus Jakarta Sans** (Google Fonts, pesos 400–700) con respaldo `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. Si la red bloquea Google Fonts, se usa la fuente del sistema sin romper nada.
- Texto base del contenido: 15 px (`.9375rem`), interlineado 1.5.
- Mínimo absoluto: 12 px (`.75rem`) para insignias y contadores.
- Títulos de página 1.5 rem (700); secciones .95–1 rem (700).
- Números en indicadores y tablas: `font-variant-numeric: tabular-nums`.

### Forma, espacio y movimiento

| Token | Valor |
|---|---|
| `--tv-radius-sm` / `--tv-radius` / `--tv-radius-lg` | 8 / 12 / 16 px |
| `--tv-shadow-sm` / `--tv-shadow` / `--tv-shadow-lg` | Sombras sutiles; `-lg` solo para modales. |
| `--tv-target` | 40 px (44 px por debajo de 640 px): alto mínimo de botones y campos. |
| `--tv-dur-fast` / `--tv-dur` | 150 / 220 ms |
| `--tv-ease` | `cubic-bezier(.2,.8,.2,1)` |

Espaciado: múltiplos de 4 px; separación habitual entre bloques de 16–20 px y dentro de tarjetas de 10–14 px.

## Analiza: layout y menú compartidos (`src/components/Layout/Layout.css`, ámbito `.layout`)

Se conservó la paleta original del calendario de tareas.

| Token | Valor | Uso |
|---|---|---|
| `--nav-bg` / `--nav-surface` | `#0f172a` / `#1e293b` | Barra superior y menú lateral; *hover*. |
| `--nav-text` / `-muted` / `-strong` | `#cbd5e1` / `#94a3b8` / `#f1f5f9` | Texto del menú. |
| `--nav-accent` / `-strong` / `-light` / `-text` | `#6366f1` / `#4f46e5` / `#818cf8` / `#c7d2fe` | Índigo de marca, avatar, indicador activo, texto activo. |
| `--nav-accent-bg` | `rgba(99,102,241,.18)` | Fondo del elemento activo. |
| `--nav-danger` | `#dc2626` | Contadores de notificaciones. |
| `--nav-focus` | `#a5b4fc` | Anillo de foco sobre fondo oscuro. |
| `--nav-font` | Plus Jakarta Sans + respaldo del sistema | Tipografía de la barra superior, el menú lateral y los desplegables (la misma que Tuvet). El contenido de cada página de Analiza conserva su tipografía. |

Comportamiento del menú lateral: expandido muestra icono y nombre de cada sección, elementos de 42 px de alto, texto de 14.4 px (`.9rem`) y encabezados de grupo de 11.5 px en mayúsculas. En Analiza **siempre inicia contraído** (solo iconos, con etiqueta al pasar el ratón o al enfocar) y se expande o contrae con el **botón de menú (hamburguesa) de la barra superior**; la elección dura lo que la sesión en pantalla y no se guarda. Por debajo de 900 px ese mismo botón abre y cierra el menú como panel lateral, siempre con nombres. No hay botón de contraer dentro del menú lateral.

Iconos del menú de Analiza (trazo de 2 px, estilo lineal, un icono distinto por opción y acorde a su nombre):

| Opción | Icono |
|---|---|
| Mis tareas | Portapapeles con check |
| Depósitos pendientes | Billete |
| Calendario del área | Calendario con días marcados |
| Mi almuerzo | Tenedor y cuchillo |
| Rendimiento | Línea de tendencia al alza |
| Solicitudes pendientes | Bandeja de entrada |
| Tareas (catálogo) | Lista con checks |
| Conteo de inventario | Caja con lista |
| Sucursales | Fachada de tienda con toldo |
| Áreas | Mapa plegado |
| Organización | Organigrama |
| Plantillas | Hojas apiladas |
| Vacaciones y situaciones del área | Avión |
| Plantillas de área | Plantilla con bloques |
| Situaciones especiales | Triángulo de advertencia |
| Cambio sucursal temporales | Flechas de ida y vuelta |
| Usuarios | Grupo de personas |
| Gerentes de área | Persona con marcador de ubicación |
| Gerentes de operaciones | Maletín |
| Admin Masters | Escudo con llave |
| Dashboard | Paneles |
| Reportes | Documento con gráfico de barras |
| Revisiones de guardia | Escudo con check |
| Configuración | Engranaje |

### Tema Analiza para páginas (`.tema-analiza`, en `tuvet.css`)

Mismas variables `--tv-*` que Tuvet, con la marca en índigo: `--tv-primary #4F46E5`, `--tv-primary-hover #4338CA`, `--tv-primary-accent #6366F1`, `--tv-primary-soft #E0E7FF`, `--tv-primary-softer #EEF2FF`, `--tv-primary-border #C7D2FE`, `--tv-primary-text #3730A3`, `--tv-bg #EEF1F6`. Los colores semánticos (peligro, éxito, advertencia), la tipografía, los radios y el movimiento son los mismos que en Tuvet.

| Par | Ratio |
|---|---|
| Blanco sobre `#4F46E5` | 6.29:1 |
| Blanco sobre `#4338CA` | 7.90:1 |
| `#3730A3` sobre `#E0E7FF` | 8.06:1 |
| `#4338CA` sobre `#EEF2FF` | 7.07:1 |
| `#6366F1` (foco, no textual) sobre blanco | 4.47:1 (≥ 3:1) |

El layout de Tuvet reutiliza `Layout.css` y redefine las variables `--nav-accent*` y `--nav-focus` con su verde azulado en `.tuvet-app.layout`.

## Contraste verificado (WCAG 2.x)

Calculado con la fórmula de luminancia relativa; mínimo 4.5:1 para texto normal y 3:1 para elementos no textuales.

| Par | Ratio | Estado |
|---|---|---|
| Blanco sobre `#0D9488` (primario propuesto) | 3.74:1 | Falla → no usar para texto |
| Blanco sobre `#0F766E` (`--tv-primary`) | 5.47:1 | Cumple |
| Blanco sobre `#115E59` (hover) | 7.58:1 | Cumple |
| `#475569` sobre blanco (`--tv-muted`) | 7.58:1 | Cumple |
| `#64748B` sobre blanco (`--tv-subtle`) | 4.76:1 | Cumple |
| `#B91C1C` sobre `#FEE2E2` (peligro) | 5.30:1 | Cumple |
| `#9A3412` sobre `#FFEDD5` (acento) | 6.38:1 | Cumple |
| `#854D0E` sobre `#FEF9C3` (pendiente) | 6.38:1 | Cumple |
| `#166534` sobre `#DCFCE7` (aprobada) | 6.49:1 | Cumple |
| `#115E59` sobre `#CCFBF1` (marca suave) | 6.73:1 | Cumple |
| Menú: `#64748b` sobre `#0f172a` (antes) | 3.75:1 | Falla → sustituido por `#94a3b8` (6.96:1) |
| Menú: blanco sobre `#ef4444` (antes) | 3.76:1 | Falla → sustituido por `#dc2626` (4.83:1) |
| Menú: blanco sobre `#6366f1` (antes) | 4.47:1 | Al límite → avatar con `#4f46e5` (6.29:1) |
| Menú: `#c7d2fe` sobre fondo activo | 10.36:1 | Cumple |
| Menú: `#4f46e5` sobre `#e0e7ff` (contador) | 5.10:1 | Cumple |

Script de verificación (Python, sin dependencias):

```python
def luminancia(hex_color):
    c = [int(hex_color.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    l = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]

def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

print(round(contraste('#FFFFFF', '#0F766E'), 2))  # 5.47
```

Todo color nuevo se añade como token y su par de texto se verifica con este script antes de usarlo.
