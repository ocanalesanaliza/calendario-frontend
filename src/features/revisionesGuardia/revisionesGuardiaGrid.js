const EMPTY_VALUE = '—'
const NOTE_PREVIEW_LENGTH = 120

function displayName(value) {
  return value?.nombre ?? value?.nombre_usuario ?? EMPTY_VALUE
}

function guardCount(revision) {
  const guardias = revision.guardias ?? revision.detalle?.guardias ?? (revision.guardia ? [revision.guardia] : [])
  return guardias.length
}

function summarizedNote(value) {
  if (!value) return EMPTY_VALUE
  return value.length > NOTE_PREVIEW_LENGTH ? `${value.slice(0, NOTE_PREVIEW_LENGTH).trimEnd()}…` : value
}

export function toRevisionGridRow(revision, revisionIndex = 0) {
  return {
    id: revision.id_revision_guardia ?? revision.id_revision ?? revision.id ?? revisionIndex,
    fecha: revision.fecha ?? EMPTY_VALUE,
    sucursal: displayName(revision.sucursal) !== EMPTY_VALUE ? displayName(revision.sucursal) : (revision.nombre_sucursal ?? EMPTY_VALUE),
    codigo: revision.sucursal?.codigo ?? revision.codigo_sucursal ?? EMPTY_VALUE,
    gerente: displayName(revision.gerente_area),
    gs: displayName(revision.usuario) !== EMPTY_VALUE ? displayName(revision.usuario) : displayName(revision.gerente_sucursal),
    resultado: revision.no_se_presento_guardia ? 'No se presentó guardia' : 'Revisión realizada',
    cantidadGuardias: guardCount(revision),
    notaResumida: summarizedNote(revision.notas),
  }
}

export function toRevisionGridRows(revisiones) {
  return revisiones.map(toRevisionGridRow)
}

export const REVISION_GRID_COLUMNS = [
  { field: 'fecha', headerName: 'Fecha', width: 120 },
  { field: 'sucursal', headerName: 'Sucursal', flex: 1, minWidth: 170 },
  { field: 'codigo', headerName: 'Código', width: 130 },
  { field: 'gerente', headerName: 'Gerente de área', flex: 1, minWidth: 170 },
  { field: 'gs', headerName: 'GS', flex: 1, minWidth: 150 },
  { field: 'resultado', headerName: 'Resultado', minWidth: 190 },
  { field: 'cantidadGuardias', headerName: 'Cantidad de guardias', minWidth: 180, type: 'number' },
  { field: 'notaResumida', headerName: 'Nota resumida', flex: 1, minWidth: 220 },
  {
    field: 'accion',
    headerName: 'Acción',
    width: 130,
    sortable: false,
    filterable: false,
  },
]
