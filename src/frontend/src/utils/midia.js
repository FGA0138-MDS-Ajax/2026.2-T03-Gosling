export const MB = 1024 * 1024
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']
export const LIMITE_AVATAR = 5 * MB
export const LIMITE_FOTO_VAGA = 10 * MB
export const MAX_FOTOS_VAGA = 8
export const LIMITE_MODELO_TERMO = 5 * MB
export const TIPO_MODELO_TERMO = 'application/pdf'

export function arquivoValido(arquivo, tipos, limite) {
  return Boolean(
    arquivo && tipos.includes(arquivo.type) && arquivo.size > 0 && arquivo.size <= limite,
  )
}

export function nomeMidiaLocal(url) {
  const arquivo = url?.match(/^\/api\/v1\/midia\/(?:modelos\/)?([a-f0-9]{32}\.(?:webp|pdf))$/)
  return arquivo?.[1]
}

export function posicaoDaFoto(enquadramento) {
  if (enquadramento) {
    return { objectPosition: `${enquadramento.x}% ${enquadramento.y}%` }
  }
}

export function fotosDoRascunho(dados) {
  return (dados.fotos ?? []).map(url => ({
    id: url,
    url,
    enquadramento: dados.enquadramento_fotos?.[url] ?? { x: 50, y: 50 },
  }))
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function tamanhoDoArquivo(bytes) {
  if (bytes >= MB) return `${numero.format(bytes / MB)} MB`
  if (bytes >= 1024) return `${numero.format(bytes / 1024)} KB`
  return `${bytes} B`
}
