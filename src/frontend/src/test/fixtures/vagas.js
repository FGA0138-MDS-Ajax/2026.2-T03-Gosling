export const VAGAS_TESTE = [
  { titulo: 'Apoio em oficinas de leitura', organizacao: 'Instituto Caminhos', causa: 'Educação' },
  { titulo: 'Comunicação para uma causa', organizacao: 'Rede Solidária', causa: 'Assistência social' },
  { titulo: 'Cuidado com espaços verdes', organizacao: 'Coletivo Raízes', causa: 'Meio ambiente' },
].map((item, indice) => ({
  id: indice + 1, titulo: item.titulo,
  organizacao: { id: indice + 1, nome: item.organizacao },
  causa: { id: indice + 1, nome: item.causa },
  descricao: 'Atividades de apoio à comunidade.',
  atividades: 'Organizar materiais e apoiar as atividades.',
  modalidade: 'PRESENCIAL', local: 'Brasília, DF', periodo: 'MANHA',
  carga_horaria: '3.00', numero_vagas: 10, status: 'ABERTA',
  ocorrencias: [{ id: indice + 1, inicio: '2026-11-16T12:00:00Z', fim: '2026-11-16T15:00:00Z' }],
}))
