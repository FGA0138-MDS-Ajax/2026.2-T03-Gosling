// Datas do calendário do voluntário, sempre em dias de Brasília (AAAA-MM-DD).
const FUSO = 'America/Sao_Paulo'
const formatoIso = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
const formatoMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const formatoDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })
const formatoDiaCompleto = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const STATUS_ATIVOS = ['PENDENTE', 'ACEITA']
export const DIAS_DA_SEMANA = [
  ['Dom', 'domingo'], ['Seg', 'segunda-feira'], ['Ter', 'terça-feira'], ['Qua', 'quarta-feira'],
  ['Qui', 'quinta-feira'], ['Sex', 'sexta-feira'], ['Sáb', 'sábado'],
]

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)
const comoData = (dia) => new Date(`${dia}T00:00:00Z`)

export const ehDia = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(comoData(valor).getTime())
export const hojeEmBrasilia = (agora = new Date()) => formatoIso.format(agora)
export const diaEmBrasilia = (instante) => formatoIso.format(new Date(instante))

export function somarDias(dia, quantidade) {
  const data = comoData(dia)
  data.setUTCDate(data.getUTCDate() + quantidade)
  return data.toISOString().slice(0, 10)
}

export const inicioDoMes = (dia) => `${dia.slice(0, 7)}-01`

export function somarMeses(mes, quantidade) {
  const data = comoData(mes)
  data.setUTCMonth(data.getUTCMonth() + quantidade, 1)
  return data.toISOString().slice(0, 10)
}

export const nomeDoMes = (mes) => capitalizar(formatoMes.format(comoData(mes)))
export const tituloDoDia = (dia) => capitalizar(formatoDia.format(comoData(dia)))
export const rotuloDoDia = (dia) => formatoDiaCompleto.format(comoData(dia))

// Semanas de domingo a sábado que cobrem o mês inteiro.
export function semanasDoMes(mes) {
  const primeiro = comoData(mes)
  let dia = somarDias(mes, -primeiro.getUTCDay())
  const proximoMes = somarMeses(mes, 1)
  const semanas = []
  while (dia < proximoMes) {
    const semana = []
    for (let i = 0; i < 7; i += 1) {
      semana.push({ dia, doMes: dia.slice(0, 7) === mes.slice(0, 7) })
      dia = somarDias(dia, 1)
    }
    semanas.push(semana)
  }
  return semanas
}

// Um encontro aparece em todos os dias de Brasília que ele ocupa.
export function diasDoEvento({ inicio, fim }) {
  const primeiro = diaEmBrasilia(inicio)
  const ultimo = diaEmBrasilia(new Date(new Date(fim).getTime() - 1))
  const dias = [primeiro]
  for (let dia = primeiro; dia < ultimo;) {
    dia = somarDias(dia, 1)
    dias.push(dia)
  }
  return dias
}

export function agruparPorDia(eventos) {
  const porDia = new Map()
  const ordenados = [...eventos].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
  for (const evento of ordenados) {
    for (const dia of diasDoEvento(evento)) {
      if (!porDia.has(dia)) porDia.set(dia, [])
      porDia.get(dia).push(evento)
    }
  }
  return porDia
}

// Avisa as telas abertas de que alguma candidatura mudou (ex.: confirmação após HTTP 201).
export const CANDIDATURAS_ALTERADAS = 'volunja:candidaturas-alteradas'
export const avisarCandidaturasAlteradas = () => window.dispatchEvent(new Event(CANDIDATURAS_ALTERADAS))
