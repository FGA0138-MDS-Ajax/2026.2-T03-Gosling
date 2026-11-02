export const PROFILE_ROUTES = {
  VOLUNTARIO: '/voluntario',
  ORGANIZACAO: '/organizacao',
  ADMINISTRADOR: '/admin',
}

export const PROFILE_NAMES = {
  VOLUNTARIO: 'Voluntário',
  ORGANIZACAO: 'Organização',
  ADMINISTRADOR: 'Administrador',
}

export function profileRoute(perfil) {
  return PROFILE_ROUTES[perfil] ?? '/login'
}
