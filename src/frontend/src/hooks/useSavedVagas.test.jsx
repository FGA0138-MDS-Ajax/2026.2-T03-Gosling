import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from './useAuth'
import { resetSavedVagasState, useSavedVagas } from './useSavedVagas'
import { writeSession } from '../services/sessionStore'
import * as api from '../services/savedVagas'

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/savedVagas', async importOriginal => ({
  ...await importOriginal(), listSavedVagas: vi.fn(), saveVaga: vi.fn(), removeSavedVaga: vi.fn(),
}))

let server
const conta = { id: 3, perfil: 'VOLUNTARIO', nome: 'Ana' }
const key = id => `volunja:saved-vagas:${id || 'visitante'}`
const deferred = () => {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const open = () => renderHook(() => ({ first: useSavedVagas(), second: useSavedVagas() }))

beforeEach(() => {
  vi.resetAllMocks()
  resetSavedVagasState()
  server = { 'conta-A': [], 'conta-B': [] }
  writeSession('conta-A', 2000000000)
  useAuth.mockReturnValue({ usuario: conta, loading: false })
  api.listSavedVagas.mockImplementation(async ({ authToken }) => [...server[authToken]])
  api.saveVaga.mockImplementation(async (id, token) => { server[token] = [...new Set([...server[token], id])] })
  api.removeSavedVaga.mockImplementation(async (id, token) => { server[token] = server[token].filter(item => item !== id) })
})

it('compartilha carregamento e confirma a mudança nos dois componentes só após a API', async () => {
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  expect(api.listSavedVagas).toHaveBeenCalledTimes(1)
  const response = deferred()
  api.saveVaga.mockImplementationOnce(async id => { await response.promise; server['conta-A'].push(id) })
  let operation
  act(() => { operation = result.current.first.toggle(7) })
  expect(result.current.first.ids).toEqual([])
  expect(result.current.second.ids).toEqual([])
  await waitFor(() => expect(result.current.second.pending).toContain(7))
  await act(async () => { response.resolve(); await operation })
  expect(result.current.first.ids).toEqual([7])
  expect(result.current.second.ids).toEqual([7])
  await act(async () => { await result.current.second.toggle(7) })
  expect(result.current.first.ids).toEqual([])
  expect(server['conta-A']).toEqual([])
})

it('mantém o estado confirmado quando a gravação falha', async () => {
  server['conta-A'] = [7]
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  api.removeSavedVaga.mockRejectedValueOnce(new Error('Rede'))
  await act(async () => { await expect(result.current.first.toggle(7)).rejects.toThrow('Não foi possível atualizar') })
  expect(result.current.second.ids).toEqual([7])
  expect(result.current.first.pending).toEqual([])
})

it('deduplica cliques simultâneos do mesmo coração', async () => {
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  const response = deferred()
  api.saveVaga.mockImplementationOnce(() => response.promise)
  let first, second
  act(() => { first = result.current.first.toggle(7); second = result.current.second.toggle(7) })
  expect(first).toBe(second)
  await waitFor(() => expect(api.saveVaga).toHaveBeenCalledTimes(1))
  await act(async () => { response.resolve(); await first })
  expect(result.current.first.ids).toEqual([7])
})

it('recarrega os salvos do servidor após nova montagem em outro navegador', async () => {
  server['conta-A'] = [9]
  const first = open()
  await waitFor(() => expect(first.result.current.first.ids).toEqual([9]))
  first.unmount()
  resetSavedVagasState()
  const second = open()
  await waitFor(() => expect(second.result.current.first.ids).toEqual([9]))
  expect(api.listSavedVagas).toHaveBeenCalledTimes(2)
})

it('não leva IDs nem uma resposta atrasada para a conta seguinte', async () => {
  const response = deferred()
  api.listSavedVagas.mockImplementationOnce(() => response.promise)
  const { result, rerender } = open()
  useAuth.mockReturnValue({ usuario: { ...conta, id: 8 }, loading: false })
  writeSession('conta-B', 2000000000)
  server['conta-B'] = [20]
  rerender()
  await waitFor(() => expect(result.current.first.ids).toEqual([20]))
  await act(async () => { response.resolve([7]); await response.promise })
  expect(result.current.first.ids).toEqual([20])
})

it('não continua uma alteração na nova conta se a sessão mudar durante a consulta', async () => {
  const response = deferred()
  api.listSavedVagas.mockImplementationOnce(() => response.promise)
  const { result, rerender } = open()
  let operation
  act(() => { operation = result.current.first.toggle(7).catch(error => error) })
  useAuth.mockReturnValue({ usuario: { ...conta, id: 8 }, loading: false })
  writeSession('conta-B', 2000000000)
  rerender()
  await act(async () => { response.resolve([7]); await operation })
  expect(api.saveVaga).not.toHaveBeenCalled()
  expect(api.removeSavedVaga).not.toHaveBeenCalled()
  expect(result.current.first.ids).toEqual([])
})

it('repete a consulta após falha sem decidir uma alteração com estado desconhecido', async () => {
  api.listSavedVagas.mockRejectedValueOnce(new Error('Rede'))
  server['conta-A'] = [7]
  const { result } = open()
  await waitFor(() => expect(result.current.first.loading).toBe(false))
  expect(result.current.first.ready).toBe(false)
  await act(async () => { await result.current.first.toggle(7) })
  expect(api.removeSavedVaga).toHaveBeenCalledWith(7, 'conta-A')
  expect(api.saveVaga).not.toHaveBeenCalled()
})

it('sincroniza alterações confirmadas em outra aba ao recuperar o foco', async () => {
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  server['conta-A'] = [7]
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(result.current.first.ids).toEqual([7]))
  expect(result.current.second.ids).toEqual([7])
})

it('o visitante salva apenas neste navegador sem chamadas protegidas', async () => {
  useAuth.mockReturnValue({ usuario: null, loading: false })
  const { result } = open()
  await act(async () => { await result.current.first.toggle(7) })
  expect(result.current.second.ids).toEqual([7])
  expect(JSON.parse(localStorage.getItem(key()))).toEqual([7])
  expect(api.listSavedVagas).not.toHaveBeenCalled()
  expect(api.saveVaga).not.toHaveBeenCalled()
  await act(async () => { await result.current.second.toggle(7) })
  expect(result.current.first.ids).toEqual([])
  expect(JSON.parse(localStorage.getItem(key()))).toEqual([])
})

it('não sincroniza os salvos locais automaticamente após login', async () => {
  localStorage.setItem(key(), '[7]')
  localStorage.setItem(key(conta.id), '[9]')
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  expect(result.current.first.ids).toEqual([])
  expect(result.current.first.local).toEqual([7, 9])
  expect(api.saveVaga).not.toHaveBeenCalled()
})

it('preserva a intenção de importar quando já há uma remoção em andamento', async () => {
  server['conta-A'] = [7]
  localStorage.setItem(key(), '[7]')
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  const response = deferred()
  api.removeSavedVaga.mockImplementationOnce(async () => { await response.promise; server['conta-A'] = [] })
  let removal, importing
  act(() => { removal = result.current.first.toggle(7); importing = result.current.first.importLocal() })
  await act(async () => { response.resolve(); await removal; await importing })
  expect(server['conta-A']).toEqual([7])
  expect(JSON.parse(localStorage.getItem(key()))).toEqual([])
})

it('importa somente por ação explícita e preserva os IDs que falharam', async () => {
  localStorage.setItem(key(), '[7,9]')
  localStorage.setItem(key(conta.id), '[7,10]')
  api.saveVaga.mockImplementation(async (id, token) => {
    if (id === 9) throw { response: { status: 404 } }
    server[token] = [...new Set([...server[token], id])]
  })
  const { result } = open()
  await waitFor(() => expect(result.current.first.ready).toBe(true))
  let summary
  await act(async () => { summary = await result.current.first.importLocal() })
  expect(summary).toEqual({ imported: 2, failed: 1 })
  expect(server['conta-A']).toEqual([7, 10])
  expect(JSON.parse(localStorage.getItem(key()))).toEqual([9])
  expect(JSON.parse(localStorage.getItem(key(conta.id)))).toEqual([])
  expect(result.current.first.local).toEqual([9])
})

it.each([
  { usuario: { id: 8, perfil: 'ORGANIZACAO' } },
  { usuario: null, loading: true },
  { usuario: null, restoreError: 'Rede' },
])('bloqueia alteração com sessão ou perfil incompatível: %j', async auth => {
  useAuth.mockReturnValue(auth)
  const { result } = open()
  expect(result.current.first.allowed).toBe(false)
  await act(async () => { await expect(result.current.first.toggle(7)).rejects.toThrow() })
  expect(api.listSavedVagas).not.toHaveBeenCalled()
  expect(api.saveVaga).not.toHaveBeenCalled()
})
