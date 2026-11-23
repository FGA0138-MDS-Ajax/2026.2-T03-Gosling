import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import SavedVagasImport from './SavedVagasImport'
import { useAuth } from '../hooks/useAuth'
import { resetSavedVagasState } from '../hooks/useSavedVagas'
import { writeSession } from '../services/sessionStore'
import * as saved from '../services/savedVagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
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
})

it('oferece importação e espera a escolha do voluntário', async () => {
  localStorage.setItem('volunja:saved-vagas:visitante', '[7]')
  render(<SavedVagasImport />)
  const button = screen.getByRole('button', { name: 'Importar salvos deste navegador' })
  await waitFor(() => expect(button).toBeEnabled())
  expect(saved.saveVaga).not.toHaveBeenCalled()
  await userEvent.click(button)
  expect(await screen.findByRole('status')).toHaveTextContent('1 vaga importada para sua conta.')
  expect(saved.saveVaga).toHaveBeenCalledWith(7, 'conta-A')
  expect(JSON.parse(localStorage.getItem('volunja:saved-vagas:visitante'))).toEqual([])
})
