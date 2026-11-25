import { describe, expect, it } from 'vitest'
import { diasDoEvento, hojeEmBrasilia, semanasDoMes, somarMeses } from './calendario'

describe('datas do calendário em Brasília', () => {
  it('monta semanas de domingo a sábado cobrindo o mês', () => {
    const semanas = semanasDoMes('2027-02-01')
    expect(semanas[0][0]).toEqual({ dia: '2027-01-31', doMes: false })
    expect(semanas.at(-1).at(-1)).toEqual({ dia: '2027-03-06', doMes: false })
    expect(semanas.flat().filter((item) => item.doMes)).toHaveLength(28)
  })

  it('passa de ano ao avançar ou voltar meses', () => {
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01')
    expect(somarMeses('2027-01-01', -1)).toBe('2026-12-01')
  })

  it('usa o dia de Brasília, e não o de UTC, para hoje e para os encontros', () => {
    expect(hojeEmBrasilia(new Date('2026-11-17T02:00:00Z'))).toBe('2026-11-16')
    expect(diasDoEvento({ inicio: '2026-11-17T01:00:00Z', fim: '2026-11-17T02:00:00Z' })).toEqual(['2026-11-16'])
    expect(diasDoEvento({ inicio: '2026-11-17T01:00:00Z', fim: '2026-11-17T03:00:00Z' })).toEqual(['2026-11-16'])
    expect(diasDoEvento({ inicio: '2026-11-17T01:00:00Z', fim: '2026-11-17T03:30:00Z' })).toEqual(['2026-11-16', '2026-11-17'])
  })
})
