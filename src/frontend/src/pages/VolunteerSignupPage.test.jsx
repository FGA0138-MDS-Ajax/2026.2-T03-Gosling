import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import AuthProvider from '../contexts/AuthProvider'
import * as auth from '../services/authService'
import * as service from '../services/voluntarioService'
import { clearSession, readSession } from '../services/sessionStore'

vi.mock('../services/authService', () => ({ login: vi.fn(), getSession: vi.fn(), getProfile: vi.fn() }))
vi.mock('../services/voluntarioService', () => ({
  registerVolunteer: vi.fn(), getVolunteerProfile: vi.fn(), updateVolunteerProfile: vi.fn(),
}))

const usuario = { id: 9, nome: 'Maria da Silva', email: 'maria@example.com', perfil: 'VOLUNTARIO', tipo: null }
const sessao = { access_token: 'token-novo', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, usuario }

beforeEach(() => {
  vi.resetAllMocks()
  clearSession()
  service.registerVolunteer.mockResolvedValue(sessao)
  service.updateVolunteerProfile.mockImplementation(async (payload) => payload)
  auth.login.mockResolvedValue(sessao)
  auth.getProfile.mockResolvedValue(usuario)
})

function open() {
  return render(<MemoryRouter initialEntries={['/cadastro/voluntario']}><AuthProvider><App /></AuthProvider></MemoryRouter>)
}

async function preencher(user, extras = {}) {
  const dados = {
    'Nome completo': ' Maria da Silva ', CPF: '529.982.247-25', 'E-mail': 'Maria@Example.com',
    Telefone: '(61) 99999-9999', Cidade: 'Brasília', Senha: 'SenhaForte@2026', ...extras,
  }
  await screen.findByRole('heading', { name: 'Cadastro de voluntário' })
  for (const [label, value] of Object.entries(dados)) {
    if (value) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  await user.selectOptions(screen.getByLabelText('Estado'), 'DF')
  await user.click(screen.getByRole('checkbox'))
}
const enviar = (user) => user.click(screen.getByRole('button', { name: 'Criar conta de voluntário' }))

describe('cadastro de voluntário — RF01', () => {
  it('coleta nome, e-mail, senha, CPF, localização, contato e consentimento', async () => {
    open()
    await screen.findByRole('heading', { name: 'Cadastro de voluntário' })
    for (const label of ['Nome completo', 'CPF', 'E-mail', 'Telefone', 'Cidade', 'Estado', 'Senha']) {
      expect(screen.getByLabelText(label)).toBeVisible()
    }
    expect(screen.getByRole('checkbox', { name: /Concordo com o uso dos meus dados/ })).not.toBeChecked()
  })

  it('cadastra, abre a sessão de Voluntário e encaminha ao fluxo do voluntário', async () => {
    const user = userEvent.setup()
    open()
    await preencher(user)
    await enviar(user)
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
    expect(service.registerVolunteer).toHaveBeenCalledWith({
      nome_completo: 'Maria da Silva', email: 'maria@example.com', identificacao: '52998224725',
      password: 'SenhaForte@2026', consentimento_termos: true,
      telefone: '61999999999', cidade: 'Brasília', estado: 'DF',
    })
    expect(auth.login).not.toHaveBeenCalled()
    expect(service.updateVolunteerProfile).not.toHaveBeenCalled()
    expect(readSession()?.access_token).toBe('token-novo')
    expect(JSON.stringify(readSession())).not.toContain('SenhaForte@2026')
  })

  it('valida os campos e o consentimento antes de chamar a API', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('heading', { name: 'Cadastro de voluntário' })
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '111.111.111-11' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'sem-arroba' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123' } })
    await enviar(user)
    expect(screen.getByText('Informe um CPF válido.')).toBeVisible()
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(screen.getByText('Use pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo, sem espaços.')).toBeVisible()
    expect(screen.getByText('Selecione o estado.')).toBeVisible()
    expect(screen.getByText('Confirme o consentimento para continuar.')).toBeVisible()
    expect(screen.getByLabelText('Nome completo')).toHaveFocus()
    expect(service.registerVolunteer).not.toHaveBeenCalled()
  })

  it('mostra carregamento e impede envio duplicado', async () => {
    const user = userEvent.setup()
    service.registerVolunteer.mockReturnValue(new Promise(() => {}))
    open()
    await preencher(user)
    await enviar(user)
    expect(screen.getByRole('button', { name: 'Cadastrando…' })).toBeDisabled()
    expect(screen.getByText('Enviando cadastro…')).toBeVisible()
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar voluntário' }))
    expect(service.registerVolunteer).toHaveBeenCalledTimes(1)
  })

  it('exibe o erro de duplicidade retornado pela API (409)', async () => {
    const user = userEvent.setup()
    service.registerVolunteer.mockRejectedValue({ response: { status: 409, data: { detail: 'E-mail já cadastrado.' } } })
    open()
    await preencher(user)
    await enviar(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado.')
    expect(auth.login).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Cadastro de voluntário' })).toBeVisible()
  })

  it('aponta campos recusados pela validação da API (422)', async () => {
    const user = userEvent.setup()
    service.registerVolunteer.mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body', 'password'], msg: 'Senha fraca.' }] } },
    })
    open()
    await preencher(user)
    await enviar(user)
    expect(await screen.findByText('Senha fraca.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Confira os campos indicados e tente novamente.')
  })
})
