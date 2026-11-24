import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import VagaDetailsPage from './VagaDetailsPage'
import { useAuth } from '../hooks/useAuth'
import * as service from '../services/vagasService'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({ detalharVaga: vi.fn(), listarVagas: vi.fn() }))
const vaga = { ...VAGAS_TESTE[0], fotos: ['/design/detalhe-imgContainer.png'],
  ocorrencias: [
    { id: 1, inicio: '2027-11-16T12:00:00Z', fim: '2027-11-16T15:00:00Z' },
    { id: 2, inicio: '2027-11-23T12:00:00Z', fim: '2027-11-23T15:00:00Z' },
  ], documentos_exigidos: [{ nome: 'Documento com foto' }, { nome: 'Termo de adesão', modelo_url: 'https://example.com/modelo.pdf' }],
  organizacao: { id: 1, nome: 'Instituto Caminhos', homologada: true }, candidaturas_disponiveis: false }
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ usuario: null, loading: false })
  service.detalharVaga.mockResolvedValue(vaga)
  service.listarVagas.mockResolvedValue({ itens: VAGAS_TESTE })
})
function open() { return render(<MemoryRouter initialEntries={['/vagas/1']}><Routes><Route path="/vagas/:id" element={<VagaDetailsPage />} /><Route path="/login" element={<h1>Login de destino</h1>} /></Routes></MemoryRouter>) }
const loaded = () => screen.findByRole('heading', { name: vaga.titulo, exact: true })
it('apresenta todos os encontros em Brasília, documentos e dados públicos', async () => {
  open(); await loaded()
  const encontros=within(screen.getByRole('list',{name:'Encontros da vaga'}))
  expect(encontros.getByText('Terça-feira, 16 de novembro')).toBeVisible()
  expect(encontros.getByText('Terça-feira, 23 de novembro')).toBeVisible()
  expect(encontros.getAllByText('09:00 – 12:00 · 3 horas')).toHaveLength(2)
  expect(screen.getByText('Todas as datas e horários no horário de Brasília.')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Baixar modelo' })).toHaveAttribute('href', 'https://example.com/modelo.pdf')
  expect(screen.getByText('Documento com foto')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Como chegar' })).toHaveAttribute('href', expect.stringContaining('Bras%C3%ADlia'))
  expect(screen.queryByText('ong@example.com')).not.toBeInTheDocument()
  const resumo=within(screen.getByRole('complementary',{name:'Participar desta vaga'}))
  expect(resumo.getByText('Terça-feira, 16 de novembro')).toBeVisible()
  expect(resumo.getByText('09:00 – 12:00 · mais 1 encontro')).toBeVisible()
})
it('conduz o visitante ao login a partir da ação de candidatura', async () => {
  const user = userEvent.setup(); open(); await loaded()
  await user.click(screen.getAllByRole('link', { name: 'Quero me candidatar' })[0])
  expect(screen.getByRole('heading', { name: 'Login de destino' })).toBeVisible()
})
it.each([['VOLUNTARIO', 'Candidaturas em breve'], ['ORGANIZACAO', 'Exclusivo para voluntários']])('respeita a sessão %s e não simula candidatura', async (perfil,label) => {
  useAuth.mockReturnValue({usuario: {id:3,nome:'Conta',perfil},loading:false})
  open(); await loaded()
  expect(screen.getAllByRole('button', { name: label })[0]).toBeDisabled()
})
it('permite salvar a vaga neste navegador e remover depois', async () => {
  const user=userEvent.setup(); open(); await loaded()
  const salvar=within(screen.getByRole('complementary',{name:'Participar desta vaga'})).getByRole('button',{name:'Salvar vaga'})
  await user.click(salvar)
  expect(salvar).toHaveAttribute('aria-pressed','true')
  expect(screen.getByRole('status')).toHaveTextContent('Vaga salva neste navegador.')
  await user.click(salvar)
  expect(salvar).toHaveAttribute('aria-pressed','false')
})
it('abre e fecha a galeria sem trocar a vaga', async () => {
  const user=userEvent.setup(); open(); await loaded()
  await user.click(screen.getByRole('button', { name: 'Ver foto' }))
  const dialog=screen.getByRole('dialog',{name:'Fotos da atividade'})
  expect(within(dialog).getByRole('img')).toHaveAttribute('src',vaga.fotos[0])
  await user.click(within(dialog).getByRole('button',{name:'Fechar'}))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('trata a inexistência e não mostra ação de candidatura', async () => {
  service.detalharVaga.mockRejectedValue({response:{status:404}})
  open(); expect(await screen.findByRole('heading',{name:'Vaga não encontrada ou indisponível.'})).toBeVisible()
  expect(screen.queryByRole('link',{name:'Quero me candidatar'})).not.toBeInTheDocument()
})
it('permite repetir após falha de rede', async () => {
  service.detalharVaga.mockRejectedValueOnce(new Error('Rede'))
  const user=userEvent.setup(); open()
  await user.click(await screen.findByRole('button',{name:'Tentar novamente'})); await loaded()
  expect(service.detalharVaga).toHaveBeenCalledTimes(2)
})
it('mostra ausência real de fotos e documentos', async () => {
  service.detalharVaga.mockResolvedValue({...vaga,fotos:[],documentos_exigidos:[]})
  open(); await loaded()
  expect(screen.getByText('Esta organização ainda não adicionou fotos da atividade.')).toBeVisible()
  expect(screen.getByText('A organização não informou documentos obrigatórios.')).toBeVisible()
})
