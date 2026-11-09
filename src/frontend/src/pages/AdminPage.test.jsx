import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import AuthProvider from '../contexts/AuthProvider'
import * as authService from '../services/authService'
import * as adminService from '../services/adminService'
import { writeSession } from '../services/sessionStore'

vi.mock('../services/authService', () => ({
  login: vi.fn(), loginAdmin: vi.fn(), getSession: vi.fn(), getProfile: vi.fn(),
}))
vi.mock('../services/adminService', () => ({
  listarCadastros: vi.fn(), consultarCadastro: vi.fn(),
  criarCadastro: vi.fn(), excluirCadastro: vi.fn(),
}))

let cadastros

function conta(dados) {
  return {
    ativo: true, tipo: null, homologada: null,
    consentimento_termos: null, quantidade_vagas: 0, ...dados,
  }
}

function sessao(perfil = 'ADMINISTRADOR') {
  return {
    access_token: 'token-teste-' + perfil,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    usuario: { id: 1, nome: 'Admin de teste', email: 'admin@example.com', perfil, tipo: null },
  }
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

beforeEach(() => {
  vi.resetAllMocks()
  cadastros = [
    conta({ id: 1, nome: 'Admin de teste', email: 'admin@example.com', perfil: 'ADMINISTRADOR' }),
    conta({ id: 2, nome: 'ONG de teste', email: 'ong@example.com', perfil: 'ORGANIZACAO', tipo: 'ONG', homologada: true, quantidade_vagas: 2, cnpj: '11222333000181' }),
    conta({ id: 3, nome: 'Ana Voluntária', email: 'ana@example.com', perfil: 'VOLUNTARIO' }),
  ]
  authService.getProfile.mockResolvedValue({})
  authService.getSession.mockResolvedValue(sessao())
  authService.loginAdmin.mockResolvedValue(sessao())
  adminService.listarCadastros.mockImplementation(async (filtros) => {
    const itens = cadastros.filter((item) => (
      (!filtros.busca || (item.nome + item.email).toLowerCase().includes(filtros.busca.toLowerCase()))
      && (!filtros.perfil || item.perfil === filtros.perfil)
      && (filtros.ativo === '' || String(item.ativo) === filtros.ativo)
    ))
    return { itens: [...itens], total: itens.length, pagina: 1, por_pagina: 20 }
  })
  adminService.consultarCadastro.mockImplementation(async (id) => structuredClone(cadastros.find((item) => item.id === id)))
  adminService.criarCadastro.mockImplementation(async ({ senha: _senha, ...dados }) => {
    const nova = conta({ ...dados, id: 10, tipo: dados.perfil === 'ORGANIZACAO' ? 'ONG' : null })
    cadastros = [nova, ...cadastros]
    return nova
  })
  adminService.excluirCadastro.mockImplementation(async (id) => {
    cadastros = cadastros.filter((item) => item.id !== id)
  })
})

function abrir(caminho = '/admin', autenticado = true) {
  if (autenticado) {
    const data = sessao()
    writeSession(data.access_token, data.expires_at)
  }
  return render(<MemoryRouter initialEntries={[caminho]}><AuthProvider><App /></AuthProvider></MemoryRouter>)
}

async function preencherBasico(user) {
  await user.type(screen.getByLabelText('Nome', { exact: true }), 'Nova Conta')
  await user.type(screen.getByLabelText('E-mail', { exact: true }), 'nova@example.com')
  await user.type(screen.getByLabelText('Senha inicial'), 'SenhaNova123!')
}

describe('administração de cadastros', () => {
  it('oferece troca de conta quando uma ONG tenta abrir o painel', async () => {
    const user = userEvent.setup()
    const data = sessao('ORGANIZACAO')
    writeSession(data.access_token, data.expires_at)
    authService.getSession.mockResolvedValue(data)
    abrir('/admin', false)
    expect(await screen.findByRole('button', { name: 'Trocar conta' })).toBeVisible()
    expect(adminService.listarCadastros).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Trocar conta' }))
    expect(await screen.findByLabelText('E-mail')).toBeVisible()
  })

  it('abre a entrada própria e autentica pelo serviço administrativo', async () => {
    const user = userEvent.setup()
    abrir('/admin', false)
    expect(await screen.findByRole('heading', { name: 'Acesso administrativo' })).toBeVisible()
    await user.type(screen.getByLabelText('E-mail'), 'admin@example.com')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaDeTeste123!')
    await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
    expect(await screen.findByRole('heading', { name: 'Área de Administrador' })).toBeVisible()
    expect(authService.loginAdmin).toHaveBeenCalledWith('admin@example.com', 'SenhaDeTeste123!')
    expect(authService.login).not.toHaveBeenCalled()
    expect(await screen.findByText('Ana Voluntária')).toBeVisible()
  })

  it('recusa outro perfil na entrada administrativa', async () => {
    const user = userEvent.setup()
    authService.loginAdmin.mockRejectedValue({ response: { status: 403 } })
    abrir('/admin/login', false)
    await user.type(await screen.findByLabelText('E-mail'), 'ong@example.com')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaDeTeste123!')
    await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent('exclusiva para administradores')
    expect(adminService.listarCadastros).not.toHaveBeenCalled()
  })

  it('permite pesquisar os cadastros', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('Ana Voluntária')
    await user.type(screen.getByLabelText('Nome ou e-mail'), 'ana@')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Excluir cadastro de ONG de teste' })).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog', { name: 'Excluir cadastro' })).not.toBeInTheDocument()
    expect(screen.getByText('Ana Voluntária')).toBeVisible()
  })

  it('abre os dados completos sem mostrar senha', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Ver cadastro de ONG de teste' }))
    const dialog = await screen.findByRole('dialog', { name: 'Dados do cadastro' })
    expect(within(dialog).getByText('11222333000181')).toBeVisible()
    expect(within(dialog).queryByLabelText('Senha inicial')).not.toBeInTheDocument()
  })

  it('cria uma ONG com os dados institucionais', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('Ana Voluntária')
    await user.click(screen.getByRole('button', { name: 'Novo cadastro' }))
    await user.selectOptions(screen.getByLabelText('Tipo de conta'), 'ORGANIZACAO')
    await preencherBasico(user)
    for (const [label, valor] of [
      ['Razão social', 'Instituto Nova Conta'], ['CNPJ', '11.222.333/0001-81'],
      ['Área de atuação', 'Educação'], ['Endereço', 'Rua Exemplo, 100'],
      ['Responsável', 'Maria da Silva'], ['Telefone', '61999999999'],
    ]) await user.type(screen.getByLabelText(label), valor)
    await user.click(screen.getByRole('button', { name: 'Criar cadastro' }))
    expect(await screen.findByText('Nova Conta')).toBeVisible()
    expect(adminService.criarCadastro).toHaveBeenCalledWith(expect.objectContaining({
      perfil: 'ORGANIZACAO', homologada: true, cnpj: '11.222.333/0001-81',
    }))
  })

  it('preserva o formulário quando o servidor recusa duplicidade', async () => {
    const user = userEvent.setup()
    adminService.criarCadastro.mockRejectedValue({ response: { data: { detail: 'E-mail já cadastrado.' } } })
    abrir()
    await screen.findByText('Ana Voluntária')
    await user.click(screen.getByRole('button', { name: 'Novo cadastro' }))
    await preencherBasico(user)
    await user.click(screen.getByRole('button', { name: 'Criar cadastro' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado.')
    expect(screen.getByLabelText('Nome', { exact: true })).toHaveValue('Nova Conta')
  })

  it('confirma a exclusão e informa as vagas vinculadas', async () => {
    const user = userEvent.setup()
    abrir()
    const excluir = await screen.findByRole('button', { name: 'Excluir cadastro de ONG de teste' })
    await user.click(excluir)
    const dialog = await screen.findByRole('dialog', { name: 'Excluir cadastro' })
    expect(within(dialog).getByText(/Também serão excluídas 2 vaga/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(adminService.excluirCadastro).not.toHaveBeenCalled()
    await user.click(excluir)
    await screen.findByRole('dialog', { name: 'Excluir cadastro' })
    await user.click(screen.getByRole('button', { name: 'Excluir cadastro e vagas' }))
    await waitFor(() => expect(screen.queryByText('ONG de teste')).not.toBeInTheDocument())
    expect(adminService.excluirCadastro).toHaveBeenCalledWith(2, true)
  })

  it('não oferece exclusão da própria conta', async () => {
    abrir()
    expect(await screen.findByRole('button', { name: 'Excluir cadastro de Admin de teste' })).toBeDisabled()
  })
})
