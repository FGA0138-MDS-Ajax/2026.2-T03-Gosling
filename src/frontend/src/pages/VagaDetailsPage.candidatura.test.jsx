// Issue #45 (CN06-RF16): fluxo de candidatura do voluntário na interface.
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VagaDetailsPage from './VagaDetailsPage'
import { useAuth } from '../hooks/useAuth'
import * as vagas from '../services/vagasService'
import * as candidaturas from '../services/candidaturasService'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({ detalharVaga: vi.fn(), listarVagas: vi.fn() }))
vi.mock('../services/candidaturasService', () => ({ enviarCandidatura: vi.fn(), baixarComprovante: vi.fn() }))

const voluntario = { id: 3, nome: 'Ana', perfil: 'VOLUNTARIO' }
const vaga = {
  ...VAGAS_TESTE[0],
  fotos: [],
  organizacao: { id: 1, nome: 'Instituto Caminhos', homologada: true },
  candidaturas_disponiveis: true,
  ocorrencias: [
    { id: 2, inicio: '2027-11-23T12:00:00Z', fim: '2027-11-23T15:00:00Z' },
    { id: 1, inicio: '2027-11-17T01:00:00Z', fim: '2027-11-17T02:30:00Z' },
  ],
  documentos_exigidos: [
    { nome: 'Documento com foto' },
    { nome: 'Termo de adesão', modelo_url: 'https://example.com/termo.pdf' },
  ],
}
const pdf = (nome = 'documento.pdf', tamanho = 1024) => new File(['x'.repeat(tamanho)], nome, { type: 'application/pdf' })
const criada = { id: 41, vaga_id: vaga.id, status: 'PENDENTE', comprovante: { codigo: 'VJ-2027-0041' } }

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ usuario: voluntario, loading: false })
  vagas.listarVagas.mockResolvedValue({ itens: VAGAS_TESTE })
  candidaturas.enviarCandidatura.mockResolvedValue(criada)
})
afterEach(() => vi.restoreAllMocks())

async function abrirCandidatura(dados = vaga) {
  vagas.detalharVaga.mockResolvedValue(dados)
  render(
    <MemoryRouter initialEntries={['/vagas/1']}>
      <Routes>
        <Route path="/vagas/:id" element={<VagaDetailsPage />} />
        <Route path="/voluntario/agenda" element={<h1>Minha agenda</h1>} />
        <Route path="/voluntario/candidaturas" element={<h1>Minhas candidaturas</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: dados.titulo, exact: true })
  const user = userEvent.setup()
  await user.click(screen.getAllByRole('button', { name: 'Quero me candidatar' })[0])
  return { user, dialog: within(screen.getByRole('dialog', { name: 'Confirmar candidatura' })) }
}

async function anexarTudo(user, dialog) {
  await user.upload(dialog.getByLabelText('Documento com foto'), pdf('rg.pdf'))
  await user.upload(dialog.getByLabelText('Termo de adesão'), pdf('termo.pdf'))
}

describe('apresentação da vaga e envio pelo serviço da API', () => {
  it('mostra a vaga e todos os encontros em ordem, no horário de Brasília', async () => {
    const { dialog } = await abrirCandidatura()
    expect(dialog.getByRole('heading', { name: vaga.titulo })).toBeVisible()
    const encontros = within(dialog.getByRole('list', { name: 'Encontros desta candidatura' })).getAllByRole('listitem')
    expect(encontros.map((item) => item.textContent)).toEqual([
      'Terça-feira, 16 de novembro de 202722:00 – 23:30',
      'Terça-feira, 23 de novembro de 202709:00 – 12:00',
    ])
  })

  it('envia a candidatura com cada documento ligado ao documento exigido', async () => {
    const { user, dialog } = await abrirCandidatura()
    const rg = pdf('rg.pdf')
    const termo = new File(['img'], 'termo.png', { type: 'image/png' })
    await user.upload(dialog.getByLabelText('Documento com foto'), rg)
    await user.upload(dialog.getByLabelText('Termo de adesão'), termo)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(candidaturas.enviarCandidatura).toHaveBeenCalledWith(vaga.id, [
      { indice: 0, arquivo: rg },
      { indice: 1, arquivo: termo },
    ])
  })

  it('envia sem anexos quando a vaga não exige documentos', async () => {
    const { user, dialog } = await abrirCandidatura({ ...vaga, documentos_exigidos: [] })
    expect(dialog.getByText('Esta vaga não exige documentos.')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(candidaturas.enviarCandidatura).toHaveBeenCalledWith(vaga.id, [])
  })

  it('mantém o botão anterior quando a vaga não aceita candidaturas', async () => {
    vagas.detalharVaga.mockResolvedValue({ ...vaga, candidaturas_disponiveis: false })
    render(<MemoryRouter initialEntries={['/vagas/1']}><Routes><Route path="/vagas/:id" element={<VagaDetailsPage />} /></Routes></MemoryRouter>)
    await screen.findByRole('heading', { name: vaga.titulo, exact: true })
    expect(screen.getAllByRole('button', { name: 'Candidaturas em breve' })[0]).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Quero me candidatar' })).not.toBeInTheDocument()
  })
})

describe('documentação exigida e comprovante', () => {
  it('oferece o modelo do documento quando a organização fornece', async () => {
    const { dialog } = await abrirCandidatura()
    expect(dialog.getByRole('link', { name: 'Baixar modelo de Termo de adesão' })).toHaveAttribute('href', 'https://example.com/termo.pdf')
  })

  it('valida falta, tipo e tamanho dos arquivos antes de chamar a API', async () => {
    const { user, dialog } = await abrirCandidatura()
    fireEvent.change(dialog.getByLabelText('Termo de adesão'), {
      target: { files: [new File(['x'], 'termo.txt', { type: 'text/plain' })] },
    })
    expect(dialog.getByText('Envie um arquivo PDF, JPG ou PNG.')).toBeVisible()
    fireEvent.change(dialog.getByLabelText('Termo de adesão'), {
      target: { files: [pdf('grande.pdf', 5 * 1024 * 1024 + 1)] },
    })
    expect(dialog.getByText('O arquivo deve ter até 5 MB.')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(dialog.getByText('Anexe este documento.')).toBeVisible()
    expect(dialog.getByRole('alert')).toHaveTextContent('Confira os documentos indicados.')
    expect(candidaturas.enviarCandidatura).not.toHaveBeenCalled()
  })

  it('mostra o código e baixa o comprovante em PDF depois da confirmação', async () => {
    const comprovante = new Blob(['%PDF'], { type: 'application/pdf' })
    candidaturas.baixarComprovante.mockResolvedValue(comprovante)
    const criarUrl = vi.fn(() => 'blob:comprovante')
    const revogarUrl = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: revogarUrl }))
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))

    const sucesso = within(await screen.findByRole('dialog', { name: 'Candidatura enviada' }))
    expect(sucesso.getByText('VJ-2027-0041')).toBeVisible()
    await user.click(sucesso.getByRole('button', { name: 'Baixar comprovante (PDF)' }))
    expect(candidaturas.baixarComprovante).toHaveBeenCalledWith(41)
    expect(criarUrl).toHaveBeenCalledWith(comprovante)
    expect(clique).toHaveBeenCalled()
    expect(revogarUrl).toHaveBeenCalledWith('blob:comprovante')
    vi.unstubAllGlobals()
  })

  it('avisa se o comprovante não puder ser baixado, sem desfazer a candidatura', async () => {
    candidaturas.baixarComprovante.mockRejectedValue(new Error('rede'))
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    const sucesso = within(await screen.findByRole('dialog', { name: 'Candidatura enviada' }))
    await user.click(sucesso.getByRole('button', { name: 'Baixar comprovante (PDF)' }))
    expect(await sucesso.findByRole('alert')).toHaveTextContent('Não foi possível baixar o comprovante agora.')
    expect(sucesso.getByRole('link', { name: 'Ver minhas candidaturas' })).toHaveAttribute('href', '/voluntario/candidaturas')
  })
})

describe('carregamento, erros, confirmação após 201 e conflito 409', () => {
  it('mostra o carregamento e só confirma depois da resposta do servidor', async () => {
    let responder
    candidaturas.enviarCandidatura.mockReturnValue(new Promise((resolve) => { responder = resolve }))
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(dialog.getByRole('button', { name: 'Enviando candidatura…' })).toBeDisabled()
    expect(dialog.getByText('Enviando seus dados e conferindo sua agenda…')).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Candidatura enviada' })).not.toBeInTheDocument()
    fireEvent.submit(dialog.getByRole('form', { name: 'Confirmar candidatura' }))
    expect(candidaturas.enviarCandidatura).toHaveBeenCalledTimes(1)

    responder(criada)
    expect(await screen.findByRole('dialog', { name: 'Candidatura enviada' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Candidatura enviada' })[0]).toBeDisabled()
  })

  it('encaminha o conflito 409 ao tratamento de agenda, sem confirmar', async () => {
    candidaturas.enviarCandidatura.mockRejectedValue({
      response: { status: 409, data: { detail: { codigo: 'CONFLITO_AGENDA', mensagem: 'Você já tem um compromisso nesse horário.', conflitos: [] } } },
    })
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))

    const conflito = within(await screen.findByRole('dialog', { name: 'Conflito de horário' }))
    expect(conflito.getByRole('alert')).toHaveTextContent('Você já tem um compromisso nesse horário.')
    expect(screen.queryByRole('dialog', { name: 'Confirmar candidatura' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Candidatura enviada' })).not.toBeInTheDocument()
    await user.click(conflito.getByRole('link', { name: 'Ver meu calendário' }))
    expect(screen.getByRole('heading', { name: 'Minha agenda' })).toBeVisible()
  })

  it.each([
    [{ status: 409, data: { detail: { codigo: 'CANDIDATURA_DUPLICADA', mensagem: 'Você já se candidatou a esta vaga.' } } }, 'Você já se candidatou a esta vaga.'],
    [{ status: 404, data: { detail: 'Vaga não encontrada ou indisponível.' } }, 'Esta vaga não está mais disponível para candidaturas.'],
    [{ status: 500 }, 'Não foi possível enviar a candidatura. Tente novamente.'],
  ])('mostra o erro da API e mantém o formulário (%#)', async (response, mensagem) => {
    candidaturas.enviarCandidatura.mockRejectedValue({ response })
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent(mensagem)
    expect(dialog.getByRole('button', { name: 'Confirmar candidatura' })).toBeEnabled()
    expect(screen.queryByRole('dialog', { name: 'Candidatura enviada' })).not.toBeInTheDocument()
  })

  it('aponta o documento recusado pela validação da API (422)', async () => {
    candidaturas.enviarCandidatura.mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body', 'arquivos', 1], msg: 'O arquivo não é um PDF válido.' }] } },
    })
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    expect(await dialog.findByText('O arquivo não é um PDF válido.')).toBeVisible()
    expect(dialog.getByLabelText('Termo de adesão')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('aviso para a agenda (#49)', () => {
  it('avisa a agenda só depois da confirmação, e não em caso de conflito', async () => {
    const aviso = vi.fn()
    window.addEventListener('volunja:candidaturas-alteradas', aviso)
    candidaturas.enviarCandidatura.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Conflito.' } } })
    const { user, dialog } = await abrirCandidatura()
    await anexarTudo(user, dialog)
    await user.click(dialog.getByRole('button', { name: 'Confirmar candidatura' }))
    await screen.findByRole('dialog', { name: 'Conflito de horário' })
    expect(aviso).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Revisar e tentar de novo' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar candidatura' }))
    await screen.findByRole('dialog', { name: 'Candidatura enviada' })
    expect(aviso).toHaveBeenCalledTimes(1)
    window.removeEventListener('volunja:candidaturas-alteradas', aviso)
  })
})
