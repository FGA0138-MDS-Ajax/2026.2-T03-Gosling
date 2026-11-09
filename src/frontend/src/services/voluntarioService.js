import http from './http'

export async function getVolunteerProfile(signal) {
  const { data } = await http.get('/voluntarios/me', { signal })
  return data
}

export async function updateVolunteerProfile(payload) {
  const { data } = await http.put('/voluntarios/me', payload)
  return data
}
