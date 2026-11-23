import { describe, expect, it } from 'vitest'
import { destinoMapa, localizacaoPayload, validarLocalizacao } from './localizacao'

describe('validação e exibição de localização', () => {
  it('recusa par incompleto, limites, CEP e UF inválidos', () => {
    expect(validarLocalizacao({ latitude: '91', cep: '123', estado: 'XX' })).toMatchObject({
      'localizacao.latitude': expect.any(String), 'localizacao.longitude': expect.any(String),
      'localizacao.cep': expect.any(String), 'localizacao.estado': expect.any(String),
    })
  })
  it('aceita zero e coordenadas sem endereço; vazio não vira zero', () => {
    expect(localizacaoPayload({})).toBeNull()
    expect(validarLocalizacao({ latitude: '0', longitude: '0' })).toEqual({})
    expect(localizacaoPayload({ latitude: '0', longitude: '0' })).toMatchObject({ latitude: 0, longitude: 0, origem_coordenadas: 'MANUAL' })
  })
  it('usa o ponto confirmado da vaga no mapa, sem inventar coordenadas', () => {
    expect(destinoMapa({ local: 'Texto da atividade', localizacao: { latitude: 0, longitude: -48 } })).toContain('query=0%2C-48')
    expect(destinoMapa({ local: 'Texto da atividade' })).toContain('query=Texto%20da%20atividade')
  })
})
