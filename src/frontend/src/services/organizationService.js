import http from './http'

export async function registerOrganization(payload) {
  const { data } = await http.post('/organizacoes', payload, { publicRequest: true })
  return data
}
