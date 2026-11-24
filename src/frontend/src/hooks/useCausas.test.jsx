import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { causaPorNome, useCausas } from './useCausas'
import { listarCausas } from '../services/causasService'
import { CAUSAS_TESTE } from '../test/fixtures/causas'

beforeEach(() => vi.resetAllMocks())

it('usa somente as causas retornadas pela API, com seus IDs e aliases', async () => {
  listarCausas.mockResolvedValueOnce([CAUSAS_TESTE[3]])
  const { result } = renderHook(() => useCausas())
  await waitFor(() => expect(result.current.carregando).toBe(false))
  expect(result.current.itens).toEqual([CAUSAS_TESTE[3]])
  expect(causaPorNome(result.current.itens, 'animais').id).toBe(5)
  expect(causaPorNome(result.current.itens, 'Assistência social')).toBeUndefined()
})

it('apresenta falha e permite repetir sem inventar uma lista alternativa', async () => {
  listarCausas.mockRejectedValueOnce(new Error('Rede'))
  const { result } = renderHook(() => useCausas())
  await waitFor(() => expect(result.current.erro).toBe('Não foi possível carregar as causas.'))
  expect(result.current.itens).toEqual([])
  act(() => result.current.recarregar())
  await waitFor(() => expect(result.current.erro).toBe(''))
  await waitFor(() => expect(result.current.itens).toEqual(CAUSAS_TESTE))
})
