const STORAGE_KEY = 'volunja:session'
export const SESSION_EXPIRED_EVENT = 'volunja:session-expired'

export function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (
      !value ||
      typeof value.access_token !== 'string' ||
      !value.access_token ||
      !Number.isFinite(value.expires_at)
    ) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return value
  } catch {
    return null
  }
}

export function writeSession(accessToken, expiresAt) {
  if (!accessToken || !Number.isFinite(expiresAt)) {
    throw new Error('Resposta de autenticação inválida.')
  }
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ access_token: accessToken, expires_at: expiresAt }),
  )
}

export function clearSession() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { return }
}
