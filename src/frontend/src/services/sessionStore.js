const STORAGE_KEY = 'volunja:session'
const ENDED_KEY = 'volunja:session-ended'
export const SESSION_EXPIRED_EVENT = 'volunja:session-expired'

function parseSession(raw) {
  try {
    const value = JSON.parse(raw)
    return value && typeof value.access_token === 'string' && value.access_token &&
      Number.isFinite(value.expires_at) ? value : null
  } catch {
    return null
  }
}

export function readSession() {
  try {
    const active = sessionStorage.getItem(STORAGE_KEY)
    if (!active && sessionStorage.getItem(ENDED_KEY)) return null
    const raw = active ?? localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = parseSession(raw)
    if (!value) {
      if (active !== null) clearSession()
      else localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // Cada aba mantém o token da conta que está exibindo, inclusive no modo persistente.
    if (!active) sessionStorage.setItem(STORAGE_KEY, raw)
    return value
  } catch {
    return null
  }
}

export function writeSession(accessToken, expiresAt, persistent = false) {
  if (!accessToken || !Number.isFinite(expiresAt)) {
    throw new Error('Resposta de autenticação inválida.')
  }
  const value = JSON.stringify({ access_token: accessToken, expires_at: expiresAt, ...(persistent ? { persistent: true } : {}) })
  sessionStorage.setItem(STORAGE_KEY, value)
  sessionStorage.removeItem(ENDED_KEY)
  if (persistent) localStorage.setItem(STORAGE_KEY, value)
  else if (parseSession(localStorage.getItem(STORAGE_KEY))?.access_token === accessToken) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function updateSessionExpiry(accessToken, expiresAt) {
  const saved = readSession()
  if (saved?.access_token !== accessToken || !Number.isFinite(expiresAt)) return
  const value = JSON.stringify({ ...saved, expires_at: expiresAt })
  sessionStorage.setItem(STORAGE_KEY, value)
  // Restaurar uma aba antiga não deve substituir a conta lembrada por outra aba.
  if (parseSession(localStorage.getItem(STORAGE_KEY))?.access_token === accessToken) {
    localStorage.setItem(STORAGE_KEY, value)
  }
}

export function wasSessionExpired() {
  try {
    return sessionStorage.getItem(ENDED_KEY) === 'expired'
  } catch {
    return false
  }
}

export function clearSession({ expired = false } = {}) {
  let active
  try { active = parseSession(sessionStorage.getItem(STORAGE_KEY)) } catch { /* Armazenamento indisponível. */ }
  try {
    const remembered = parseSession(localStorage.getItem(STORAGE_KEY))
    if (active && remembered?.access_token === active.access_token) localStorage.removeItem(STORAGE_KEY)
  } catch { /* O armazenamento da aba ainda deve ser limpo. */ }
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    // Mantém o motivo na aba, inclusive se uma recarga descartar o evento.
    sessionStorage.setItem(ENDED_KEY, expired ? 'expired' : 'true')
  } catch { /* Armazenamento indisponível. */ }
}
