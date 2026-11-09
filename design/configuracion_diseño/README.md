# Configuración de diseño

Estándar visual y de experiencia de usuario del frontend (`calendario-frontend`). Recoge **cómo** se diseñaron las pantallas del Calendario Tuvet y el menú del calendario de tareas (Analiza), para que las pantallas nuevas sigan las mismas reglas.

## Documentos

| Documento | Contenido |
|---|---|
| [01_metodologia.md](01_metodologia.md) | Herramienta usada (skill *ui-ux-pro-max*), flujo de trabajo, consultas realizadas y qué se aceptó o descartó. |
| [02_tokens.md](02_tokens.md) | Paleta, tipografía, espaciado, radios, sombras y movimiento de Tuvet y Analiza, con la tabla de contraste WCAG verificada. |
| [03_componentes_y_patrones.md](03_componentes_y_patrones.md) | Componentes reutilizables (`TuvetUi`), formularios, confirmaciones, estados vacíos y de carga, accesibilidad. |
| [04_pantallas_seguimiento.md](04_pantallas_seguimiento.md) | Especificación del panel de seguimiento (vistas Tabla, Tarjetas y Tablero) y de la pantalla de asignación. |
| [05_checklist.md](05_checklist.md) | Lista de comprobación obligatoria antes de entregar una pantalla. |

## Reglas de oro

1. **Colores solo mediante variables (tokens).** En Tuvet `--tv-*`; en el layout compartido `--nav-*`. Nunca un hex suelto en una regla nueva.
2. **Contraste mínimo 4.5:1** para texto normal (3:1 para texto ≥ 24 px o elementos no textuales). Se verifica con números, no a ojo.
3. **Nada se comunica solo con color:** cada estado lleva texto o icono.
4. **Formularios con etiqueta visible, error debajo del campo** y enlazado con `aria-describedby`; foco al primer campo con error.
5. **Acciones destructivas siempre con diálogo de confirmación** (`useConfirmacion`), nunca `window.confirm`.
6. **Zonas táctiles ≥ 40 px** (44 px en móvil) y foco visible en todo control.
7. **Respetar `prefers-reduced-motion`.**
8. **Iconos SVG**, nunca emoji.

## Dónde vive el código

| Pieza | Ruta en `calendario-frontend` |
|---|---|
| Tokens y estilos de Tuvet | `src/features/tuvet/tuvet.css` |
| Componentes base | `src/features/tuvet/components/TuvetUi.jsx` |
| Diálogo de confirmación | `src/features/tuvet/components/useConfirmacion.jsx` |
| Errores por campo | `src/features/tuvet/utils/formularios.js` |
| Vistas del panel | `src/features/tuvet/components/SeguimientoVistas.jsx` |
| Cálculos del panel | `src/features/tuvet/utils/seguimiento.js` |
| Layout y menú (Analiza, compartido) | `src/components/Layout/Layout.css`, `Layout.jsx` |

Prototipo visual de las opciones del panel (lienzo de diseño): https://claude.ai/artifact/7VAMcLT9YgnK1HauQj1fA6 — privado; compartirlo desde su menú *Share* si otras personas deben verlo.
