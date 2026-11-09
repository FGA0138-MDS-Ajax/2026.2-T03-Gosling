import { describe, expect, it } from 'vitest'
import { formatDisponibilidades, parseDisponibilidades } from './volunteerProfile'

describe('formato da disponibilidade', () => {
  it('converte a lista da API em dias, períodos e carga horária', () => {
    expect(parseDisponibilidades(['PERIODO:TARDE', 'DIA:SEGUNDA', 'CARGA_HORARIA:8', 'Fins de Semana']))
      .toEqual({ dias: ['SEGUNDA'], periodos: ['TARDE'], cargaHoraria: '8' })
    expect(parseDisponibilidades(null)).toEqual({ dias: [], periodos: [], cargaHoraria: '' })
  })

  it('gera a lista em ordem fixa e ignora carga horária vazia', () => {
    expect(formatDisponibilidades({ dias: ['DOMINGO', 'SEGUNDA'], periodos: ['NOITE'], cargaHoraria: '' }))
      .toEqual(['DIA:SEGUNDA', 'DIA:DOMINGO', 'PERIODO:NOITE'])
  })
})
