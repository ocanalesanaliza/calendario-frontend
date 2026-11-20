# Cumplimiento de envíos en el historial de depósitos

La pantalla mantiene las consultas existentes y los identificadores opacos de sucursal y cierre.
El resumen financiero y la tabla no dependen de la disponibilidad del calendario.

## Integración pendiente del servidor

El contrato actual utilizado por el frontend no proporciona envíos esperados y faltantes.
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
