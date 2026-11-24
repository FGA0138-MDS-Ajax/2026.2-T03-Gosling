const key = accountId => `volunja:saved-vagas:${accountId || 'visitante'}`
export function readSavedVagas(accountId) {
  try {
    const ids = JSON.parse(localStorage.getItem(key(accountId)))
    return Array.isArray(ids) ? ids.filter(id => Number.isInteger(id) && id > 0) : []
  } catch { return [] }
}
export function toggleSavedVaga(id, accountId) {
  const ids = readSavedVagas(accountId)
  const next = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]
  localStorage.setItem(key(accountId), JSON.stringify(next))
  return next.includes(id)
}
