# 03 · Componentes y patrones

## Componentes base (`src/features/tuvet/components/TuvetUi.jsx`)

| Componente | Para qué | Notas de uso |
|---|---|---|
| `PageHeader` | Título, descripción y acciones de la página. | Acciones a la derecha; se apilan en pantallas estrechas. |
| `Aviso` | Mensajes de éxito, error, advertencia o información. | Lleva icono; `error` usa `role="alert"`, el resto `status` + `aria-live="polite"`. No roba el foco. |
| `EstadoCarga` | Carga, error con reintento, vacío y contenido. | Carga con esqueletos (reservan espacio); vacío con mensaje útil y `emptyAction` opcional. |
| `Modal` | Diálogos. | Atrapa el foco, lo devuelve al cerrar, enfoca el primer campo y Escape cierra solo el modal superior. Props: `title`, `subtitle`, `icon`, `tone` (`primary`, `success`, `danger`), `wide`, `footer`. En móvil se abre desde abajo. |
| `ConfirmDialog` / `useConfirmacion` | Confirmar acciones destructivas o irreversibles. | `confirmar({ title, message, detail, confirmLabel, tone, accion })`. Si `accion` falla, el error se muestra dentro del diálogo. |
| `FormSection` | Agrupa campos relacionados. | `fieldset` con `legend` accesible. |
| `Field` | Campo con etiqueta, ayuda y error. | Conecta `htmlFor`, `aria-invalid`, `aria-describedby` y `aria-required` al control hijo. Obligatorio: `*` rojo. |
| `Toggle` | Opción sí/no con descripción. | `role="switch"`. |
| `OptionCards` | Elegir una de 2–3 opciones explicadas. | Radios accesibles con tarjeta y marca de selección. |
| `ChipToggles` | Selección múltiple compacta (días de la semana). | Botones con `aria-pressed`. |
| `SelectableList` | Selección múltiple en listas largas. | Buscador, contador, "Todos" y "Limpiar"; avatares opcionales. |
| `FileDrop` | Subir evidencias. | Arrastrar y soltar o buscar; muestra nombre y tamaño. |
| `PasswordTemporalModal` | Mostrar la contraseña temporal una sola vez. | Botón Copiar; no se guarda en ningún almacenamiento. |
| `MesSelector`, `EstadoBadge`, `Avatar`, `Icono`, `Checkbox` | Piezas pequeñas. | `EstadoBadge` combina icono y texto. `Icono` es SVG con `aria-hidden`. |

Componentes del panel en `SeguimientoVistas.jsx`: `BarraMeta`, `BarraEstados`, `LeyendaEstados`, `NivelBadge`, `VistaTabla`, `VistaTarjetas` y `VistaTablero` (ver [04_pantallas_seguimiento.md](04_pantallas_seguimiento.md)).

## Temas: Tuvet y Analiza

El kit (`TuvetUi`, `useConfirmacion`, `formularios.js` y las clases `tuvet-*` de `tuvet.css`) es **compartido**. Los colores llegan por variables `--tv-*` definidas en la raíz de la página:

| Clase raíz | Paleta | Uso |
|---|---|---|
| `.tuvet-app` | Verde azulado (`#0F766E`) | Todo el calendario Tuvet (la aplica `TuvetLayout`). |
| `.tema-analiza` | Índigo (`#4F46E5`) | Páginas del calendario de tareas rediseñadas: **Catálogo de tareas** (`/tareas`), **Conteo de inventario** (`/inventario-demo`), **Sucursales** (`/sucursales`), **Plantillas** (`/plantillas` y `/plantillas/:id`), **Vacaciones y situaciones del área** (`/ausencias-area`), **Configuración** (`/configuracion`), **Usuarios** (`/usuarios`), **Gerentes de área** (`/gerentes`), **Gerentes de operaciones** (`/gerentes-operaciones`) y **Revisiones de guardia** (`/analitica/revisiones-guardia`). |

**Acciones de fila:** con hasta tres acciones, botones con texto (`tuvet-btn` dentro de `td.tuvet-cell-acciones`). Con más de tres, como en Sucursales, botones con icono `tuvet-icon-action` de 36 px, siempre con `aria-label` descriptivo ("Editar Sucursal Centro") y `title` visible al pasar el ratón; las destructivas añaden `tuvet-icon-action-danger`.

En **Conteo de inventario** se conserva la tabla editable de MUI (`DataGrid`) con su lógica de edición y navegación con Tab; solo se le aplican los tokens (`--tv-*`) mediante `sx` y `InventarioConteo.css`. `InventarioDemo.css` se mantiene por los estilos de la celda editable.

Para rediseñar otra página de Analiza con este estándar:

1. Envolver la página en `<div className="tema-analiza tuvet-page …">` e importar `features/tuvet/tuvet.css`.
2. Usar los componentes del kit (`PageHeader`, `Field`, `FormSection`, `Modal`, `EstadoCarga`, `Aviso`, `Toggle`, `OptionCards`) y `useConfirmacion` para acciones destructivas.
3. Los estilos propios de la página van en un CSS nuevo, con todo limitado a la clase raíz de la página (p. ej. `.tareas-catalogo …`).
4. **No borrar el CSS antiguo de la página** sin comprobar antes que ninguna otra página dependa de sus clases genéricas (`.btn-primary`, `.modal`, `.badge`…), porque todos los CSS se cargan de forma global.

Caso del catálogo: `TareasPage.css` se conserva porque da estilo al `RecurrenceSelector`, compartido con Plantillas y Mis tareas. `TareasCatalogo.css` adapta ese selector al kit dentro de cualquier página `.tema-analiza` (catálogo y detalle de plantilla).

Caso de Plantillas: `PlantillasPage.css` y `PlantillaDetallePage.css` se conservan; los estilos nuevos van en `PlantillasKit.css`, limitados a `.plantillas-kit` (prefijos `pk-` para la lista y `pd-` para el detalle). En el detalle, la jornada se distingue con insignias (`pd-jornada-manana` amarillo, `pd-jornada-tarde` índigo) y el catálogo para agregar tareas bloquea las que ya están en esa jornada con la etiqueta "Ya agregada".

Caso de Vacaciones y situaciones del área (`AusenciasKit.css`, prefijo `ak-`): para que no se confundan, cada tipo de ausencia tiene un **acento propio** (variables `--ak-acento*`): vacaciones en índigo con icono de calendario y situaciones especiales en ámbar con icono de alerta. Los administradores las ven en **pestañas con forma de tarjeta** (`role="tablist"`, flechas izquierda/derecha) con título, para qué sirve y contador ("2 pendientes", "3 activas"); la tabla de cada pestaña lleva una franja superior con su color. Las solicitudes del GA son tarjetas con borde izquierdo del color del estado. `AusenciasAreaPage.css` ya no se importa porque solo tenía clases de esta página.

La tabla de vacaciones del administrador empieza con la columna **"Gerente Área"**, que muestra quién solicitó: iniciales y nombre, o "—" si el backend no envía el dato. Ese dato llega en la misma lista de solicitudes, sin otra petición. La tabla de situaciones usa el mismo criterio para su columna de GA.

Caso de Configuración (`ConfiguracionKit.css`, prefijo `ck-`), variante **lista compacta** elegida frente a "frases con el número" y "solo lectura + Editar": una sola tarjeta con una fila por ajuste, con nombre corto, icono (i) y el número con la unidad "días". La explicación larga solo aparece en un tooltip de la (i), al pasar el ratón o al enfocarla con el teclado, y queda enlazada con `aria-describedby`. Hay un único botón "Guardar"; si un valor es inválido, el error aparece bajo su fila y el foco va a ese campo. Se descartó una primera versión con tarjetas por tema, barra fija y resumen de errores porque sobrecargaba la página para solo cinco valores. A la derecha (debajo en pantallas de 900 px o menos) hay un panel con dos tarjetas: **Última actualización**, con las iniciales, el nombre, el tiempo relativo ("hace 3 días") y la fecha completa, y **Así queda hoy**, que convierte los valores en fechas reales desde hoy (o "hoy" si el valor es 0) y se actualiza mientras se edita. Además:
- La (i) incluye el **valor de fábrica**, copiado de los `default` del modelo `ConfiguracionSolicitudes`; si cambian en el backend, hay que actualizar `CAMPOS[].fabrica`.
- **"Restaurar valores de fábrica"** solo rellena el formulario y no guarda nada.
- Una fila editada muestra la píldora **"antes: X"** hasta guardar.
- La tarjeta de última actualización recuerda que **solo el admin maestro** puede modificar los valores y que son globales.

Caso de Usuarios (`UsuariosKit.css`, prefijo `uk-`): sigue el patrón de Sucursales.
- **Barra:** buscador local por nombre, correo, sucursal o gerente, y chips **Activos / Inactivos**. Los chips sustituyen al antiguo desplegable "Mostrar" y siguen pidiendo al backend `habilitado=false`.
- **Tabla sin ancho mínimo:** el usuario va con iniciales, nombre y correo debajo, recortado si es largo. Las iniciales se ocultan a 1280 px o menos.
- **Estado:** insignia Activo/Inactivo y, si aplica, "Cambiar contraseña" en ámbar. El subtítulo cuenta cuántos usuarios deben cambiarla.
- **Acciones:** cuatro botones de icono (Editar, Resetear contraseña, Cambiar sucursal y Desactivar).
- **Confirmaciones:** resetear la contraseña pide confirmación con `useConfirmacion`, igual que desactivar.
- **Contraseña temporal:** solo vive en el estado del modal y se descarta al cerrarlo.

Caso de Gerentes de área (`GerentesKit.css`, prefijo `gk-`): igual que Usuarios.
- **Filtros:** chips Todos/Activos/Inactivos con contador, filtrados en el navegador (por defecto, Activos).
- **Rol:** insignia índigo con llave para el admin maestro y neutra para el gerente de área.
- **Acciones:** hasta cuatro botones de icono (Editar, Asignar área, Resetear contraseña y Desactivar).
- **Desactivar** (`alertdialog`) muestra el impacto antes de confirmar: número de sucursales y usuarios a cargo, la lista de sucursales con su código y, si hace falta, el gerente de destino con su error en línea.
- **Asignar área:** usa `AreaManagerAssignmentModal`, compartido con otras pantallas, y no se rediseñó aquí.
- El antiguo `Toast` se sustituyó por un `Aviso` de éxito.

Caso de Gerentes de operaciones (`GerentesOperacionesKit.css`, prefijo `gok-`): igual que Gerentes de área, con estas diferencias.
- **Áreas:** se muestran como etiquetas (`tuvet-tag`) con el código y el nombre completo en el `title`. El buscador también encuentra por área.
- **Subtítulo:** cuenta los gerentes activos que no tienen áreas asignadas.
- **Gestionar áreas:** muestra las áreas actuales y explica las dos operaciones del backend, cada una con su botón: "Asignar ahora" (área libre) y "Programar reasignación" (área ocupada).
- **Nuevo gerente:** las áreas opcionales se eligen con `SelectableList`.
- **Errores del backend:** los errores 400 por campo se siguen mostrando en su campo.

Caso de Revisiones de guardia (`RevisionesGuardiaKit.css`, prefijo `rk-`):
- **Tabla compacta:** sustituye al `DataGrid` de MUI; se eligió frente a "lista agrupada por día" y "tarjetas". Pasa de 9 a 6 columnas: Fecha (día y mes, con el año debajo), Sucursal (con el código debajo), Responsables (GS, con "GA:" debajo), Resultado, Guardias y Nota recortada. Las filas sin guardia llevan una franja roja a la izquierda (`rk-sin-guardia`).
- **Paginación:** propia y en el servidor. Muestra "Mostrando X–Y de N", el selector "Por página" (10/20/50/100), anterior/siguiente y los números de página con saltos (`aria-current="page"`). La exportación a Excel no cambia.
- **Filtros:** van en una tarjeta con `Field`. Los atajos **Hoy / Últimos 7 días / Este mes** solo rellenan Desde y Hasta y se aplican con "Aplicar filtros".
- **Resultado:** insignia verde "Realizada" o roja "Sin guardia" (el detalle y el Excel conservan el texto completo). Sobre la tabla se cuenta cuántas revisiones de la página no tuvieron guardia.
- **`RevisionGuardiaDetalleModal`:**
  - Usa las clases `tuvet-modal` y mantiene su propio foco y ciclo de Tab.
  - Cada guardia es una tarjeta con borde verde si porta todo o rojo si le falta algo.
  - Los faltantes se muestran como etiquetas rojas.
  - La identidad y el teléfono siguen apareciendo solo en el detalle, nunca en la tabla.

## Apariencia por empresa y país (tokens dinámicos)

Los colores, la fuente y el logo pueden personalizarse por **empresa y país** desde **Administración → Apariencia** (Analiza, `/apariencia`) y **Apariencia** (Tuvet, `/tuvet/apariencia`). Se guardan en el backend (`organization_branding`).

- **Una apariencia por calendario y país.** Por ejemplo, Tuvet · Honduras, Tuvet · El Salvador, Analiza · Honduras y Analiza · Guatemala tienen cada una la suya. Cada apariencia se aplica **solo a su calendario**:
  - las de empresas con módulo `tareas` en `.tema-analiza` y en `.layout:not(.tuvet-app)`;
  - las de módulo `tuvet` en `.tuvet-app` y en `.layout.tuvet-app`.

  Hay un `<style>` por calendario: `apariencia-empresa-tareas` y `apariencia-empresa-tuvet`.
- `AparienciaProvider` (`features/apariencia/AparienciaContext.jsx`) pide `GET /api/v1/organization/branding/current/` al iniciar sesión.
  - Un usuario normal recibe la de su empresa y país.
  - Una cuenta de sistemas elige empresa y país **por calendario**, con el botón "Ver este país en …" o al guardar. La elección se recuerda en `localStorage`, en `apariencia-vista-sistemas` = `{ tareas: {...}, tuvet: {...} }`.
- `useApariencia('tareas' | 'tuvet')` devuelve la apariencia de ese calendario. `Layout` usa `'tareas'` y `TuvetLayout`, `'tuvet'`. La página Apariencia de cada calendario solo lista las empresas de su módulo.
- `aplicarApariencia.js` traduce los 21 colores a los tokens existentes (`--tv-*`, `--nav-*` y los nuevos `--tv-btn-*`) e inyecta `<style id="apariencia-empresa">` con selectores `html:root …` para ganar a `tuvet.css` y `Layout.css`. También carga la fuente de Google Fonts solo si está en la lista permitida.
- Sin apariencia guardada no se inyecta nada y se ven los colores de siempre.
- **Botones:** `.tuvet-btn`, `.tuvet-btn-secondary` y `.tuvet-btn-danger-solid` leen `--tv-btn-primary-bg/-fg/-hover`, `--tv-btn-secondary-bg/-fg` y `--tv-btn-danger-bg/-fg`. Si no hay apariencia, usan como respaldo los tokens del tema, así que el aspecto no cambia.
- **Logo:** si existe, sustituye al icono y al nombre del calendario en la barra superior. Se muestra con `.topbar-logo`: 44 px de alto y hasta 220 px de ancho; en móvil, 36 × 150 px.
  - La página Apariencia muestra una réplica de la barra a tamaño real.
  - Revisa el logo cargado (`utils/logo.js`): márgenes vacíos, transparencia, proporción entre 1,5:1 y 5:1, al menos 88 px de alto y contraste de 3:1 o más con el fondo del menú.
  - Ofrece **"Ajustar logo automáticamente"**, que recorta los márgenes y lo deja a 132 px de alto, siempre en el navegador.
  - Incluye la guía "Recomendaciones para que el logo se vea bien".
  - **Peso:** se aceptan archivos de hasta **8 MB** (`LOGO_ARCHIVO_MAX_BYTES`), pero se guardan como máximo **256 KB** (límite del backend). Los archivos más pesados se reducen en el navegador con el mismo ajuste automático, escalándolos primero a 2000 px de lado para analizarlos. El límite guardado es bajo a propósito: el logo va en base64 en `current/` y se descarga en cada carga de la aplicación.
- **Página:** incluye selector de empresa y país, logo, fuente con muestra, recomendaciones de paletas (backend), colores por grupo con su contraste y una vista previa.
  - La opción "Ver los cambios en toda la aplicación" aplica los valores antes de guardar.
  - Una cuenta de sistemas ve aplicada la última empresa y país que guardó (se recuerda en `localStorage`).
- Los contrastes usan la misma fórmula y las mismas parejas en el frontend (`utils/color.js`) y en el backend (`branding_palette.py`).

## Patrón: formularios

1. **Etiqueta siempre visible.** El texto de ejemplo dentro del campo complementa, nunca sustituye.
2. **Agrupar** con `FormSection` en bloques con título que responden a una pregunta ("¿Qué hay que hacer?", "¿Cuándo?", "¿Cómo se verifica?").
3. **Validar al salir del campo** (`onBlur`), no mientras se escribe; al cambiar el valor, se limpia el error de ese campo.
4. **Error debajo del campo** que explica la causa y cómo corregirla. Ejemplo: "La recurrencia quincenal necesita exactamente dos días distintos (ej. 1, 15)", no "Valor inválido".
5. **Al enviar con errores, el foco va al primer campo inválido** (`enfocarPrimerError`).
6. **Errores del backend:** `erroresDelServidor(error, campos)` coloca cada error en su campo; lo que no corresponde a un campo va en un `Aviso` al principio del formulario.
7. **Botón de envío con estado:** texto concreto ("Crear tarea", "Guardar cambios") y "Guardando…" con `aria-busy`.
8. **Tipos de entrada semánticos** (`email`, `datetime-local`, `inputMode="numeric"`) y `autoComplete` cuando aplique.

## Patrón: acciones destructivas

- Siempre `useConfirmacion`, con un título del tipo "Desactivar tarea", el mensaje con el nombre del elemento, el detalle de las consecuencias y un botón con el verbo ("Desactivar", "Quitar", "Retirar").
- Tono `danger`: botón rojo sólido, separado del de Cancelar.
- Prohibido: `window.confirm`, `window.prompt` y `window.alert`.

## Patrón: estados de la información

| Situación | Qué mostrar |
|---|---|
| Cargando | Esqueletos (`.tuvet-skeleton`), nunca solo "Cargando…". |
| Error al cargar | Mensaje y botón "Reintentar". |
| Vacío | Qué falta y cómo resolverlo, con la acción principal ("Crear tarea", "Asignar plantilla"). |
| Vacío por un filtro | "Sin resultados para «…»" y, si aplica, dónde sí hay resultados. |
| Éxito | `Aviso` de éxito breve y concreto. |

## Patrón: estados y urgencia

- Estados de ocurrencia: **pendiente** (amarillo), **en revisión** (verde azulado claro), **aprobada** (verde), **cancelada** (gris), **vencida** (rojo). Siempre con texto y, en las insignias, con icono.
- Urgencia con **fechas relativas**: "Vence hoy 18:00", "Mañana 09:30", "En 3 días", "Venció hace 2 días".

## Patrón: accesibilidad

- Foco visible en todo control: `outline` de 2 px, o anillo `box-shadow` en campos; nunca quitarlo sin reemplazo.
- Enlace "Saltar al contenido" en cada layout.
- Pestañas con `role="tablist"`, `aria-selected` y navegación con flechas.
- Iconos decorativos con `aria-hidden="true"`; botones solo con icono con `aria-label`.
- Contadores con texto para lectores de pantalla ("3 pendientes"), nunca un número suelto.
- Gráficos con `role="img"` y `aria-label` que enumera los valores.

## Patrón: diseño adaptable

- Puntos de corte: 640 px (móvil), 900 px (tablet y menú plegable de Analiza) y 1100 px (indicadores en dos columnas).
- Las tablas se desplazan dentro de su contenedor (`.tuvet-table-wrap`), nunca la página entera.
- Por debajo de 640 px: formularios en una columna, modales desde abajo, botones del pie a todo el ancho y campos con 16 px de texto para evitar el zoom automático.
