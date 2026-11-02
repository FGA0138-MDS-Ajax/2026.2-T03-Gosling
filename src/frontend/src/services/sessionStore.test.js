import { describe, expect, it } from 'vitest'
import { clearSession, readSession, writeSession } from './sessionStore'

describe('armazenamento da sessão', () => {
  it('guarda somente token e expiração', () => {
    writeSession('token', 2000000000)
    expect(readSession()).toEqual({ access_token: 'token', expires_at: 2000000000 })
  })

  it('encerra a sessão local', () => {
    writeSession('token', 2000000000)
    clearSession()
    expect(readSession()).toBeNull()
  })

  it.each(['invalido', '{}', '{"access_token":"","expires_at":1}'])(
    'ignora sessão corrompida: %s',
    (value) => {
      sessionStorage.setItem('volunja:session', value)
      expect(readSession()).toBeNull()
    },
  )

  it('recusa resposta de login sem expiração válida', () => {
    expect(() => writeSession('token', undefined)).toThrow()
  })
})
