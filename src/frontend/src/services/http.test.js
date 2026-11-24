import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import http from './http'
import {
  readSession,
  SESSION_EXPIRED_EVENT,
  writeSession,
} from './sessionStore'

const originalAdapter = http.defaults.adapter
afterEach(() => { http.defaults.adapter = originalAdapter })

function rejectWith(status, beforeReject) {
  http.defaults.adapter = async (config) => {
    beforeReject?.()
    throw new AxiosError('Falha HTTP', 'ERR_BAD_REQUEST', config, null, {
      status, data: {}, config, headers: {},
    })
  }
}

describe('cliente HTTP compartilhado', () => {
  it('envia o token nos recursos protegidos', async () => {
    writeSession('token-atual', 2000000000)
    http.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBe('Bearer token-atual')
      return { status: 200, data: {}, headers: {}, config }
    }
    await http.get('/auth/me')
  })

  it('encerra sessão e emite aviso global para 401', async () => {
    writeSession('token-atual', 2000000000)
    const notify = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, notify)
    rejectWith(401)
    await expect(http.get('/auth/me')).rejects.toBeInstanceOf(AxiosError)
    expect(readSession()).toBeNull()
    expect(notify).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, notify)
  })

  it('deixa a tela tratar as credenciais inválidas do login', async () => {
    writeSession('token-atual', 2000000000)
    rejectWith(401)
    await expect(http.post('/auth/login', {}, { publicRequest: true })).rejects.toThrow()
    expect(readSession()?.access_token).toBe('token-atual')
  })

  it('não encerra uma sessão nova por uma resposta atrasada da antiga', async () => {
    writeSession('token-antigo', 2000000000)
    rejectWith(401, () => writeSession('token-novo', 2000000000))
    await expect(http.get('/auth/me')).rejects.toThrow()
    expect(readSession()?.access_token).toBe('token-novo')
  })

  it('preserva a sessão em erro 403', async () => {
    writeSession('token-atual', 2000000000)
    rejectWith(403)
    await expect(http.get('/admin/me')).rejects.toThrow()
    expect(readSession()?.access_token).toBe('token-atual')
  })

  it('usa a conta da aba e um 401 dela não apaga a conta lembrada em outra aba', async () => {
    writeSession('conta-A', 2000000000, true)
    const outra = { access_token: 'conta-B', expires_at: 2000000000, persistent: true }
    localStorage.setItem('volunja:session', JSON.stringify(outra))
    http.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBe('Bearer conta-A')
      throw new AxiosError('Sessão expirada', 'ERR_BAD_REQUEST', config, null, {
        status: 401, data: {}, config, headers: {},
      })
    }
    await expect(http.get('/voluntarios/me')).rejects.toThrow()
    expect(readSession()).toBeNull()
    expect(JSON.parse(localStorage.getItem('volunja:session'))).toEqual(outra)
  })
})
