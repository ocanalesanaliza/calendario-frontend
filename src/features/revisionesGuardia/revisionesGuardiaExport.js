export const REVISION_EXPORT_HEADERS = [
  'Fecha',
  'Sucursal',
  'Código',
  'Gerente de área',
  'GS',
  'Resultado',
  'Cantidad de guardias',
  'Nota',
]

export function toRevisionExportSheetData(filas) {
  return [
    REVISION_EXPORT_HEADERS,
    ...filas.map((fila) => [
      fila.fecha,
      fila.sucursal,
      fila.codigo,
      fila.gerente,
      fila.gs,
      fila.resultado,
      fila.cantidadGuardias,
      fila.notaResumida,
    ]),
  ]
}
