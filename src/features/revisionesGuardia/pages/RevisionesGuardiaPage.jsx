import { useEffect, useState } from 'react'
import { getSucursales } from '../../sucursales/services/sucursalesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { getAnaliticaRevisionesGuardia } from '../services/revisionesGuardiaAnaliticaService'
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

function nombre(value) {
  return value?.nombre ?? value?.nombre_usuario ?? '—'
}

function filasRevision(revision, revisionIndex) {
  const guardias = revision.guardias ?? revision.detalle?.guardias ?? (revision.guardia ? [revision.guardia] : [])
  const base = {
    id: revision.id_revision_guardia ?? revision.id_revision ?? revision.id ?? revisionIndex,
    fecha: revision.fecha ?? '—',
    sucursal: nombre(revision.sucursal) !== '—' ? nombre(revision.sucursal) : (revision.nombre_sucursal ?? '—'),
    codigo: revision.sucursal?.codigo ?? revision.codigo_sucursal ?? '—',
    gerente: nombre(revision.gerente_area),
    usuario: nombre(revision.usuario) !== '—' ? nombre(revision.usuario) : nombre(revision.gerente_sucursal),
  }
  if (guardias.length === 0) return [{ ...base, key: `${base.id}-sin-guardia`, guardia: null }]
  return guardias.map((guardia, index) => ({
    ...base,
    key: `${base.id}-${guardia.numero_guardia ?? index + 1}`,
    guardia,
  }))
}

export default function RevisionesGuardiaPage() {
  const [draft, setDraft] = useState(FILTROS_VACIOS)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [revision, setRevision] = useState(0)
  const [catalogos, setCatalogos] = useState({ sucursales: [], gerentes: [], usuarios: [] })
  const [carga, setCarga] = useState({ clave: null, results: [], count: 0, totalPages: 0, error: '' })
  const claveCarga = `${JSON.stringify(filtros)}:${page}:${pageSize}:${revision}`
  const loading = carga.clave !== claveCarga
  const results = loading ? [] : carga.results
  const count = loading ? 0 : carga.count
  const totalPages = loading ? 0 : carga.totalPages
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
    params.page = page
    params.page_size = pageSize
    getAnaliticaRevisionesGuardia(params)
      .then((data) => {
        if (!vigente) return
        const total = data.count ?? data.results?.length ?? 0
        setCarga({
          clave: claveCarga,
          results: data.results ?? [],
          count: total,
          totalPages: data.total_pages ?? Math.ceil(total / pageSize),
          error: '',
        })
      })
      .catch((err) => {
        if (vigente) setCarga({ clave: claveCarga, results: [], count: 0, totalPages: 0, error: err.message })
      })
    return () => { vigente = false }
  }, [filtros, page, pageSize, revision, claveCarga])

  function setFiltro(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function aplicarFiltros(event) {
    event.preventDefault()
    setPage(1)
    setFiltros({ ...draft })
    setRevision((value) => value + 1)
  }

  function limpiarFiltros() {
    setDraft(FILTROS_VACIOS)
    setFiltros(FILTROS_VACIOS)
    setPage(1)
    setRevision((value) => value + 1)
  }

  const filas = results.flatMap(filasRevision)

  return (
    <div className="revisiones-analitica-page">
      <div className="page-header">
        <div>
          <h1>Revisiones de guardia</h1>
          <p>{count} revisión{count !== 1 ? 'es' : ''} encontrada{count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <form className="revisiones-filtros" onSubmit={aplicarFiltros}>
        <label>Fecha<input type="date" value={draft.fecha} onChange={(e) => setFiltro('fecha', e.target.value)} /></label>
        <label>Desde<input type="date" value={draft.fecha_inicio} onChange={(e) => setFiltro('fecha_inicio', e.target.value)} /></label>
        <label>Hasta<input type="date" value={draft.fecha_fin} onChange={(e) => setFiltro('fecha_fin', e.target.value)} /></label>
        <label>Sucursal<select value={draft.id_sucursal} onChange={(e) => setFiltro('id_sucursal', e.target.value)}><option value="">Todas</option>{catalogos.sucursales.map((item) => <option key={item.id_sucursal} value={item.id_sucursal}>{item.nombre}</option>)}</select></label>
        <label>Gerente de área<select value={draft.id_gerente_area} onChange={(e) => setFiltro('id_gerente_area', e.target.value)}><option value="">Todos</option>{catalogos.gerentes.map((item) => <option key={item.id_gerente_area} value={item.id_gerente_area}>{item.nombre}</option>)}</select></label>
        <label>GS<select value={draft.id_usuario} onChange={(e) => setFiltro('id_usuario', e.target.value)}><option value="">Todos</option>{catalogos.usuarios.map((item) => <option key={item.id_usuario} value={item.id_usuario}>{item.nombre}</option>)}</select></label>
        <label className="revisiones-buscar">Buscar<input type="search" value={draft.buscar} onChange={(e) => setFiltro('buscar', e.target.value)} placeholder="Sucursal, código, GS, guardia, identidad o teléfono" /></label>
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
        <div className="table-card revisiones-table-wrap">
          <table className="revisiones-table">
            <thead><tr><th>Fecha</th><th>Sucursal</th><th>Código</th><th>Gerente de área</th><th>GS</th><th>Guardia</th><th>Nombre</th><th>Identidad</th><th>Teléfono</th></tr></thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.key}>
                  <td>{fila.fecha}</td><td>{fila.sucursal}</td><td>{fila.codigo}</td><td>{fila.gerente}</td><td>{fila.usuario}</td>
                  <td>{fila.guardia?.numero_guardia ?? '—'}</td>
                  <td>{fila.guardia ? [fila.guardia.primer_nombre, fila.guardia.segundo_nombre, fila.guardia.primer_apellido, fila.guardia.segundo_apellido].filter(Boolean).join(' ') : '—'}</td>
                  <td>{fila.guardia?.identidad ?? '—'}</td><td>{fila.guardia?.telefono || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="revisiones-pagination">
        <label>Por página<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
        {totalPages > 1 && <><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {page} de {totalPages}</span><button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button></>}
      </div>
    </div>
  )
}
