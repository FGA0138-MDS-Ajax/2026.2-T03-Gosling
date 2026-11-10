import http from './http'

export async function registerOrganization(payload) {
  const { data } = await http.post('/organizacoes', payload, { publicRequest: true })
  return data
}

export async function getOrganization(signal) {
  const { data } = await http.get('/organizacoes/me', { signal })
  return data
}

export async function updateOrganization(payload) {
  const { data } = await http.put('/organizacoes/me', payload)
  return data
}
