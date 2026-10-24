import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { getSucursales } from '../../sucursales/services/sucursalesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { getAnaliticaRevisionesGuardia } from '../services/revisionesGuardiaAnaliticaService'
import { toRevisionGridRows } from '../revisionesGuardiaGrid'
import { toGuardiaExportSheetData, toRevisionExportSheetData } from '../revisionesGuardiaExport'
import RevisionGuardiaDetalleModal from '../components/RevisionGuardiaDetalleModal'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Field, Icono, PageHeader } from '../../tuvet/components/TuvetUi'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './RevisionesGuardiaPage.css'
import './RevisionesGuardiaKit.css'

const FILTROS_VACIOS = {
  fecha: '',
  fecha_inicio: '',
  fecha_fin: '',
  id_sucursal: '',
  id_gerente_area: '',
  id_usuario: '',
  buscar: '',
}

const WORKSHEET_LAYOUTS = {
  Revisiones: [12, 28, 16, 28, 24, 24, 22, 42],
  Guardias: [12, 28, 16, 28, 24, 18, 32, 16, 42, 42, 42],
}

// Fecha local en formato AAAA-MM-DD (toISOString usaría UTC y podría cambiar de día).
function isoLocal(fecha) {
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-')
}

// Atajos de rango: solo rellenan Desde/Hasta en el borrador; se aplican con "Aplicar filtros".
const RANGOS = [
  { clave: 'hoy', etiqueta: 'Hoy', rango: (hoy) => [hoy, hoy] },
  { clave: '7', etiqueta: 'Últimos 7 días', rango: (hoy) => [new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6), hoy] },
  { clave: 'mes', etiqueta: 'Este mes', rango: (hoy) => [new Date(hoy.getFullYear(), hoy.getMonth(), 1), hoy] },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "2026-09-09" → { dia: '9 sep', anio: '2026' }; si no es una fecha, se muestra tal cual.
function partesFecha(valor) {
  const match = String(valor ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return { dia: valor || '—', anio: '' }
  return { dia: `${Number(match[3])} ${MESES[Number(match[2]) - 1]}`, anio: match[1] }
}

// Páginas visibles: primera, última y las vecinas de la actual; null marca un salto.
function paginasVisibles(actual, total) {
  const paginas = []
  for (let n = 1; n <= total; n += 1) {
    if (n === 1 || n === total || Math.abs(n - actual) <= 1) paginas.push(n)
    else if (paginas.at(-1) !== null) paginas.push(null)
  }
  return paginas
}

function createGuardReviewWorksheet(sheetData, widths, page, generatedAt) {
  const [headers, ...dataRows] = sheetData
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Revisiones de guardia'],
    [`Página ${page}`, `Generado: ${generatedAt.toISOString()}`],
    [],
    headers,
    ...dataRows,
  ])
  worksheet['!cols'] = widths.map((wch) => ({ wch }))
  worksheet['!rows'] = [{}, {}, {}, { hpt: 32 }]
  worksheet['!autofilter'] = { ref: `A4:${XLSX.utils.encode_col(headers.length - 1)}${4 + dataRows.length}` }
  return worksheet
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

  function aplicarRango(rango) {
    const [desde, hasta] = rango(new Date())
    setDraft((current) => ({ ...current, fecha: '', fecha_inicio: isoLocal(desde), fecha_fin: isoLocal(hasta) }))
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
    const generatedAt = new Date()
    const page = paginationModel.page + 1
    const fecha = generatedAt.toISOString().slice(0, 10)
    const revisionesWorksheet = createGuardReviewWorksheet(toRevisionExportSheetData(filas), WORKSHEET_LAYOUTS.Revisiones, page, generatedAt)
    const guardiasWorksheet = createGuardReviewWorksheet(toGuardiaExportSheetData(results), WORKSHEET_LAYOUTS.Guardias, page, generatedAt)
    const workbook = XLSX.utils.book_new()
    workbook.Props = {
      Title: 'Revisiones de guardia',
      Subject: `Página ${page} exportada el ${generatedAt.toISOString()}`,
      Author: 'Calendario',
      CreatedDate: generatedAt,
    }
    XLSX.utils.book_append_sheet(workbook, revisionesWorksheet, 'Revisiones')
    XLSX.utils.book_append_sheet(workbook, guardiasWorksheet, 'Guardias')
    XLSX.writeFile(workbook, `revisiones-guardia-pagina-${page}-${fecha}.xlsx`)
  }

  const filas = toRevisionGridRows(results)
  const sinGuardia = filas.filter((fila) => fila.resultado !== 'Revisión realizada').length
  const filtrosActivos = Object.values(filtros).filter((valor) => valor !== '').length
  const paginaActual = paginationModel.page + 1
  const totalPaginas = Math.max(1, Math.ceil(count / paginationModel.pageSize))
  const desde = count ? paginationModel.page * paginationModel.pageSize + 1 : 0
  const hasta = Math.min(count, paginationModel.page * paginationModel.pageSize + filas.length)

  function irAPagina(numero) {
    cambiarPaginacion({ page: numero - 1, pageSize: paginationModel.pageSize })
  }

  return (
    <div className="tema-analiza tuvet-page revisiones-kit">
      <PageHeader
        title="Revisiones de guardia"
        description={`${count} revisión${count !== 1 ? 'es' : ''} encontrada${count !== 1 ? 's' : ''}${filtrosActivos ? ` con ${filtrosActivos} filtro${filtrosActivos !== 1 ? 's' : ''}` : ''}.`}
      />

      <form className="tuvet-card rk-filtros" onSubmit={aplicarFiltros} aria-label="Filtros de revisiones">
        <div className="rk-rangos" role="group" aria-label="Rango rápido">
          {RANGOS.map((item) => (
            <button key={item.clave} type="button" className="tuvet-chip" onClick={() => aplicarRango(item.rango)}>{item.etiqueta}</button>
          ))}
        </div>
        <div className="rk-campos">
          <Field label="Fecha">
            <input type="date" value={draft.fecha} onChange={(e) => setFiltro('fecha', e.target.value)} />
          </Field>
          <Field label="Desde">
            <input type="date" value={draft.fecha_inicio} onChange={(e) => setFiltro('fecha_inicio', e.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="date" value={draft.fecha_fin} onChange={(e) => setFiltro('fecha_fin', e.target.value)} />
          </Field>
          <Field label="Sucursal">
            <select value={draft.id_sucursal} onChange={(e) => setFiltro('id_sucursal', e.target.value)}><option value="">Todas</option>{catalogos.sucursales.map((item) => <option key={item.id_sucursal} value={item.id_sucursal}>{item.nombre}</option>)}</select>
          </Field>
          <Field label="Gerente de área">
            <select value={draft.id_gerente_area} onChange={(e) => setFiltro('id_gerente_area', e.target.value)}><option value="">Todos</option>{catalogos.gerentes.map((item) => <option key={item.id_gerente_area} value={item.id_gerente_area}>{item.nombre}</option>)}</select>
          </Field>
          <Field label="GS">
            <select value={draft.id_usuario} onChange={(e) => setFiltro('id_usuario', e.target.value)}><option value="">Todos</option>{catalogos.usuarios.map((item) => <option key={item.id_usuario} value={item.id_usuario}>{item.nombre}</option>)}</select>
          </Field>
          <div className="rk-buscar">
            <Field label="Buscar">
              <input type="search" value={draft.buscar} onChange={(e) => setFiltro('buscar', e.target.value)} placeholder="Sucursal, código, GS o nota" />
            </Field>
          </div>
        </div>
        <div className="rk-acciones">
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={limpiarFiltros}>Limpiar</button>
          <button type="submit" className="tuvet-btn">Aplicar filtros</button>
        </div>
      </form>

      <div className="rk-barra">
        <span className="rk-pagina">
          Página actual: {paginationModel.page + 1}
          {sinGuardia > 0 && <span className="tuvet-badge tuvet-badge-vencida rk-alerta"><Icono nombre="alerta" className="tuvet-badge-icon" />{sinGuardia} sin guardia en esta página</span>}
        </span>
        <button type="button" className="tuvet-btn tuvet-btn-secondary rk-exportar" onClick={exportarPaginaActual} disabled={filas.length === 0}>
          <Icono nombre="archivo" />
          Exportar a excel
        </button>
      </div>

      {loading ? (
        <p className="tuvet-state" role="status">Cargando revisiones...</p>
      ) : error ? (
        <div className="tuvet-aviso tuvet-aviso-error tuvet-error-state" role="alert">
          <Icono nombre="error" className="tuvet-aviso-icon" />
          <div>
            <p>{error}</p>
            <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setRevision((value) => value + 1)}>Reintentar</button>
          </div>
        </div>
      ) : filas.length === 0 ? (
        <div className="tuvet-empty">
          <Icono nombre="vacio" className="tuvet-empty-icon" />
          <p>No hay revisiones para los filtros aplicados.</p>
          {filtrosActivos > 0 && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={limpiarFiltros}>Quitar filtros</button>}
        </div>
      ) : (
        <div className="tuvet-card rk-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table rk-tabla">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Responsables</th>
                  <th scope="col">Resultado</th>
                  <th scope="col" className="rk-num">Guardias</th>
                  <th scope="col">Nota</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const realizada = fila.resultado === 'Revisión realizada'
                  const fecha = partesFecha(fila.fecha)
                  return (
                    <tr key={fila.id} className={realizada ? '' : 'rk-sin-guardia'}>
                      <td className="rk-fecha"><strong>{fecha.dia}</strong>{fecha.anio && <span>{fecha.anio}</span>}</td>
                      <td className="rk-doble"><strong>{fila.sucursal}</strong><span>{fila.codigo}</span></td>
                      <td className="rk-doble">{fila.gs}<span>GA: {fila.gerente}</span></td>
                      <td>
                        <span className={`tuvet-badge ${realizada ? 'tuvet-badge-aprobada' : 'tuvet-badge-vencida'}`}>
                          <Icono nombre={realizada ? 'check' : 'alerta'} className="tuvet-badge-icon" />
                          {realizada ? 'Realizada' : 'Sin guardia'}
                        </span>
                      </td>
                      <td className="rk-num"><span className="rk-guardias" title={`${fila.cantidadGuardias} guardia${fila.cantidadGuardias !== 1 ? 's' : ''}`}><Icono nombre="persona" className="rk-guardias-icono" />{fila.cantidadGuardias}</span></td>
                      <td className="rk-nota" title={fila.notaResumida}>{fila.notaResumida}</td>
                      <td className="tuvet-cell-acciones">
                        <button type="button" className="tuvet-btn tuvet-btn-secondary rk-ver" aria-label={`Ver detalle de ${fila.sucursal} del ${fila.fecha}`} onClick={() => abrirDetalle(fila.id)}>Ver detalle</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <nav className="rk-pie" aria-label="Paginación de revisiones">
            <span className="rk-rango" aria-live="polite">Mostrando {desde}–{hasta} de {count} revisiones</span>
            <div className="rk-paginas">
              <label className="rk-por-pagina">
                Por página
                <select value={paginationModel.pageSize} onChange={(event) => cambiarPaginacion({ page: paginationModel.page, pageSize: Number(event.target.value) })}>
                  {PAGE_SIZE_OPTIONS.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                </select>
              </label>
              <button type="button" className="tuvet-btn tuvet-btn-secondary rk-pag" aria-label="Página anterior" disabled={paginaActual <= 1} onClick={() => irAPagina(paginaActual - 1)}>‹</button>
              {paginasVisibles(paginaActual, totalPaginas).map((numero, indice) => numero === null
                ? <span key={`salto-${indice}`} className="rk-salto" aria-hidden="true">…</span>
                : (
                  <button
                    key={numero}
                    type="button"
                    className={`tuvet-btn rk-pag ${numero === paginaActual ? 'is-actual' : 'tuvet-btn-secondary'}`}
                    aria-label={`Página ${numero}`}
                    aria-current={numero === paginaActual ? 'page' : undefined}
                    onClick={() => irAPagina(numero)}
                  >
                    {numero}
                  </button>
                ))}
              <button type="button" className="tuvet-btn tuvet-btn-secondary rk-pag" aria-label="Página siguiente" disabled={paginaActual >= totalPaginas} onClick={() => irAPagina(paginaActual + 1)}>›</button>
            </div>
          </nav>
        </div>
      )}
      {detalleRevision && <RevisionGuardiaDetalleModal revision={detalleRevision} onClose={cerrarDetalle} />}
    </div>
  )
}
