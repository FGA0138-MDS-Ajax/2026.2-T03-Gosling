import http from './http'

export async function listarCausas(signal) {
  const { data } = await http.get('/causas', {
    publicRequest: true, params: { incluir_inativas: true }, signal,
  })
  if (!Array.isArray(data) || data.some(c => !Number.isInteger(c.id) || c.id < 1 || typeof c.nome !== 'string')) {
    throw new Error('Não foi possível consultar o catálogo de causas.')
  }
  return data
}
