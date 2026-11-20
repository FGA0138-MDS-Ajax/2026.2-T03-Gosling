# Acompanhamento das sprints

Registro de situação em **20/11/2026**, com o calendário do [Documento de Visão](visão.md#23-planejamento-das-fases-eou-iteracoes-do-projeto) e as entregas verificáveis no Git e nas PRs. As sprints duram sete dias, de quarta a terça-feira. O projeto está na **Sprint 10, de 18 a 24/11**.

Os registros das sprints encerradas foram consolidados nesta data. Eles recuperam entregas e desvios; não substituem atas de reuniões nem representam retrospectivas realizadas nas datas passadas. O plano original previa funcionalidades que ainda não estão integradas. A prioridade é estabilizar a gestão de vagas, concluir a revisão da interface e negociar com o P.O. a sequência dos requisitos pendentes.

## Planejado e realizado

| Sprint e período | Planejado no Documento de Visão | Realizado e evidência | Situação em 20/11 |
| --- | --- | --- | --- |
| 1 · 16–22/09 | Definição do produto e visão inicial | Inicialização dos documentos em [16/09][inicializacao] e atualização em [21/09][visao-inicial]. | Há entrega documental registrada. |
| 2 · 23–29/09 | Concluir Documento de Visão e backlog | Revisão em [29/09][revisao-visao], seguida de ajustes em 30/09. | A versão de visão foi produzida; ajustes ultrapassaram o encerramento da sprint. |
| 3 · 30/09–06/10 | Documento de Arquitetura | Ajustes da visão em 30/09; primeiros commits do DA em [07/10][arquitetura-inicial]. | A arquitetura foi registrada após o intervalo previsto. |
| 4 · 07–13/10 | Protótipo e apresentação do DV | DA versionado em 07/10 e documentação publicada em [13/10][pages-inicial]. | Publicação comprovada; o histórico não comprova sozinho a realização da apresentação. |
| 5 · 14–20/10 | Apresentação do DA e preparação do ambiente | Atualização dos documentos e slides em [19/10][atualizacao-documentos]. | Materiais disponíveis; ambiente e apresentação não têm relatório de execução próprio. |
| 6 · 21–27/10 | Cadastro e autenticação, CN01 | [Ata de 26/10](atas-reuniao/ata-reuniao-2.md) registra a distribuição do trabalho, sem detalhar decisões. A autenticação seria integrada na Sprint 7. | Desenvolvimento previsto não foi entregue dentro deste intervalo. |
| 7 · 28/10–03/11 | Perfis do voluntário e da organização | Estrutura do sistema em [28/10][estrutura]; autenticação integrada pela [PR #57][pr57] em 02/11; entradas institucionais e projeto social pelas [PRs #59][pr59] e [#61][pr61]. | Entrega de CN01 atrasada em relação à Sprint 6. Perfis continuaram em desenvolvimento. |
| 8 · 04–10/11 | Publicação e gestão de vagas, CN04; ponto de controle | Cadastro/API de organizações e formulário institucional nas [PRs #65][pr65] e [#67][pr67]; perfil institucional na [#69][pr69], integrados em 09/11. Implementações de cadastro/perfil de voluntário estavam em integração. | CN02/CN03 avançaram depois do prazo original. A publicação ainda não havia sido mesclada à `developer` no encerramento. |
| 9 · 11–17/11 | Busca, candidatura, calendário e inspeção | [PR #72][pr72] mesclada em `test/fluxos-isolamento` em 11/11; consolidação de cadastro, perfil e publicação na `developer` pela [#68][pr68] em 13/11. Gestão de vagas passou pelas [#84][pr84], [#86][pr86], [#92][pr92] e [#93][pr93]. A [#88][pr88] foi aberta em 16/11. | Publicação integrada. RF09/RF10 têm defeitos de contrato com o banco. Candidatura/calendário não foram entregues. #88 permanece em revisão. |
| 10 · 18–24/11 | Triagem, conexão, comprovante e correções da inspeção | Em 20/11 foram consolidados estes relatórios e tratados os comentários da #88 sobre sessão entre abas e uploads sem vínculo. | Em andamento; correções da #88 dependem de merge e nova revisão. A sequência abaixo é proposta de replanejamento. |
| 11 · 25/11–01/12 | Ajustes de UX e entrega final | Período futuro na data deste registro. | Planejada; execução e resultado ainda não aferidos. |

A `main` permanece no commit inicial; a implementação está na `developer`. Há, portanto, um desvio do fluxo de releases previsto no DA. A publicação do Pages ocorre pela branch `docs`, cujo conteúdo publicado também precisava receber as atualizações documentais já existentes na `developer`.

## Relatos das sprints de desenvolvimento

### Sprint 6 — início do desenvolvimento

O marco disponível é a ata de 26/10. Ela informa a distribuição do trabalho, mas não registra o backlog comprometido, os participantes individualmente, decisões ou impedimentos. O primeiro incremento de autenticação foi integrado em 02/11, na Sprint 7. Não há base para declarar a Sprint 6 concluída em 100% ou atribuir retrospectivamente uma velocidade.

### Sprint 7 — autenticação e integração inicial

A #57 reuniu API, sessão JWT, proteção por perfil, Nginx, Docker e automação dos testes. As #59 e #61 complementaram as entradas de organização e projeto social. A #57 recebeu aprovação de `notkazui` antes do merge; a #61 recebeu aprovação de `CauaHenriqueM`. A #59 tem comentário solicitando evidências, mas não uma review formal registrada. O [relatório de testes](testes.md#resultados-historicos-nas-prs) recupera os resultados informados nessas entregas.

O desvio foi o deslocamento de CN01 da Sprint 6 para a 7. Os perfis planejados para esta semana continuaram nas semanas seguintes.

### Sprint 8 — cadastros e perfil institucional

As #65, #67 e #69 integraram cadastro e perfil da ONG em 09/11. A #69 relata consulta e edição com API real, persistência após recarregar e evidências visuais. Os commits de Rafael referentes às telas de cadastro e perfil do voluntário foram aproveitados na integração posterior, conforme a descrição da #68 e o [registro na #72][integracao-atribuicao].

O desvio foi manter CN02/CN03 em integração na semana reservada a CN04. O calendário original continuou sem uma revisão formal publicada.

### Sprint 9 — publicação e gestão de vagas

A #68 consolidou a publicação com múltiplos encontros, persistência, validações e isolamento entre voluntários. A revisão de Juan gerou ajustes nos erros por campo, tamanho do local e carga horária decimal; houve aprovação antes do merge. A [execução de CI do commit final][ci68] concluiu com sucesso.

O painel/listagem passou por merge, reversão e restauração (#84 → #86 → #92). A edição chegou pela #93. Entretanto, o repositório SQL de RF09/RF10 ainda utiliza estruturas ausentes das migrações. Esses itens estão no [registro de débitos e defeitos](debitos-tecnicos.md), com prioridade de correção antes de tratar a gestão de vagas como concluída.

Busca e detalhes avançam na #88, ainda aberta. Candidatura, calendário e conflito entre compromissos não têm incremento integrado que permita marcar CT04/CT08–CT13 como executados.

### Sprint 10 — estabilização e documentação

Os comentários de Juan na #88 identificaram dois defeitos: um login temporário apagava a sessão lembrada de outra aba; fotos enviadas antes da publicação podiam ficar armazenadas indefinidamente. A correção preserva a sessão de outra conta e acrescenta limpeza periódica de mídia sem vínculo, com testes de regressão. Os resultados da execução atual estão no [relatório de testes](testes.md#validacao-das-correcoes-da-pr-88).

Este registro também reúne as evidências antes dispersas nas PRs. A existência dos relatórios melhora a rastreabilidade, mas não conclui as funcionalidades ainda ausentes nem substitui a coleta de métricas que não ocorreu.

## Replanejamento proposto a partir de 20/11

Esta sequência é uma **proposta para validação da equipe e do P.O.**. As datas originais permanecem no DV. Nenhuma mudança de prioridade MoSCoW ou aceite do P.O. é presumida por este documento.

| Janela | Ordem e resultado esperado | Critério de conclusão |
| --- | --- | --- |
| Restante da Sprint 10 | Finalizar revisão da #88; corrigir o contrato de RF09/RF10 com as migrações e acrescentar integração com MySQL. | PR revisada por outro integrante, CI aprovado e reprodução do fluxo sem HTTP 500. |
| Restante da Sprint 10 | Reavaliar capacidade para candidatura, documentos, acompanhamento, calendário e conflito transacional. | Backlog da sprint com itens, responsáveis e pontos registrados; dependências e itens não comportados negociados com o P.O. |
| Sprint 11 | Concluir os Must ainda assumidos, executar seus testes de sistema e a avaliação de usabilidade; estabilizar a versão de apresentação. | CTs correspondentes executados e registrados; defeitos críticos resolvidos; release revisada na `main`. |

O acúmulo de Must de candidatura, triagem e comprovante representa risco alto para a entrega. A equipe precisa decidir o escopo com o P.O.; este relatório não presume que todos caibam nas duas últimas sprints.

### Alocação dos requisitos pendentes

| Requisitos | Referência original | Encaminhamento proposto e dependência |
| --- | --- | --- |
| RF09 e RF10 | Sprint 8 | Estabilizar na Sprint 10; dependem de corrigir SQL/contratos e de integração real. Painel da #85 ainda está aberto. |
| RF11 e RF14 | RF11 sem sprint; RF14 na 9 | Concluir o recorte de documentos exigidos/detalhes da #88 na Sprint 10; envio de documentos de candidatura pertence a RF17. |
| RF12 e RF13 | Sem sprint na Tabela 6; CN05 na 9 | Listagem pública existe; filtros por causa/modalidade/período estão na #88. Local/carga e filtros adicionais dependem da [#76][issue76]; validar recorte com o P.O. |
| RF16, RF17, RF18, RF26 e RF27 | RF16/RF26/RF27 na 9; demais sem sprint | Prioridade de planejamento na Sprint 10: candidatura e documentos precedem acompanhamento, agenda e conflitos. Não registrar como entregues. |
| RF19, RF21 e RF22 | Sem sprint | Dependem de candidatura persistida. Negociar entrega na Sprint 11 junto aos respectivos CTs. |
| RF05 e RF20 | Should sem sprint | Recuperação de senha/notificações dependem do escopo negociado; não há compromisso de entrega comprovado. |
| RF03, RF15, RF23 e RF25 | Could; RF03 na 6, demais sem sprint | Decisão explícita do P.O. sobre permanência no recorte final. Login de projeto social e CRUD administrativo não comprovam cadastro completo ou moderação por denúncias. |
| RF24 | Should sem sprint | Homologação completa pendente; registrar a aprovação automática como débito, conforme a #65. |
| RNF01–RNF07 | Sem sprint | Verificação transversal até a Sprint 11. Segurança/responsividade/acessibilidade já têm testes parciais; M6 exige avaliação com pessoas, e desempenho exige medição própria. |

## Métricas e interpretação dos resultados

| Métrica do DV | Dado disponível em 20/11 | Análise e próxima coleta |
| --- | --- | --- |
| M1 · aderência | Não apurada: falta o total de itens comprometidos no início de cada sprint. | Atrasos de integração estão registrados acima. Registrar o compromisso no próximo planejamento e calcular concluídos/comprometidos ao fechar a sprint. |
| M2 · velocidade | Não apurada: não há série de pontos comprometidos/concluídos. | Não converter número de commits em pontos. Estimar o backlog antes de assumir novas entregas. |
| M3 · contribuições | Contagem de autoria abaixo e reviews na [análise da inspeção](inspecao.md#revisoes-das-prs). | Contagens não medem sozinhas esforço, qualidade, trabalho em par ou validam os pontos de participação. |
| M4 · cobertura | #57: 99,63%; #65: aproximadamente 90,8%; #68: 88,90%, conforme resultados relatados nas PRs. Execução atual da #88 em [Testes](testes.md). | Todas superam o limiar de 80% no escopo medido. A cobertura agrega módulos legados e não comprova a correção das consultas SQL não exercitadas. |
| M5 · densidade de defeitos | Não apurada: falta o denominador de pontos entregues. | Os 16 IDs da inspeção têm [tratamento individual](inspecao.md#tratamento-dos-apontamentos). Contagem de apontamentos não é densidade de defeitos confirmados. |
| M6 · sucesso em tarefa | Sem coleta com participantes consolidada. | Aplicar busca/candidatura quando o fluxo estiver disponível, registrar tarefas concluídas/total e comparar com 80%. Axe e responsividade não substituem essa coleta. |

### Autoria de commits nas sprints

Contagem feita sobre `d871469`, snapshot da `developer` usado na inspeção, por data de autoria em Brasília, **sem commits de merge**. As grafias de Cauã foram agrupadas; `notkazui` foi associado a Juan conforme identificação da equipe. A coluna não é uma distribuição de pontos.

| Sprint | Cauã | Juan (`notkazui`) | Miguel | Rafael |
| --- | ---: | ---: | ---: | ---: |
| 1 | 3 | 0 | 0 | 0 |
| 2 | 0 | 0 | 1 | 0 |
| 3 | 4 | 0 | 0 | 0 |
| 4 | 3 | 0 | 0 | 0 |
| 5 | 3 | 0 | 0 | 0 |
| 6 | 2 | 0 | 0 | 0 |
| 7 | 4 | 1 | 27 | 1 |
| 8 | 7 | 3 | 11 | 2 |
| 9, até o snapshot de 16/11 | 3 | 0 | 17 | 0 |

O commit inicial de Sophia em 12/09 antecede a Sprint 1 e não entra nesta tabela. A presença de autoria externa e de nomes de usuário é explicada na [análise da inspeção](inspecao.md#autoria-e-identificacao-dos-integrantes).

## Registro das próximas sprints

Ao iniciar a sprint, registrar objetivo, issues comprometidas, responsáveis, estimativas e dependências. Ao encerrar, registrar o que foi integrado, o que foi adiado e por quê, links de PRs/reviews/CI, resultados de testes, métricas disponíveis, impedimentos e ações de melhoria. A ata deve informar data e participantes reais; a retrospectiva deve registrar decisões efetivamente tomadas. Cada débito precisa de responsável, prioridade e critério verificável de encerramento.

[inicializacao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/80083eb
[visao-inicial]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/8044d0a
[revisao-visao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/bbd6160
[arquitetura-inicial]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/f373966
[pages-inicial]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/da90b60
[atualizacao-documentos]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/d8f70fc
[estrutura]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/0fd0772
[pr57]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/57
[pr59]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/59
[pr61]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/61
[pr65]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/65
[pr67]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/67
[pr68]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/68
[pr69]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/69
[pr72]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/72
[pr84]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/84
[pr85]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/85
[pr86]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/86
[pr88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/88
[pr92]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/92
[pr93]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/93
[issue76]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/issues/76
[integracao-atribuicao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/72#issuecomment-6809131855
[ci68]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/actions/runs/43507230528
