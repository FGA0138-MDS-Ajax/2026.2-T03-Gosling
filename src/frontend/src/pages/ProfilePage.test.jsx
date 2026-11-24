import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import ProfilePage from './ProfilePage'
import { useAuth } from '../hooks/useAuth'
import * as auth from '../services/authService'
import * as vagas from '../services/vagasService'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/authService', () => ({ getProfile: vi.fn() }))
vi.mock('../services/vagasService', () => ({ listarVagas: vi.fn() }))

const futuro = [{ id: 9, inicio: '2099-11-21T11:00:00Z', fim: '2099-11-21T15:00:00Z' }]
const passado = [{ id: 8, inicio: '2020-01-10T11:00:00Z', fim: '2020-01-10T15:00:00Z' }]
const [educacao, social, ambiente] = VAGAS_TESTE.map((vaga) => ({ ...vaga, ocorrencias: futuro }))
const voluntario = { id: 3, nome: 'Ana Martins', perfil: 'VOLUNTARIO', tipo: null }
const perfil = { ...voluntario, identificacao: '12345678909', telefone: '61998765432', cidade: 'Ceilândia', estado: 'DF',
  causas: ['Educação'], causa_ids: [1], causas_legadas: [], disponibilidade_semanal: [{ dia: 'SABADO', periodo: 'MANHA' }], carga_horaria_semanal: null }

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ usuario: voluntario, logout: vi.fn() })
  auth.getProfile.mockResolvedValue(perfil)
  vagas.listarVagas.mockResolvedValue({ itens: [ambiente, educacao, social], total: 3, pagina: 1, por_pagina: 20 })
})
const open = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>)

it('recomenda só as vagas abertas que combinam com os interesses do perfil', async () => {
  open()
  const sugestoes = within(await screen.findByRole('region', { name: 'Recomendadas para você' }))
  expect(sugestoes.getByRole('heading', { name: educacao.titulo })).toBeVisible()
  expect(sugestoes.queryByRole('heading', { name: ambiente.titulo })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
  expect(screen.getByText('Olá, Ana Martins.')).toBeVisible()
  expect(screen.getByText('Localização: Ceilândia / DF')).toBeVisible()
  expect(screen.getByRole('progressbar', { name: 'Preenchimento do perfil' })).toHaveAttribute('aria-valuenow', '88')
})

it('mostra as vagas abertas quando nada combina e ignora vagas encerradas', async () => {
  auth.getProfile.mockResolvedValue({ ...perfil, causas: ['Esporte'], causa_ids: [9] })
  vagas.listarVagas.mockResolvedValue({ itens: [{ ...ambiente, ocorrencias: passado }, social], total: 2, pagina: 1, por_pagina: 20 })
  open()
  const sugestoes = within(await screen.findByRole('region', { name: 'Vagas abertas agora' }))
  await sugestoes.findByRole('heading', { name: social.titulo })
  expect(sugestoes.queryByRole('heading', { name: ambiente.titulo })).not.toBeInTheDocument()
  expect(screen.getByText('Marque seus interesses no perfil para receber recomendações.')).toBeVisible()
})

it('não mostra dados do perfil quando a conta não carrega', async () => {
  auth.getProfile.mockRejectedValue(new Error('Rede'))
  open()
  expect(await screen.findByText('Não foi possível carregar sua conta. Tente novamente.')).toBeVisible()
  expect(screen.queryByText(/Localização:/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editar meu perfil' })).toHaveAttribute('href', '/voluntario/perfil')
})

it.each([['ONG', true], ['PROJETO_SOCIAL', false]])('mostra a publicação de vagas só para %s quando permitido', async (tipo, publica) => {
  useAuth.mockReturnValue({ usuario: { id: 7, nome: 'Instituto Caminhos', perfil: 'ORGANIZACAO', tipo }, logout: vi.fn() })
  auth.getProfile.mockResolvedValue({ id: 7 })
  open()
  expect(await screen.findByRole('heading', { name: 'Área de Organização' })).toBeVisible()
  expect(screen.getByText(`Tipo de organização: ${tipo === 'ONG' ? 'ONG' : 'Projeto social'}`)).toBeVisible()
  expect(Boolean(screen.queryByRole('link', { name: 'Publicar vaga' }))).toBe(publica)
  expect(vagas.listarVagas).not.toHaveBeenCalled()
})
