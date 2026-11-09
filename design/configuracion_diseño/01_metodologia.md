# 01 · Metodología

## Herramienta

Las decisiones de diseño se tomaron con la skill **UI/UX Pro Max** (`ui-ux-pro-max`, licencia MIT, repositorio `nextlevelbuilder/ui-ux-pro-max-skill`).

- **Instalación:** manual, en `~/.claude/skills/ui-ux-pro-max` (copia de `.claude/skills/ui-ux-pro-max` del repositorio, sin `scripts/tests`). Se revisó antes de instalar: el buscador solo usa la biblioteca estándar de Python y no hace llamadas de red.
- **Requisito:** Python 3.x.
- **Buscador:** `python "%USERPROFILE%\.claude\skills\ui-ux-pro-max\scripts\search.py" "<consulta>" --domain <dominio>`.

La skill aporta un catálogo local de estilos, paletas, tipografías, guías de UX (119), tipos de gráfico y reglas por tecnología, más una tabla de prioridades (accesibilidad → interacción → rendimiento → estilo → diseño adaptable → tipografía y color → animación → formularios → navegación → gráficos).

## Flujo de trabajo seguido

1. **Analizar el requisito:** tipo de producto, usuarios, contexto de uso y tecnología (detectada en `package.json`: React 19 + Vite, CSS plano).
2. **Sistema de diseño** (`--design-system`) solo para una dirección visual nueva (Tuvet). Para Analiza se conservaron los colores existentes y solo se consultaron reglas.
3. **Consultas puntuales** (`--domain ux|chart|icons`, `--stack react`): una intención por consulta, de 2 a 5 términos.
4. **Validar cada resultado** frente al producto. Si una consulta no devuelve nada, se reintenta una vez; si sigue vacía, se aplica la regla general de la tabla de prioridades y se indica.
5. **Verificar el contraste con números** (script WCAG; ver [02_tokens.md](02_tokens.md)).
6. **Implementar con tokens y componentes compartidos**, con tests y lint en verde.
7. **Repasar la lista de comprobación** ([05_checklist.md](05_checklist.md)).

## Consultas realizadas y decisiones

### Sistema de diseño de Tuvet

Consulta: `"internal task management productivity dashboard approvals" --design-system --density 7 --motion 3 --variance 3`.

| Resultado | Decisión |
|---|---|
| Estilo *Minimalism & Swiss Style* | **Aceptado.** Recomendado para herramientas internas y dashboards. |
| Paleta teal (`#0D9488`) + acento naranja (`#EA580C`) | **Aceptada con ajuste:** blanco sobre `#0D9488` da 3.74:1 (falla). El primario de botones pasa a teal-700 `#0F766E` (5.47:1). `#0D9488` queda para acentos y anillos de foco. |
| Tipografía Plus Jakarta Sans | **Aceptada.** Pensada para aplicaciones SaaS de productividad. |
| Patrón *Product Demo + Features* | **Descartado:** es para páginas de venta. |
| Animación GSAP *Scroll Reveal* | **Descartada:** el proyecto no usa GSAP; se usan transiciones CSS breves. |

### Formularios y accesibilidad (`--domain ux`)

| Consulta | Regla aplicada |
|---|---|
| `modal focus trap keyboard` | Foco visible en todos los controles; el modal atrapa el foco y lo devuelve al cerrar. |
| `inline validation error field` | Error debajo del campo, con `aria-describedby`; resumen enfocable cuando hay varios. |
| `status color not only indicator` | Ningún estado solo con color: texto o icono siempre. |
| `data table mobile responsive` | Tablas con desplazamiento horizontal dentro de su contenedor, o tarjetas. |
| `touch target size spacing` | Zonas táctiles ≥ 40 px (44 px en móvil); 8 px entre objetivos. |
| `reduced motion transition timing` | `prefers-reduced-motion` desactiva animaciones; duraciones como tokens. |
| `emoji used as icons` (dos intentos) | Sin coincidencia en el catálogo; se aplica la regla general de la skill: iconos SVG, nunca emoji. |

Referencia leída: `references/quick-reference.md` §8 (*Forms & Feedback*): `input-labels`, `error-placement`, `required-indicators`, `empty-states`, `confirmation-dialogs`, `inline-validation`, `error-clarity`, `focus-management`, `touch-friendly-input`, `destructive-emphasis`, `toast-accessibility`.

### Menú del calendario de tareas (Analiza)

Sin sistema de diseño nuevo: se conservó la paleta. Consultas `--domain ux`: estado activo de la navegación, etiquetas en menú contraído, contadores para lectores de pantalla, navegación por teclado, contraste en fondos oscuros. Referencia: §9 (`nav-label-icon`, `nav-state-active`, `adaptive-navigation`).

| Regla | Aplicación |
|---|---|
| `nav-state-active` | Página actual con fondo, color, peso y barra lateral. |
| `nav-label-icon` | En modo compacto, etiqueta visible al pasar el ratón y al enfocar con teclado. |
| `adaptive-navigation` | Por debajo de 900 px el menú lateral pasa a panel desplegable. |
| Contadores | Texto oculto "N pendientes"; botón de notificaciones con `aria-label` descriptivo. |
| *Skip links* | Enlace "Saltar al contenido". |
| Migas de pan | **Descartadas:** la navegación tiene un solo nivel (la regla aplica a partir de tres). |

### Panel de seguimiento (`--domain chart|ux`)

| Consulta | Resultado | Decisión |
|---|---|---|
| `progress completion percentage goal` (chart) | *Bullet chart* para rendimiento contra meta; barra 100 % apilada como alternativa. | **Aceptado:** barra con marcador de meta + barra apilada de estados. |
| `status by person comparison` (chart) | Radar. | **Descartado:** demasiado complejo para el uso diario; se usa tabla. |
| `deadline due date urgency` (ux) | Fechas relativas o según la configuración regional. | **Aceptado:** "Vence hoy 18:00", "Venció hace 2 días". |
| `data table vs card view toggle` (ux) | Tablas desplazables o tarjetas en móvil; nunca depender de *hover*. | **Aceptado:** vistas Tabla y Tarjetas intercambiables. |
| `assign items bulk selection` (ux) | Selección múltiple y acciones en bloque. | **Aceptado:** pantalla de asignación con "Seleccionar todos". |
| `task management team workload dashboard` (product) | Producto LMS. | **Descartado:** no encaja con el dominio. |

## Cómo repetir el proceso en una pantalla nueva

```powershell
$s = "$env:USERPROFILE\.claude\skills\ui-ux-pro-max\scripts\search.py"
$env:PYTHONIOENCODING = "utf-8"
python $s "<una intención, 2-5 términos>" --domain ux -n 3
python $s "<componente o patrón>" --stack react -n 3
```

No incluir datos privados (nombres de personas, correos) en las consultas.
