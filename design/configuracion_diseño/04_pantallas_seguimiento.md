# 04 · Panel de seguimiento y asignación (Tuvet)

Pantallas para el **encargado de departamento**: ver cómo avanzan sus gerentes de sucursal con las tareas asignadas y asignar plantillas.

| Ruta | Pantalla | Permiso |
|---|---|---|
| `/tuvet/seguimiento?vista=tabla\|tarjetas\|tablero` | Panel de seguimiento (inicio del encargado) | `canManageTasks` |
| `/tuvet/asignar?plantilla=<id>` | Asignar tareas | `canManageTasks` |

La vista elegida va en la URL para poder enlazar a cada vista y para que el botón Atrás funcione.

## Datos

- Fuente: `GET /api/tuvet/revisiones/?year&month&estado=` con tres consultas en paralelo (`pendiente`, `en_revision` y `aprobada`). Devuelve las ocurrencias de las tareas del encargado autenticado para todos los gerentes.
- **Cumplimiento = aprobadas / total del mes, sin contar las canceladas**, la misma regla que `GET /rendimiento/` del backend.
- **Meta: `META_CUMPLIMIENTO = 90` %** (`utils/seguimiento.js`). Es un valor de presentación; el backend no define meta. Si cambia, se cambia solo esa constante.
- Niveles: **En meta** (≥ 90 %), **Cerca** (≥ 75 %), **Bajo** (< 75 %), **Sin datos** (sin ocurrencias).

### Urgencia (`clasificarUrgencia`)

| Clave | Condición | Columna del tablero |
|---|---|---|
| `vencida` | Pendiente y `vencida = true`. | Vencidas |
| `hoy` | Pendiente con límite hoy. | Vencen hoy |
| `pronto` | Pendiente con límite en 1–3 días (`DIAS_PROXIMOS`). | Próximos 3 días |
| `normal` | Pendiente con límite posterior. | No se muestra en el tablero. |
| `revision` | `en_revision`. | Por revisar |

## Cabecera común

- Título "Seguimiento de tareas" y departamento.
- Selector de vista segmentado: **Tabla | Tarjetas | Tablero**.
- Selector de mes y botón principal **"+ Asignar plantilla"**.
- **Indicadores:**
  - Cumplimiento general: valor, "X de Y aprobadas", nivel y barra contra la meta. Si no se alcanza, indica cuántos puntos faltan.
  - Pendientes (en plazo).
  - Vencen pronto (con cuántas vencen hoy), en naranja.
  - Vencidas, en rojo.
  - Por revisar, con enlace a Revisiones.
- **Filtros** (Tabla y Tarjetas): buscador y chips con contador: Todos, Bajo la meta, Con vencidas, Por revisar.

## Vista A · Tabla

Una fila por gerente, ordenadas de menor a mayor cumplimiento.

| Columna | Contenido |
|---|---|
| Gerente de sucursal | Avatar, nombre y "N tareas este mes". |
| Cumplimiento | Valor, `BarraMeta` (barra + marcador de la meta) y nivel. |
| Estado del mes | Insignias: aprobadas, en revisión, pendientes y vencidas (solo las que tienen valor). |
| Próxima a vencer | Tarea más urgente con su fecha relativa, o "Nada pendiente". |
| Acción | "Ver tareas": modal con todas las ocurrencias del gerente. |

Uso recomendado: muchos gerentes y comparar de un vistazo.

## Vista B · Tarjetas

- Leyenda de colores de estado arriba, con la explicación de la línea de la meta.
- Tarjeta por gerente, ordenadas de menor a mayor cumplimiento (primero quien más ayuda necesita):
  - Cabecera con avatar, nombre, porcentaje y nivel.
  - `BarraEstados`: barra apilada de aprobadas, revisión, pendientes y vencidas, con la línea de la meta.
  - Contadores de los cuatro estados; el de vencidas se resalta en rojo si es mayor que cero.
  - "Próximas a vencer": las dos más urgentes.
  - Borde rojo suave si tiene vencidas.
- Uso recomendado: pocos gerentes, detalle por persona y móvil.

## Vista C · Tablero por urgencia

- Cuatro columnas: **Vencidas**, **Vencen hoy**, **Próximos 3 días** y **Por revisar**, con contador y una frase de ayuda.
- Cada tarjeta muestra la tarea, su fecha relativa, el gerente, la plantilla y "Con documento" si aplica.
- En "Por revisar", el botón **Revisar** lleva a `/tuvet/revisiones`.
- Una columna vacía muestra "Nada aquí".
- Uso recomendado: el trabajo del día ("¿qué necesita atención hoy?").

## Pantalla D · Asignar tareas

Sustituye a la antigua ventana de asignación. Tres pasos en una sola pantalla, con indicador de progreso:

1. **Plantilla:** lista de plantillas activas en tarjetas seleccionables y, debajo, "Incluye" con cada tarea y su programación.
2. **Gerentes de sucursal:**
   - Lista de todos los gerentes de la empresa (`/gerentes-sucursal/disponibles/`), con buscador y "Seleccionar todos".
   - Filtro "Solo los que dependen de mí" (`/gerentes-sucursal/`), que solo aparece si el encargado tiene gerentes a su cargo.
   - Los que ya tienen la plantilla aparecen marcados y bloqueados, con "Ya la tiene · desde [fecha]" y un botón **Quitar** que pide confirmación.
   - Los nuevos seleccionados muestran "Se asignará".
3. **Resumen:** plantilla, número de tareas, gerentes nuevos y cuántos ya la tenían, más una nota sobre la generación de ocurrencias. El botón **"Asignar a N gerente(s)"** está desactivado sin selección o si la plantilla no tiene tareas.

Desde Plantillas, tanto el botón "Asignar" como "Sí, asignar" (tras crear una plantilla) llevan a `/tuvet/asignar?plantilla=<id>`.

## Selector de empresa para Sistemas (`/empresas`)

- Pantalla de inicio de la **cuenta de Sistemas**: `HomeRoute` la redirige aquí desde `/` y desde el login.
- Una tarjeta por empresa de `GET /api/calendar/companies/` que tenga `modulo_calendario`. Si la API falla, se ofrecen las dos conocidas (Analiza y Tuvet) con un aviso.
- Cada tarjeta lleva el color de su calendario:
  - **Analiza** (`tareas`): índigo `#4f46e5`, lleva a `/calendario`.
  - **Tuvet** (`tuvet`): verde azulado `#0f766e`, lleva a `/tuvet`.
- La tarjeta entera es un enlace accesible ("Entrar a Analiza: Calendario de tareas"), con foco visible, zona de clic amplia y elevación al pasar el ratón (desactivada con movimiento reducido).
- Para volver: **"Cambiar de empresa"** en el menú del usuario de ambos calendarios y, en Tuvet, también en el menú lateral. El menú de Analiza ya no tiene el enlace "Calendario Tuvet".
- Código: `src/features/empresas/pages/SelectorEmpresaPage.jsx` y `.css`.

## Mis tareas del gerente de sucursal (`/tuvet/mis-tareas`)

- **Periodo** con selector segmentado **Día | Semana | Mes**. Por defecto es **Día (hoy)**. La URL guarda `?periodo=semana|mes&fecha=AAAA-MM-DD`; sin parámetros equivale a hoy.
- Navegación con ‹ ›: un día, una semana (de lunes a domingo) o un mes. El botón **Hoy** aparece cuando el periodo no incluye hoy.
- Títulos relativos: "Hoy · jueves 22 de octubre", "Mañana · …", "19 – 25 oct 2026", "Octubre 2026".
- Datos: `GET /mis-tareas/?year&month`. Una semana que cruza de mes consulta los dos meses y combina los resultados sin duplicados. El filtrado por periodo usa `fecha_programada` (`utils/periodos.js`).
- **Vista de hoy:** además de las tareas del día, una sección **Atrasadas** con las pendientes vencidas de días anteriores, para que no queden ocultas.
- **Semana y mes:** tareas agrupadas por día, con el día de hoy resaltado.
- **Tareas futuras:** si `fecha_programada` es posterior a hoy, no se muestra "Marcar realizada" sino "Disponible desde [fecha]" (`puedeMarcarse`). El backend lo valida igualmente y responde 400 con `detail.fecha_programada`; ese mensaje se muestra en el formulario de marcado.
- Vacío por periodo: "No tienes tareas programadas para este día", con la acción "Ver la semana".

## Prototipo

Lienzo con las cuatro opciones y datos de ejemplo: https://claude.ai/artifact/7VAMcLT9YgnK1HauQj1fA6 (privado).
