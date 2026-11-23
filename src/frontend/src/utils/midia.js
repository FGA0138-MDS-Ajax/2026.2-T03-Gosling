export const MB = 1024 * 1024
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']
export const LIMITE_AVATAR = 5 * MB
export const LIMITE_FOTO_VAGA = 10 * MB
export const MAX_FOTOS_VAGA = 8

export function arquivoValido(arquivo, tipos, limite) {
  return Boolean(arquivo && tipos.includes(arquivo.type) && arquivo.size <= limite)
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
