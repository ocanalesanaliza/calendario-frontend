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

export const GUARDIA_EXPORT_HEADERS = [
  'Fecha',
  'Sucursal',
  'Código',
  'Gerente de sucursal',
  'Resultado',
  'Número de guardia',
  'Nombre completo',
  'Teléfono',
  'Uniforme no portado',
  'Equipamiento no portado',
  'Nota',
]

const EMPTY_VALUE = '—'

const UNIFORME_LABELS = {
  botas: 'Botas',
  zapatillas: 'Zapatillas',
  tenis: 'Tenis',
  camisa_con_logo: 'Camisa con logo',
  pantalon_tela: 'Pantalón de tela',
  pantalon_jean: 'Pantalón jean',
  gorra: 'Gorra',
}

const EQUIPAMIENTO_LABELS = {
  porta_carnet: 'Porta carnet',
  revolver: 'Revólver',
  escopeta: 'Escopeta',
  tolete: 'Tolete',
  libro_novedades: 'Libro de novedades',
}

function displayName(value) {
  return value?.nombre ?? value?.nombre_usuario ?? EMPTY_VALUE
}

function fullName(guardia) {
  const name = guardia.nombre_completo
    ?? guardia.nombre
    ?? [guardia.primer_nombre, guardia.segundo_nombre, guardia.primer_apellido, guardia.segundo_apellido]
      .filter(Boolean)
      .join(' ')

  return name || EMPTY_VALUE
}

function getGuardias(revision) {
  return revision.guardias ?? revision.detalle?.guardias ?? (revision.guardia ? [revision.guardia] : [])
}

function missingItems(items, labels, emptyLabel) {
  const missing = Object.entries(labels)
    .filter(([key]) => items?.[key] === false)
    .map(([, label]) => label)

  return missing.length ? missing.join(', ') : emptyLabel
}

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

export function toGuardiaExportSheetData(revisiones) {
  const guardiaRows = revisiones.flatMap((revision) => {
    const sucursal = displayName(revision.sucursal) !== EMPTY_VALUE ? displayName(revision.sucursal) : (revision.nombre_sucursal ?? EMPTY_VALUE)
    const gerenteSucursal = displayName(revision.usuario) !== EMPTY_VALUE ? displayName(revision.usuario) : displayName(revision.gerente_sucursal)
    const resultado = revision.no_se_presento_guardia ? 'No se presentó guardia' : 'Revisión realizada'

    return getGuardias(revision).map((guardia, index) => [
      revision.fecha ?? EMPTY_VALUE,
      sucursal,
      revision.sucursal?.codigo ?? revision.codigo_sucursal ?? EMPTY_VALUE,
      gerenteSucursal,
      resultado,
      guardia.numero_guardia ?? index + 1,
      fullName(guardia),
      guardia.telefono ?? EMPTY_VALUE,
      missingItems(guardia.uniforme, UNIFORME_LABELS, 'Sin faltantes de uniforme.'),
      missingItems(guardia.equipamiento, EQUIPAMIENTO_LABELS, 'Sin faltantes de equipamiento.'),
      revision.notas ?? EMPTY_VALUE,
    ])
  })

  return [GUARDIA_EXPORT_HEADERS, ...guardiaRows]
}
