# Análise e tratamento da inspeção Allen

Conferência realizada em **20/11/2026** a partir do *Formulario Inspecao Gosling-Allen.pdf*, que informa inspeção em **16/11/2026**, sobre a branch `developer`, [commit `d871469`][snapshot]. O formulário reúne 16 apontamentos, DEF-001 a DEF-016. O objetivo deste registro é reunir evidências, esclarecer divergências e acompanhar o que exige correção.

Há testes de sistema documentados nas PRs e há contribuições de Juan sob o usuário `notkazui`. Também há lacunas reais: relatórios por sprint, métricas, cobertura de fluxos ainda ausentes, integração de RF09/RF10 e registro formal de aprovação em parte das PRs. Os itens abaixo não são considerados encerrados apenas pela publicação deste texto.

O PDF de referência foi recebido para a análise local; seu SHA-256 é `c377cf8bb04183f1a5191046933bc83d6740eff0f76a4fa18796f08abf9673df`. Datas de inspeção, de merge e desta consolidação têm significados distintos. Correções feitas na #88 em 20/11 não são apresentadas como existentes no snapshot inspecionado de 16/11.

## Autoria e identificação dos integrantes

O DEF-015, nas páginas 10, 11 e 15, afirma que Juan não tem commits e apresenta `notkazui` como autor ausente da tabela de integrantes. A equipe identifica **Juan como `notkazui`**. Há commits de implementação, além de merges, com essa autoria: [cadastro de ONG em 09/11][juan-cadastro], [perfil institucional em 09/11][juan-perfil] e [integração do voluntário em 09/11][juan-integracao]. Há também reviews de Juan nas [PRs #57][pr57], [#68][pr68], [#84][pr84] e [#88][pr88]. A ausência do nome civil na string de autoria não demonstra ausência de contribuição.

O PDF **não afirma que Sophia não fez commits**; registra três commits dela e questiona a presença de autoria fora da tabela da equipe. O histórico confirma [Initial commit][sophia-inicial], [Initialize developer][sophia-developer] e [Initialize docs][sophia-docs], em 12/09. O DV identifica Sophia no papel de P.O./monitoria, separado dos quatro integrantes desenvolvedores. Autoria de inicialização ou colaboração externa não exige, por si, incluir essa pessoa na distribuição de pontos dos integrantes.

Rafael aparece como `Rafael` no Git e `rafa-alencar` nas PRs. As telas de cadastro e perfil foram incorporadas pela integração posterior, com atribuição explícita nas #68 e [#72][atribuicao72]. Os nomes de Cauã também têm grafias diferentes no histórico. A [contagem por sprint](sprints.md#autoria-de-commits-nas-sprints) agrupa essas grafias e informa seu critério.

A igualdade dos 25 pontos da tabela não foi recalculada a partir do número de commits. A pontuação de participação precisa considerar os critérios da disciplina e os registros da equipe; o Git sozinho não mede revisão, reuniões, trabalho em par e esforço individual.

## Revisões das PRs

Foram conferidas as submissões formais de review e as conversas das **17 PRs mescladas** localizadas até esta consolidação. Essa amostra contém 15 merges com destino à `developer` e 2 com destino a branches de integração. Uma review `COMMENTED`, uma solicitação de alterações e uma aprovação têm efeitos diferentes. Mesclar uma PR ou ser seu autor também não equivale a aprová-la como revisor.

| PR | Destino | Registro de review formal | Observação verificável |
| --- | --- | --- | --- |
| [#57][pr57] | `developer` | `APPROVED`, `notkazui`, 02/11, antes do merge | Aprovação explícita de autenticação e CI. |
| [#58][pr58] | `developer` | Nenhuma submissão localizada | Há [execução de CI com falha][ci58] no commit da PR. |
| [#59][pr59] | `developer` | Nenhuma submissão localizada | Há [comentário de Cauã pedindo prints][comentario59] antes do merge; é evidência de conferência, sem aprovação formal. |
| [#60][pr60] | `developer` | Nenhuma submissão localizada | Merge sem review formal recuperada. |
| [#61][pr61] | `developer` | `APPROVED`, `CauaHenriqueM`, 03/11, antes do merge | Aprovação registrada. |
| [#63][pr63] | `adapta-auth` | Nenhuma submissão localizada | Não foi um merge direto na `developer`; há [execução de CI com falha][ci63]. |
| [#64][pr64] | `developer` | Nenhuma submissão localizada | Merge sem review formal recuperada. |
| [#65][pr65] | `developer` | Nenhuma submissão localizada | A PR relata testes e evidências, mas isso não constitui aprovação de outro integrante. |
| [#66][pr66] | `developer` | Nenhuma submissão localizada | Merge sem review formal recuperada. |
| [#67][pr67] | `developer` | Nenhuma submissão localizada | Merge sem review formal recuperada. |
| [#68][pr68] | `developer` | Comentários, `CHANGES_REQUESTED` e depois `APPROVED` de `notkazui`, antes do merge de 13/11 | Demonstra revisão, reparo e aprovação. CI do commit final [aprovado][ci68]. |
| [#69][pr69] | `developer` | Nenhuma submissão localizada | Evidências de teste não substituem review formal. |
| [#72][pr72] | `test/fluxos-isolamento` | Nenhuma submissão localizada | Há comentário de atribuição da integração; não é aprovação. |
| [#84][pr84] | `developer` | `CHANGES_REQUESTED` de `notkazui`, antes do merge | Houve revisão; não foi localizada aprovação posterior. Os comentários do autor recuperados após o merge não alteram essa condição. |
| [#86][pr86] | `developer` | Nenhuma submissão localizada | PR de reversão. |
| [#92][pr92] | `developer` | Nenhuma submissão localizada | PR de restauração. |
| [#93][pr93] | `developer` | Nenhuma submissão localizada | Merge sem review formal recuperada. |

**Resultado:** 4 das 17 PRs têm submissões formais de review, sendo 3 com aprovação registrada antes do merge. Nas outras 13 não foi localizada submissão formal; uma delas, #59, tem comentário de conferência. Considerando só os 15 merges destinados à `developer`, são 11 sem submissão formal recuperada.

Assim, o número **13/17 é sustentado quando “review” significa a submissão formal do GitHub**, com a ressalva de que a amostra inclui branches de integração. Ele não prova ausência de toda conversa ou leitura humana. As evidências também não sustentam afirmar que todas as PRs tiveram aprovação registrada.

A [#88][pr88] está fora dessa contagem porque não foi mesclada; na consulta desta atualização, em 20/11, consta encerrada sem merge. Em 20/11 Juan submeteu `CHANGES_REQUESTED` sobre sessão e mídia. Os dois reparos foram enviados no [commit `fe69315`][correcao88] e as duas threads foram resolvidas. Resolver a thread não registra aprovação pelo revisor nem integração na developer.

## Testes de sistema existentes e alcance da crítica

O formulário reconhece que `auth.spec.js` e `integracao.spec.js` cobrem autenticação e perfis. O DEF-011 questiona a cobertura dos demais cenários do roteiro, e o DEF-010 questiona a falta de consolidação por sprint e de preenchimento das evidências de CT01–CT14. Não se trata de uma constatação de inexistência de qualquer teste.

A [#57][pr57] relata 4 testes de sistema e a [#68][pr68] relata 7 testes de navegador contra Docker/MySQL, com evidências. A #68 também documenta reparos decorrentes da revisão. A #88 registra 8 testes de navegador e a reexecução atual foi aprovada. O [relatório de testes](testes.md) reúne esses resultados e distingue testes de API, componentes, sistema e usabilidade.

Permanecem pendentes os cenários de candidatura/documentos, triagem, agenda e conflito entre candidaturas. Testes com mocks não comprovam o SQL de RF09/RF10, e axe-core não substitui a coleta de M6 com participantes. A reprodução adicional em 20/11 confirmou HTTP 500 na listagem da ONG e na edição de estado/horário com o MySQL migrado, conforme [resultados observados](testes.md#validacao-das-correcoes-da-pr-88).

## Tratamento dos apontamentos

| ID / localização no PDF | Análise e encaminhamento | Situação desta consolidação |
| --- | --- | --- |
| DEF-001 · pp. 3, 13 | Conferir linhas de fonte de tabelas/figuras nas versões Markdown do DV/DA. | Pendente de revisão editorial dos documentos-base. |
| DEF-002 · pp. 4, 13 | Acrescentar citações dos métodos e conceitos nos trechos correspondentes do DV, conferindo a fonte efetivamente utilizada. | Pendente; os novos relatórios não encerram a revisão bibliográfica. |
| DEF-003 · pp. 4, 13 | Conferir correspondência entre citações e referências do DV. | Pendente, junto ao DEF-002. |
| DEF-004 · pp. 4–6, 13 | [Sprints](sprints.md) consolida desvios, dados disponíveis de M3/M4 e proposta de replanejamento. M1/M2/M5/M6 continuam sem série completa. | Parcialmente tratado; não houve reconstrução fictícia de métricas. |
| DEF-005 · pp. 4, 13 | As atas existentes são resumidas e não documentam decisões/retrospectivas. Aplicar o [registro das próximas sprints](sprints.md#registro-das-proximas-sprints). | Pendente dos registros reais da equipe; reuniões passadas não foram inventadas. |
| DEF-006 · pp. 4, 14 | Histórico de entregas e situação por sprint publicados. Percentuais de compromisso não são calculáveis sem baseline. | Parcial: situação recuperada; M1 histórica não apurada. |
| DEF-007 · pp. 4, 14 | Atrasos explicitados e [sequência proposta](sprints.md#replanejamento-proposto-a-partir-de-2011) registrada. | Proposta pendente de validação da equipe/P.O. |
| DEF-008 · pp. 4, 14 | [Alocação dos requisitos pendentes](sprints.md#alocacao-dos-requisitos-pendentes) distingue Must/Should/Could e dependências. | Proposta de alocação; não é compromisso retroativo ou aceite do P.O. |
| DEF-009 · pp. 6, 14 | [Plano operacional de testes](testes.md) explicita ambiente, ferramentas, responsáveis por papel, momento e roteiro M6. | Documentação complementada; atribuições nominais e execução futura dependem do planejamento. |
| DEF-010 · pp. 7, 14 | [Resultados históricos](testes.md#resultados-historicos-nas-prs) e matriz CT01–CT14 consolidados, com reparos conhecidos e pendências. | Parcial: evidências existentes recuperadas; ciclos históricos não informados continuam sem contagem. |
| DEF-011 · pp. 7, 14 | Existem E2E de auth/perfil/publicação; faltam os fluxos de sistema discriminados na matriz. | Parcialmente confirmado; ampliar conforme funcionalidades forem entregues. |
| DEF-012 · pp. 7, 14 | Divergência SQL/banco reproduzida; `new_tests.py` e cobertura de módulos legados exigem correção. | Aberto, **DT01–DT03**. |
| DEF-013 · pp. 5, 9, 14 | Contagem formal de reviews conferida acima; CI falho de #58/#63 confirmado. Padrão de commits e defasagem da `main` exigem ação. A configuração de proteção não foi auditada nesta consulta. | Parcialmente confirmado, **DT06/DT07**. Não assumir ausência de qualquer revisão humana. |
| DEF-014 · pp. 5, 15 | Há arquivos e implementações paralelas a revisar. Conferir dependências antes de excluir e não reproduzir chaves/credenciais nos relatórios. | Aberto, **DT03/DT07**. |
| DEF-015 · pp. 10, 11, 15 | Juan contribui como `notkazui`; Sophia tem commits iniciais e aparece no DV como P.O./monitoria. Quantidade de commits não comprova a adequação dos pontos individuais. | Esclarecido quanto à identificação/autoria; pontuação permanece sob avaliação da equipe/disciplina. |
| DEF-016 · pp. 11, 15 | Divergência entre contratos/modelo e SQL de RF09/RF10 confirmada. | Aberto, **DT01–DT03**. |

Os encaminhamentos acadêmicos e a reavaliação da inspeção cabem ao monitor/professor. Este registro não altera notas nem declara aprovação de artefatos por terceiros.

[snapshot]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/tree/d871469
[juan-cadastro]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/450df4843d016ad8bb8cf0342d3eb3668c1fe7ca
[juan-perfil]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/55eb2fe8c2e18a9dca82a3113850d2db6b1c90da
[juan-integracao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/1beaa81f00ca97ca66981b40f00cf74569265ec4
[sophia-inicial]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/65f451c
[sophia-developer]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/75d89b8
[sophia-docs]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/d2e3c0e
[atribuicao72]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/72#issuecomment-6809131855
[comentario59]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/59#issuecomment-6589985679
[ci58]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/actions/runs/41561449208
[ci63]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/actions/runs/42338247346
[ci68]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/actions/runs/43507230528
[correcao88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/fe69315
[pr57]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/57
[pr58]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/58
[pr59]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/59
[pr60]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/60
[pr61]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/61
[pr63]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/63
[pr64]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/64
[pr65]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/65
[pr66]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/66
[pr67]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/67
[pr68]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/68
[pr69]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/69
[pr72]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/72
[pr84]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/84
[pr86]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/86
[pr88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/88
[pr92]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/92
[pr93]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/93
