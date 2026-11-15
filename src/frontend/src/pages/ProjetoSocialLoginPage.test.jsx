import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import AuthProvider from '../contexts/AuthProvider'
import * as authService from '../services/authService'
import { clearSession, readSession } from '../services/sessionStore'

vi.mock('../services/authService', () => ({
  login: vi.fn(),
  getSession: vi.fn(),
  getProfile: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  clearSession()
  authService.getProfile.mockResolvedValue({})
})

function sessaoProjetoSocial() {
  return {
    access_token: 'token-ficticio-projeto',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    usuario: {
      id: 7, nome: 'Projeto de teste', email: 'projeto@example.com',
      perfil: 'ORGANIZACAO', tipo: 'PROJETO_SOCIAL',
    },
  }
}

function abrir(caminho = '/login/projeto-social') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  )
}

async function preencherEEnviar(user) {
  await user.type(screen.getByLabelText('E-mail'), 'projeto@example.com')
  await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaDeTeste123!')
  await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
}

describe('login do projeto social', () => {
  it('exibe e-mail, senha, botão de entrar e acesso ao cadastro', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Entrar como projeto social' })).toBeVisible()
    expect(screen.getByLabelText('E-mail')).toBeVisible()
    expect(screen.getByLabelText('Senha', { exact: true })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Cadastre seu projeto social' }))
      .toHaveAttribute('href', '/cadastro/projeto-social')
  })

  it('abre o cadastro de projeto social, ainda indisponível (RF03 Could)', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('link', { name: 'Cadastre seu projeto social' }))
    expect(screen.getByRole('heading', { name: 'Cadastro de projeto social' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('heading', { name: 'Entrar como projeto social' })).toBeVisible()
  })

  it('é acessível a partir do login geral', async () => {
    const user = userEvent.setup()
    abrir('/login')
    await user.click(await screen.findByRole('link', { name: 'Entre como projeto social' }))
    expect(await screen.findByRole('heading', { name: 'Entrar como projeto social' })).toBeVisible()
  })

  it('encaminha ao fluxo institucional preservando o tipo Projeto Social', async () => {
    const user = userEvent.setup()
    const dados = sessaoProjetoSocial()
    authService.login.mockResolvedValue(dados)
    authService.getSession.mockResolvedValue(dados)
    const tela = abrir()
    await screen.findByRole('heading', { name: 'Entrar como projeto social' })
    await preencherEEnviar(user)
    expect(await screen.findByRole('heading', { name: 'Área de Organização' })).toBeVisible()
    expect(screen.getByText('Tipo de organização: Projeto social')).toBeVisible()
    expect(authService.login).toHaveBeenCalledWith('projeto@example.com', 'SenhaDeTeste123!')
    expect(JSON.stringify(readSession())).not.toContain('SenhaDeTeste123!')
    tela.unmount()
    abrir('/organizacao')
    expect(await screen.findByText('Tipo de organização: Projeto social')).toBeVisible()
  })

  it('valida campos antes de chamar a API', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('heading', { name: 'Entrar como projeto social' })
    await user.type(screen.getByLabelText('E-mail'), 'email-invalido')
    await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(screen.getByText('Informe sua senha.')).toBeVisible()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('mostra carregamento e trata falha de autenticação', async () => {
    const user = userEvent.setup()
    let rejeitar
    authService.login.mockReturnValue(new Promise((_, reject) => { rejeitar = reject }))
    abrir()
    await screen.findByRole('heading', { name: 'Entrar como projeto social' })
    await preencherEEnviar(user)
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    rejeitar({ response: { status: 401 } })
    expect(await screen.findByRole('alert'))
      .toHaveTextContent('E-mail ou senha inválidos. Confira os dados e tente novamente.')
    expect(screen.getByRole('heading', { name: 'Entrar como projeto social' })).toBeVisible()
    expect(readSession()).toBeNull()
  })
})
