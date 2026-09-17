# Grupo Gosling - [Ainda sem nome de produto]

## VISÃO DO PRODUTO E DO PROJETO

**Versão 0.1**

> **Observação sobre este documento:** trata-se de um artefato vivo. Ele deve ser refinado e atualizado ao longo de todo o ciclo de vida de desenvolvimento do produto. A cada revisão, uma nova versão deve ser registrada no *Histórico de Revisões*, com descrição sucinta das mudanças ocorridas. São assumidos os padrões ABNT de nomenclatura para numeração de figuras, tabelas e quadros, bem como para referências bibliográficas.
>
> Trechos marcados com **`[A DEFINIR]`** ou **`[A VALIDAR]`** dependem de decisão ou pesquisa ainda pendente da equipe.

---

### Tabela 1 - Integrantes do Grupo

| Mat. | Nome | Função (responsabilidade) | Pontos de participação na elaboração |
|---|---|---|---|
| 231026661 | Cauã Henrique Moura Rodrigues | `[A DEFINIR]` | `[A DEFINIR]` |
| 232027529 | Juan Yuri Gabriel Brito Silva | `[A DEFINIR]` | `[A DEFINIR]` |
| 232005432 | Miguel Tobias de Lima Galvão | `[A DEFINIR]` | `[A DEFINIR]` |
| 222026528 | Rafael Rodrigues Alencar | `[A DEFINIR]` | `[A DEFINIR]` |
| **Total de pontos** | | | **100** |

> Os pontos de participação devem fechar 100 pontos para toda a equipe e refletir a participação de cada membro **na elaboração deste documento**.

### Tabela 2 - Histórico de Revisões

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 17/09/2026 | 0.0 | Criação da estrutura inicial dos documentos de visão e arquitetura | Cauã Henrique Moura Rodrigues |
| 17/09/2026 | 0.1 | Estruturação do documento conforme template da disciplina; registro do problema, da declaração de posição do produto, dos objetivos, do escopo inicial e do backlog preliminar | Equipe Gosling |

---

## Sumário

- [1. Visão Geral do Produto](#1-visão-geral-do-produto)
    - [1.1 Problema](#11-problema)
    - [1.2 Declaração de Posição do Produto](#12-declaração-de-posição-do-produto)
    - [1.3 Objetivos do Produto](#13-objetivos-do-produto)
    - [1.4 Tecnologias a Serem Utilizadas](#14-tecnologias-a-serem-utilizadas)
- [2. Visão Geral do Projeto](#2-visão-geral-do-projeto)
    - [2.1 Ciclo de vida do projeto de desenvolvimento de software](#21-ciclo-de-vida-do-projeto-de-desenvolvimento-de-software)
    - [2.2 Organização do Projeto](#22-organização-do-projeto)
    - [2.3 Planejamento das Fases e/ou Iterações do Projeto](#23-planejamento-das-fases-eou-iterações-do-projeto)
    - [2.4 Matriz de Comunicação](#24-matriz-de-comunicação)
    - [2.5 Gerenciamento de Riscos](#25-gerenciamento-de-riscos)
    - [2.6 Critérios de Replanejamento](#26-critérios-de-replanejamento)
- [3. Processo de Desenvolvimento de Software](#3-processo-de-desenvolvimento-de-software)
- [4. Declaração de Escopo do Projeto](#4-declaração-de-escopo-do-projeto)
    - [4.1 Backlog do produto](#41-backlog-do-produto)
    - [4.2 Perfis](#42-perfis)
    - [4.3 Cenários](#43-cenários)
    - [4.4 Tabela de Backlog do produto](#44-tabela-de-backlog-do-produto)
- [5. Métricas e Medições](#5-métricas-e-medições)
    - [5.1 GQM de medições](#51-gqm-de-medições)
- [6. Testes de Software](#6-testes-de-software)
    - [6.1 Estratégia de testes](#61-estratégia-de-testes)
    - [6.2 Roteiro de teste](#62-roteiro-de-teste)
- [7. Referências Bibliográficas](#7-referências-bibliográficas)

---

## 1. Visão Geral do Produto

### 1.1 Problema

#### 1.1.1 Contexto de negócio

O trabalho voluntário é um dos principais insumos do terceiro setor brasileiro. Organizações Não Governamentais (ONGs), associações e projetos sociais dependem de pessoas dispostas a doar tempo e competências para executar suas atividades-fim - acolhimento, educação, saúde, assistência, cultura, meio ambiente e defesa de direitos. Do outro lado, existe um contingente de pessoas interessadas em atuar como voluntárias, mas que não sabe onde procurar oportunidades.

Hoje, a divulgação de vagas de voluntariado é **descentralizada e informal**: acontece em perfis de redes sociais, grupos de mensagens, cartazes, sites próprios de cada organização e pelo boca a boca. O resultado é que a oferta (vagas das ONGs) e a demanda (pessoas dispostas a se voluntariar) não se encontram de forma sistemática. Quando se encontram, frequentemente há incompatibilidade entre o que a organização precisa e o que o voluntário pode oferecer em termos de **interesse, disponibilidade de horário, localização e tipo de atividade**.

**Quadro 1 - Síntese do tema, problema e questão-problema**

| Item | Descrição |
|---|---|
| **Tema** | Desenvolvimento de uma plataforma de voluntariado para conectar voluntários e ONGs, com foco em UX. |
| **Problema** | Pessoas interessadas em realizar trabalho voluntário e organizações que necessitam de voluntários têm dificuldade para se encontrar e identificar oportunidades compatíveis quanto a interesse, disponibilidade, localização e necessidades das atividades. |
| **Questão-problema** | Como facilitar o encontro entre pessoas interessadas em trabalho voluntário e organizações que necessitam de voluntários, considerando suas necessidades e disponibilidades? |

O Quadro 1 consolida a delimitação do trabalho. O **tema** define o recorte tecnológico e de qualidade (uma plataforma web com foco explícito em experiência do usuário); o **problema** descreve a dificuldade observada nas duas pontas da relação; e a **questão-problema** traduz essa dificuldade em uma pergunta que o software deve responder. As três formulações são o fio condutor das demais seções: os objetivos (seção 1.3), o escopo (seção 4) e as métricas (seção 5) derivam diretamente delas.

#### 1.1.2 Problema encontrado

Atualmente as ONGs e os trabalhadores voluntários têm dificuldade de centralizar suas publicações de vagas, bem como dificuldade de saber onde buscar todas as vagas de trabalho voluntário disponíveis.

Esse problema se desdobra em duas perspectivas complementares:

- **Perspectiva da ONG:** dificuldade de dar visibilidade às vagas para além da própria rede de contatos; esforço manual para triar candidatos; ausência de um registro organizado de quem se candidatou, com qual disponibilidade e com qual documentação; retrabalho na comunicação inicial com cada interessado. [ colocar dados de pesquisa importantes aqui ]
- **Perspectiva do voluntário:** ausência de um ponto único de busca; informações incompletas sobre as vagas (o que será feito, onde, em qual turno, por quantas horas); dificuldade de filtrar oportunidades compatíveis com a própria agenda e localização; falta de retorno formal sobre a candidatura e de um comprovante da atividade realizada. [ colocar dados de pesquisa importantes aqui ]

**Figura 1 - Diagrama de Ishikawa do problema**

`[inserir diagrama numerar e enunciar sobre]` -  `docs/assets/`.


**Quadro 2 - Causas levantadas para o problema**

falar sobre os topicos **informação** **processo** **pessoas** **tecnologia** e **compatibilidade**

> **`[inserir quadro e dados]`** - Os dados coletados devem ser citados nesta seção e referenciados na seção 7.

Comentando o Quadro 2: as causas não são independentes. A dispersão da **informação** é o que torna o **processo** de triagem manual e caro para a ONG; esse custo faz com que organizações com equipes pequenas (**pessoas**) invistam pouco em captação, o que realimenta a baixa visibilidade. A ausência de um canal digital adequado (**tecnologia**) impede que critérios objetivos de **compatibilidade** - turno, carga horária, modalidade e localização - sejam aplicados antes do contato humano. É sobre esse encadeamento que a solução de software atua.

#### 1.1.3 Solução de software proposta

Propõe-se o desenvolvimento de uma **aplicação web** que centraliza a publicação e a busca de vagas de trabalho voluntário, atuando como ponte entre ONGs e voluntários.

A solução contribui para o problema descrito da seguinte forma:

1. **Centraliza a informação** em um catálogo único de vagas, com campos padronizados (área de atuação/causa, modalidade, local, carga horária, período e número de vagas), atacando as causas da categoria *Informação*.
2. **Torna a compatibilidade um critério de busca**, por meio de filtros que refletem exatamente os campos padronizados, atacando as causas da categoria *Compatibilidade*.
3. **Estrutura o processo de candidatura**, com registro do interesse, envio da documentação necessária, emissão de comprovante e encaminhamento do contato entre o responsável pela vaga na ONG e o voluntário, atacando as causas da categoria *Processo*.
4. **Reduz a barreira tecnológica** para a organização, que passa a contar com um canal de divulgação sem precisar manter infraestrutura própria, atacando as causas da categoria *Tecnologia*.

O **foco em UX** é parte da própria proposta de solução, e não um detalhe de implementação: o público-alvo é heterogêneo em idade e familiaridade digital, e uma interface confusa reproduziria, dentro do sistema, a mesma barreira de acesso que existe hoje fora dele. Por esse motivo, requisitos de usabilidade e acessibilidade são tratados como requisitos de primeira classe no backlog (seção X.X) e são objeto de medição específica (seção X.X). **a definir ainda as seções**

### 1.2 Declaração de Posição do Produto

**Quadro 3 - Declaração de posição do produto**

| | |
|---|---|
| **Para:** | Pessoas interessadas em realizar trabalho voluntário e organizações do terceiro setor (ONGs, associações e projetos sociais) que necessitam de voluntários. |
| **Necessidade:** | Encontrar, de forma centralizada e confiável, oportunidades de voluntariado e voluntários compatíveis quanto a interesse, disponibilidade, localização e necessidades da atividade. |
| **O `[Produto]`:** | É uma aplicação web de conexão entre voluntários e organizações do terceiro setor. |
| **Que:** | Reúne em um só lugar as vagas de voluntariado, permite buscá-las por filtros que refletem a disponibilidade real do voluntário (causa, modalidade, local, carga horária e período) e conduz a candidatura desde o interesse inicial até o contato com o responsável pela vaga, com emissão de comprovante. |
| **Ao contrário:** | Da divulgação dispersa em redes sociais, grupos de mensagens e sites individuais de cada organização. Sem o produto, a conexão continua dependendo do acaso e do boca a boca: a ONG segue sem alcance para preencher suas vagas e o voluntário desiste por não encontrar uma oportunidade compatível com sua rotina. |
| **Nosso produto:** | Trata a compatibilidade e a experiência de uso como diferencial central: a busca é estruturada sobre os mesmos campos que a ONG preenche ao publicar a vaga, e a interface é projetada e avaliada com foco em UX, para ser utilizável por pessoas com diferentes níveis de familiaridade digital. |

O Quadro 3 sintetiza a intenção do produto e sua relevância para os envolvidos. Ele deve ser lido em conjunto com o Quadro 1: enquanto aquele delimita o problema, este declara a posição que o produto pretende ocupar. Os dois pontos que sustentam essa posição são (i) a **padronização dos campos da vaga**, que é o que torna a busca por compatibilidade possível, e (ii) o **cuidado com a experiência de uso**, que é o que garante que ambos os perfis consigam efetivamente concluir suas tarefas na plataforma.

#### 1.2.1 Usuários-alvo e clientes

**Quadro 4 - Usuários-alvo do produto**

| Usuário-alvo | Características | Por que o produto é importante para ele |
|---|---|---|
| **Voluntário** | Pessoa física interessada em doar tempo a causas sociais; possui disponibilidade limitada e específica (turnos, dias, carga horária); perfil heterogêneo em idade, formação e familiaridade digital - de estudantes a aposentados. | Passa a ter um ponto único de busca, com filtros que respeitam sua agenda e sua localização, além de um registro formal da candidatura e um comprovante da atividade. |
| **ONG / Organização** | Organização do terceiro setor, frequentemente com equipe reduzida e sem área dedicada à captação de voluntários; possui demandas recorrentes e sazonais por mão de obra voluntária. | Ganha visibilidade para suas vagas além da própria rede de contatos e recebe candidaturas já organizadas segundo os critérios que ela mesma definiu, reduzindo o esforço de triagem. |
| **Cliente / P.O.** | Professor da disciplina, que acompanha o histórico de commits e o desenvolvimento do projeto; tem como ponto de contato com a equipe o monitor responsável pelo grupo Gosling. | Avalia se o produto atende aos seus usuários-alvo e se cumpre os requisitos previamente delimitados pelo escopo do problema, sendo quem valida e homologa as entregas da equipe. |

#### 1.2.2 Alternativas competitivas

> **`[Inserir após pesquisa concorrentes de plataformas já existentes - linkedin infojobs etc]`**

### 1.3 Objetivos do Produto

**Objetivo geral:** desenvolver uma aplicação web que facilite o encontro entre pessoas interessadas em trabalho voluntário e organizações que necessitam de voluntários, considerando as necessidades e as disponibilidades de ambas as partes.

**Objetivos específicos:**

1. Permitir que organizações se cadastrem e publiquem vagas de trabalho voluntário com informações padronizadas e completas.
2. Permitir que voluntários se cadastrem e mantenham um perfil com seus interesses e sua disponibilidade.
3. Oferecer busca de vagas com filtros baseados nos campos padronizados da vaga (causa, modalidade, local, carga horária e período), de modo que o voluntário encontre oportunidades compatíveis com sua rotina.
4. Estruturar o fluxo de candidatura, incluindo o envio da documentação necessária e a emissão de comprovante ao voluntário.
5. Estabelecer a ponte de comunicação entre o responsável pela vaga na ONG e o voluntário candidato.
6. Entregar uma interface com foco em usabilidade e acessibilidade, utilizável por pessoas com diferentes níveis de familiaridade digital.

Os objetivos 1 a 3 atacam diretamente as causas de *Informação* e *Compatibilidade* do Quadro 2; os objetivos 4 e 5 atacam as causas de *Processo*; e o objetivo 6 materializa o foco em UX declarado no tema do projeto, sustentando a proposta de valor descrita no Quadro 3.

### 1.4 Tecnologias a Serem Utilizadas

**Quadro 5 - Tecnologias, ferramentas e métodos adotados**

| Categoria | Tecnologia / Ferramenta | Situação |
|---|---|---|
| Versionamento e hospedagem do código | Git e GitHub | Definido |
| Documentação do projeto | MkDocs com tema Material, em arquivos Markdown | Definido |
| Publicação da documentação | GitHub Pages, com automação de *deploy* via GitHub Actions a cada *commit* na branch `main` | Definido |
| Política de branches | `main` (produção) e `developer` (desenvolvimento), conforme definido no repositório | A definir |
| Linguagem e framework de *front-end* | `[A DEFINIR]` | A definir |
| Linguagem e framework de *back-end* | `[A DEFINIR]` | A definir |
| Banco de dados | `[A DEFINIR]` | A definir |
| Prototipação e design de interface | `[A DEFINIR]` (ferramenta para os *wireframes* e o protótipo de alta fidelidade) | A definir |
| Gestão do backlog e das sprints | `[A DEFINIR]` | A definir |
| Comunicação da equipe | `[A DEFINIR]` | A definir |
| Testes | `[A DEFINIR]` | A definir |
| Metodologias e técnicas | Scrum e XP (detalhados na seção 3); MoSCoW?, GQM?; diagrama de Ishikawa para análise do problema | A definir |