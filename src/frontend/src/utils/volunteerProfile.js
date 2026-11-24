export const DIAS = [
  { value: 'SEGUNDA', label: 'Segunda' }, { value: 'TERCA', label: 'Terça' },
  { value: 'QUARTA', label: 'Quarta' }, { value: 'QUINTA', label: 'Quinta' },
  { value: 'SEXTA', label: 'Sexta' }, { value: 'SABADO', label: 'Sábado' },
  { value: 'DOMINGO', label: 'Domingo' },
]

export const PERIODOS = [
  { value: 'MANHA', label: 'Manhã' }, { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
]

export const NOMES_ESTADOS = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}
export const ESTADOS = Object.keys(NOMES_ESTADOS)

// A API guarda a disponibilidade como lista de textos. Cada preferência vira
// um texto com prefixo, por exemplo: ["DIA:SABADO", "PERIODO:MANHA", "CARGA_HORARIA:4"].
// Se o back-end passar a usar um objeto, só estas duas funções mudam.
export function parseDisponibilidades(lista = []) {
  const resultado = { dias: [], periodos: [], cargaHoraria: '', outras: [] }
  for (const item of lista ?? []) {
    const [tipo, valor, ...resto] = String(item).split(':')
    if (resto.length) { resultado.outras.push(item); continue }
    if (tipo === 'DIA' && DIAS.some((dia) => dia.value === valor)) resultado.dias.push(valor)
    else if (tipo === 'PERIODO' && PERIODOS.some((p) => p.value === valor)) resultado.periodos.push(valor)
    else if (tipo === 'CARGA_HORARIA' && /^\d+$/.test(valor)) resultado.cargaHoraria = valor
    else resultado.outras.push(item)
  }
  return resultado
}

export function formatDisponibilidades({ dias, periodos, cargaHoraria, outras = [] }) {
  return [
    ...DIAS.filter((dia) => dias.includes(dia.value)).map((dia) => `DIA:${dia.value}`),
    ...PERIODOS.filter((p) => periodos.includes(p.value)).map((p) => `PERIODO:${p.value}`),
    ...outras,
    ...(cargaHoraria ? [`CARGA_HORARIA:${Number(cargaHoraria)}`] : []),
  ]
}

export function validCpf(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false
  for (const size of [9, 10]) {
    let sum = 0
    for (let i = 0; i < size; i += 1) sum += Number(value[i]) * (size + 1 - i)
    const digit = (sum * 10) % 11 % 10
    if (digit !== Number(value[size])) return false
  }
  return true
}

export function weeklyAvailability(perfil) {
  if (Array.isArray(perfil.disponibilidade_semanal)) return perfil.disponibilidade_semanal
  const legacy = parseDisponibilidades(perfil.disponibilidades)
  return legacy.dias.flatMap(dia => legacy.periodos.map(periodo => ({ dia, periodo })))
}

export function profileCompletion({ nome, identificacao, telefone, cidade, estado, causas = [], causa_ids, causas_legadas = [], disponibilidade_semanal = [], carga_horaria_semanal }) {
  const interesses = causa_ids ? causa_ids.length + causas_legadas.length : causas.length
  const itens = [nome, identificacao, telefone, cidade, estado, interesses, disponibilidade_semanal.length, carga_horaria_semanal]
  return Math.round(itens.filter(Boolean).length / itens.length * 100)
}

export function causaCombina(interesses = [], causaId) {
  return Number.isInteger(causaId) && causaId > 0 && interesses.includes(causaId)
}

export function maskCpf(value = '') {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2')
}

export function privateCpf(value) {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length === 11 ? `•••.${digits.slice(3, 6)}.${digits.slice(6, 9)}-••` : 'Não informado'
}
