import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarCep } from './cepService'

afterEach(() => vi.unstubAllGlobals())

describe('consulta de CEP', () => {
  it('valida o formato antes de enviar e consulta sem sessão nem endereço residencial', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          cep: '70000-001',
          localidade: 'Brasília',
          uf: 'DF',
          bairro: 'Centro',
        }),
      })
    vi.stubGlobal('fetch', fetch)
    await expect(consultarCep('12A')).rejects.toMatchObject({ codigo: 'INVALIDO' })
    expect(fetch).not.toHaveBeenCalled()
    const data = await consultarCep('70000-001')
    expect(data).toMatchObject({
      cep: '70000001',
      cidade: 'Brasília',
      estado: 'DF',
      bairro: 'Centro',
    })
    expect(data).not.toHaveProperty('latitude')
    expect(fetch).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/70000001/json/',
      expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }),
    )
  })
  it('diferencia CEP inexistente de indisponibilidade', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ erro: true }) })
      .mockRejectedValueOnce(new Error('offline'))
    vi.stubGlobal('fetch', fetch)
    await expect(consultarCep('70000001')).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' })
    await expect(consultarCep('70000001')).rejects.toMatchObject({ codigo: 'INDISPONIVEL' })
  })
  it.each([
    { cep: '70000002', localidade: 'Brasília', uf: 'DF' },
    { cep: '70000001', localidade: 'Brasília', uf: 'XX' },
    { cep: '70000001', localidade: {}, uf: 'DF' },
  ])('não confirma retorno incompleto ou de outro CEP', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    await expect(consultarCep('70000001')).rejects.toMatchObject({ codigo: 'INDISPONIVEL' })
  })
})
