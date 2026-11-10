import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import {
  clearSession,
  readSession,
  SESSION_EXPIRED_EVENT,
  writeSession,
} from '../services/sessionStore'
import { AuthContext } from './authContext'

export default function AuthProvider({ children }) {
  const [{ saved: initial, expired: initialExpired }] = useState(() => {
    const saved = readSession()
    return { saved, expired: Boolean(saved && saved.expires_at * 1000 <= Date.now()) }
  })
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(Boolean(initial && !initialExpired))
  const [restoreError, setRestoreError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(initialExpired)
  const [expiresAt, setExpiresAt] = useState(initialExpired ? 0 : initial?.expires_at ?? 0)
  const revision = useRef(0)

  const logout = useCallback(({ expired = false } = {}) => {
    revision.current += 1
    clearSession()
    setUsuario(null)
    setExpiresAt(0)
    setRestoreError('')
    setSessionExpired(expired)
    setLoading(false)
  }, [])

  const restore = useCallback(async (saved, requestRevision) => {
    if (requestRevision !== revision.current) return
    try {
      const result = await authService.getSession()
      if (requestRevision !== revision.current) return
      writeSession(saved.access_token, result.expires_at)
      setUsuario(result.usuario)
      setExpiresAt(result.expires_at)
      setSessionExpired(false)
    } catch (error) {
      if (requestRevision !== revision.current) return
      if (error.response?.status === 401) {
        logout({ expired: true })
      } else {
        setRestoreError('Não foi possível validar sua sessão. Tente novamente.')
      }
    } finally {
      if (requestRevision === revision.current) setLoading(false)
    }
  }, [logout])

  const refreshSession = useCallback(() => {
    const saved = readSession()
    if (!saved) { logout(); return }
    if (saved.expires_at * 1000 <= Date.now()) {
      logout({ expired: true })
      return
    }
    setRestoreError('')
    setExpiresAt(saved.expires_at)
    setLoading(true)
    return restore(saved, ++revision.current)
  }, [logout, restore])

  useEffect(() => {
    const saved = readSession()
    if (saved && saved.expires_at * 1000 > Date.now()) {
      const requestRevision = ++revision.current
      Promise.resolve().then(() => restore(saved, requestRevision))
    } else {
      clearSession()
    }
    return () => { revision.current += 1 }
  }, [restore])

  useEffect(() => {
    const expire = () => logout({ expired: true })
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
  }, [logout])

  useEffect(() => {
    if (!expiresAt) return
    const timeout = setTimeout(
      () => logout({ expired: true }),
      Math.max(0, expiresAt * 1000 - Date.now()),
    )
    const checkExpiry = () => {
      if (expiresAt * 1000 <= Date.now()) logout({ expired: true })
    }
    window.addEventListener('focus', checkExpiry)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('focus', checkExpiry)
    }
  }, [expiresAt, logout])

  const autenticar = useCallback(async (metodo, ...args) => {
    const requestRevision = ++revision.current
    setSessionExpired(false)
    const result = await metodo(...args)
    if (requestRevision !== revision.current) return
    writeSession(result.access_token, result.expires_at)
    setUsuario(result.usuario)
    setExpiresAt(result.expires_at)
    setRestoreError('')
    setLoading(false)
  }, [])

  const login = useCallback(
    (email, senha) => autenticar(authService.login, email, senha),
    [autenticar],
  )
  const loginAdmin = useCallback(
    (email, senha) => autenticar(authService.loginAdmin, email, senha),
    [autenticar],
  )
  const cadastrarVoluntario = useCallback(
    (payload) => autenticar(authService.cadastrarVoluntario, payload),
    [autenticar],
  )
  const updateAccount = useCallback((account) => {
    setUsuario((current) => current?.id === account.id
      ? { ...current, nome: account.nome, email: account.email }
      : current)
  }, [])

  return (
    <AuthContext.Provider value={{
      usuario, loading, restoreError, sessionExpired,
      login, loginAdmin, logout, refreshSession, updateAccount, cadastrarVoluntario,
    }}>
      {children}
    </AuthContext.Provider>
  )
}