export function amount(value) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

export function money(value) {
  const result = amount(value)
  return result === null ? '—' : `L ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result)}`
}

export function branchName(branch) {
  return [branch?.code ?? branch?.codigo, branch?.name ?? branch?.nombre].filter(Boolean).join(' · ') || 'Sucursal'
}

// GET /api/depositos/ga/historial/ returns branch identity beside a nested
// summary. Keep its signed identity intact and project only financial fields.
export function normalizeHistoryBranch(branch) {
  const summary = branch?.summary ?? branch?.resumen
  if (!summary || typeof summary !== 'object') return branch
  const fields = [
    'total_sales', 'cash_sales', 'card_sales', 'deposited_amount', 'outstanding_amount',
    'closures_total', 'closures_reconciled', 'closures_pending_reconciliation',
    'closures_no_deposit_declared', 'closures_with_discrepancy',
  ]
  return {
    ...branch,
    ...Object.fromEntries(fields.filter((key) => Object.hasOwn(summary, key)).map((key) => [key, summary[key]])),
  }
}

export function percent(value, total) {
  const numerator = amount(value)
  const denominator = amount(total)
  if (numerator === null || denominator === null || denominator <= 0 || numerator < 0 || numerator > denominator) return null
  return (numerator / denominator) * 100
}

// Optional server contract, documented in deposit-history-compliance.md.
// Calendar expectations cannot be inferred from financial totals or month length.
export function complianceRows(compliance, branches) {
  const byId = new Map(branches.map((branch) => [String(branch.id), branch]))
  const included = new Set()
  return (Array.isArray(compliance?.branches) ? compliance.branches : []).flatMap((row) => {
    if (!row || included.has(String(row.branch_id))) return []
    const branch = byId.get(String(row.branch_id))
    const counts = [row.expected_count, row.submitted_count, row.missing_count].map(amount)
    const [expected, submitted, missing] = counts
    if (!branch || row.calendar_status !== 'resolved' || counts.some((count) => count === null || !Number.isSafeInteger(count) || count < 0) || submitted + missing !== expected) return []
    included.add(String(row.branch_id))
    return [{ branch, expected, submitted, missing }]
  })
}
