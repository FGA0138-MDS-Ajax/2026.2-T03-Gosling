import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from './useAuth'
import { readSession } from '../services/sessionStore'
import {
  LOCAL_SAVED_EVENT, listSavedVagas, readSavedVagas, removeLocalSavedVagas,
  removeSavedVaga, saveVaga, toggleSavedVaga,
} from '../services/savedVagas'

const stores = new Map()
let activeKey = ''

const localIds = id => [...new Set([...readSavedVagas(), ...(id ? readSavedVagas(id) : [])])]
const message = error => error.response?.status === 404
  ? 'Esta vaga não está mais disponível para salvar.'
  : 'Não foi possível atualizar suas vagas salvas. Tente novamente.'

function publish(store, changes) {
  store.snapshot = { ...store.snapshot, ...changes }
  store.listeners.forEach(listener => listener())
}

function isCurrent(store) {
  return activeKey === store.key && (store.kind !== 'voluntario' || readSession()?.access_token === store.token)
}

function getStore(key, kind, id, token) {
  if (!stores.has(key)) {
    const store = {
      key, kind, id, token, revision: 0, inflight: null, locks: new Map(), listeners: new Set(),
      snapshot: { ids: kind === 'visitante' ? readSavedVagas() : [], ready: kind !== 'voluntario', loading: false, pending: [], importing: false, local: localIds(id) },
    }
    store.subscribe = listener => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    }
    store.getSnapshot = () => store.snapshot
    stores.set(key, store)
  }
  return stores.get(key)
}

async function load(store, force = false) {
  if (store.kind === 'visitante') {
    publish(store, { ids: readSavedVagas(), ready: true })
    return
  }
  if (store.kind !== 'voluntario' || !isCurrent(store)) return
  publish(store, { local: localIds(store.id) })
  if (store.inflight) return store.inflight
  if (store.snapshot.ready && !force) return
  const revision = store.revision
  publish(store, { loading: true })
  const request = (async () => {
    try {
      const ids = await listSavedVagas({ authToken: store.token })
      if (isCurrent(store) && revision === store.revision) publish(store, { ids, ready: true })
    } finally {
      if (store.inflight === request) store.inflight = null
      publish(store, { loading: false })
    }
  })()
  store.inflight = request
  return request
}

function change(store, id, target) {
  if (store.locks.has(id)) return store.locks.get(id)
  const request = (async () => {
    try {
      publish(store, { pending: [...store.snapshot.pending, id] })
      if (!isCurrent(store) || store.kind === 'bloqueado') throw new Error('Valide sua sessão para salvar vagas.')
      if (!store.snapshot.ready) await load(store, true)
      if (!isCurrent(store) || !store.snapshot.ready) throw new Error('Valide sua sessão para salvar vagas.')
      const saved = target ?? !store.snapshot.ids.includes(id)
      store.revision += 1
      if (store.kind === 'visitante') {
        if (store.snapshot.ids.includes(id) !== saved) toggleSavedVaga(id)
      } else if (saved) {
        await saveVaga(id, store.token)
      } else {
        await removeSavedVaga(id, store.token)
      }
      store.revision += 1
      if (!isCurrent(store)) throw new Error('A sessão mudou durante a operação.')
      publish(store, { ids: saved ? [...new Set([...store.snapshot.ids, id])] : store.snapshot.ids.filter(value => value !== id) })
      return saved
    } catch (error) {
      if (!isCurrent(store)) throw new Error('A sessão mudou durante a operação.')
      throw new Error(message(error))
    } finally {
      store.locks.delete(id)
      publish(store, { pending: store.snapshot.pending.filter(value => value !== id) })
    }
  })()
  store.locks.set(id, request)
  return request
}

async function importLocal(store) {
  if (store.kind !== 'voluntario' || store.snapshot.importing || !isCurrent(store)) return null
  publish(store, { importing: true })
  let imported = 0
  let failed = 0
  try {
    for (const id of localIds(store.id)) {
      if (!isCurrent(store)) break
      try {
        await change(store, id, true)
        if (!isCurrent(store)) break
        removeLocalSavedVagas([id], store.id)
        removeLocalSavedVagas([id])
        imported += 1
      } catch {
        failed += 1
      }
    }
    return { imported, failed }
  } finally {
    publish(store, { importing: false, local: localIds(store.id) })
  }
}

export function useSavedVagas() {
  const { usuario, loading, restoreError } = useAuth()
  const kind = loading || restoreError || (usuario && usuario.perfil !== 'VOLUNTARIO')
    ? 'bloqueado' : usuario ? 'voluntario' : 'visitante'
  const token = readSession()?.access_token
  const key = `${kind}:${usuario?.id ?? ''}:${token ?? ''}`
  const store = getStore(key, kind, usuario?.id, token)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => {
    activeKey = key
    const refresh = () => { load(store, true).catch(() => {}) }
    load(store).catch(() => {})
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(LOCAL_SAVED_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(LOCAL_SAVED_EVENT, refresh)
    }
  }, [key, store])

  return {
    ...snapshot, key, visitor: kind === 'visitante', allowed: kind !== 'bloqueado',
    toggle: id => change(store, id), importLocal: () => importLocal(store),
  }
}

export function resetSavedVagasState() {
  activeKey = ''
  stores.clear()
}
