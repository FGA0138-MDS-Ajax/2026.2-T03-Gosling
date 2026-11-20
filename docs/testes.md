# Execução e evidências de testes

Relatório consolidado em **20/11/2026**. O VolunJá tem testes automatizados de backend e frontend e testes de sistema com navegador, API, MySQL e Nginx. Há resultados e evidências nas PRs; faltava reuni-los por sprint e relacioná-los ao roteiro CT01–CT14 do [Documento de Visão](visão.md#6-testes-de-software).

A evidência disponível comprova parte dos fluxos do MVP. Candidatura, triagem, calendário e conflitos entre candidaturas continuam pendentes. Cobertura de código, testes com mocks e verificações de acessibilidade têm escopos próprios e não equivalem à execução de todos os testes de sistema.

## Escopo e ambientes

| Camada / nível | Ferramentas e ambiente | O que é verificado | Responsabilidade e momento |
| --- | --- | --- | --- |
| Backend, unidade/contrato | pytest; testes de serviços, schemas e rotas, com dublês quando necessário | Validações, autenticação, respostas e erros isolados | Autor da funcionalidade durante a implementação; outro integrante revisa a PR. |
| Backend, integração | pytest, SQLAlchemy e banco de teste; SQLite local ou MySQL 8.4 migrado | Persistência, transações, autenticação, perfis e isolamento nos testes que realmente utilizam o banco | Autor e qualidade antes do merge; o job `backend` executa no MySQL. RF09/RF10 ainda precisam de integração real específica. |
| Frontend, componente/integração | Vitest e React Testing Library, em jsdom | Formulários, navegação, sessão, carregamento, erros e integração com serviços simulados | Autor antes da PR; job `frontend` no CI. API simulada neste nível não comprova persistência. |
| Sistema | Playwright/Chromium contra o sistema em Docker Compose: React, Nginx, FastAPI e MySQL | Fluxos de login, cadastro/perfil, isolamento, publicação, recarga, logout e limite do proxy | Autor e qualidade por incremento; job `fluxo-autenticacao` após backend/frontend. Algumas requisições de login usam a API direta para isolar cenários; o limite real do proxy tem teste próprio. |
| Acessibilidade e responsividade | axe-core, teclado e viewports de 360, 768 e 1280 px | Violações automatizáveis e comportamento dos fluxos inspecionados | Durante os testes de sistema; não comprova conformidade integral de todas as páginas. |
| Usabilidade com participantes | Roteiro de tarefas e registro da métrica M6 | Se pessoas concluem busca/candidatura sem treinamento, com sucesso ≥ 80% | Equipe de UX/qualidade no incremento utilizável e na Sprint 11; coleta consolidada ainda pendente. |

O [workflow versionado][workflow] mantém os três jobs. Os artefatos previstos são `cobertura-backend` (`coverage.xml`) e `evidencias-autenticacao` (`test-results` e `playwright-report`). O nome do último job é histórico: a suíte atual também exercita cadastro, perfil e publicação.

## Resultados históricos nas PRs

Os números abaixo são os resultados **relatados nas respectivas PRs**, com os escopos e datas de cada entrega. Não devem ser somados nem apresentados como execuções realizadas no encerramento das sprints anteriores. O relatório atual recupera essas evidências; não cria relatórios contemporâneos que não existiam.

| PR e momento de integração | Resultado informado / evidência | Relação com as sprints |
| --- | --- | --- |
| [#57][pr57] · 02/11 | 62 testes de backend, cobertura de 99,63%; 31 de frontend; 4 de sistema com Docker/navegador; prints na PR. Os 5 testes de hash são subconjunto da validação descrita. | Sprint 7, entrega de autenticação originalmente prevista na 6. |
| [#59][pr59] · 02/11 | 33 testes de frontend, lint/build e prints; inclui acesso ao cadastro, teclado, restauração e logout da ONG. | Sprint 7. |
| [#61][pr61] · 03/11 | 39 testes de frontend no total, incluindo 6 do login de projeto social. | Sprint 7. |
| [#65][pr65] · 09/11 | 113 testes de backend; cobertura aproximada de 90,8%; migração e MySQL relatados como verificados. | Sprint 8; cadastro e perfil institucional. |
| [#69][pr69] · 09/11 | Testes de frontend, lint/build, consulta/edição com API real e persistência após recarga, com imagens na PR. | Sprint 8. |
| [#72][pr72] · 11/11 | 218 testes de backend, 87,84% de cobertura; 99 de frontend; integração de cadastro/perfil. Merge desta PR em `test/fluxos-isolamento`. | Sprint 9; consolidação posterior na `developer` pela #68. |
| [#68][pr68] · 13/11 | 283 testes de backend, 88,90% de cobertura; 140 de frontend; 7 de navegador contra Docker/MySQL. A [execução do commit final][ci68] concluiu com sucesso. | Sprint 9; publicação e integração de cadastro/perfil. |
| [#88][pr88] · aberta em 16/11 | A descrição original registrava 341 testes de backend, 89,73% de cobertura, 169 de frontend e 8 Playwright. A contagem mudou após integração da `developer` e os reparos de revisão. | Sprint 9/10, ainda pendente de merge. Resultado atual abaixo. |

Os relatórios em PDF de [JWT](TESTS_REFERENTES_A_JWT.pdf), [cadastro de voluntários](TESTES_REFERENTES_A_VOLUNTARIOS.pdf) e [perfil — issue #20](Documentação%20de%20Testes%20-%20Issue%20%2320%20(Volunjá%20API).pdf) também existem. Parte deles descreve módulos legados ou contratos anteriores; são evidência histórica e precisam ser lidos junto ao código da aplicação ativa, sem assumir que validam os endpoints atuais.

## Validação das correções da PR 88

Execução de **20/11/2026**, sobre o [commit `fe69315`][correcao88], após incorporar a `developer` no commit `4bc26f2`. Os ambientes foram separados: SQLite efêmero, banco `volunja_test` no MySQL 8.4 e sistema Docker para o navegador. Foram usados dados fictícios.

| Verificação | Resultado observado |
| --- | --- |
| Backend com SQLite | **391 aprovados**, cobertura de **90,50%** de `app`. |
| Backend com MySQL 8.4, após Alembic | **391 aprovados**, cobertura de **90,50%** de `app`. |
| Frontend com Vitest | **171 aprovados**, em 16 arquivos. |
| Playwright contra Docker/MySQL/Nginx | **8 aprovados**. |
| Ruff, lint do frontend e build de produção | Aprovados. Formatação dos arquivos de mídia novos/alterados conferida. |

O [GitHub Actions do commit `fe69315`][ci88] também concluiu com **sucesso nos três jobs**: `backend`, `frontend` e `fluxo-autenticacao`, incluindo migrações no MySQL e publicação dos artefatos de cobertura/navegação.

A sessão temporária de uma segunda conta passou a preservar a sessão lembrada da primeira. O [teste de armazenamento][teste-sessao] cobre persistência, expiração atualizada, logout e restauração em nova aba; o [cenário Playwright][e2e-integracao] inclui login sem persistência em outra aba, recarga e logout sem apagar a conta lembrada.

Os [testes de limpeza de mídia][teste-limpeza] verificam upload abandonado, upload recente, preservação de fotos em todos os estados da vaga, avatar e modelo vinculado, rollback da publicação, rejeição de imagem já removida, indisponibilidade do banco e retomada periódica após falha. A coleta verifica os vínculos a cada hora e remove somente uploads sem vínculo com mais de 24 horas. A coordenação atual considera o único worker da API.

As 391 aprovações não eliminam a lacuna de integração de RF09/RF10: os testes existentes dessas consultas ainda usam simulações. Uma reprodução adicional, fora da suíte aprovada, confirmou o problema:

| Requisição no sistema isolado com MySQL migrado | Esperado | Observado em 20/11 |
| --- | --- | --- |
| `POST /api/v1/vagas`, ONG fictícia autenticada | 201 | 201 |
| `GET /api/v1/organizacoes/me/vagas` | 200 com lista | **500**; consulta depende de estruturas ausentes do esquema. |
| `PUT /api/v1/vagas/{id}`, com `estado_vaga=ENCERRADA` | Atualização válida conforme contrato acordado | **500**; coluna `estado_vaga` inexistente. |
| `PUT /api/v1/vagas/{id}`, alterando `data_inicio` | Validar encontros/candidaturas | **500**; tabela `candidaturas` inexistente. |

Os logs registraram os erros MySQL 1054 (`Unknown column 'estado_vaga'`) e 1146 (`Table 'volunja.candidaturas' doesn't exist`). O problema foi registrado como **DT01/DT02** e continua aberto; não pertence à correção de sessão/mídia da #88.

## Rastreabilidade do roteiro CT01 a CT14

As classificações abaixo distinguem execução de sistema de testes parciais de API/componente. Não há atribuição de ciclos históricos individuais onde as PRs não informam esse dado.

| CT | Resultado conhecido e evidência | Reparos / pendência | Momento e responsável pelo próximo fechamento |
| --- | --- | --- | --- |
| CT01 · cadastro do voluntário | **Sistema executado no recorte atual**: cadastro, sessão, perfil, recarga e isolamento, em `integracao.spec.js`; evidências nas #68/#88. | Ajustes de integração, telefone/senha e cadastro em etapas registrados nas PRs. Quantidade histórica de ciclos por CT não apurada. | Regressão na Sprint 10/11: responsável por cadastro + qualidade. |
| CT02 · publicação | **Sistema executado**: erros por campo, persistência, carga decimal e encontros, em `integracao.spec.js`. | Revisão da #68 corrigiu validação por campo, local e carga. Regressão de uploads acrescentada na #88; não cobre todos os futuros recursos da vaga. | Regressão na Sprint 10/11: responsável por vagas + qualidade. |
| CT03 · busca com filtros | **Parcial**: API e componentes testam causa/modalidade/período na #88; não foi localizado E2E de busca com esses filtros. | Falta o roteiro completo no navegador e a definição dos filtros restantes da #76. | Proposta Sprint 10/11: responsável pelo catálogo + qualidade. |
| CT04 · candidatura/documentos | **Pendente**: sem fluxo integrado correspondente. | Implementar RF16/RF17 e a emissão prevista no critério de aceite. | Após candidatura/documentos: responsáveis por candidatura/comprovante + qualidade; replanejar com P.O. |
| CT05 · triagem/conexão | **Pendente**. | Depende de candidatura, triagem e liberação de contato. | Proposta Sprint 11: responsáveis por triagem + qualidade/P.O. |
| CT06 · acesso por perfil | **Executado nos recursos atuais**: API e Playwright validam autenticação, perfis e isolamento; #57/#68/#88. | Expandir aos endpoints de candidatura e agenda quando existirem. | Cada PR e Sprint 11: autor do endpoint + revisor de segurança/qualidade. |
| CT07 · usabilidade | **Pendente de coleta M6**. Axe e responsividade já executados não medem sucesso de pessoas nas tarefas. | Aplicar o roteiro abaixo; não declarar aprovação sem participantes e resultados. | Incremento utilizável/Sprint 11: equipe de UX + qualidade. |
| CT08 · calendário | **Pendente**. | Implementar RF26 com candidaturas e estados válidos. | Após RF16/RF26: responsável por agenda + qualidade; replanejar com P.O. |
| CT09 · conflito | **Pendente**. | Implementar RF27; sobreposição entre encontros da mesma vaga não é conflito entre candidaturas. | Após RF16/RF27: responsável por candidatura + qualidade. |
| CT10 · intervalos permitidos | **Parcial de validação de encontros** no backend; sistema de candidaturas pendente. | Cobrir consecutivos, meia-noite e sobreposição no fluxo completo. | Junto ao CT09. |
| CT11 · liberação de horário | **Pendente**. | Depende de recusa/cancelamento e atualização da agenda. | Após RF18/RF19/RF26: responsáveis por candidatura/agenda + qualidade. |
| CT12 · simultaneidade | **Pendente**. | Exige candidaturas reais, transação e requisições concorrentes no MySQL. | Junto à implementação de RF27: backend + qualidade. |
| CT13 · proteção da agenda | **Pendente**. Os testes de isolamento de perfil não comprovam proteção de um endpoint de agenda ausente. | Criar dois voluntários e uma ONG e verificar acesso à agenda de cada titular. | Junto a RF26: responsável por agenda + qualidade. |
| CT14 · ocorrências/edição | **Parcial**: publicação e rejeição de intervalos inválidos têm teste real. Edição com candidatura ativa não está validada em sistema. | Corrigir DT01/DT02 e executar edição/conflito com candidaturas persistidas. | Proposta Sprint 10/11: responsáveis por vagas/candidatura + qualidade. |

Os momentos futuros são parte da [proposta de replanejamento](sprints.md#replanejamento-proposto-a-partir-de-2011); precisam ser confirmados pela equipe/P.O. O autor executa o roteiro e um integrante diferente revisa evidências e resultado antes do merge.

### Coleta prevista de usabilidade

Quando busca e candidatura estiverem utilizáveis, a equipe de UX deve recrutar participantes, apresentar as tarefas sem treinamento e registrar, por participante identificado por código, sucesso/falha, tempo, ajuda necessária e dificuldades. As tarefas são encontrar uma oportunidade compatível e concluir a candidatura com a documentação exigida. Cada tarefa deve ter seu próprio total e taxa de sucesso: `concluíram / participaram × 100`. Comparar com a meta de 80%, abrir defeitos para dificuldades observadas e repetir a avaliação após as correções. O relatório deve informar data, versão testada, quantidade de participantes, método e resultado; nenhum desses resultados foi presumido aqui.

## Como executar e registrar

No backend, após instalar `requirements-dev.txt`, os comandos usados são:

```powershell
python -m ruff check app tests migrations
python -m pytest
```

Sem `TEST_DATABASE_URL`, os testes usam SQLite efêmero. Para a integração MySQL, usar **um banco exclusivo de testes**: definir `DATABASE_URL` e `TEST_DATABASE_URL` apontando para ele, aplicar `python -m alembic upgrade head` e executar pytest. O job `backend` configura esse ambiente automaticamente. Esses comandos não devem apontar para uma base de uso real.

No frontend:

```powershell
npm ci
npm run lint
npm test
npm run build
```

Para sistema, iniciar o Compose e criar as contas fictícias conforme o [README][readme], instalar o Chromium do Playwright e executar:

```powershell
$env:DEMO_PASSWORD = 'SenhaDeTeste123!'
$env:E2E_BASE_URL = 'http://127.0.0.1:8080'
npm run test:e2e
```

Na validação de 20/11 foi usado um projeto Compose isolado, porta web 8082 e MySQL de testes separado; isso não altera a porta padrão do projeto.

Em cada execução futura, registrar sprint, commit, ambiente, comando, esperado/obtido, número de aprovados/falhos, CTs relacionados e link do CI/artefato. Se houver falha, abrir ou relacionar o defeito, registrar o reparo e a reexecução. Um check aprovado só sustenta os testes que efetivamente foram coletados e executados.

[workflow]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/fe69315/.github/workflows/backend.yml
[readme]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/fe69315/README.md
[pr57]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/57
[pr59]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/59
[pr61]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/61
[pr65]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/65
[pr68]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/68
[pr69]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/69
[pr72]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/72
[pr88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/pull/88
[ci68]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/actions/runs/43507230528
[correcao88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/commit/fe69315
[teste-sessao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/fe69315/src/frontend/src/services/sessionStore.test.js
[teste-limpeza]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/fe69315/src/backend/tests/vagas/test_limpeza_midia.py
[e2e-integracao]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/blob/fe69315/src/frontend/e2e/integracao.spec.js
[ci88]: https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling/actions/runs/44835433519
