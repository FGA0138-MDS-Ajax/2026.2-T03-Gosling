import { describe, expect, it } from 'vitest'
import { formatarOcorrencia, horarioBrasiliaParaUTC, prepararOcorrencias } from './ocorrencias'

function encontro(dataInicio, horaInicio, horaFim, dataFim = dataInicio) {
  return { dataInicio, horaInicio, dataFim, horaFim }
}

describe('datas e horários de Brasília', () => {
  it('converte o horário informado para UTC', () => {
    expect(horarioBrasiliaParaUTC('2026-11-16', '09:00')).toBe('2026-11-16T12:00:00.000Z')
  })
  it.each([
    ['2026-02-30', '09:00'], ['2026-11-16', '25:00'], ['', '09:00'],
  ])('rejeita a data/hora inválida %s %s', (data, hora) => {
    expect(() => horarioBrasiliaParaUTC(data, hora)).toThrow()
  })
  it('exige ao menos um encontro', () => {
    expect(() => prepararOcorrencias([])).toThrow('pelo menos um')
  })
  it('rejeita término igual ou anterior ao início', () => {
    expect(() => prepararOcorrencias([encontro('2026-11-16', '10:00', '10:00')])).toThrow('depois')
    expect(() => prepararOcorrencias([encontro('2026-11-16', '10:00', '09:00')])).toThrow('depois')
  })
  it('permite encontros consecutivos e em dias diferentes', () => {
    expect(prepararOcorrencias([
      encontro('2026-11-16', '09:00', '10:00'),
      encontro('2026-11-16', '10:00', '11:00'),
      encontro('2026-11-17', '09:00', '10:00'),
    ])).toHaveLength(3)
  })
  it('detecta sobreposição ao atravessar a meia-noite', () => {
    expect(() => prepararOcorrencias([
      encontro('2026-11-16', '23:30', '01:00', '2026-11-17'),
      encontro('2026-11-17', '00:30', '02:00'),
    ])).toThrow('sobrepostos')
  })
  it('mostra a data e hora de Brasília nas ocorrências UTC', () => {
    expect(formatarOcorrencia({
      inicio: '2026-11-17T02:30:00Z', fim: '2026-11-17T03:30:00Z',
    })).toBe('16/11/2026 às 23:30 até 17/11/2026 às 00:30')
  })
})
