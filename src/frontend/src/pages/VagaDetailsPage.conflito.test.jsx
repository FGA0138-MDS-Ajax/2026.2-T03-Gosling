// Issue #54 (CN06-RF27): exibir conflito de candidatura e acesso ao calendário.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VagaDetailsPage from './VagaDetailsPage'
import { useAuth } from '../hooks/useAuth'
import * as vagas from '../services/vagasService'
import * as candidaturas from '../services/candidaturasService'
import { interpretarErroCandidatura } from '../utils/candidatura'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({ detalharVaga: vi.fn(), listarVagas: vi.fn() }))
vi.mock('../services/candidaturasService', () => ({ enviarCandidatura: vi.fn(), baixarComprovante: vi.fn() }))

const vaga = {
  ...VAGAS_TESTE[0],
  fotos: [],
  organizacao: { id: 1, nome: 'Instituto Caminhos', homologada: true },
  candidaturas_disponiveis: true,
  ocorrencias: [{ id: 1, inicio: '2027-11-17T01:00:00Z', fim: '2027-11-17T02:30:00Z' }],
  documentos_exigidos: [{ nome: 'Documento com foto' }],
}
const respostaConflito = {
  response: {
    status: 409,
    data: {
      detail: {
        codigo: 'CONFLITO_HORARIO',
        mensagem: 'Você já tem um compromisso nesse horário.',
        conflitos: [
          {
            vaga_id: 8,
            titulo_vaga: 'Plantão na biblioteca comunitária',
            inicio: '2027-11-17T00:30:00Z',
            fim: '2027-11-17T02:00:00Z',
          },
        ],
      },
    },
  },
}

function CalendarioDeDestino() {
  const { state } = useLocation()
  return (
    <main>
      <h1>Meu calendário</h1>
      <p>Data: {state?.data}</p>
      <p>Vaga tentada: {state?.conflito?.titulo}</p>
      <p>Conflitos: {state?.conflito?.conflitos?.length}</p>
      <p>Voltar para: {state?.voltarPara}</p>
    </main>
  )
}

async function provocarConflito(falha = respostaConflito) {
  candidaturas.enviarCandidatura.mockRejectedValueOnce(falha)
  vagas.detalharVaga.mockResolvedValue(vaga)
  render(
    <MemoryRouter initialEntries={['/vagas/1']}>
      <Routes>
        <Route path="/vagas/:id" element={<VagaDetailsPage />} />
        <Route path="/voluntario/agenda" element={<CalendarioDeDestino />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: vaga.titulo, exact: true })
  const user = userEvent.setup()
  await user.click(screen.getAllByRole('button', { name: 'Quero me candidatar' })[0])
  const rg = new File(['x'], 'rg.pdf', { type: 'application/pdf' })
  const formulario = within(screen.getByRole('dialog', { name: 'Confirmar candidatura' }))
  await user.upload(formulario.getByLabelText('Documento com foto'), rg)
  await user.click(formulario.getByRole('button', { name: 'Confirmar candidatura' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Conflito de horário' }))
  return { user, dialog, rg }
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ usuario: { id: 3, nome: 'Ana', perfil: 'VOLUNTARIO' }, loading: false })
  vagas.listarVagas.mockResolvedValue({ itens: VAGAS_TESTE })
})

describe('leitura do 409 e identificação do conflito', () => {
  it('mostra a vaga, a data e os horários em conflito no horário de Brasília', async () => {
    const { dialog } = await provocarConflito()
    expect(dialog.getByRole('alert')).toHaveTextContent('Você já tem um compromisso nesse horário.')
    const item = within(dialog.getByRole('list', { name: 'Compromissos em conflito' })).getByRole('listitem')
    expect(within(item).getByText('Plantão na biblioteca comunitária')).toBeVisible()
    expect(within(item).getByText('Terça-feira, 16 de novembro, 21:30 – 23:00')).toBeVisible()
    expect(within(item).getByText('Coincide com o encontro desta vaga: Terça-feira, 16 de novembro, 22:00 – 23:30')).toBeVisible()
    expect(dialog.getByText(vaga.titulo, { exact: false })).toBeVisible()
  })

  it('lista vários conflitos em ordem cronológica', async () => {
    const detalhe = respostaConflito.response.data.detail
    const { dialog } = await provocarConflito({
      response: {
        status: 409,
        data: {
          detail: {
            ...detalhe,
            conflitos: [
              { vaga_id: 9, titulo_vaga: 'Mutirão de limpeza', inicio: '2027-11-20T12:00:00Z', fim: '2027-11-20T15:00:00Z' },
              detalhe.conflitos[0],
            ],
          },
        },
      },
    })
    const titulos = within(dialog.getByRole('list', { name: 'Compromissos em conflito' }))
      .getAllByRole('listitem').map((item) => item.querySelector('strong').textContent)
    expect(titulos).toEqual(['Plantão na biblioteca comunitária', 'Mutirão de limpeza'])
  })

  it('trata um 409 sem detalhes e ainda orienta a conferir o calendário', async () => {
    const { dialog } = await provocarConflito({ response: { status: 409, data: { detail: 'Conflito de horário com outra candidatura.' } } })
    expect(dialog.getByRole('alert')).toHaveTextContent('Conflito de horário com outra candidatura.')
    expect(dialog.getByText('Não recebemos os detalhes do compromisso. Confira os horários no seu calendário.')).toBeVisible()
    expect(dialog.getByRole('link', { name: 'Ver meu calendário' })).toBeVisible()
  })

  it('reconhece qualquer 409 que não seja de candidatura duplicada como conflito de agenda', () => {
    expect(interpretarErroCandidatura({ response: { status: 409, data: { detail: 'Conflito.' } } }))
      .toEqual({ tipo: 'conflito', mensagem: 'Conflito.', conflitos: [] })
    expect(interpretarErroCandidatura({ response: { status: 409, data: {} } }).tipo).toBe('conflito')
  })
})

describe('ação Ver meu calendário e dados para corrigir a tentativa', () => {
  it('abre o calendário no dia do conflito, com a vaga tentada e o caminho de volta', async () => {
    const { user, dialog } = await provocarConflito()
    await user.click(dialog.getByRole('link', { name: 'Ver meu calendário' }))
    expect(screen.getByRole('heading', { name: 'Meu calendário' })).toBeVisible()
    expect(screen.getByText('Data: 2027-11-16')).toBeVisible()
    expect(screen.getByText(`Vaga tentada: ${vaga.titulo}`)).toBeVisible()
    expect(screen.getByText('Conflitos: 1')).toBeVisible()
    expect(screen.getByText('Voltar para: /vagas/1')).toBeVisible()
  })

  it('reabre a candidatura com os documentos já escolhidos para tentar de novo', async () => {
    const { user, dialog, rg } = await provocarConflito()
    await user.click(dialog.getByRole('button', { name: 'Revisar e tentar de novo' }))
    const formulario = within(screen.getByRole('dialog', { name: 'Confirmar candidatura' }))
    expect(formulario.getByText('Selecionado: rg.pdf')).toBeVisible()

    candidaturas.enviarCandidatura.mockResolvedValueOnce({ id: 50, status: 'PENDENTE', comprovante: { codigo: 'VJ-50' } })
    await user.click(formulario.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(candidaturas.enviarCandidatura).toHaveBeenLastCalledWith(vaga.id, [{ indice: 0, arquivo: rg }])
    expect(await screen.findByRole('dialog', { name: 'Candidatura enviada' })).toBeVisible()
  })
})

describe('nenhum sinal de sucesso no caminho de conflito', () => {
  it('não mostra confirmação, comprovante nem candidatura enviada', async () => {
    const { user, dialog } = await provocarConflito()
    expect(screen.queryByRole('dialog', { name: 'Candidatura enviada' })).not.toBeInTheDocument()
    expect(screen.queryByText(/comprovante/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/registrada|sucesso|Pendente/)).not.toBeInTheDocument()
    expect(candidaturas.baixarComprovante).not.toHaveBeenCalled()

    await user.click(dialog.getByRole('button', { name: 'Voltar para a vaga' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Quero me candidatar' })[0]).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Candidatura enviada' })).not.toBeInTheDocument()
  })
})
