import http from './http'

export async function carregarMidiaPrivada(nome, signal) {
  const { data } = await http.get(`/midia/privada/${encodeURIComponent(nome)}`, {
    responseType: 'blob',
    signal,
  })
  return data
}
