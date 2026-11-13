import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import AuthProvider from '../contexts/AuthProvider'
import * as auth from '../services/authService'
import * as service from '../services/voluntarioService'
import { writeSession } from '../services/sessionStore'

vi.mock('../services/authService', () => ({ getSession: vi.fn(), getProfile: vi.fn() }))
vi.mock('../services/voluntarioService', () => ({ getVolunteerProfile: vi.fn(), updateVolunteerProfile: vi.fn() }))

const usuario = { id: 3, nome: 'Maria da Silva', email: 'maria@example.com', perfil: 'VOLUNTARIO', tipo: null }
const perfil = {
  id: 3, nome: 'Maria da Silva', email: 'maria@example.com', identificacao: '12345678901',
  perfil: 'VOLUNTARIO', telefone: '61999999999', cidade: 'Brasília', estado: 'DF', biografia: 'Gosto de ensinar.',
  causas: ['Educação'], disponibilidades: ['DIA:SABADO', 'PERIODO:MANHA', 'CARGA_HORARIA:4'],
}

beforeEach(() => {
  vi.resetAllMocks()
  const expires_at = Math.floor(Date.now() / 1000) + 3600
  writeSession('token-teste', expires_at)
  auth.getSession.mockResolvedValue({ usuario, expires_at })
  auth.getProfile.mockResolvedValue(usuario)
  service.getVolunteerProfile.mockResolvedValue(perfil)
  service.updateVolunteerProfile.mockImplementation(async ({ nome_completo, ...campos }) => ({ ...perfil, ...campos, nome: nome_completo }))
})

function open(path = '/voluntario/perfil') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>)
}
const loaded = () => screen.findByLabelText('Nome completo')
const save = (user) => user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

describe('perfil do voluntário — RF06', () => {
  it('abre pela área do voluntário e exibe dados pessoais, causas e disponibilidade', async () => {
    const user = userEvent.setup()
    open('/voluntario')
    await user.click(await screen.findByRole('link', { name: 'Editar meu perfil' }))
    expect(await loaded()).toHaveValue('Maria da Silva')
    expect(screen.getByText('maria@example.com')).toBeVisible()
    expect(screen.getByText('12345678901')).toBeVisible()
    expect(screen.getByLabelText('Telefone (opcional)')).toHaveValue('61999999999')
    expect(screen.getByLabelText('Estado (opcional)')).toHaveValue('DF')
    expect(screen.getByRole('checkbox', { name: 'Educação' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Saúde' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sábado' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Manhã' })).toBeChecked()
    expect(screen.getByLabelText(/Carga horária semanal/)).toHaveValue(4)
    expect(service.getVolunteerProfile).toHaveBeenCalled()
  })

  it('salva pelo recurso /voluntarios/me e informa sucesso', async () => {
    const user = userEvent.setup()
    open()
    fireEvent.change(await loaded(), { target: { value: '  Maria Souza  ' } })
    await user.click(screen.getByRole('checkbox', { name: 'Meio Ambiente' }))
    await user.click(screen.getByRole('checkbox', { name: 'Domingo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Manhã' }))
    await user.click(screen.getByRole('checkbox', { name: 'Noite' }))
    fireEvent.change(screen.getByLabelText(/Carga horária semanal/), { target: { value: '6' } })
    await save(user)
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible()
    expect(service.updateVolunteerProfile).toHaveBeenCalledWith({
      nome_completo: 'Maria Souza', telefone: '61999999999', cidade: 'Brasília', estado: 'DF',
      biografia: 'Gosto de ensinar.', causas: ['Educação', 'Meio Ambiente'],
      disponibilidades: ['DIA:SABADO', 'DIA:DOMINGO', 'PERIODO:NOITE', 'CARGA_HORARIA:6'],
    })
    await user.click(screen.getByRole('link', { name: 'Voltar para minha área' }))
    expect(await screen.findByText('Olá, Maria Souza.')).toBeVisible()
  })

  it('reabre o perfil com o nome salvo e preserva preferências anteriores', async () => {
    const user = userEvent.setup()
    let salvo = { ...perfil, disponibilidades: ['Fins de Semana'] }
    service.getVolunteerProfile.mockImplementation(async () => salvo)
    service.updateVolunteerProfile.mockImplementation(async ({ nome_completo, ...campos }) => {
      salvo = { ...salvo, ...campos, nome: nome_completo }
      return salvo
    })
    const tela = open()
    fireEvent.change(await loaded(), { target: { value: 'Maria Souza' } })
    await save(user)
    await screen.findByText('Perfil atualizado com sucesso.')
    tela.unmount()
    open()
    expect(await loaded()).toHaveValue('Maria Souza')
    expect(salvo.disponibilidades).toEqual(['Fins de Semana'])
  })

  it('não envia e-mail, CPF nem senha na atualização', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await save(user)
    await screen.findByText('Perfil atualizado com sucesso.')
    const payload = service.updateVolunteerProfile.mock.calls[0][0]
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('identificacao')
    expect(Object.keys(payload).join()).not.toMatch(/senha|password/)
  })

  it('separa preferências de disponibilidade dos compromissos do calendário', async () => {
    open()
    await loaded()
    const secao = screen.getByRole('heading', { name: 'Preferências de disponibilidade' }).parentElement
    expect(within(secao).getByText(/não são compromissos/)).toBeVisible()
    expect(within(secao).getByText(/aparecem separadamente no seu calendário/)).toBeVisible()
  })

  it('valida campos antes de chamar a API', async () => {
    const user = userEvent.setup()
    open()
    fireEvent.change(await loaded(), { target: { value: ' ' } })
    fireEvent.change(screen.getByLabelText('Telefone (opcional)'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText(/Carga horária semanal/), { target: { value: '99' } })
    await save(user)
    expect(screen.getByText('Informe seu nome completo.')).toBeVisible()
    expect(screen.getByText('Informe de 10 a 15 dígitos, incluindo DDD.')).toBeVisible()
    expect(screen.getByText('Informe um número de horas entre 1 e 60.')).toBeVisible()
    expect(screen.getByLabelText('Nome completo')).toHaveFocus()
    expect(service.updateVolunteerProfile).not.toHaveBeenCalled()
  })

  it('mostra carregamento ao salvar e trata erro da API', async () => {
    const user = userEvent.setup()
    let rejeitar
    service.updateVolunteerProfile.mockReturnValue(new Promise((_, reject) => { rejeitar = reject }))
    open()
    await loaded()
    await save(user)
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    rejeitar({ response: { status: 500 } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar o perfil. Tente novamente.')
    expect(screen.queryByText('Perfil atualizado com sucesso.')).not.toBeInTheDocument()
  })

  it('aponta os campos recusados pela validação da API (422)', async () => {
    const user = userEvent.setup()
    service.updateVolunteerProfile.mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body', 'cidade'], msg: 'Cidade inválida.' }] } },
    })
    open()
    await loaded()
    await save(user)
    expect(await screen.findByText('Cidade inválida.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Confira os campos indicados e tente novamente.')
  })

  it('informa falha ao carregar e permite tentar novamente', async () => {
    const user = userEvent.setup()
    service.getVolunteerProfile.mockRejectedValueOnce(new Error('falha'))
    open()
    expect(await screen.findByText('Não foi possível carregar o perfil.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await loaded()).toHaveValue('Maria da Silva')
  })

  it('mostra e permite focar erros de causas, estado e disponibilidade retornados pela API', async () => {
    const user = userEvent.setup()
    service.updateVolunteerProfile.mockRejectedValue({ response: { status: 422, data: { detail: [
      { loc: ['body', 'causas', 0], msg: 'Causa inválida.' },
      { loc: ['body', 'estado'], msg: 'Estado inválido.' },
      { loc: ['body', 'disponibilidades', 0], msg: 'Disponibilidade inválida.' },
    ] } } })
    open()
    await loaded()
    await save(user)
    expect(await screen.findByText('Causa inválida.')).toBeVisible()
    expect(screen.getByRole('group', { name: 'Escolha as causas que você quer apoiar' })).toHaveAccessibleDescription('Causa inválida.')
    expect(screen.getByLabelText('Estado (opcional)')).toHaveFocus()
    expect(screen.getByLabelText('Estado (opcional)')).toHaveAccessibleDescription('Estado inválido.')
    expect(screen.getByText('Disponibilidade inválida.')).toBeVisible()
  })

  it('foca o grupo de causas quando a API recusa somente essa lista', async () => {
    const user = userEvent.setup()
    service.updateVolunteerProfile.mockRejectedValue({ response: { status: 422, data: { detail: [
      { loc: ['body', 'causas', 0], msg: 'Causa inválida.' },
    ] } } })
    open()
    await loaded()
    await save(user)
    await screen.findByText('Causa inválida.')
    expect(screen.getByRole('group', { name: 'Escolha as causas que você quer apoiar' })).toHaveFocus()
  })

  it('bloqueia envios repetidos e mantém as alterações quando a gravação falha', async () => {
    let rejeitar
    service.updateVolunteerProfile.mockReturnValue(new Promise((_, reject) => { rejeitar = reject }))
    open()
    fireEvent.change(await loaded(), { target: { value: 'Maria Alterada' } })
    const formulario = screen.getByRole('form', { name: 'Editar perfil de voluntário' })
    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    expect(service.updateVolunteerProfile).toHaveBeenCalledTimes(1)
    rejeitar(new Error('Sem conexão'))
    await screen.findByRole('alert')
    expect(await loaded()).toHaveValue('Maria Alterada')
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
  })

  it('impede que uma organização abra o perfil de voluntário', async () => {
    const org = { ...usuario, perfil: 'ORGANIZACAO', tipo: 'ONG' }
    auth.getSession.mockResolvedValue({ usuario: org, expires_at: Math.floor(Date.now() / 1000) + 3600 })
    open()
    expect(await screen.findByRole('heading', { name: 'Área de Organização' })).toBeVisible()
    expect(service.getVolunteerProfile).not.toHaveBeenCalled()
  })
})
