import http from './http'

// Contrato do PR #98: GET /voluntarios/me/calendario?inicio=AAAA-MM-DD&fim=AAAA-MM-DD,
// dias de Brasília com fim exclusivo; resposta em ordem cronológica e horários em UTC.
export async function consultarCalendario({ inicio, fim }, signal) {
  const { data } = await http.get('/voluntarios/me/calendario', { params: { inicio, fim }, signal })
  return data
}
