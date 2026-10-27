# Historial de rendimiento de áreas para GO

Objetivo: entregar la consulta de solo lectura GO.A para rendimiento histórico segmentado por Área, responsabilidad y período. Rama: `ga_performance`. Estrategia: un commit local por GO.A; no hay operaciones remotas. Verificación: pruebas focalizadas, lint y suite completa.

## Specs

S1. "GO.A: GO route, navigation, selector, segmented history, filters, cursor pagination, and read-only presentation."
S2. "GO.B: authorized occurrence and gap evidence modals." permanece pendiente y no forma parte de esta unidad.
S3. "GO.C: verification and closure." permanece pendiente y no forma parte de esta unidad.
S4. "Route: /historial-rendimiento-go" y "Navigation label: Rendimiento de áreas" en Analítica; no reutilizar ni extender `/rendimiento`.
S5. "canAccessGOAreaPerformanceHistory" es una compuerta UX únicamente para GO activo/habilitado y con rol coincidente; no infiere autoridad histórica continua, no concede acceso a Áreas, no recrea autorización backend ni expone capacidades Systems.
S6. El selector usa exclusivamente `GET /api/calendar/performance/areas/` con `business_date`, `from_month` y `to_month`; sus resultados ya representan la autoridad histórica continua completa para el rango exacto. No usar `GET /api/calendar/areas/`.
S7. El historial usa exclusivamente `GET /api/calendar/performance/history/` con `area_id`, `business_date`, `from_month`, `to_month`, `cursor` y `limit`; el rango es inclusivo, menor de 24 meses y un cursor opaco se reenvía sin transformación.
S8. Las filas se mantienen segmentadas por Área + responsabilidad + período y muestran Área, responsabilidad, período, estado, pesos esperado/acreditado, porcentaje, `as_of` y versión solo definitiva. `not_applicable` muestra "No aplica", pesos 0 y nunca 0 %.
S9. GO.A es estrictamente de solo lectura: no muestra `snapshot_id`, correcciones, recibos, auditorías, alertas, aprobaciones, reconocimientos, acciones masivas ni controles de mutación.
S10. La página usa `.tema-analiza`, componentes TuvetUi y tokens `--tv-*`/`--nav-*`, SVG, foco de teclado, movimiento reducido y estructura adaptable de tabla/tarjetas.

## Tasks

T1 — S1, S4-S10 — inline — completed — GREEN: servicio/página GO 7 pruebas, App/Layout/políticas 213 pruebas y lint pasaron; commit pendiente. Riesgo: item 3 (la consulta GO debe depender de la autoridad continua del backend y no recrear capacidades Systems/T8).
T2 — S2 — pending — Fuera de alcance de GO.A: modales de evidencia de ocurrencia y brecha.
T3 — S3 — pending — Fuera de alcance de GO.A: verificación y cierre de fase completa.

## Log

L1 (2026-10-27): "You are the frontend implementation agent for GO.A: read-only GO Area performance history."
L2 (2026-10-27): Preflight registrado antes de escribir: branch `ga_performance`; HEAD `df6d0d02afe74621cc0b55ba78e5fed9373eef4d`; subject `feat(frontend): integra T8 de rendimiento GA`; estado permitido: solo `?? .opencode/`.
L3 (2026-10-27): Se leyeron las guías de diseño, el contrato backend del selector GO, el plan de proyección GA y los patrones frontend T8/App/Layout/perfiles antes de implementar.
L4 (2026-10-27): Pre-GO unresolved integration condition: not a GO defect and not a stable baseline. Comando exacto: `npm.cmd run test -- src/features/operationalAlerts/pages/OperationalAlertsPage.test.jsx`.

```text
> calendario@0.0.0 test
> vitest run src/features/operationalAlerts/pages/OperationalAlertsPage.test.jsx


 RUN  v4.1.11 C:/Users/Desarrollador/Documents/proyectos/calendario-frontend

 ❯ src/features/operationalAlerts/pages/OperationalAlertsPage.test.jsx (6 tests | 1 failed) 325ms
     × loads active alerts by default and preserves server order 126ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/features/operationalAlerts/pages/OperationalAlertsPage.test.jsx > OperationalAlertsPage > loads active alerts by default and preserves server order
TestingLibraryElementError: Unable to find an element with the text: /Consulta de solo lectura para Sistemas/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Ignored nodes: comments, script, style
<body>
  <div>
    <div class="tema-analiza tuvet-page operational-alerts-page">
      <div class="tuvet-page-header">
        <div>
          <h1>Alertas operativas</h1>
        </div>
      </div>
      <div aria-label="Alcance de alertas operativas" class="tuvet-tabs" role="tablist">
        <button aria-selected="true" class="tuvet-tab active" role="tab" type="button">Activas</button>
        <button aria-selected="false" class="tuvet-tab " role="tab" type="button">Historial</button>
      </div>
      <div aria-label="Cargando" class="tuvet-skeleton" role="status"><span /><span /><span /></div>
    </div>
  </div>
</body>
 ❯ Object.getElementError node_modules/@testing-library/dom/dist/config.js:37:19
 ❯ Object.getElementError node_modules/@testing-library/dom/dist/query-helpers.js:76:38
 ❯ Object.getElementError node_modules/@testing-library/dom/dist/query-helpers.js:52:17
 ❯ Object.getElementError node_modules/@testing-library/dom/dist/query-helpers.js:95:19
 ❯ src/features/operationalAlerts/pages/OperationalAlertsPage.test.jsx:20:19
     18|     expect(screen.getByRole('status', { name: 'Cargando' })).toBeInThe…
     19|     expect(screen.getByRole('heading', { name: 'Alertas operativas' })…
     20|     expect(screen.getByText(/Consulta de solo lectura para Sistemas/))…
       |                   ^
     21|     expect(screen.getByRole('tablist', { name: 'Alcance de alertas ope…
     22|     expect(screen.getByRole('tab', { name: 'Activas' })).toHaveAttribu…

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
   Start at  10:15:17
   Duration  1.81s (transform 133ms, setup 298ms, import 121ms, tests 325ms, environment 922ms)

Exited with code 1
```

L5 (2026-10-27): RED observado antes de la implementación: las suites GO no resolvían `goPerformanceHistoryService` ni `GOAreaPerformanceHistoryPage`; las pruebas de la nueva capacidad, ruta y navegación fallaban porque todavía no existían. Resultado: 5 archivos de prueba fallidos, 20 fallas y 193 pruebas existentes pasaron.
L6 (2026-10-27): GREEN focal: `npm.cmd run test -- src/features/goPerformanceHistory/services/goPerformanceHistoryService.test.js src/features/goPerformanceHistory/pages/GOAreaPerformanceHistoryPage.test.jsx` pasó con 2 archivos y 7 pruebas. Cubre solicitudes exactas del selector/consulta, no usar `/api/calendar/areas/`, cursor opaco, rango, Área inactiva, segmentos, definitivo/provisional, N/A, `snapshot_id` oculto, ausencia de controles de mutación y estados de carga/error/foco/estructura adaptable.
L7 (2026-10-27): GREEN de integración: `npm.cmd run test -- src/App.test.jsx src/components/Layout/Layout.test.jsx src/features/auth/profilePolicies.test.js` pasó con 3 archivos y 213 pruebas. La matriz permite solo GO activo/habilitado y niega/oculta GA, GA reasignado, Admin Master, Master Admin, GS, Systems, GO inactivo y GO deshabilitado.
L8 (2026-10-27): `npm.cmd run lint` pasó sin errores. `git diff --check` pasó.
L9 (2026-10-27): Suite completa `npm.cmd run test`: 75 archivos/714 pruebas pasaron; 4 archivos/13 pruebas fallaron exclusivamente en deuda conocida: 11 fallas de `localStorage.clear` en Login/Apariencia, el timeout intermitente de Inventario y la condición de integración Alerts pre-GO registrada en L4. No se reparó ni modificó ninguno de esos ámbitos.
L10 (2026-10-27): GO.A completado. GO.B y GO.C siguen pendientes y fuera de este commit. La UI consulta únicamente el selector de rango autorizado y el historial backend; no implementa detalle de ocurrencias/brechas ni capacidades Systems/T8. Riesgo: item 3 (el backend mantiene la autoridad histórica continua por Área y rango).
