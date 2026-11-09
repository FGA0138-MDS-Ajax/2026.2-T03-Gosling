// Catálogo de causas (documento de arquitetura: Causa é um catálogo compartilhado).
// Enquanto a API não expõe o catálogo, a lista fica centralizada aqui.
export const CAUSAS = [
  'Educação', 'Saúde', 'Meio Ambiente', 'Assistência Social', 'Animais',
  'Cultura', 'Esporte', 'Direitos Humanos', 'Idosos', 'Crianças e Adolescentes',
]

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

export const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// A API guarda a disponibilidade como lista de textos. Cada preferência vira
// um texto com prefixo, por exemplo: ["DIA:SABADO", "PERIODO:MANHA", "CARGA_HORARIA:4"].
// Se o back-end passar a usar um objeto, só estas duas funções mudam.
export function parseDisponibilidades(lista = []) {
  const resultado = { dias: [], periodos: [], cargaHoraria: '' }
  for (const item of lista ?? []) {
    const [tipo, valor] = String(item).split(':')
    if (tipo === 'DIA' && DIAS.some((dia) => dia.value === valor)) resultado.dias.push(valor)
    else if (tipo === 'PERIODO' && PERIODOS.some((p) => p.value === valor)) resultado.periodos.push(valor)
    else if (tipo === 'CARGA_HORARIA' && /^\d+$/.test(valor)) resultado.cargaHoraria = valor
  }
  return resultado
}

export function formatDisponibilidades({ dias, periodos, cargaHoraria }) {
  return [
    ...DIAS.filter((dia) => dias.includes(dia.value)).map((dia) => `DIA:${dia.value}`),
    ...PERIODOS.filter((p) => periodos.includes(p.value)).map((p) => `PERIODO:${p.value}`),
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
