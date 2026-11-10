import http from './http'

export async function login(email, senha) {
  const { data } = await http.post(
    '/auth/login',
    { email: email.trim(), senha },
    { publicRequest: true },
  )
  return data
}

export async function getSession() {
  const { data } = await http.get('/auth/me')
  return data
}

export async function loginAdmin(email, senha) {
  const { data } = await http.post(
    '/admin/login',
    { email: email.trim(), senha },
    { publicRequest: true },
  )
  return data
}

export async function getProfile(perfil) {
  const paths = {
    VOLUNTARIO: '/voluntarios/me',
    ORGANIZACAO: '/organizacoes/me',
    ADMINISTRADOR: '/admin/me',
  }
  const { data } = await http.get(paths[perfil])
  return data
}

export async function cadastrarVoluntario(payload) {
  const { data } = await http.post('/voluntarios', payload, { publicRequest: true })
  return data
}
