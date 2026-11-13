import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../hooks/useAuth'
import * as vagasService from '../services/vagasService'
import { VAGAS_TESTE } from '../test/fixtures/vagas'
import VagasPage from './VagasPage'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({
  listarVagas: vi.fn(), publicarVaga: vi.fn(),
}))

const ONG = { id: 7, perfil: 'ORGANIZACAO', tipo: 'ONG', nome: 'ONG da sessão' }
let vagasServidor

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
  vagasServidor = structuredClone(VAGAS_TESTE)
  vagasService.listarVagas.mockImplementation(async () => ({
    itens: [...vagasServidor], total: vagasServidor.length, pagina: 1, por_pagina: 20,
  }))
  vagasService.publicarVaga.mockImplementation(async (payload) => {
    const vaga = {
      ...payload, id: 99, status: 'ABERTA',
      causa: { id: 1, nome: payload.causa },
      organizacao: { id: ONG.id, nome: ONG.nome },
      ocorrencias: payload.ocorrencias.map((item, indice) => ({ ...item, id: 100 + indice })),
    }
    vagasServidor = [vaga, ...vagasServidor]
    return vaga
  })
})

function abrir(usuario = null, extra = {}) {
  useAuth.mockReturnValue({
    usuario, loading: false, restoreError: '', logout: vi.fn(), ...extra,
  })
  return render(<MemoryRouter><VagasPage /></MemoryRouter>)
}

function preencherEncontro(indice, data, inicio, fim, dataFim = data) {
  fireEvent.change(screen.getByLabelText(`Data de início do encontro ${indice}`), { target: { value: data } })
  fireEvent.change(screen.getByLabelText(`Hora de início do encontro ${indice}`), { target: { value: inicio } })
  fireEvent.change(screen.getByLabelText(`Data de término do encontro ${indice}`), { target: { value: dataFim } })
  fireEvent.change(screen.getByLabelText(`Hora de término do encontro ${indice}`), { target: { value: fim } })
}

async function preencherFormulario(user) {
  await user.click(screen.getByRole('button', { name: 'Publicar vaga', exact: true }))
  await user.type(screen.getByLabelText('Título da vaga'), 'Oficina de leitura')
  await user.type(screen.getByLabelText('Descrição'), 'Apoio às atividades de leitura da comunidade.')
  await user.type(screen.getByLabelText('Atividades do voluntário'), 'Organizar livros e apoiar a leitura.')
  await user.type(screen.getByLabelText('Causa'), 'Educação')
  await user.type(screen.getByLabelText('Local ou atividade remota'), 'Brasília')
  await user.type(screen.getByLabelText('Carga horária (horas)'), '3')
  await user.type(screen.getByLabelText('Número de vagas'), '2')
  preencherEncontro(1, '2026-11-16', '09:00', '12:00')
}

function botaoEnviar() {
  return within(screen.getByRole('dialog')).getByRole('button', { name: 'Publicar vaga', exact: true })
}

describe('página pública de vagas', () => {
  it.each([
    [null, false],
    [{ perfil: 'VOLUNTARIO' }, false],
    [{ perfil: 'ADMINISTRADOR' }, false],
    [{ perfil: 'ORGANIZACAO', tipo: 'PROJETO_SOCIAL' }, false],
    [ONG, true],
  ])('controla a publicação pela sessão %j', async (usuario, permitido) => {
    abrir(usuario)
    expect(await screen.findAllByRole('article')).toHaveLength(3)
    const botao = screen.queryByRole('button', { name: 'Publicar vaga', exact: true })
    if (permitido) expect(botao).toBeVisible()
    else expect(botao).not.toBeInTheDocument()
  })

  it.each([{ loading: true }, { restoreError: 'Falha de rede' }])(
    'aguarda validação da sessão antes de oferecer publicação: %j',
    async (extra) => {
      abrir(ONG, extra)
      await screen.findAllByRole('article')
      expect(screen.queryByRole('button', { name: 'Publicar vaga' })).not.toBeInTheDocument()
    },
  )

  it('publica pela API e recupera a vaga ao remontar a página', async () => {
    const user = userEvent.setup()
    const view = abrir(ONG)
    await screen.findAllByRole('article')
    await preencherFormulario(user)
    expect(screen.getByLabelText('Data de início do encontro 1')).toHaveAttribute('type', 'date')
    await user.click(botaoEnviar())
    expect(await screen.findByRole('heading', { name: 'Oficina de leitura' })).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByText(ONG.nome)).toBeVisible()
    expect(vagasService.publicarVaga).toHaveBeenCalledWith(expect.objectContaining({
      ocorrencias: [{ inicio: '2026-11-16T12:00:00.000Z', fim: '2026-11-16T15:00:00.000Z' }],
    }))
    expect(vagasService.publicarVaga.mock.calls[0][0]).not.toHaveProperty('organizacao_id')

    view.unmount()
    abrir(ONG)
    expect(await screen.findByRole('heading', { name: 'Oficina de leitura' })).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(4)
  })

  it('recusa textos formados por espaços', async () => {
    const user = userEvent.setup()
    abrir(ONG)
    await screen.findAllByRole('article')
    await user.click(screen.getByRole('button', { name: 'Publicar vaga', exact: true }))
    fireEvent.change(screen.getByLabelText('Título da vaga'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Publicar vaga' }))
    expect(screen.getByText('Confira os campos indicados e tente novamente.')).toBeVisible()
    expect(screen.getByLabelText(/Título da vaga/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Título da vaga/)).toHaveAccessibleDescription('Use pelo menos 3 caracteres.')
    expect(screen.getByLabelText(/Título da vaga/)).toHaveFocus()
    expect(vagasService.publicarVaga).not.toHaveBeenCalled()
  })

  it('mostra conflito entre encontros e permite horários consecutivos', async () => {
    const user = userEvent.setup()
    abrir(ONG)
    await screen.findAllByRole('article')
    await preencherFormulario(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar encontro' }))
    preencherEncontro(2, '2026-11-16', '11:00', '13:00')
    expect(screen.getByRole('alert')).toHaveTextContent('horários sobrepostos')
    await user.click(botaoEnviar())
    expect(vagasService.publicarVaga).not.toHaveBeenCalled()

    preencherEncontro(2, '2026-11-16', '12:00', '13:00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(botaoEnviar())
    await screen.findByRole('heading', { name: 'Oficina de leitura' })
    expect(vagasService.publicarVaga.mock.calls[0][0].ocorrencias).toHaveLength(2)
  })

  it('preserva o formulário se a API recusar a publicação', async () => {
    const user = userEvent.setup()
    vagasService.publicarVaga.mockRejectedValue(new Error('Falha de rede'))
    abrir(ONG)
    await screen.findAllByRole('article')
    await preencherFormulario(user)
    await user.click(botaoEnviar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível publicar')
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByLabelText('Título da vaga')).toHaveValue('Oficina de leitura')
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it.each(['0.01', '1.25', '99999.99'])('publica carga %s e local com 500 caracteres', async (carga) => {
    const user = userEvent.setup()
    abrir(ONG)
    await screen.findAllByRole('article')
    await preencherFormulario(user)
    const local = 'L'.repeat(500)
    fireEvent.change(screen.getByLabelText('Local ou atividade remota'), { target: { value: local } })
    fireEvent.change(screen.getByLabelText('Carga horária (horas)'), { target: { value: carga } })
    expect(screen.getByLabelText('Local ou atividade remota')).toHaveAttribute('maxlength', '500')
    expect(screen.getByLabelText('Carga horária (horas)')).toHaveAttribute('step', '0.01')
    await user.click(botaoEnviar())
    await screen.findByRole('heading', { name: 'Oficina de leitura' })
    expect(vagasService.publicarVaga).toHaveBeenCalledWith(expect.objectContaining({
      local, carga_horaria: Number(carga),
    }))
  })

  it.each(['0', '-1', '1.001', '100000'])('recusa a carga inválida %s e aponta o campo', async (carga) => {
    const user = userEvent.setup()
    abrir(ONG)
    await screen.findAllByRole('article')
    await preencherFormulario(user)
    fireEvent.change(screen.getByLabelText('Carga horária (horas)'), { target: { value: carga } })
    await user.click(botaoEnviar())
    expect(screen.getByLabelText(/Carga horária \(horas\)/)).toHaveAccessibleDescription(/até duas casas decimais/)
    expect(screen.getByLabelText(/Carga horária \(horas\)/)).toHaveFocus()
    expect(vagasService.publicarVaga).not.toHaveBeenCalled()
  })

  it('associa os erros 422 aos campos e indica o encontro recusado sem apagar os dados', async () => {
    const user = userEvent.setup()
    vagasService.publicarVaga.mockRejectedValue({ response: { status: 422, data: { detail: [
      { loc: ['body', 'local'], type: 'string_too_long', msg: 'String should have at most 500 characters' },
      { loc: ['body', 'carga_horaria'], msg: 'Carga horária inválida.' },
      { loc: ['body', 'ocorrencias', 0, 'fim'], msg: 'O término deve ser posterior ao início.' },
    ] } } })
    abrir(ONG)
    await screen.findAllByRole('article')
    await preencherFormulario(user)
    await user.click(botaoEnviar())
    expect(await screen.findByText('Confira os campos indicados e tente novamente.')).toBeVisible()
    expect(screen.getByLabelText(/Local ou atividade remota/)).toHaveAccessibleDescription('Use até 500 caracteres.')
    expect(screen.getByLabelText(/Local ou atividade remota/)).toHaveFocus()
    expect(screen.getByLabelText(/Carga horária \(horas\)/)).toHaveAccessibleDescription('Carga horária inválida.')
    expect(screen.getByText('Encontro 1: O término deve ser posterior ao início.')).toBeVisible()
    expect(screen.getByLabelText('Título da vaga')).toHaveValue('Oficina de leitura')
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('oferece nova tentativa quando a listagem falha', async () => {
    const user = userEvent.setup()
    vagasService.listarVagas.mockRejectedValueOnce(new Error('Sem conexão'))
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findAllByRole('article')).toHaveLength(3)
  })
})
