import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import AuthProvider from './contexts/AuthProvider'
import * as authService from './services/authService'
import {
  clearSession,
  readSession,
  SESSION_EXPIRED_EVENT,
  writeSession,
} from './services/sessionStore'

vi.mock('./services/authService', () => ({
  login: vi.fn(),
  getSession: vi.fn(),
  getProfile: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  authService.getProfile.mockResolvedValue({})
})

function session(perfil = 'VOLUNTARIO') {
  return {
    access_token: 'token-ficticio-' + perfil,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    usuario: {
      id: 1, nome: 'Conta de teste', email: 'conta@example.com',
      perfil, tipo: perfil === 'ORGANIZACAO' ? 'ONG' : null,
    },
  }
}

function open(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(user) {
  await user.type(screen.getByLabelText('E-mail'), 'conta@example.com')
  await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaDeTeste123!')
  await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
}

describe('fluxo de autenticação', () => {
  it('valida campos obrigatórios antes de chamar a API', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
    expect(screen.getByText('Informe seu e-mail.')).toBeVisible()
    expect(screen.getByText('Informe sua senha.')).toBeVisible()
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('permite mostrar e ocultar a senha pelo teclado', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveAttribute('type', 'text')
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveAttribute('type', 'password')
  })

  it('rejeita e-mail inválido sem enviar o formulário', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    await user.type(screen.getByLabelText('E-mail'), 'email-invalido')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaDeTeste123!')
    await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('permite ao voluntário entrar usando somente o teclado', async () => {
    const user = userEvent.setup()
    authService.login.mockResolvedValue(session())
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    screen.getByLabelText('E-mail').focus()
    await user.keyboard('conta@example.com')
    await user.tab()
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveFocus()
    await user.keyboard('SenhaDeTeste123!{Enter}')
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
    expect(authService.login).toHaveBeenCalledWith('conta@example.com', 'SenhaDeTeste123!')
  })

  it('permite abrir o acesso ao cadastro de voluntário pelo teclado', async () => {
    const user = userEvent.setup()
    open()
    const link = await screen.findByRole('link', { name: 'Cadastre-se como voluntário' })
    expect(link).toHaveAttribute('href', '/cadastro/voluntario')
    link.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Cadastro de voluntário' })).toBeVisible()
    expect(screen.getByText('O cadastro de novas contas ainda não está disponível.')).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('mantém o acesso ao cadastro público após a sessão expirar', async () => {
    const user = userEvent.setup()
    writeSession('token-expirado', Math.floor(Date.now() / 1000) - 1)
    open()
    await user.click(await screen.findByRole('link', { name: 'Cadastre-se como voluntário' }))
    expect(screen.getByRole('heading', { name: 'Cadastro de voluntário' })).toBeVisible()
    expect(readSession()).toBeNull()
    expect(authService.getSession).not.toHaveBeenCalled()
  })

  it.each([
    ['VOLUNTARIO', 'Área de Voluntário'],
    ['ORGANIZACAO', 'Área de Organização'],
    ['ADMINISTRADOR', 'Área de Administrador'],
  ])('encaminha o perfil %s ao fluxo correto', async (perfil, title) => {
    const user = userEvent.setup()
    authService.login.mockResolvedValue(session(perfil))
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    await fillAndSubmit(user)
    expect(await screen.findByRole('heading', { name: title })).toBeVisible()
    expect(readSession()?.access_token).toBe('token-ficticio-' + perfil)
    expect(JSON.stringify(readSession())).not.toContain('SenhaDeTeste123!')
    if (perfil === 'ORGANIZACAO') {
      expect(screen.getByText('Tipo de organização: ONG')).toBeVisible()
    }
  })

  it('informa credenciais inválidas e permanece no login', async () => {
    const user = userEvent.setup()
    authService.login.mockRejectedValue({ response: { status: 401 } })
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    await fillAndSubmit(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos')
    expect(readSession()).toBeNull()
  })

  it.each([
    [429, 'Muitas tentativas de entrada.'],
    [422, 'Confira o e-mail e a senha informados.'],
    [undefined, 'Não foi possível entrar. Tente novamente.'],
  ])('informa a falha %s e permite tentar novamente', async (status, message) => {
    const user = userEvent.setup()
    authService.login.mockRejectedValue({ response: { status } })
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    await fillAndSubmit(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled()
    expect(readSession()).toBeNull()
  })

  it('impede envios repetidos enquanto aguarda o servidor', async () => {
    const user = userEvent.setup()
    let resolve
    authService.login.mockReturnValue(new Promise((done) => { resolve = done }))
    open()
    await screen.findByRole('heading', { name: 'Entre no VolunJá' })
    await fillAndSubmit(user)
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Entrar na conta' }))
    expect(authService.login).toHaveBeenCalledTimes(1)
    await act(async () => resolve(session()))
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
  })

  it('protege acesso direto a uma rota sem sessão', async () => {
    open('/admin')
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
  })

  it('restaura a sessão e impede abrir a área de outro perfil', async () => {
    const data = session()
    writeSession(data.access_token, data.expires_at)
    authService.getSession.mockResolvedValue(data)
    open('/admin')
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
    expect(authService.getSession).toHaveBeenCalled()
  })

  it('logout remove o token e retorna ao login', async () => {
    const user = userEvent.setup()
    const data = session()
    writeSession(data.access_token, data.expires_at)
    authService.getSession.mockResolvedValue(data)
    open('/voluntario')
    await screen.findByRole('heading', { name: 'Área de Voluntário' })
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(readSession()).toBeNull()
  })

  it('encerra sessão automaticamente quando chega a expiração', async () => {
    vi.useFakeTimers()
    const data = session()
    writeSession(data.access_token, data.expires_at)
    authService.getSession.mockResolvedValue(data)
    open('/voluntario')
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
    await act(async () => { vi.advanceTimersByTime(3600001) })
    expect(screen.getByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(readSession()).toBeNull()
  })

  it('401 global encerra a sessão e informa a expiração', async () => {
    const data = session()
    writeSession(data.access_token, data.expires_at)
    authService.getSession.mockResolvedValue(data)
    open('/voluntario')
    await screen.findByRole('heading', { name: 'Área de Voluntário' })
    act(() => {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    })
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
  })

  it('oferece nova tentativa se não conseguir validar a sessão', async () => {
    const user = userEvent.setup()
    const data = session()
    writeSession(data.access_token, data.expires_at)
    authService.getSession
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(data)
    open('/voluntario')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível validar')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
  })
})
