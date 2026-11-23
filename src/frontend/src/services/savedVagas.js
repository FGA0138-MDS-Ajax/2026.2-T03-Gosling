import http from './http'

const key = accountId => `volunja:saved-vagas:${accountId || 'visitante'}`
export const LOCAL_SAVED_EVENT = 'volunja:local-saved-vagas'
export function readSavedVagas(accountId) {
  try {
    const ids = JSON.parse(localStorage.getItem(key(accountId)))
    return Array.isArray(ids) ? [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))] : []
  } catch { return [] }
}
export function toggleSavedVaga(id, accountId) {
  const ids = readSavedVagas(accountId)
  const next = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]
  localStorage.setItem(key(accountId), JSON.stringify(next))
  window.dispatchEvent(new Event(LOCAL_SAVED_EVENT))
  return next.includes(id)
}

export function removeLocalSavedVagas(ids, accountId) {
  const next = readSavedVagas(accountId).filter(id => !ids.includes(id))
  localStorage.setItem(key(accountId), JSON.stringify(next))
  window.dispatchEvent(new Event(LOCAL_SAVED_EVENT))
}

export async function listSavedVagas({ authToken, signal } = {}) {
  const { data } = await http.get('/voluntarios/me/vagas-salvas', { expectedAuthToken: authToken, signal })
  if (!Array.isArray(data.vaga_ids) || data.vaga_ids.some(id => !Number.isInteger(id) || id < 1)) {
    throw new Error('Resposta inválida ao consultar vagas salvas.')
  }
  return [...new Set(data.vaga_ids)]
}

export async function saveVaga(id, authToken) {
  const { status } = await http.put(`/voluntarios/me/vagas-salvas/${id}`, undefined, { expectedAuthToken: authToken })
  if (status !== 204) throw new Error('A gravação da vaga salva não foi confirmada.')
}

export async function removeSavedVaga(id, authToken) {
  const { status } = await http.delete(`/voluntarios/me/vagas-salvas/${id}`, { expectedAuthToken: authToken })
  if (status !== 204) throw new Error('A remoção da vaga salva não foi confirmada.')
}
