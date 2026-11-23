// Issue #49 (CN10-RF26): calendário e agenda diária do voluntário.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgendaPage from './AgendaPage'
import { useAuth } from '../hooks/useAuth'
import * as servico from '../services/calendarioService'
import { avisarCandidaturasAlteradas } from '../utils/calendario'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/calendarioService', () => ({ consultarCalendario: vi.fn() }))

const evento = (dados) => ({
  candidatura_id: 1,
  vaga_id: 10,
  titulo_vaga: 'Oficina de leitura',
  organizacao: { id: 2, nome: 'ONG Exemplo' },
  status: 'PENDENTE',
  inicio: '2026-11-16T12:00:00Z',
  fim: '2026-11-16T15:00:00Z',
  ...dados,
})

function abrir(estado) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/voluntario/agenda', state: estado }]}>
      <Routes>
        <Route path="/voluntario/agenda" element={<AgendaPage />} />
        <Route path="/vagas/:id" element={<h1>Página da vaga</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  return userEvent.setup()
}

const dia = (rotulo) => screen.getByRole('button', { name: new RegExp(`^${rotulo}`) })
const atividadesDoDia = () => within(screen.getByRole('list', { name: 'Atividades do dia' }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T15:00:00Z'))
  useAuth.mockReturnValue({ usuario: { id: 3, nome: 'Ana Souza', perfil: 'VOLUNTARIO' }, loading: false })
  servico.consultarCalendario.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('consulta do intervalo exibido e apresentação dos eventos', () => {
  it('consulta as semanas visíveis do mês, com fim exclusivo, e refaz ao trocar de mês', async () => {
    const user = abrir()
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeVisible()
    expect(servico.consultarCalendario).toHaveBeenLastCalledWith({ inicio: '2026-11-01', fim: '2026-12-06' }, expect.any(AbortSignal))

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('heading', { name: 'Dezembro de 2026' })).toBeVisible()
    expect(servico.consultarCalendario).toHaveBeenLastCalledWith({ inicio: '2026-11-29', fim: '2027-01-03' }, expect.any(AbortSignal))

    await user.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(screen.getByRole('heading', { name: 'Novembro de 2026' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Segunda-feira, 16 de novembro' })).toBeVisible()
  })

  it('mostra vaga, ONG, status e horário de Brasília de cada atividade do dia', async () => {
    servico.consultarCalendario.mockResolvedValue([
      evento({ candidatura_id: 2, vaga_id: 11, titulo_vaga: 'Mutirão de limpeza', organizacao: { id: 3, nome: 'Coletivo Verde' }, status: 'ACEITA', inicio: '2026-11-16T19:00:00Z', fim: '2026-11-16T21:00:00Z' }),
      evento(),
    ])
    const user = abrir()
    const itens = (await screen.findByRole('list', { name: 'Atividades do dia' })).querySelectorAll('li')
    expect([...itens].map((item) => item.querySelector('a').textContent)).toEqual(['Oficina de leitura', 'Mutirão de limpeza'])
    expect(within(itens[0]).getByText('09:00 – 12:00')).toBeVisible()
    expect(within(itens[0]).getByText('ONG Exemplo')).toBeVisible()
    expect(within(itens[0]).getByText('Pendente')).toBeVisible()
    expect(within(itens[1]).getByText('16:00 – 18:00')).toBeVisible()
    expect(within(itens[1]).getByText('Aceita')).toBeVisible()
    expect(dia('segunda-feira, 16 de novembro de 2026, 2 atividades')).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(itens[0]).getByRole('link', { name: 'Oficina de leitura' }))
    expect(screen.getByRole('heading', { name: 'Página da vaga' })).toBeVisible()
  })

  it('coloca no dia certo de Brasília um encontro noturno que em UTC é o dia seguinte', async () => {
    servico.consultarCalendario.mockResolvedValue([evento({ inicio: '2026-11-18T01:00:00Z', fim: '2026-11-18T02:30:00Z' })])
    const user = abrir()
    await user.click(await screen.findByRole('button', { name: 'terça-feira, 17 de novembro de 2026, 1 atividade' }))
    expect(atividadesDoDia().getByText('22:00 – 23:30')).toBeVisible()
    expect(dia('quarta-feira, 18 de novembro de 2026')).toHaveAccessibleName('quarta-feira, 18 de novembro de 2026')
  })

  it('mostra nos dois dias, com as datas completas, um encontro que atravessa a meia-noite', async () => {
    servico.consultarCalendario.mockResolvedValue([evento({ inicio: '2026-11-21T01:00:00Z', fim: '2026-11-21T04:00:00Z' })])
    const user = abrir()
    for (const nome of ['sexta-feira, 20 de novembro de 2026, 1 atividade', 'sábado, 21 de novembro de 2026, 1 atividade']) {
      await user.click(await screen.findByRole('button', { name: nome }))
      expect(atividadesDoDia().getByText('20/11/2026 às 22:00 até 21/11/2026 às 01:00')).toBeVisible()
    }
  })
})

describe('somente candidaturas pendentes ou aceitas e dias sem eventos', () => {
  it('ignora candidaturas recusadas ou canceladas, mesmo que cheguem da API', async () => {
    servico.consultarCalendario.mockResolvedValue([
      evento({ candidatura_id: 1, titulo_vaga: 'Vaga pendente' }),
      evento({ candidatura_id: 2, titulo_vaga: 'Vaga recusada', status: 'RECUSADA' }),
      evento({ candidatura_id: 3, titulo_vaga: 'Vaga cancelada', status: 'CANCELADA' }),
    ])
    abrir()
    expect(await screen.findByRole('link', { name: 'Vaga pendente' })).toBeVisible()
    expect(screen.queryByText('Vaga recusada')).not.toBeInTheDocument()
    expect(screen.queryByText('Vaga cancelada')).not.toBeInTheDocument()
    expect(dia('segunda-feira, 16 de novembro de 2026, 1 atividade')).toBeVisible()
  })

  it('informa o dia sem atividades e o mês vazio, com acesso às vagas', async () => {
    servico.consultarCalendario.mockResolvedValue([evento()])
    const user = abrir()
    await screen.findByRole('list', { name: 'Atividades do dia' })
    await user.click(dia('terça-feira, 17 de novembro de 2026'))
    expect(screen.getByText('Nenhuma atividade neste dia.')).toBeVisible()
    expect(screen.queryByText(/Você não tem atividades em/)).not.toBeInTheDocument()

    servico.consultarCalendario.mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByText('Você não tem atividades em dezembro de 2026.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Explorar vagas' })).toHaveAttribute('href', '/vagas')
  })
})

describe('atualização após alterações das candidaturas, carregamento e falha', () => {
  it('recarrega quando uma candidatura é confirmada e quando a aba volta a ficar visível', async () => {
    abrir()
    expect(await screen.findByText('Nenhuma atividade neste dia.')).toBeVisible()
    expect(servico.consultarCalendario).toHaveBeenCalledTimes(1)

    servico.consultarCalendario.mockResolvedValue([evento({ titulo_vaga: 'Vaga recém-confirmada' })])
    act(() => avisarCandidaturasAlteradas())
    expect(await screen.findByRole('link', { name: 'Vaga recém-confirmada' })).toBeVisible()
    expect(servico.consultarCalendario).toHaveBeenCalledTimes(2)

    servico.consultarCalendario.mockResolvedValue([])
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByText('Nenhuma atividade neste dia.')).toBeVisible()
    expect(servico.consultarCalendario).toHaveBeenCalledTimes(3)
  })

  it('mostra o carregamento e não exibe dados de outro mês enquanto consulta', async () => {
    servico.consultarCalendario.mockResolvedValueOnce([evento()])
    const user = abrir()
    await screen.findByRole('list', { name: 'Atividades do dia' })
    servico.consultarCalendario.mockReturnValue(new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sua agenda…')
    expect(screen.queryByRole('list', { name: 'Atividades do dia' })).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhuma atividade neste dia.')).not.toBeInTheDocument()
  })

  it('informa a falha e permite tentar novamente', async () => {
    servico.consultarCalendario.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce([evento()])
    const user = abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar sua agenda.')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('link', { name: 'Oficina de leitura' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('chegada a partir de um conflito de candidatura (#54)', () => {
  it('abre no dia do conflito, destaca o compromisso e oferece a volta para a vaga', async () => {
    servico.consultarCalendario.mockResolvedValue([
      evento({ vaga_id: 8, titulo_vaga: 'Plantão na biblioteca', inicio: '2027-01-12T12:00:00Z', fim: '2027-01-12T14:00:00Z' }),
    ])
    abrir({
      data: '2027-01-12',
      conflito: { vagaId: 1, titulo: 'Apoio em oficinas', conflitos: [{ vaga_id: 8 }] },
      voltarPara: '/vagas/1',
    })
    expect(await screen.findByRole('heading', { name: 'Janeiro de 2027' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Terça-feira, 12 de janeiro' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Conflito com Apoio em oficinas' })).toBeVisible()
    expect(await atividadesDoDia().findByText('Em conflito')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Voltar para a vaga' })).toHaveAttribute('href', '/vagas/1')
  })

  it('ignora uma data inválida recebida pela navegação', async () => {
    abrir({ data: 'amanhã' })
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Segunda-feira, 16 de novembro' })).toBeVisible()
  })
})
