import { describe, expect, it } from 'vitest'
import { clearSession, readSession, updateSessionExpiry, writeSession } from './sessionStore'

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

  it('mantém a conta da aba quando outra aba troca a conta persistente', () => {
    writeSession('conta-A', 2000000000, true)
    const outra = { access_token: 'conta-B', expires_at: 2000000100, persistent: true }
    localStorage.setItem('volunja:session', JSON.stringify(outra))
    expect(readSession()?.access_token).toBe('conta-A')
    updateSessionExpiry('conta-A', 2000000200)
    expect(readSession()?.expires_at).toBe(2000000200)
    expect(JSON.parse(localStorage.getItem('volunja:session'))).toEqual(outra)

    clearSession()
    expect(readSession()).toBeNull()
    expect(JSON.parse(localStorage.getItem('volunja:session'))).toEqual(outra)
    // Repetir logout ou montar o provider novamente não apaga a outra conta.
    clearSession()
    expect(readSession()).toBeNull()
    expect(JSON.parse(localStorage.getItem('volunja:session'))).toEqual(outra)
  })

  it('restaura a conta lembrada em uma nova aba e a mantém após logout em outra', () => {
    writeSession('conta-A', 2000000000, true)
    sessionStorage.clear()
    expect(readSession()?.access_token).toBe('conta-A')
    localStorage.removeItem('volunja:session')
    expect(readSession()?.access_token).toBe('conta-A')
    clearSession()
    expect(readSession()).toBeNull()
  })

  it('atualiza a expiração da conta lembrada e limpa ambos os armazenamentos no logout', () => {
    writeSession('token', 2000000000, true)
    updateSessionExpiry('token', 2000000100)
    expect(JSON.parse(localStorage.getItem('volunja:session')).expires_at).toBe(2000000100)
    clearSession()
    expect(localStorage.getItem('volunja:session')).toBeNull()
    expect(sessionStorage.getItem('volunja:session')).toBeNull()
    writeSession('nova', 2000000200)
    expect(readSession()?.access_token).toBe('nova')
    expect(localStorage.getItem('volunja:session')).toBeNull()
  })

  it('ignora um armazenamento persistente corrompido ao restaurar a conta da aba', () => {
    writeSession('token', 2000000000, true)
    localStorage.setItem('volunja:session', 'invalido')
    expect(() => updateSessionExpiry('token', 2000000100)).not.toThrow()
    expect(readSession()?.expires_at).toBe(2000000100)
  })
})
