import { localizacaoPayload } from './localizacao'
import { criarEncontro } from './ocorrencias'

export const horarioSalvamento = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

export function encontrosDoRascunho(dados) {
  if (!dados?.ocorrencias?.length) return [criarEncontro()]

  return dados.ocorrencias.map(encontro => ({
    ...criarEncontro(),
    dataInicio: encontro.data_inicio ?? '',
    horaInicio: encontro.hora_inicio ?? '',
    dataFim: encontro.data_fim ?? '',
    horaFim: encontro.hora_fim ?? '',
  }))
}

export function encontrosParaRascunho(encontros) {
  return encontros.map(encontro => ({
    data_inicio: encontro.dataInicio || null,
    hora_inicio: encontro.horaInicio || null,
    data_fim: encontro.dataFim || null,
    hora_fim: encontro.horaFim || null,
  }))
}

export function lerFormularioVaga(formulario, origemEndereco, enderecoVaga) {
  const campos = new FormData(formulario)
  const texto = campo => String(campos.get(campo) ?? '').trim()
  const numero = campo => (texto(campo) ? Number(texto(campo)) : null)
  const modalidade = texto('modalidade')
  const dados = {
    titulo: texto('titulo'),
    descricao: texto('descricao'),
    atividades: texto('atividades'),
    local: texto('local'),
    carga_horaria: numero('carga_horaria'),
    numero_vagas: numero('numero_vagas'),
    modalidade,
    periodo: texto('periodo'),
  }

  if (modalidade === 'REMOTO') return dados

  if (origemEndereco === 'ORGANIZACAO') {
    dados.origem_localizacao = 'ORGANIZACAO'
  } else {
    const localizacao = localizacaoPayload(enderecoVaga)
    if (localizacao) {
      dados.localizacao = localizacao
      dados.origem_localizacao = 'PROPRIA'
    }
  }

  return dados
}
