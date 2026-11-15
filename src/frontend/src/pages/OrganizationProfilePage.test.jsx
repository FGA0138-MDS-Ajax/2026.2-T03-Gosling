import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import AuthProvider from '../contexts/AuthProvider'
import * as auth from '../services/authService'
import * as service from '../services/organizationService'
import { writeSession } from '../services/sessionStore'

vi.mock('../services/authService', () => ({ getSession: vi.fn(), getProfile: vi.fn() }))
vi.mock('../services/organizationService', () => ({ getOrganization: vi.fn(), updateOrganization: vi.fn(), registerOrganization: vi.fn() }))
const organization = {
  id: 1, nome: 'ONG Exemplo', razao_social: 'Associação Exemplo', cnpj: '11222333000181',
  area_atuacao: 'Educação', endereco: 'Rua das Flores, 100', responsavel: 'Pessoa Responsável',
  email: 'ong@example.com', telefone: '61999999999', descricao: 'Nossa causa',
  tipo: 'ONG', perfil: 'ORGANIZACAO', homologada: true,
}
beforeEach(() => {
  vi.resetAllMocks()
  const expires_at = Math.floor(Date.now() / 1000) + 3600
  writeSession('token-teste', expires_at)
  auth.getSession.mockResolvedValue({ usuario: organization, expires_at })
  auth.getProfile.mockResolvedValue(organization)
  service.getOrganization.mockResolvedValue(organization)
  service.updateOrganization.mockImplementation(async (payload) => ({ ...organization, ...payload }))
})
function open(path = '/organizacao/perfil') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>)
}
async function loaded() { return screen.findByLabelText('Nome da organização') }

describe('perfil institucional — RF07', () => {
  it('abre edição pela área da organização e carrega dados', async () => {
    const user = userEvent.setup()
    open('/organizacao')
    await user.click(await screen.findByRole('link', { name: 'Editar perfil institucional' }))
    expect(await loaded()).toHaveValue('ONG Exemplo')
    expect(screen.getByText('Homologada')).toBeVisible()
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('envia somente campos editáveis e atualiza a saudação da conta', async () => {
    const user = userEvent.setup()
    open()
    fireEvent.change(await loaded(), { target: { value: '  Novo nome  ' } })
    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), { target: { value: ' Nova descrição ' } })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible()
    const payload = service.updateOrganization.mock.calls[0][0]
    expect(payload).toEqual({ nome: 'Novo nome', razao_social: organization.razao_social, cnpj: organization.cnpj,
      area_atuacao: organization.area_atuacao, endereco: organization.endereco, responsavel: organization.responsavel,
      email: organization.email, telefone: organization.telefone, descricao: 'Nova descrição' })
    await user.click(screen.getByRole('link', { name: 'Voltar para minha área' }))
    expect(await screen.findByText('Olá, Novo nome.')).toBeVisible()
  })

  it('mantém valores salvos ao reabrir o perfil', async () => {
    const user = userEvent.setup()
    service.updateOrganization.mockImplementation(async (payload) => {
      const saved = { ...organization, ...payload }
      service.getOrganization.mockResolvedValue(saved)
      return saved
    })
    open()
    fireEvent.change(await loaded(), { target: { value: 'ONG Atualizada' } })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await screen.findByText('Perfil atualizado com sucesso.')
    await user.click(screen.getByRole('link', { name: 'Voltar para minha área' }))
    await user.click(await screen.findByRole('link', { name: 'Editar perfil institucional' }))
    expect(await loaded()).toHaveValue('ONG Atualizada')
  })

  it('permite tentar novamente após falha ao carregar', async () => {
    service.getOrganization.mockRejectedValueOnce(new Error('Offline'))
    const user = userEvent.setup()
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await loaded()).toHaveValue(organization.nome)
  })

  it.each([['nome', ''], ['cnpj', '11222333000180'], ['email', 'invalido'], ['telefone', '123']])('valida %s antes de salvar', async (name, value) => {
    const user = userEvent.setup()
    open()
    await loaded()
    fireEvent.change(document.getElementById(name), { target: { value } })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(document.getElementById(name)).toHaveFocus()
    expect(service.updateOrganization).not.toHaveBeenCalled()
  })

  it('exibe conflito sem perder edição e permite tentar novamente', async () => {
    service.updateOrganization.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'E-mail já cadastrado.' } } })
    const user = userEvent.setup()
    open()
    fireEvent.change(await loaded(), { target: { value: 'Nome editado' } })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado.')
    expect(screen.getByLabelText('Nome da organização')).toHaveValue('Nome editado')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible()
  })

  it('associa erro 422 ao campo após habilitar o formulário', async () => {
    service.updateOrganization.mockRejectedValue({ response: { status: 422, data: { detail: [{ loc: ['body', 'endereco'], msg: 'Endereço inválido.' }] } } })
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Endereço inválido.')).toBeVisible()
    expect(screen.getByLabelText('Endereço')).toHaveFocus()
  })

  it('impede pedidos duplicados durante o salvamento', async () => {
    let finish
    service.updateOrganization.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form'))
    expect(service.updateOrganization).toHaveBeenCalledTimes(1)
    await act(async () => finish(organization))
    expect(screen.getByText('Perfil atualizado com sucesso.')).toBeVisible()
  })

  it('preserva projeto social e aceita campos institucionais opcionais vazios', async () => {
    service.getOrganization.mockResolvedValue({ ...organization, tipo: 'PROJETO_SOCIAL', homologada: false, cnpj: null, razao_social: null, descricao: null })
    const user = userEvent.setup()
    open()
    await loaded()
    expect(screen.getByText('Projeto social')).toBeVisible()
    expect(screen.getByText('Pendente')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible()
    expect(service.updateOrganization.mock.calls[0][0]).toMatchObject({ cnpj: null, razao_social: null, descricao: '' })
  })

  it('protege a rota de acesso sem sessão', async () => {
    sessionStorage.clear()
    open()
    expect(await screen.findByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(service.getOrganization).not.toHaveBeenCalled()
  })

  it('impede acesso de voluntário ao perfil institucional', async () => {
    auth.getSession.mockResolvedValue({ usuario: { ...organization, perfil: 'VOLUNTARIO', tipo: null }, expires_at: Math.floor(Date.now() / 1000) + 3600 })
    open()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Área de Voluntário' })).toBeVisible())
    expect(service.getOrganization).not.toHaveBeenCalled()
  })
})
