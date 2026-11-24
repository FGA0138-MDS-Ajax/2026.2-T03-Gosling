import { ESTADOS } from './volunteerProfile'

export const CAMPOS_ENDERECO = {
  cep: 9,
  logradouro: 200,
  numero: 30,
  complemento: 100,
  bairro: 100,
  regiao_administrativa: 100,
  cidade: 100,
  estado: 2,
}

export function localizacaoInicial(valor, cidade = '', estado = '') {
  return Object.fromEntries(
    [...Object.keys(CAMPOS_ENDERECO), 'latitude', 'longitude', 'origem_coordenadas'].map(campo => [
      campo,
      String(valor?.[campo] ?? ({ cidade, estado }[campo] || '')),
    ]),
  )
}

export function localizacaoPayload(valor) {
  const dados = Object.fromEntries(
    Object.keys(CAMPOS_ENDERECO).map(campo => [campo, valor?.[campo]?.trim() || null]),
  )
  for (const campo of ['latitude', 'longitude']) {
    const texto = String(valor?.[campo] ?? '').trim()
    dados[campo] = texto ? Number(texto.replace(',', '.')) : null
  }
  dados.origem_coordenadas =
    dados.latitude !== null || dados.longitude !== null
      ? valor?.origem_coordenadas || 'MANUAL'
      : null
  if (dados.cep) dados.cep = dados.cep.replace('-', '')
  return Object.values(dados).some(item => item !== null) ? dados : null
}

export function validarLocalizacao(valor, prefixo = 'localizacao') {
  const erros = {}
  const erro = (campo, texto) => {
    erros[`${prefixo}.${campo}`] = texto
  }
  for (const [campo, limite] of Object.entries(CAMPOS_ENDERECO)) {
    if ((valor?.[campo]?.trim() || '').length > limite) erro(campo, `Use até ${limite} caracteres.`)
  }
  if (valor?.cep && !/^[0-9]{5}-?[0-9]{3}$/.test(valor.cep.trim())) {
    erro('cep', 'Informe um CEP com oito dígitos.')
  }

  if (valor?.estado && !ESTADOS.includes(valor.estado)) {
    erro('estado', 'Selecione uma UF válida.')
  }

  if (valor?.cidade?.trim() && valor.cidade.trim().length < 2) {
    erro('cidade', 'Use pelo menos 2 caracteres.')
  }

  const temLatitude = String(valor?.latitude ?? '').trim() !== ''
  const temLongitude = String(valor?.longitude ?? '').trim() !== ''

  if (temLatitude !== temLongitude) {
    const campoAusente = temLatitude ? 'longitude' : 'latitude'
    erro(campoAusente, 'Informe latitude e longitude juntas.')
  }

  for (const [campo, limite] of [
    ['latitude', 90],
    ['longitude', 180],
  ]) {
    const texto = String(valor?.[campo] ?? '')
      .trim()
      .replace(',', '.')

    if (texto && (!/^-?\d+(?:\.\d{1,7})?$/.test(texto) || Math.abs(Number(texto)) > limite)) {
      erro(campo, `Informe um valor entre -${limite} e ${limite}, com até 7 casas decimais.`)
    }
  }

  return erros
}

export function textoEndereco(localizacao) {
  if (!localizacao) return ''
  const { logradouro, numero, complemento, bairro, regiao_administrativa, cidade, estado, cep } =
    localizacao
  return [
    [logradouro, numero].filter(Boolean).join(', '),
    complemento,
    bairro,
    regiao_administrativa !== bairro ? regiao_administrativa : '',
    [cidade, estado].filter(Boolean).join(' / '),
    cep,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function destinoMapa(vaga) {
  const ponto = vaga.localizacao
  const query =
    ponto?.latitude != null && ponto?.longitude != null
      ? `${ponto.latitude},${ponto.longitude}`
      : textoEndereco(ponto) || vaga.local
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)
}
