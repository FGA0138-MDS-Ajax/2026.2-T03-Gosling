# VolunJá

O **VolunJá** é uma aplicação web proposta pelo **grupo Gosling** para conectar voluntários e organizações do terceiro setor. A proposta reúne vagas de voluntariado e permite buscar oportunidades compatíveis com os interesses, a localização e a disponibilidade de cada pessoa, com foco na experiência do usuário. O escopo também prevê um calendário pessoal de candidaturas ativas e o bloqueio de novas candidaturas com horários sobrepostos.

Este site reúne a documentação do projeto desenvolvido na disciplina **Métodos de Desenvolvimento de Software (MDS), semestre 2026.2**.

## Andamento e qualidade

Os registros de execução foram consolidados em **20/11/2026**, durante a Sprint 10. Eles distinguem entregas integradas, PRs em revisão, resultados de testes e trabalho pendente:

- [Sprints e métricas](sprints.md): planejado e realizado, desvios, contribuições e proposta de replanejamento.
- [Execução dos testes](testes.md): evidências das PRs, validação atual e rastreabilidade de CT01 a CT14.
- [Débitos técnicos e defeitos](debitos-tecnicos.md): prioridades, impacto e critérios de encerramento.
- [Tratamento da inspeção Allen](inspecao.md): análise dos 16 apontamentos, autoria e registros de revisão das PRs.

## Testes de software e evidências

Os relatórios trazem os casos verificados, os resultados e os prints das PRs dentro do próprio Pages:

| Entrega | Relatório |
| --- | --- |
| Login, sessão e segurança | [Autenticação e acesso](testes/autenticacao.md) |
| Cadastro e edição de dados | [Cadastros e perfis](testes/cadastros-perfis.md) |
| Publicação e painel institucional | [Publicação e gestão de vagas](testes/vagas.md) |
| Reparos solicitados na revisão | [Regressões de sessão e mídia](testes/regressoes.md) |
| Navegador, API, MySQL e Nginx | [Testes de sistema — 8 cenários e capturas](testes/sistema.md) |

O [plano de testes e cobertura](testes.md) mantém a rastreabilidade com CT01–CT14, os comandos de execução e as pendências.

Na data do registro, candidaturas, triagem e calendário ainda têm entregas pendentes. A descrição do produto abaixo apresenta o escopo pretendido; o estado de implementação está nos relatórios de acompanhamento.

## Documentos do projeto

| Documento | Versão | Conteúdo | Arquivos de referência |
| --- | --- | --- | --- |
| [Visão do Produto e do Projeto](visão.md) | 0.4 | Problema, proposta do produto, planejamento, escopo e backlog (RF01 a RF27 e RNF01 a RNF07), regras RN01 a RN05, métricas e testes CT01 a CT14. | [PDF](documento%20de%20visao.pdf) · [Word](documento%20de%20visao.docx) |
| [Documento de Arquitetura](arquitetura.md) | 0.3 | Arquitetura em camadas com React, FastAPI e MySQL; módulos, contratos de calendário e conflito de horário, transações, diagramas, implantação e padrões de código e versionamento. | [PDF](documento%20de%20arquitetura.pdf) · [Word](documento%20de%20arquitetura.docx) |

As versões em Markdown foram conferidas com os PDFs e arquivos Word em **28/10/2026**. Os diagramas de arquitetura reproduzem as imagens do documento Word e podem ser abertos em tamanho original clicando nas imagens.

Material de apoio: [apresentação do Documento de Arquitetura (PDF)](Slides%20Documento%20de%20Arquitetura.pdf).

## Atas de reunião

- [Ata 1 — alinhamento dos documentos de visão e arquitetura](atas-reuniao/ata-reuniao-1.md).
- [Ata 2 — planejamento e distribuição do trabalho da sprint](atas-reuniao/ata-reuniao-2.md).

## Equipe

| Matrícula | Integrante |
| --- | --- |
| 231026661 | Cauã Henrique Moura Rodrigues |
| 232027529 | Juan Yuri Gabriel Brito Silva |
| 232005432 | Miguel Tobias de Lima Galvão |
| 222026528 | Rafael Rodrigues Alencar |
