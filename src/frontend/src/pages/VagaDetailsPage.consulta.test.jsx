// Issue #43 (CN05-RF14): consulta pública completa de uma vaga.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VagaDetailsPage from './VagaDetailsPage'
import { useAuth } from '../hooks/useAuth'
import * as service from '../services/vagasService'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({ detalharVaga: vi.fn(), listarVagas: vi.fn() }))

const vagaBase = {
  ...VAGAS_TESTE[0],
  fotos: [],
  documentos_exigidos: [],
  organizacao: { id: 1, nome: 'Instituto Caminhos', homologada: true },
  candidaturas_disponiveis: false,
  modalidade: 'HIBRIDO',
  periodo: 'NOITE',
  carga_horaria: '2.50',
  numero_vagas: 4,
  ocorrencias: [{ id: 1, inicio: '2027-11-16T12:00:00Z', fim: '2027-11-16T15:00:00Z' }],
}

function LoginDeDestino() {
  const location = useLocation()
  return <h1>Login de destino, voltar para {location.state?.from}</h1>
}

function abrir(vaga = vagaBase) {
  service.detalharVaga.mockResolvedValue(vaga)
  render(
    <MemoryRouter initialEntries={['/vagas/1']}>
      <Routes>
        <Route path="/vagas/:id" element={<VagaDetailsPage />} />
        <Route path="/login" element={<LoginDeDestino />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.findByRole('heading', { name: vaga.titulo, exact: true })
}

const encontros = () => within(screen.getByRole('list', { name: 'Encontros da vaga' }))

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ usuario: null, loading: false })
  service.listarVagas.mockResolvedValue({ itens: VAGAS_TESTE })
})

describe('campos, múltiplas ocorrências e horário de Brasília', () => {
  it('lista os encontros em ordem cronológica, mesmo que a API os envie fora de ordem', async () => {
    await abrir({
      ...vagaBase,
      ocorrencias: [
        { id: 3, inicio: '2027-12-07T12:00:00Z', fim: '2027-12-07T14:00:00Z' },
        { id: 1, inicio: '2027-11-16T12:00:00Z', fim: '2027-11-16T15:00:00Z' },
        { id: 2, inicio: '2027-11-30T12:00:00Z', fim: '2027-11-30T13:00:00Z' },
      ],
    })
    const datas = encontros().getAllByRole('listitem').map((item) => within(item).getByText(/-feira,/).textContent)
    expect(datas).toEqual(['Terça-feira, 16 de novembro', 'Terça-feira, 30 de novembro', 'Terça-feira, 07 de dezembro'])
    expect(screen.getByText('3 encontros')).toBeVisible()
  })

  it('mostra no dia de Brasília um encontro noturno que em UTC já é o dia seguinte', async () => {
    await abrir({
      ...vagaBase,
      ocorrencias: [{ id: 1, inicio: '2027-11-17T01:00:00Z', fim: '2027-11-17T02:30:00Z' }],
    })
    expect(encontros().getByText('Terça-feira, 16 de novembro')).toBeVisible()
    expect(encontros().getByText('22:00 – 23:30 · 1,5 horas')).toBeVisible()
    expect(encontros().queryByText(/17 de novembro/)).not.toBeInTheDocument()
  })

  it('mostra as duas datas quando o encontro atravessa a meia-noite em Brasília', async () => {
    await abrir({
      ...vagaBase,
      ocorrencias: [{ id: 1, inicio: '2027-11-17T01:00:00Z', fim: '2027-11-17T04:00:00Z' }],
    })
    expect(encontros().getByText('16/11/2027 às 22:00 até 17/11/2027 às 01:00 · 3 horas')).toBeVisible()
  })

  it('exibe os campos públicos da vaga', async () => {
    await abrir()
    for (const texto of ['Híbrido', 'Noite', '2,5 h por encontro', '4 vagas ofertadas', 'Instituto Caminhos', vagaBase.local]) {
      expect(screen.getAllByText(texto, { exact: false })[0]).toBeVisible()
    }
  })
})

describe('ação de candidatura conforme a sessão e o estado da vaga', () => {
  it('leva o visitante ao login guardando o endereço da vaga para voltar', async () => {
    const user = userEvent.setup()
    await abrir()
    await user.click(screen.getAllByRole('link', { name: 'Quero me candidatar' })[0])
    expect(screen.getByRole('heading', { name: 'Login de destino, voltar para /vagas/1' })).toBeVisible()
  })

  it.each([
    ['visitante', null],
    ['voluntário', { id: 3, nome: 'Ana', perfil: 'VOLUNTARIO' }],
  ])('bloqueia a candidatura do %s quando todos os encontros já passaram', async (_, usuario) => {
    useAuth.mockReturnValue({ usuario, loading: false })
    await abrir({
      ...vagaBase,
      ocorrencias: [{ id: 1, inicio: '2020-03-10T12:00:00Z', fim: '2020-03-10T15:00:00Z' }],
    })
    for (const botao of screen.getAllByRole('button', { name: 'Encontros encerrados' })) {
      expect(botao).toBeDisabled()
    }
    expect(screen.queryByRole('link', { name: 'Quero me candidatar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Candidaturas em breve' })).not.toBeInTheDocument()
  })

  it('não oferece a candidatura enquanto a sessão ainda está sendo validada', async () => {
    useAuth.mockReturnValue({ usuario: null, loading: true })
    await abrir()
    expect(screen.getAllByText('Validando sessão…')[0]).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Quero me candidatar' })).not.toBeInTheDocument()
  })

  it('explica à organização autenticada que a candidatura é só para voluntários', async () => {
    useAuth.mockReturnValue({ usuario: { id: 5, nome: 'ONG', perfil: 'ORGANIZACAO' }, loading: false })
    await abrir()
    expect(screen.getAllByRole('button', { name: 'Exclusivo para voluntários' })[0]).toBeDisabled()
    expect(screen.getAllByText('Entre com uma conta de voluntário para se candidatar.')[0]).toBeVisible()
  })
})

describe('vaga inexistente ou sem visibilidade e contatos reservados', () => {
  it('não mostra contatos reservados mesmo que cheguem na resposta da API', async () => {
    await abrir({
      ...vagaBase,
      organizacao: {
        ...vagaBase.organizacao,
        email: 'contato-reservado@example.com',
        telefone: '61988887777',
        responsavel: 'Responsável Reservado',
        cnpj: '11222333000181',
      },
    })
    for (const reservado of ['contato-reservado@example.com', '61988887777', 'Responsável Reservado', '11222333000181']) {
      expect(screen.queryByText(reservado, { exact: false })).not.toBeInTheDocument()
    }
    expect(screen.getAllByText('O contato do responsável é liberado depois do aceite.')[0]).toBeVisible()
  })

  it('trata a vaga suspensa, encerrada ou de outra organização indisponível como não encontrada', async () => {
    service.detalharVaga.mockRejectedValue({ response: { status: 404, data: { detail: 'Vaga não encontrada ou indisponível.' } } })
    render(
      <MemoryRouter initialEntries={['/vagas/99']}>
        <Routes><Route path="/vagas/:id" element={<VagaDetailsPage />} /></Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Vaga não encontrada ou indisponível.' })).toBeVisible()
    expect(service.detalharVaga).toHaveBeenCalledWith('99', expect.any(AbortSignal))
    expect(screen.queryByText('Datas e horários')).not.toBeInTheDocument()
  })
})
