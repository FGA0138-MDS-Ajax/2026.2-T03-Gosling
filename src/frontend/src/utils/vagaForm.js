export const TEXTOS_VAGA = {
  titulo: { min: 3, max: 150 },
  descricao: { min: 10, max: 5000 },
  atividades: { min: 10, max: 5000 },
  causa: { min: 3, max: 100 },
  local: { min: 3, max: 500 },
}

export function validarPublicacao(dados) {
  const erros = {}
  for (const [campo, { min, max }] of Object.entries(TEXTOS_VAGA)) {
    if (dados[campo].length < min) erros[campo] = `Use pelo menos ${min} caracteres.`
    else if (dados[campo].length > max) erros[campo] = `Use até ${max} caracteres.`
  }
  const carga = dados.carga_horaria
  if (!Number.isFinite(carga) || carga < 0.01 || carga > 99999.99
    || Math.abs(carga * 100 - Math.round(carga * 100)) > 0.0000001) {
    erros.carga_horaria = 'Informe de 0,01 a 99.999,99 horas, com até duas casas decimais.'
  }
  if (!Number.isInteger(dados.numero_vagas) || dados.numero_vagas < 1) {
    erros.numero_vagas = 'Informe um número inteiro de vagas, a partir de 1.'
  }
  return erros
}

export function errosPublicacao(detail) {
  const campos = {}
  const encontros = []
  const gerais = []
  for (const issue of detail) {
    const campo = issue.loc?.[1]
    const texto = TEXTOS_VAGA[campo]
    let mensagem = issue.msg || 'Confira o valor informado.'
    if (texto && issue.type === 'string_too_short') mensagem = `Use pelo menos ${texto.min} caracteres.`
    if (texto && issue.type === 'string_too_long') mensagem = `Use até ${texto.max} caracteres.`
    if (campo === 'ocorrencias') {
      const indice = issue.loc?.[2]
      encontros.push(`${Number.isInteger(indice) ? `Encontro ${indice + 1}: ` : ''}${mensagem}`)
    } else if (texto || ['modalidade', 'periodo', 'carga_horaria', 'numero_vagas'].includes(campo)) {
      campos[campo] ??= mensagem
    } else {
      gerais.push(mensagem)
    }
  }
  return {
    campos,
    encontros: encontros.join(' '),
    mensagem: gerais.length ? gerais.join(' ') : 'Confira os campos indicados e tente novamente.',
  }
}
