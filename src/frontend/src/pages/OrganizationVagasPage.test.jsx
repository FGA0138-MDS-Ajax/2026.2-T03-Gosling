import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuth } from '../hooks/useAuth'
import { getProfile } from '../services/authService'
import http from '../services/http'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/authService', () => ({ getProfile: vi.fn() }))

const ong = { id: 1, nome: 'ONG Teste', perfil: 'ORGANIZACAO', tipo: 'ONG' }
const vagas = [
  {
    id: 1,
    titulo: 'Oficina de leitura',
    status: 'ABERTA',
    local: 'Brasília',
    total_candidaturas: 4,
  },
  { id: 2, titulo: 'Apoio escolar', estado_vaga: 'ENCERRADA', total_candidaturas: 0 },
  { id: 3, titulo: 'Mutirão de limpeza', status: 'SUSPENSA', total_candidaturas: null },
]

function resposta(itens, pagina = 1, totalPaginas = 1) {
  return { data: { itens, pagina, total_paginas: totalPaginas } }
}

function abrir(caminho = '/organizacao/vagas', usuario = ong) {
  useAuth.mockReturnValue({ usuario, loading: false })
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  getProfile.mockResolvedValue({})
})

describe('painel de vagas da organização', () => {
  it('abre pela área da organização e distingue contagem zero de indisponível', async () => {
    const user = userEvent.setup()
    const listar = vi.spyOn(http, 'get').mockResolvedValue(resposta(vagas))
    abrir('/organizacao')
    await user.click(screen.getByRole('link', { name: 'Minhas vagas' }))

    const aberta = await screen.findByRole('row', { name: 'Oficina de leitura' })
    expect(aberta).toHaveTextContent('Aberta')
    expect(aberta).toHaveTextContent('Brasília')
    expect(within(aberta).getByText('4')).toBeVisible()
    const encerrada = screen.getByRole('row', { name: 'Apoio escolar' })
    expect(encerrada).toHaveTextContent('Encerrada')
    expect(within(encerrada).getByText('0')).toBeVisible()
    const suspensa = screen.getByRole('row', { name: 'Mutirão de limpeza' })
    expect(suspensa).toHaveTextContent('Suspensa')
    expect(suspensa).toHaveTextContent('Indisponível')
    expect(screen.getByRole('link', { name: 'Publicar vaga' })).toHaveAttribute('href', '/vagas')

    expect(listar).toHaveBeenCalledWith('/organizacoes/me/vagas', {
      params: { pagina: 1, tamanho_pagina: 10 },
      signal: expect.any(AbortSignal),
    })
  })

  it('navega entre páginas e repete a página solicitada em caso de falha', async () => {
    const user = userEvent.setup()
    const listar = vi
      .spyOn(http, 'get')
      .mockResolvedValueOnce(resposta([vagas[0]], 1, 2))
      .mockRejectedValueOnce(new Error('Sem conexão'))
      .mockResolvedValueOnce(resposta([vagas[1]], 2, 2))
      .mockResolvedValueOnce(resposta([vagas[0]], 1, 2))
    abrir()

    expect(screen.getByRole('status')).toHaveTextContent('Carregando suas vagas')
    await screen.findByRole('row', { name: 'Oficina de leitura' })
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('row', { name: 'Apoio escolar' })).toBeVisible()
    expect(screen.getByText('Página 2 de 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByRole('row', { name: 'Oficina de leitura' })).toBeVisible()
    expect(listar.mock.calls.map(([, config]) => config.params.pagina)).toEqual([1, 2, 2, 1])
  })

  it('exibe lista vazia e respeita a permissão de publicação do projeto social', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(resposta([], 1, 0))
    abrir('/organizacao/vagas', { ...ong, tipo: 'PROJETO_SOCIAL' })
    expect(await screen.findByText('Sua organização ainda não tem vagas.')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Publicar vaga' })).not.toBeInTheDocument()
  })

  it('redireciona o voluntário sem consultar as vagas institucionais', async () => {
    const listar = vi.spyOn(http, 'get').mockResolvedValue(resposta([]))
    abrir('/organizacao/vagas', { ...ong, perfil: 'VOLUNTARIO' })
    expect(await screen.findByRole('heading', { name: 'Área de Voluntário' })).toBeVisible()
    expect(listar).not.toHaveBeenCalledWith('/organizacoes/me/vagas', expect.anything())
  })

  it('consulta rascunhos na primeira página e oferece a retomada', async () => {
    const user = userEvent.setup()
    const rascunho = {
      id: 19,
      titulo: 'Mutirão em preparo',
      estado_vaga: 'RASCUNHO',
      atualizado_em: '2026-11-23T18:40:00Z',
    }
    const listar = vi
      .spyOn(http, 'get')
      .mockResolvedValueOnce(resposta(vagas))
      .mockResolvedValueOnce(resposta([rascunho]))
    abrir()
    await screen.findByRole('row', { name: 'Oficina de leitura' })

    await user.click(screen.getByRole('button', { name: 'Rascunhos' }))

    const linha = await screen.findByRole('row', { name: 'Mutirão em preparo' })
    expect(linha).toHaveTextContent('15:40')
    expect(within(linha).getByRole('link', { name: 'Editar rascunho' })).toHaveAttribute(
      'href',
      '/vagas?rascunho=19',
    )
    expect(listar).toHaveBeenLastCalledWith('/organizacoes/me/vagas', {
      params: { pagina: 1, tamanho_pagina: 10, status: 'RASCUNHO' },
      signal: expect.any(AbortSignal),
    })
  })
})
