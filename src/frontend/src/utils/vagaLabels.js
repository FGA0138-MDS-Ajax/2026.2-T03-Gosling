export const MODALIDADES = { PRESENCIAL: 'Presencial', REMOTO: 'Remoto', HIBRIDO: 'Híbrido' }
export const PERIODOS = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', MADRUGADA: 'Madrugada' }

// Apresentação visual por código estável; nomes e opções vêm somente da API.
export const APRESENTACAO_CAUSAS = {
  'meio-ambiente': { icone: 'leaf', tom: 'green', destaque: 0 },
  'protecao-animal': { icone: 'paw', tom: 'orange', destaque: 1 },
  educacao: { icone: 'book', tom: 'blue', destaque: 2 },
  alimentacao: { icone: 'food', tom: 'red', destaque: 3 },
  'pessoas-idosas': { icone: 'hands', tom: 'purple', destaque: 4 },
  cultura: { icone: 'music', tom: 'pink', destaque: 5 },
  saude: { icone: 'heart', tom: 'red' },
  esporte: { icone: 'sparkles', tom: 'blue' },
}

export const normalizarCausa = (nome = '') => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const TONS = { animais: 'orange', idosos: 'purple', 'assistencia social': 'indigo' }
export function tomDaCausa(nome, codigo) {
  const alvo = normalizarCausa(nome)
  return APRESENTACAO_CAUSAS[codigo || alvo.replaceAll(' ', '-')]?.tom || TONS[alvo] || 'teal'
}
