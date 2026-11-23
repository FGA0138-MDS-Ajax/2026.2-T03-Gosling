import { nomeMidiaLocal } from './midia'

export const TIPOS_DOCUMENTO = {
  IDENTIDADE: 'Documento de identidade',
  RESIDENCIA: 'Comprovante de residência',
  TERMO: 'Termo de adesão',
  PERSONALIZADO: 'Documento personalizado',
}

export function documentoDaVaga(dados = {}) {
  return {
    id: dados.id ?? crypto.randomUUID(),
    tipo: dados.tipo ?? 'PERSONALIZADO',
    nome: dados.nome ?? '',
    orientacao: dados.orientacao ?? '',
    obrigatorio: dados.obrigatorio ?? true,
    modelo_url: dados.modelo_url ?? '',
    modelo: dados.modelo,
    arquivoModelo: null,
  }
}

export function modeloTermoLocal(url) {
  return Boolean(url?.startsWith('/api/v1/midia/modelos/') && nomeMidiaLocal(url))
}

export function linkModeloValido(url) {
  if (nomeMidiaLocal(url)) return true

  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
