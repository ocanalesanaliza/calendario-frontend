export function isInventoryFieldEditable(field) {
  return field === 'physical_stock' || field === 'expiration_date'
}
