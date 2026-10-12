import { useEffect, useRef, useState } from 'react'
import {
  createCompany,
  createCountry,
  createRegion,
  getCompanies,
  getCountries,
  getRegions,
} from '../services/organizacionService'
import './OrganizacionPage.css'

const items = (data) => Array.isArray(data) ? data : data?.results || []
const entityId = (entity) => entity.id ?? entity.id_company ?? entity.id_region ?? entity.id_country
const entityName = (entity) => entity.name ?? entity.nombre

function errorMessage(error, entity, parent) {
  if (error.status === 403) return 'No tienes permisos para administrar la organización.'
  if (error.status === 409) return `Ya existe ${entity === 'compañía' ? 'una' : 'un'} ${entity} con ese nombre.`
  if (error.status === 404 && parent) return `${parent} seleccionado ya no está disponible. Actualiza la selección e inténtalo de nuevo.`
  return error.message || `No se pudo guardar ${entity === 'compañía' ? 'la' : 'el'} ${entity}.`
}

function HierarchySection({ title, children }) {
  return <section className="organizacion-card"><div className="organizacion-card-header"><h2>{title}</h2></div>{children}</section>
}

export default function OrganizacionPage() {
  const [companies, setCompanies] = useState([])
  const [regions, setRegions] = useState([])
  const [countries, setCountries] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [regionsLoading, setRegionsLoading] = useState(false)
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState('')
  const [regionsError, setRegionsError] = useState('')
  const [countriesError, setCountriesError] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [regionName, setRegionName] = useState('')
  const [countryName, setCountryName] = useState('')
  const [saving, setSaving] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const regionsRequest = useRef(0)
  const countriesRequest = useRef(0)

  async function loadCompanies() {
    setCompaniesLoading(true)
    setCompaniesError('')
    try {
      setCompanies(items(await getCompanies()))
    } catch (error) {
      setCompaniesError(errorMessage(error, 'compañía'))
    } finally {
      setCompaniesLoading(false)
    }
  }

  async function loadRegions(id) {
    const request = ++regionsRequest.current
    setRegionsLoading(true)
    setRegionsError('')
    try {
      const data = await getRegions(id)
      if (request === regionsRequest.current) setRegions(items(data))
    } catch (error) {
      if (request === regionsRequest.current) setRegionsError(errorMessage(error, 'región', 'La compañía'))
    } finally {
      if (request === regionsRequest.current) setRegionsLoading(false)
    }
  }

  async function loadCountries(id) {
    const request = ++countriesRequest.current
    setCountriesLoading(true)
    setCountriesError('')
    try {
      const data = await getCountries(id)
      if (request === countriesRequest.current) setCountries(items(data))
    } catch (error) {
      if (request === countriesRequest.current) setCountriesError(errorMessage(error, 'país', 'La región'))
    } finally {
      if (request === countriesRequest.current) setCountriesLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCompanies()
  }, [])

  function selectCompany(id) {
    ++regionsRequest.current
    ++countriesRequest.current
    setCompanyId(id)
    setRegionId('')
    setRegions([])
    setCountries([])
    setCountriesError('')
    if (id) void loadRegions(id)
  }

  function selectRegion(id) {
    ++countriesRequest.current
    setRegionId(id)
    setCountries([])
    setCountriesError('')
    if (id) void loadCountries(id)
  }

  async function submitCompany(event) {
    event.preventDefault()
    const name = companyName.trim()
    if (!name) { setFormError('El nombre de la compañía es obligatorio.'); return }
    setSaving('company'); setFormError(''); setNotice('')
    try {
      const created = await createCompany({ name })
      await loadCompanies()
      selectCompany(String(entityId(created)))
      setCompanyName('')
      setNotice('Compañía creada correctamente.')
    } catch (error) { setFormError(errorMessage(error, 'compañía')) } finally { setSaving('') }
  }

  async function submitRegion(event) {
    event.preventDefault()
    const name = regionName.trim()
    if (!name) { setFormError('El nombre de la región es obligatorio.'); return }
    setSaving('region'); setFormError(''); setNotice('')
    try {
      const created = await createRegion({ company_id: Number(companyId), name })
      await loadRegions(companyId)
      selectRegion(String(entityId(created)))
      setRegionName('')
      setNotice('Región creada correctamente.')
    } catch (error) { setFormError(errorMessage(error, 'región', 'La compañía')) } finally { setSaving('') }
  }

  async function submitCountry(event) {
    event.preventDefault()
    const name = countryName.trim()
    if (!name) { setFormError('El nombre del país es obligatorio.'); return }
    setSaving('country'); setFormError(''); setNotice('')
    try {
      await createCountry({ region_id: Number(regionId), name })
      await loadCountries(regionId)
      setCountryName('')
      setNotice('País creado correctamente.')
    } catch (error) { setFormError(errorMessage(error, 'país', 'La región')) } finally { setSaving('') }
  }

  return <div className="organizacion-page">
    <div className="organizacion-page-header"><div><h1>Organización</h1><p>Administra la jerarquía de compañías, regiones y países.</p></div></div>
    {notice && <p className="organizacion-notice" role="status">{notice}</p>}
    {formError && <p className="organizacion-form-error" role="alert">{formError}</p>}
    <div className="organizacion-hierarchy">
      <HierarchySection title="Compañías">
        {companiesLoading ? <p className="organizacion-state" role="status">Cargando compañías...</p> : companiesError ? <div className="organizacion-error-state" role="alert"><p>{companiesError}</p><button type="button" className="organizacion-button organizacion-button-secondary" onClick={loadCompanies}>Reintentar</button></div> : <label className="organizacion-field">Compañía<select value={companyId} onChange={(event) => selectCompany(event.target.value)}><option value="">Seleccionar compañía</option>{companies.map((company) => <option key={entityId(company)} value={entityId(company)}>{entityName(company)}</option>)}</select></label>}
        <form className="organizacion-form" onSubmit={submitCompany}><label className="organizacion-field">Nueva compañía<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={saving === 'company'} required /></label><button className="organizacion-button" disabled={saving === 'company'}>{saving === 'company' ? 'Creando...' : 'Crear compañía'}</button></form>
      </HierarchySection>
      <HierarchySection title="Regiones">
        {!companyId ? <p className="organizacion-state">Selecciona una compañía para cargar sus regiones.</p> : regionsLoading ? <p className="organizacion-state" role="status">Cargando regiones...</p> : regionsError ? <div className="organizacion-error-state" role="alert"><p>{regionsError}</p><button type="button" className="organizacion-button organizacion-button-secondary" onClick={() => loadRegions(companyId)}>Reintentar</button></div> : <label className="organizacion-field">Región<select value={regionId} onChange={(event) => selectRegion(event.target.value)}><option value="">Seleccionar región</option>{regions.map((region) => <option key={entityId(region)} value={entityId(region)}>{entityName(region)}</option>)}</select></label>}
        <form className="organizacion-form" onSubmit={submitRegion}><label className="organizacion-field">Nueva región<input value={regionName} onChange={(event) => setRegionName(event.target.value)} disabled={!companyId || saving === 'region'} required /></label><button className="organizacion-button" disabled={!companyId || saving === 'region'}>{saving === 'region' ? 'Creando...' : 'Crear región'}</button></form>
      </HierarchySection>
      <HierarchySection title="Países">
        {!regionId ? <p className="organizacion-state">Selecciona una región para cargar sus países.</p> : countriesLoading ? <p className="organizacion-state" role="status">Cargando países...</p> : countriesError ? <div className="organizacion-error-state" role="alert"><p>{countriesError}</p><button type="button" className="organizacion-button organizacion-button-secondary" onClick={() => loadCountries(regionId)}>Reintentar</button></div> : <ul className="organizacion-country-list">{countries.length ? countries.map((country) => <li key={entityId(country)}>{entityName(country)}</li>) : <li>No hay países registrados para esta región.</li>}</ul>}
        <form className="organizacion-form" onSubmit={submitCountry}><label className="organizacion-field">Nuevo país<input value={countryName} onChange={(event) => setCountryName(event.target.value)} disabled={!regionId || saving === 'country'} required /></label><button className="organizacion-button" disabled={!regionId || saving === 'country'}>{saving === 'country' ? 'Creando...' : 'Crear país'}</button></form>
      </HierarchySection>
    </div>
  </div>
}
