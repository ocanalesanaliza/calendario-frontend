# Cumplimiento de envíos en el historial de depósitos

La pantalla mantiene las consultas existentes y los identificadores opacos de sucursal y cierre.
El resumen financiero y la tabla no dependen de la disponibilidad del calendario.

## Contrato financiero existente

`DepositGAHistoryView` devuelve los importes de cada sucursal dentro de
`branches[].summary`, separados de `id`, `code` y `name`:

```json
{
  "branches": [{
    "id": "identificador-opaco-firmado",
    "code": "CMG-001",
    "name": "Comayagua",
    "summary": {
      "total_sales": "210000.00",
      "cash_sales": "74300.00",
      "card_sales": "135700.00",
      "deposited_amount": "64300.00",
      "outstanding_amount": "10000.00",
      "closures_total": 18,
      "closures_pending_reconciliation": 2
    }
  }]
}
```

Los valores del ejemplo son ilustrativos; la estructura se contrastó con
`tareas/views/api_depositos.py` y `tareas/serializers/deposito_serializer.py`
en la referencia local `origin/dev` del backend, commit `a0ebfc6`.
`normalizeHistoryBranch` proyecta únicamente los campos financieros y conserva
los identificadores firmados. No se necesitan consultas adicionales por sucursal.

El contador `closures_total` corresponde a cierres de reportes enviados dentro
del rango autorizado; no es un denominador de cierres esperados. La conciliación
financiera tampoco determina si se envió un cierre.

## Integración pendiente del servidor

El contrato actual utilizado por el frontend no proporciona envíos esperados y faltantes.
No se encontró `submission_compliance` en la referencia de backend inspeccionada.
Se propone agregar este bloque **opcional** a la respuesta existente de
`GET /api/depositos/ga/historial/?from=YYYY-MM-DD&to=YYYY-MM-DD`:

```json
{
  "submission_compliance": {
    "branches": [
      {
        "branch_id": "mismo-identificador-opaco-de-branches",
        "calendar_status": "resolved",
        "expected_count": 25,
        "submitted_count": 18,
        "missing_count": 7
      }
    ]
  }
}
```

Este ejemplo es un contrato propuesto, no datos reales ni confirmación de una API desplegada.
El frontend ya puede representar este bloque cuando el backend lo entregue.

Las tres cantidades deben usar la misma unidad: cierres esperados cuyo plazo de envío
ya venció en el rango consultado. El backend debe resolver calendario, horario,
excepciones y supervisión histórica de cada sucursal; excluir fechas futuras o cuyo
plazo no haya vencido, y contar los envíos según esos mismos cierres, sin duplicados.
`submitted_count + missing_count` debe ser igual a `expected_count`.
Un cierre enviado pendiente de conciliación cuenta como enviado: los estados
financieros no determinan el estado del envío.

No se asumen días de lunes a viernes ni un cierre por día. Si el calendario no puede
resolverse, devolver otro `calendar_status` y conteos nulos. El frontend excluye esa
sucursal del cálculo, informa la cobertura parcial y nunca la acusa de faltar envíos.
Solo acepta enteros no negativos, datos coherentes e identificadores presentes en
`branches`; no envía consultas adicionales por sucursal ni inventa un endpoint.

Si falta el bloque, la sección permanece visible con «Cumplimiento aún no disponible».
La tabla de datos desplegable ofrece una alternativa accesible al gráfico.
