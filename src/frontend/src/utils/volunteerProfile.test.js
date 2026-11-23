import { describe, expect, it } from 'vitest'
import { formatDisponibilidades, parseDisponibilidades, profileCompletion, validCpf } from './volunteerProfile'

describe('formato da disponibilidade', () => {
  it('converte a lista da API em dias, períodos e carga horária', () => {
    expect(parseDisponibilidades(['PERIODO:TARDE', 'DIA:SEGUNDA', 'CARGA_HORARIA:8', 'Fins de Semana']))
      .toEqual({ dias: ['SEGUNDA'], periodos: ['TARDE'], cargaHoraria: '8', outras: ['Fins de Semana'] })
    expect(parseDisponibilidades(null)).toEqual({ dias: [], periodos: [], cargaHoraria: '', outras: [] })
  })

  it('gera a lista em ordem fixa e ignora carga horária vazia', () => {
    expect(formatDisponibilidades({ dias: ['DOMINGO', 'SEGUNDA'], periodos: ['NOITE'], cargaHoraria: '' }))
      .toEqual(['DIA:SEGUNDA', 'DIA:DOMINGO', 'PERIODO:NOITE'])
  })
})

describe('validação de CPF', () => {
  it('aceita CPF válido e recusa inválido', () => {
    expect(validCpf('52998224725')).toBe(true)
    expect(validCpf('52998224724')).toBe(false)
    expect(validCpf('11111111111')).toBe(false)
    expect(validCpf('123')).toBe(false)
  })
})

describe('preenchimento do perfil', () => {
  it('conta os oito itens do perfil', () => {
    expect(profileCompletion({})).toBe(0)
    expect(profileCompletion({ nome: 'Ana', identificacao: '1', telefone: '61', cidade: 'Gama', estado: 'DF',
      causas: ['Cultura'], disponibilidade_semanal: [{ dia: 'SABADO', periodo: 'MANHA' }], carga_horaria_semanal: 4 })).toBe(100)
    expect(profileCompletion({ nome: 'Ana', causas: ['Cultura'] })).toBe(25)
  })
})
