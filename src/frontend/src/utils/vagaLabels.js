export const MODALIDADES = { PRESENCIAL: 'Presencial', REMOTO: 'Remoto', HIBRIDO: 'Híbrido' }
export const PERIODOS = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', MADRUGADA: 'Madrugada' }

export const CAUSAS_DESTAQUE = [
  { nome: 'Meio ambiente', icone: 'leaf', tom: 'green' },
  { nome: 'Proteção animal', icone: 'paw', tom: 'orange' },
  { nome: 'Educação', icone: 'book', tom: 'blue' },
  { nome: 'Alimentação', icone: 'food', tom: 'red' },
  { nome: 'Pessoas idosas', icone: 'hands', tom: 'purple' },
  { nome: 'Cultura', icone: 'music', tom: 'pink' },
]

export const normalizarCausa = (nome = '') => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const TONS = { animais: 'orange', idosos: 'purple', 'assistencia social': 'indigo' }
export function tomDaCausa(nome) {
  const alvo = normalizarCausa(nome)
  return CAUSAS_DESTAQUE.find((causa) => normalizarCausa(causa.nome) === alvo)?.tom || TONS[alvo] || 'teal'
}
