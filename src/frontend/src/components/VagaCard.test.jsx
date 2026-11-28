import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import VagaCard from './VagaCard'
import VagaDetailsPage from '../pages/VagaDetailsPage'
import { useAuth } from '../hooks/useAuth'
import { resetSavedVagasState } from '../hooks/useSavedVagas'
import { writeSession } from '../services/sessionStore'
import * as saved from '../services/savedVagas'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({
  detalharVaga: vi.fn(async () => ({ ...VAGAS_TESTE[0], fotos: [], documentos_exigidos: [] })),
  listarVagas: vi.fn(async () => ({ itens: [] })),
}))
vi.mock('../services/savedVagas', async importOriginal => ({
  ...await importOriginal(), listSavedVagas: vi.fn(), saveVaga: vi.fn(), removeSavedVaga: vi.fn(),
}))

beforeEach(() => {
  resetSavedVagasState()
  vi.clearAllMocks()
  writeSession('conta-A', 2000000000)
  useAuth.mockReturnValue({ usuario: { id: 3, nome: 'Ana', perfil: 'VOLUNTARIO' }, loading: false })
  saved.listSavedVagas.mockResolvedValue([])
  saved.saveVaga.mockResolvedValue(undefined)
  saved.removeSavedVaga.mockResolvedValue(undefined)
})

function open() {
  render(<MemoryRouter initialEntries={['/vagas/1']}>
    <section aria-label="Card da home"><VagaCard vaga={VAGAS_TESTE[0]} /></section>
    <Routes><Route path="/vagas/:id" element={<VagaDetailsPage />} /></Routes>
  </MemoryRouter>)
}

it('sincroniza o card e os dois corações do detalhe após confirmação da API', async () => {
  open()
  const user = userEvent.setup()
  const card = within(screen.getByRole('region', { name: 'Card da home' })).getByRole('button')
  await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'false'))
  const summary = within(await screen.findByRole('complementary', { name: 'Participar desta vaga' }))
  await user.click(card)
  expect(card).toHaveAttribute('aria-pressed', 'true')
  expect(summary.getByRole('button', { name: 'Vaga salva' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Remover dos salvos', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(saved.saveVaga).toHaveBeenCalledWith(1, 'conta-A')
  await user.click(summary.getByRole('button', { name: 'Vaga salva' }))
  expect(card).toHaveAttribute('aria-pressed', 'false')
  expect(saved.removeSavedVaga).toHaveBeenCalledWith(1, 'conta-A')
})

it('explica falha e mantém os corações no estado confirmado', async () => {
  saved.saveVaga.mockRejectedValueOnce(new Error('Rede'))
  open()
  const user = userEvent.setup()
  const card = within(screen.getByRole('region', { name: 'Card da home' })).getByRole('button')
  await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'false'))
  await user.click(card)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar suas vagas salvas.')
  expect(card).toHaveAttribute('aria-pressed', 'false')
  const summary = within(screen.getByRole('complementary', { name: 'Participar desta vaga' }))
  expect(summary.getByRole('button', { name: 'Salvar vaga' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByText('Vaga salva na sua conta.')).not.toBeInTheDocument()
})
