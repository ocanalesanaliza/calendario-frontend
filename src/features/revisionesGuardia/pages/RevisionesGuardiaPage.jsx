import { useEffect, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import * as XLSX from 'xlsx'
import { getSucursales } from '../../sucursales/services/sucursalesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { getAnaliticaRevisionesGuardia } from '../services/revisionesGuardiaAnaliticaService'
import { REVISION_GRID_COLUMNS, toRevisionGridRows } from '../revisionesGuardiaGrid'
import { toRevisionExportSheetData } from '../revisionesGuardiaExport'
import RevisionGuardiaDetalleModal from '../components/RevisionGuardiaDetalleModal'
import './RevisionesGuardiaPage.css'

const FILTROS_VACIOS = {
  fecha: '',
  fecha_inicio: '',
  fecha_fin: '',
  id_sucursal: '',
  id_gerente_area: '',
  id_usuario: '',
  buscar: '',
}

export default function RevisionesGuardiaPage() {
  const [draft, setDraft] = useState(FILTROS_VACIOS)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 })
  const [revision, setRevision] = useState(0)
  const [catalogos, setCatalogos] = useState({ sucursales: [], gerentes: [], usuarios: [] })
  const [carga, setCarga] = useState({ clave: null, results: [], count: 0, error: '' })
  const [detalleRevision, setDetalleRevision] = useState(null)
  const claveCarga = `${JSON.stringify(filtros)}:${paginationModel.page}:${paginationModel.pageSize}:${revision}`
  const loading = carga.clave !== claveCarga
  const results = loading ? [] : carga.results
  const count = loading ? 0 : carga.count
  const error = loading ? '' : carga.error

  useEffect(() => {
    let vigente = true
    Promise.allSettled([getSucursales(), getGerentes(), getUsuarios()]).then(([sucursales, gerentes, usuarios]) => {
      if (!vigente) return
      setCatalogos({
        sucursales: sucursales.status === 'fulfilled' ? sucursales.value : [],
        gerentes: gerentes.status === 'fulfilled' ? gerentes.value : [],
        usuarios: usuarios.status === 'fulfilled' ? usuarios.value : [],
      })
    })
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    let vigente = true
    const params = Object.fromEntries(Object.entries(filtros).filter(([, value]) => value !== ''))
    params.page = paginationModel.page + 1
    params.page_size = paginationModel.pageSize
    getAnaliticaRevisionesGuardia(params)
      .then((data) => {
        if (!vigente) return
        const total = data.count ?? data.results?.length ?? 0
        setCarga({
          clave: claveCarga,
          results: data.results ?? [],
          count: total,
          error: '',
        })
      })
      .catch((err) => {
        if (vigente) setCarga({ clave: claveCarga, results: [], count: 0, error: err.message })
      })
    return () => { vigente = false }
  }, [filtros, paginationModel, revision, claveCarga])

  function setFiltro(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function aplicarFiltros(event) {
    event.preventDefault()
    setPaginationModel((current) => ({ ...current, page: 0 }))
    setFiltros({ ...draft })
    setRevision((value) => value + 1)
  }

  function limpiarFiltros() {
    setDraft(FILTROS_VACIOS)
    setFiltros(FILTROS_VACIOS)
    setPaginationModel((current) => ({ ...current, page: 0 }))
    setRevision((value) => value + 1)
  }

  function cambiarPaginacion(nextModel) {
    setPaginationModel((current) => ({
      ...nextModel,
      page: nextModel.pageSize !== current.pageSize ? 0 : nextModel.page,
    }))
  }

  function abrirDetalle(id) {
    const revisionSeleccionada = results[filas.findIndex((fila) => fila.id === id)]
    if (!revisionSeleccionada) return
    setDetalleRevision(revisionSeleccionada)
  }

  function cerrarDetalle() {
    setDetalleRevision(null)
  }

  function exportarPaginaActual() {
    const worksheet = XLSX.utils.aoa_to_sheet(toRevisionExportSheetData(filas))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revisiones')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `revisiones-guardia-pagina-${paginationModel.page + 1}-${fecha}.xlsx`)
  }

  const filas = toRevisionGridRows(results)
  const gridColumns = REVISION_GRID_COLUMNS.map((column) => column.field === 'accion'
    ? { ...column, renderCell: (params) => <button type="button" className="btn-secondary" onClick={() => abrirDetalle(params.row.id)}>Ver detalle</button> }
    : column)

  return (
    <div className="revisiones-analitica-page">
      <div className="page-header">
        <div>
          <h1>Revisiones de guardia</h1>
          <p>{count} revisión{count !== 1 ? 'es' : ''} encontrada{count !== 1 ? 's' : ''}</p>
        </div>
        <div className="revisiones-export-actions">
          <span>Página actual: {paginationModel.page + 1}</span>
          <button type="button" className="btn-secondary" onClick={exportarPaginaActual} disabled={filas.length === 0}>Exportar página actual</button>
        </div>
      </div>

      <form className="revisiones-filtros" onSubmit={aplicarFiltros}>
        <label>Fecha<input type="date" value={draft.fecha} onChange={(e) => setFiltro('fecha', e.target.value)} /></label>
        <label>Desde<input type="date" value={draft.fecha_inicio} onChange={(e) => setFiltro('fecha_inicio', e.target.value)} /></label>
        <label>Hasta<input type="date" value={draft.fecha_fin} onChange={(e) => setFiltro('fecha_fin', e.target.value)} /></label>
        <label>Sucursal<select value={draft.id_sucursal} onChange={(e) => setFiltro('id_sucursal', e.target.value)}><option value="">Todas</option>{catalogos.sucursales.map((item) => <option key={item.id_sucursal} value={item.id_sucursal}>{item.nombre}</option>)}</select></label>
        <label>Gerente de área<select value={draft.id_gerente_area} onChange={(e) => setFiltro('id_gerente_area', e.target.value)}><option value="">Todos</option>{catalogos.gerentes.map((item) => <option key={item.id_gerente_area} value={item.id_gerente_area}>{item.nombre}</option>)}</select></label>
        <label>GS<select value={draft.id_usuario} onChange={(e) => setFiltro('id_usuario', e.target.value)}><option value="">Todos</option>{catalogos.usuarios.map((item) => <option key={item.id_usuario} value={item.id_usuario}>{item.nombre}</option>)}</select></label>
        <label className="revisiones-buscar">Buscar<input type="search" value={draft.buscar} onChange={(e) => setFiltro('buscar', e.target.value)} placeholder="Sucursal, código, GS o nota" /></label>
        <div className="revisiones-filter-actions">
          <button type="button" className="btn-secondary" onClick={limpiarFiltros}>Limpiar</button>
          <button type="submit" className="btn-primary">Aplicar filtros</button>
        </div>
      </form>

      {loading ? (
        <div className="loading-state">Cargando revisiones...</div>
      ) : error ? (
        <div role="alert" className="modal-error">{error}</div>
      ) : filas.length === 0 ? (
        <div className="empty-state">No hay revisiones para los filtros aplicados.</div>
      ) : (
        <div className="table-card revisiones-grid-wrap">
          <DataGrid
            columns={gridColumns}
            rows={filas}
            rowCount={count}
            loading={loading}
            pagination
            paginationMode="server"
            sortingMode="server"
            filterMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={cambiarPaginacion}
            pageSizeOptions={[10, 20, 50, 100]}
            disableColumnFilter
            disableColumnSorting
            disableRowSelectionOnClick
          />
        </div>
      )}
      {detalleRevision && <RevisionGuardiaDetalleModal revision={detalleRevision} onClose={cerrarDetalle} />}
    </div>
  )
}
