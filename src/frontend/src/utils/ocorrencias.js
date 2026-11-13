const FUSO = 'America/Sao_Paulo'
const partesBrasilia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const dataBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, dateStyle: 'short',
})
const horaBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function partes(instant) {
  return Object.fromEntries(
    partesBrasilia.formatToParts(new Date(instant))
      .filter((item) => item.type !== 'literal')
      .map((item) => [item.type, Number(item.value)]),
  )
}

export function horarioBrasiliaParaUTC(data, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
    throw new Error('Preencha as datas e os horários de todos os encontros.')
  }
  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, minuto] = hora.split(':').map(Number)
  const alvo = Date.UTC(ano, mes - 1, dia, h, minuto)
  if (!Number.isFinite(alvo)) throw new Error('Data ou horário inválido.')

  let instant = alvo
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const p = partes(instant)
    const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    const ajuste = alvo - local
    instant += ajuste
    if (ajuste === 0) break
  }

  const p = partes(instant)
  if (p.year !== ano || p.month !== mes || p.day !== dia
    || p.hour !== h || p.minute !== minuto) {
    throw new Error('Data ou horário inválido no horário de Brasília.')
  }
  return new Date(instant).toISOString()
}

export function criarEncontro() {
  return {
    id: crypto.randomUUID(),
    dataInicio: '', horaInicio: '', dataFim: '', horaFim: '',
  }
}

export function prepararOcorrencias(encontros) {
  if (encontros.length === 0) throw new Error('Adicione pelo menos um encontro.')
  const ocorrencias = encontros.map((item, indice) => {
    const inicio = horarioBrasiliaParaUTC(item.dataInicio, item.horaInicio)
    const fim = horarioBrasiliaParaUTC(item.dataFim, item.horaFim)
    if (inicio >= fim) {
      throw new Error(`O encontro ${indice + 1} deve terminar depois do início.`)
    }
    return { inicio, fim, posicao: indice + 1 }
  }).sort((a, b) => a.inicio.localeCompare(b.inicio))

  for (let indice = 1; indice < ocorrencias.length; indice += 1) {
    const anterior = ocorrencias[indice - 1]
    const atual = ocorrencias[indice]
    if (atual.inicio < anterior.fim) {
      throw new Error(
        `Os encontros ${anterior.posicao} e ${atual.posicao} têm horários sobrepostos.`,
      )
    }
  }
  return ocorrencias.map(({ inicio, fim }) => ({ inicio, fim }))
}

export function formatarOcorrencia({ inicio, fim }) {
  const inicioDate = new Date(inicio)
  const fimDate = new Date(fim)
  const primeiroDia = dataBrasilia.format(inicioDate)
  const ultimoDia = dataBrasilia.format(fimDate)
  if (primeiroDia === ultimoDia) {
    return `${primeiroDia}, das ${horaBrasilia.format(inicioDate)} às ${horaBrasilia.format(fimDate)}`
  }
  return `${primeiroDia} às ${horaBrasilia.format(inicioDate)} até ${ultimoDia} às ${horaBrasilia.format(fimDate)}`
}
