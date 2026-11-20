# Débitos técnicos e defeitos pendentes

Situação consolidada em **20/11/2026**. O registro reúne problemas que precisam de tratamento para sustentar o conceito de pronto do projeto. A [análise da inspeção](inspecao.md) detalha os apontamentos recebidos, e o [acompanhamento das sprints](sprints.md) propõe a ordem de trabalho.

**Débito técnico** é uma limitação de implementação/processo que exige trabalho posterior. Um defeito reproduzível deve ser corrigido como defeito; uma funcionalidade ainda não implementada continua no backlog do produto. Assim, candidatura, calendário e comprovante não são tratados como funcionalidades entregues com débito.

Os responsáveis abaixo são papéis de encaminhamento. A distribuição nominal e as datas de compromisso precisam ser registradas no planejamento da equipe; este documento não atribui decisões a reuniões passadas.

## Registro de tratamento

| ID e natureza | Problema e consequência | Prioridade / responsável | Evidência e critério de encerramento | Situação |
| --- | --- | --- | --- | --- |
| DT01 · defeito de integração | RF09/RF10 consultam `candidaturas` e usam `estado_vaga`, `cidade`, `estado_uf` e `data_criacao`, enquanto o modelo vigente usa `status`, `local` e `ocorrencias_vaga`. A [reprodução com MySQL](testes.md#validacao-das-correcoes-da-pr-88) confirmou HTTP 500 na listagem e na edição. | Crítica · responsáveis pelo backend de vagas e revisor | [Repositório SQL][sql] × [modelos][modelos] e [migrações][migracoes]. Encerrar com contratos alinhados, migração aplicável e testes de listagem/edição no MySQL real sem simular o repositório. | Aberto; não resolvido pela documentação ou pela #88. |
| DT02 · cobertura de integração | Testes de RF09/RF10 com `MagicMock` validam chamadas e traduções de erros, mas não executam o SQL no esquema real. | Alta · responsáveis por vagas e qualidade | [Testes de listagem][testes-listagem] e [testes de edição][testes-edicao]. Encerrar após criar vagas pelo fluxo real e consultar/editar em banco migrado, incluindo isolamento entre ONGs e falhas. | Aberto. Os mocks podem continuar nos testes unitários, acompanhados dos testes reais. |
| DT03 · código legado e coleta | `app/jwt_geraçao` e `app/voluntarios` mantêm implementações paralelas não montadas pelo `app.main`; parte da cobertura mede esses módulos. `tests/auth/new_tests.py` não segue o padrão de coleta `test_*.py`/`*_test.py`. | Alta · equipe de backend | [Aplicação principal][main] e [diretório de testes][tests]. Encerrar após mapear imports, portar casos úteis para a aplicação ativa, remover duplicações sem perder comportamento e recalcular a cobertura. | Aberto; não remover pastas sem conferir dependências. |
| DT04 · homologação provisória | A #65 registra aprovação automática de ONGs enquanto RF24 não estiver implementada. Não equivale à homologação completa prevista no produto. | Alta · responsáveis por organizações e P.O. | [PR #65][pr65]. Encerrar após definir e implementar o fluxo acordado de homologação e testar publicação por ONG homologada/não homologada. | Solução provisória documentada. |
| DT05 · documentação e métricas | Faltam baselines de compromisso/pontos, atas detalhadas e coleta histórica de M1/M2/M5/M6. | Alta · Scrum Master e qualidade | [Sprints e métricas](sprints.md#metricas-e-interpretacao-dos-resultados). Encerrar com registros contemporâneos de planejamento/fechamento e evidências de coleta; não preencher retroativamente com estimativas apresentadas como fatos. | Parcial: histórico e lacunas consolidados; dados ausentes continuam pendentes. |
| DT06 · gestão de configuração | Há merges sem aprovação formal registrada, execução de CI com falha em PRs históricas e `main` sem atualização de release. O Pages publicado ficou atrás da documentação da `developer`. | Alta · equipe e mantenedores | [Auditoria das PRs](inspecao.md#revisoes-das-prs). Encerrar com aprovação de outro integrante antes do merge, checks do commit final aprovados, release revisada e publicação dos relatórios. | Aberto; proteção de branch depende dos mantenedores e não foi alterada por este documento. |
| DT07 · arquivos e convenções | Arquivos `inicio`, `Inicio.brach.txt`, `src/backend/=0.2.0` e configurações locais exigem revisão; commits/branches não seguem uniformemente o padrão do DA. | Média · equipe | [Snapshot inspecionado][snapshot]. Encerrar após verificar a utilidade de cada arquivo, remover apenas o dispensável e aplicar a convenção em novos commits/branches. Preservar o histórico já publicado. | Aberto. |
| DT08 · sessão entre abas | Login sem persistência removia a sessão lembrada de outra conta. | Alta · responsável pela #88 e revisor | [PR #88][pr88]; testes unitários e cenário de navegador com duas contas, uma delas temporária. | Correção implementada na #88, pendente de merge. |
| DT09 · uploads abandonados | Fotos eram persistidas antes da publicação e não tinham coleta quando o formulário era abandonado. | Média · responsável pela #88 e revisor | [PR #88][pr88]. Limpeza a cada hora de uploads sem vínculo com mais de 24 h; preservar fotos de vagas em qualquer estado, avatares e modelos vinculados. Testar rollback, abandono e upload recente. | Correção implementada na #88, pendente de merge. |
| DT10 · implantação da limpeza | A trava da coleta de mídia atua dentro do processo. A implantação atual usa um worker Uvicorn. | Média ao mudar a implantação · backend/infraestrutura | [Dockerfile da API][dockerfile]. Antes de habilitar múltiplos workers/instâncias, substituir a coordenação por mecanismo compartilhado e testar concorrência entre publicação e coleta. | Limitação conhecida da solução da #88. |

## Itens do produto que continuam no backlog

A #88 declara que vagas salvas ficam no navegador e que candidaturas, agenda e conflitos pertencem a outras entregas. Esses recursos não podem ser contabilizados como concluídos apenas porque existe uma tela, um botão ou uma mensagem de indisponibilidade.

As issues [#74][i74] a [#81][i81] detalham evolução de catálogo de causas, localização, filtros, dados institucionais, mídia, rascunhos, indicadores e favoritos. O vínculo de fotos e documentos exigidos feito na #88 atende somente parte desse conjunto. A [#82][i82] trata da validação e regressões do redesenho.

Os requisitos Must de candidatura, documentos, acompanhamento, triagem, contato, comprovante, calendário e conflitos precisam de planejamento explícito com o P.O., conforme a [proposta de replanejamento](sprints.md#replanejamento-proposto-a-partir-de-2011).

## Regra de fechamento

Cada correção deve apontar o ID tratado, a issue/PR, o teste que reproduzia o problema, o resultado após o reparo e a aprovação do revisor. O status muda para encerrado quando a correção estiver integrada e validada. Contornar um erro no teste, simular a consulta que falhava ou apenas publicar um texto não encerra o defeito de execução.

[sql]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/d871469/src/backend/app/vagas/repository.py
[modelos]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/d871469/src/backend/app/vagas/models.py
[migracoes]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/tree/d871469/src/backend/migrations/versions
[testes-listagem]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/d871469/src/backend/tests/organizacoes/test_vagas_me.py
[testes-edicao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/d871469/src/backend/tests/vagas/test_atualizar_vaga.py
[main]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/d871469/src/backend/app/main.py
[tests]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/tree/d871469/src/backend/tests
[snapshot]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/tree/d871469
[pr65]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/65
[pr88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/88
[dockerfile]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/d871469/src/backend/Dockerfile
[i74]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/issues/74
[i81]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/issues/81
[i82]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/issues/82
