# 05 · Lista de comprobación antes de entregar una pantalla

Basada en el *Pre-Delivery Checklist* de la skill ui-ux-pro-max y en las reglas de este estándar. Una pantalla no se entrega con casillas sin marcar.

## Accesibilidad (crítico)

- [ ] El texto tiene un contraste ≥ 4.5:1, verificado con el script de [02_tokens.md](02_tokens.md).
- [ ] Ningún estado se comunica solo con color (siempre texto o icono).
- [ ] Todo control es alcanzable con Tab, en orden lógico, y tiene foco visible.
- [ ] Los botones solo con icono tienen `aria-label`; los iconos decorativos, `aria-hidden`.
- [ ] Los modales atrapan el foco y lo devuelven al cerrar (usar `Modal`).
- [ ] Los gráficos y barras tienen `role="img"` y `aria-label` con los valores.

## Interacción

- [ ] Zonas táctiles ≥ 40 px (44 px en móvil), con 8 px de separación.
- [ ] Todos los elementos pulsables tienen `cursor: pointer` y un estado al pasar el ratón con transición de 150–250 ms.
- [ ] Ninguna acción importante depende solo del *hover*.
- [ ] Las acciones destructivas usan `useConfirmacion`.
- [ ] Los envíos muestran estado de carga y un resultado.

## Formularios

- [ ] Etiqueta visible en cada campo y `*` en los obligatorios.
- [ ] El error aparece debajo del campo, explica cómo corregirlo y está enlazado con `aria-describedby`.
- [ ] Al enviar con errores, el foco va al primer campo inválido.
- [ ] Los errores del backend se muestran en su campo (`erroresDelServidor`).

## Estilo y consistencia

- [ ] Solo tokens (`--tv-*`, `--nav-*`); ningún hex nuevo suelto.
- [ ] Iconos SVG, ningún emoji.
- [ ] Componentes de `TuvetUi` en lugar de marcado propio equivalente.
- [ ] Texto ≥ 12 px; números con `tabular-nums` en tablas e indicadores.

## Diseño adaptable

- [ ] Probado a 375, 768, 1024 y 1440 px de ancho.
- [ ] Sin desplazamiento horizontal de la página (las tablas se desplazan dentro de su contenedor).
- [ ] Formularios en una columna en móvil.

## Movimiento

- [ ] `prefers-reduced-motion` respetado (las reglas globales de `tuvet.css` y `Layout.css` ya lo cubren; no añadir animaciones fuera de ellas).

## Calidad

- [ ] Tests de la pantalla (servicio, lógica y flujo principal) en verde.
- [ ] ESLint sin errores.
- [ ] Estados de carga, error y vacío implementados.
