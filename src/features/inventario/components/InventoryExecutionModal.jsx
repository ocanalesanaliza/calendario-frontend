import { useEffect, useRef, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import { Aviso, FileDrop, FormSection, Modal } from '../../tuvet/components/TuvetUi'
import { formatTamano } from '../../tuvet/utils/archivos'
import {
  correctInventory,
  discoverAreaBranches,
  newIdempotencyKey,
  previewInventory,
  submitInventoryArea,
  submitInventoryBranch,
} from '../inventoryService'
import { isInventoryFieldEditable } from '../inventoryExecution'

const XLSX = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function rowId(row, index) {
  return row.code ?? row.product ?? index
}

function editableRows(rows) {
  return rows.map((row, index) => ({ ...row, __id: rowId(row, index) }))
}

function toDateOnly(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string') return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return null
}

function toGridDate(value) {
  const date = toDateOnly(value)
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isXlsx(file) {
  return file?.name?.toLowerCase().endsWith('.xlsx')
}

export default function InventoryExecutionModal({ occurrence, mode, correction, onClose, onSuccess, onReload }) {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [sending, setSending] = useState(false)
  const key = useRef(newIdempotencyKey())
  const areaOccurrenceId = occurrence?.occurrence_id ?? occurrence?.id
  const isCorrection = Boolean(correction)

  useEffect(() => {
    if (mode !== 'area' || isCorrection) return
    let active = true
    discoverAreaBranches(areaOccurrenceId)
      .then((data) => { if (active) setBranches(data.branches ?? []) })
      .catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [areaOccurrenceId, isCorrection, mode])

  async function selectFile(nextFile) {
    setError('')
    setFieldErrors({})
    if (!nextFile || !isXlsx(nextFile)) {
      setFile(null)
      setRows([])
      setFieldErrors({ file: 'Selecciona un archivo XLSX para continuar.' })
      return
    }
    setFile(nextFile)
    try {
      const result = await previewInventory(nextFile)
      setRows(editableRows(result.rows ?? []))
      if (result.errors?.length) setError('El archivo tiene errores que debes corregir antes de enviarlo.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function updateRow(id, field, value) {
    setRows((current) => current.map((row) => (row.__id === id ? { ...row, [field]: value } : row)))
  }

  function validate() {
    const next = {}
    if (!file) next.file = 'Selecciona un archivo XLSX para continuar.'
    if (isCorrection && !reason.trim()) next.reason = 'Indica el motivo de la corrección.'
    if (mode === 'area' && !isCorrection && !branchId) next.branch = 'Selecciona una sucursal autorizada antes de cargar el archivo.'
    if (isCorrection && !correction.expected_version) next.general = 'No se encontró la versión esperada del historial.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!validate()) return
    setSending(true)
    try {
      const serializedRows = rows.map((row) => {
        const serialized = { ...row }
        delete serialized.__id
        return serialized
      })
      if (isCorrection) {
        await correctInventory({ submissionId: correction.id, inventoryType: correction.inventory_type, file, rows: serializedRows, comment, reason, expectedVersion: correction.expected_version, idempotencyKey: key.current })
      } else if (mode === 'area') {
        await submitInventoryArea({ areaOccurrenceId, branchId, file, rows: serializedRows, comment, idempotencyKey: key.current })
      } else {
        await submitInventoryBranch({ assignmentId: occurrence.id, file, rows: serializedRows, comment, idempotencyKey: key.current })
      }
      onSuccess?.()
    } catch (requestError) {
      if (requestError.status === 409 && isCorrection) {
        setError('El historial cambió. Tu borrador se conserva; recarga el detalle antes de enviarlo de nuevo.')
      } else if (requestError.status === 403) {
        setError('No tienes autorización para realizar esta operación. Tu borrador se conserva.')
      } else {
        setError(requestError.message)
      }
      setSending(false)
    }
  }

  const title = isCorrection ? 'Corregir inventario' : 'Registrar inventario'
  const uploadDisabled = sending || (mode === 'area' && !isCorrection && !branchId)

  return <Modal title={title} subtitle={occurrence?.nombre ?? occurrence?.task?.name ?? 'Inventario'} icon="tarea" tone="success" onClose={sending ? () => {} : onClose} footer={<><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={sending}>Cancelar</button><button type="submit" form="inventory-execution-form" className="tuvet-btn" disabled={sending}>{sending ? 'Enviando...' : isCorrection ? 'Enviar corrección' : 'Registrar inventario'}</button></>}>
    <form id="inventory-execution-form" className="tuvet-form" onSubmit={submit} noValidate>
      <Aviso tipo="error">{error || fieldErrors.general}</Aviso>
      {mode === 'area' && !isCorrection && <FormSection title="Sucursal autorizada" description="Selecciona la sucursal antes de cargar el XLSX."><label className="tuvet-label" htmlFor="inventory-branch">Sucursal</label><select id="inventory-branch" className="tuvet-input" value={branchId} onChange={(event) => { setBranchId(event.target.value); setFieldErrors((current) => ({ ...current, branch: '' })) }} disabled={sending}><option value="">Selecciona una sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select>{fieldErrors.branch && <span className="tuvet-field-error" role="alert">{fieldErrors.branch}</span>}</FormSection>}
      {mode === 'area' && !isCorrection && !branchId && <Aviso tipo="info">Selecciona una sucursal autorizada antes de cargar el archivo.</Aviso>}
      <FormSection title="Archivo XLSX" description="El archivo se conserva solamente en esta pantalla mientras completas el envío."><FileDrop accept={XLSX} file={file} onChange={selectFile} disabled={uploadDisabled} formatSize={formatTamano} hint="Arrastra o selecciona el XLSX" invalid={Boolean(fieldErrors.file)} />{fieldErrors.file && <span className="tuvet-field-error" role="alert">{fieldErrors.file}</span>}</FormSection>
      {rows.length > 0 && <section aria-label="Filas normalizadas"><h3>Vista previa</h3><DataGrid autoHeight disableRowSelectionOnClick rows={rows} getRowId={(row) => row.__id} columns={[{ field: 'product', headerName: 'Producto', flex: 1 }, { field: 'stock', headerName: 'Existencia', width: 120 }, { field: 'physical_stock', headerName: 'Existencia física', width: 150, editable: true, type: 'number' }, { field: 'expiration_date', headerName: 'Vencimiento', width: 150, editable: true, type: 'date', valueGetter: (value) => toGridDate(value) }]} isCellEditable={(params) => !sending && isInventoryFieldEditable(params.field)} processRowUpdate={(next) => { const expirationDate = toDateOnly(next.expiration_date); updateRow(next.__id, 'physical_stock', next.physical_stock); updateRow(next.__id, 'expiration_date', expirationDate); return { ...next, expiration_date: toGridDate(expirationDate) } }} /></section>}
      <FormSection title="Comentario o conclusión" description="Opcional, máximo 1,000 caracteres."><textarea className="tuvet-input" maxLength="1000" value={comment} onChange={(event) => setComment(event.target.value)} disabled={sending} /></FormSection>
      {isCorrection && <FormSection title="Motivo de la corrección" description="Obligatorio, máximo 1,000 caracteres."><textarea className="tuvet-input" maxLength="1000" value={reason} onChange={(event) => { setReason(event.target.value); setFieldErrors((current) => ({ ...current, reason: '' })) }} disabled={sending} />{fieldErrors.reason && <span className="tuvet-field-error" role="alert">{fieldErrors.reason}</span>}</FormSection>}
      {isCorrection && error.includes('recarga') && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onReload}>Recargar detalle</button>}
    </form>
  </Modal>
}
