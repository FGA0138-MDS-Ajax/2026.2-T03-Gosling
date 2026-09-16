# Documento de Arquitetura
**Versão 0.0**
##Integrantes do Grupo
| Matrícula   | Nome                                                | Função (responsabilidade) | Pontos de participação |
|-------------|-----------------------------------------------------|---------------------------|------------------------|
| 231026661   | Cauã Henrique Moura Rodrigues                       |                           |                        |
| 232027529   | Juan Yuri Gabriel Brito Silva                       |                           |                        |
| 232005432   | Miguel Tobias de Lima Galvão                        |                           |                        |
| 222026528   | Rafael Rodrigues Alencar                            |                           |                        |

---

## Sumário

- [1 Introdução](#1-Introdução)
    - [1.1 Propósito](#11-Propósito)
    - [1.2 Escopo](#12-Escopo)
- [2 Representação Arquitetural](#2-representacao-arquitetural)
- [3 Bibliografia](#3-bibliografia)

---

## 1.Introdução

### 1.1 Propósito

Este documento descreve a arquitetura do sistema sendo desenvolvido pelo grupo Gosling, na disciplina de MDS – Métodos de Desenvolvimento de Software – edição do segundo semestre de 2026, para o sistema XXXXXXXX, a fim de fornecer uma visão abrangente do sistema para desenvolvedores, testadores e demais interessados em aspectos relacionados às tecnologias a serem usadas no desenvolvimento.

### 1.2 Escopo

O detalhamento do escopo se encontra no documento de arquitetura, este, juntamente com o documento de Visão do produto e do projeto. Porém, em linhas gerais o escopo do produto compreende o desenvolvimento de um software capaz de registrar vagas de conectar vagas de trabalhos voluntários publicados por ONGs, bem como registrar o interesse do voluntariado em específicas vagas.

Em geral, o escopo do produto corresponde a uma aplicação web onde será possível realizar o cadastro de uma ONG cujo a mesma poderá cadastrar vagas de trabalhos voluntários com as informa~çoes: Vaga, Descrição da Vaga, Descrição das atividades, Área de Atuação/Causa, Modalidade (presencial/remoto/híbrido), Local, Carga Horária, Período(manhã/tarde/noite/madrugada), Número de Vagas. Será possível também o cadastro de voluntariados, cujo os mesmos poderão realizar buscas de vagas dentro de seus interesses, a partir de filtros das informações básicas de uma vaga. Realizar o cadastro de trabalho, encaminhando documentação necessária, receber um comprovante e realizar a ponte de conexão entre o responsável pela vaga da ONG e o voluntariádo para demais informações.