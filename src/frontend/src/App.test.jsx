import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import AuthProvider from './contexts/AuthProvider'
import * as authService from './services/authService'
import * as vagasService from './services/vagasService'
import * as adminService from './services/adminService'
import {
  clearSession,
  readSession,
  SESSION_EXPIRED_EVENT,
  writeSession,
} from './services/sessionStore'

vi.mock('./services/authService', () => ({
  login: vi.fn(),
  loginAdmin: vi.fn(),
  cadastrarVoluntario: vi.fn(),
  getSession: vi.fn(),
  getProfile: vi.fn(),
}))
vi.mock('./services/vagasService', () => ({
  listarVagas: vi.fn(), publicarVaga: vi.fn(),
}))
vi.mock('./services/adminService', () => ({
  listarCadastros: vi.fn(), consultarCadastro: vi.fn(),
  criarCadastro: vi.fn(), excluirCadastro: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  authService.getProfile.mockResolvedValue({})
  vagasService.listarVagas.mockResolvedValue({ itens: [], total: 0, pagina: 1, por_pagina: 20 })
  adminService.listarCadastros.mockResolvedValue({ itens: [], total: 0, pagina: 1, por_pagina: 20 })
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
  it.each(['VOLUNTARIO', 'ORGANIZACAO'])(
    'retorna às vagas depois do login do perfil %s iniciado pelo catálogo',
    async (perfil) => {
      const user = userEvent.setup()
      authService.login.mockResolvedValue(session(perfil))
      open('/vagas')
      await user.click(screen.getByRole('link', { name: 'Entrar', exact: true }))
      await screen.findByRole('heading', { name: 'Entre no VolunJá' })
      await fillAndSubmit(user)

      expect(await screen.findByRole('heading', { name: 'Vagas de voluntariado' })).toBeVisible()
      const publicar = screen.queryByRole('button', { name: 'Publicar vaga', exact: true })
      if (perfil === 'ORGANIZACAO') expect(publicar).toBeVisible()
      else expect(publicar).not.toBeInTheDocument()
    },
  )

  it('abre o formulário de publicação a partir da área da ONG', async () => {
    const originalShowModal = HTMLDialogElement.prototype.showModal
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    try {
      const user = userEvent.setup()
      const data = session('ORGANIZACAO')
      writeSession(data.access_token, data.expires_at)
      authService.getSession.mockResolvedValue(data)
      open('/organizacao')
      await screen.findByRole('heading', { name: 'Área de Organização' })
      await user.click(screen.getByRole('link', { name: 'Publicar vaga' }))

      expect(await screen.findByRole('dialog', { name: 'Publicar vaga' })).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Vagas de voluntariado' })).toBeVisible()
    } finally {
      HTMLDialogElement.prototype.showModal = originalShowModal
    }
  })

  it('abre o acesso público ao cadastro da organização pelo teclado', async () => {
    const user = userEvent.setup()
    open()
    const link = await screen.findByRole('link', { name: 'Cadastre sua organização' })
    expect(link).toHaveAttribute('href', '/cadastro/organizacao')
    link.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Cadastro de organização' })).toBeVisible()
    expect(screen.getByRole('form', { name: 'Cadastrar organização' })).toBeVisible()
    expect(authService.login).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
  })

  it('permite à ONG entrar pelo teclado e preserva seu tipo ao restaurar a sessão', async () => {
    const user = userEvent.setup()
    const data = session('ORGANIZACAO')
    authService.login.mockResolvedValue(data)
    authService.getSession.mockResolvedValue(data)
    const view = open()
    const email = await screen.findByLabelText('E-mail')
    email.focus()
    await user.keyboard('ong@example.com')
    await user.tab()
    await user.keyboard('SenhaDeTeste123!{Enter}')
    expect(await screen.findByRole('heading', { name: 'Área de Organização' })).toBeVisible()
    expect(screen.getByText('Tipo de organização: ONG')).toBeVisible()
    expect(authService.login).toHaveBeenCalledWith('ong@example.com', 'SenhaDeTeste123!')
    expect(authService.getProfile).toHaveBeenCalledWith('ORGANIZACAO')
    view.unmount()
    open('/organizacao')
    expect(await screen.findByRole('heading', { name: 'Área de Organização' })).toBeVisible()
    expect(screen.getByText('Tipo de organização: ONG')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(readSession()).toBeNull()
  })

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
    expect(screen.getByLabelText('CPF')).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('abre a área do voluntário com a sessão devolvida pelo cadastro', async () => {
    const user = userEvent.setup()
    authService.cadastrarVoluntario.mockResolvedValue(session())
    authService.getProfile.mockResolvedValue({ id: 1, cidade: 'Brasília', estado: 'DF' })
    open('/cadastro/voluntario')
    for (const [campo, valor] of [
      ['Nome completo', 'Ana Silva'], ['E-mail', 'ana@example.org'],
      ['CPF', '529.982.247-25'], ['Cidade', 'Brasília'],
      ['Telefone com DDD', '(61) 99999-0000'], ['Senha', 'SenhaDeTeste123!'],
    ]) {
      await user.type(screen.getByLabelText(campo), valor)
    }
    await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'DF')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
    expect(await screen.findByText('Localização: Brasília / DF')).toBeVisible()
    expect(authService.cadastrarVoluntario).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'DF', telefone: '61999990000', consentimento_termos: true,
    }))
    expect(readSession().access_token).toBe('token-ficticio-VOLUNTARIO')
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
    expect(await screen.findByRole('heading', { name: 'Acesso administrativo' })).toBeVisible()
  })

  it('restaura a sessão e exige conta administrativa para abrir o painel', async () => {
    const data = session()
    writeSession(data.access_token, data.expires_at)
    authService.getSession.mockResolvedValue(data)
    open('/admin')
    expect(await screen.findByRole('heading', { name: 'Acesso administrativo' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Trocar conta' })).toBeVisible()
    expect(adminService.listarCadastros).not.toHaveBeenCalled()
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
