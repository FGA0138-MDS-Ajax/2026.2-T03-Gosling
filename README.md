# VolunJá — autenticação, administração e vagas de voluntariado

Implementação da issue #1: API de login, JWT de 60 minutos, controle de acesso por perfil, sessão e logout no cliente, tratamento global de HTTP 401 e limitação de tentativas no Nginx.

A página pública `/vagas` consulta vagas salvas no MySQL. Contas do tipo ONG podem publicar atividades com uma ou mais datas e horários. As publicações permanecem disponíveis após recarregar a página.

## Iniciar o sistema completo

Requisitos: Git e Docker Desktop com o mecanismo Linux em execução. Os comandos abaixo são para PowerShell, na raiz do repositório.

1. Configure as três variáveis de `.env.example` em um arquivo `.env` na raiz.
   Para criar esse arquivo com valores aleatórios, sem sobrescrever um arquivo existente:

```powershell
python -c "from pathlib import Path; import secrets; names=['MYSQL_ROOT_PASSWORD','MYSQL_PASSWORD','JWT_SECRET_KEY']; content='\n'.join(name+'='+secrets.token_hex(32) for name in names)+'\n'; Path('.env').open('x', encoding='utf-8').write(content)"
```

Se `.env` já existir, preencha as três variáveis manualmente. As senhas geradas em hexadecimal podem ser usadas diretamente na URL do MySQL. Uma senha escrita manualmente com caracteres reservados precisa ser codificada para uso em URL.

2. Inicie o sistema. O serviço da API aplica as migrações Alembic antes de iniciar o Uvicorn.

```powershell
docker compose up --build -d --wait
```

3. Crie as contas fictícias para conferir os três perfis:

```powershell
docker compose exec -e DEMO_PASSWORD=SenhaDeTeste123! api python -m app.usuarios.seed
```

| E-mail fictício | Perfil |
| --- | --- |
| voluntario@example.com | VOLUNTARIO |
| ong@example.com | ORGANIZACAO, tipo ONG |
| admin@example.com | ADMINISTRADOR |

A senha dessas contas será a informada em `DEMO_PASSWORD`. O comando é explícito e idempotente: contas existentes e suas senhas são preservadas. A aplicação não cria contas padrão ao iniciar.

4. Abra <http://localhost:8080/login> para acessar o frontend. O Nginx encaminha os pedidos `/api/` para o backend pela rede interna do Compose. A API também está disponível localmente em `127.0.0.1:8000`; o MySQL permanece na rede interna.

Se a porta 8080 estiver ocupada, acrescente `WEB_PORT=8081` ao `.env` da raiz e execute novamente `docker compose up -d --wait`. Nesse caso, abra <http://localhost:8081/login>. Para rodar os testes de navegador nessa porta, defina `$env:E2E_BASE_URL = 'http://127.0.0.1:8081'` antes de `npm run test:e2e`.

Para encerrar sem apagar o banco persistente:

```powershell
docker compose down
```

## Administração de cadastros

Abra `/admin` ou `/admin/login` na mesma porta do frontend. Essa entrada tem formulário próprio e aceita somente contas com perfil `ADMINISTRADOR`. Se já estiver conectado como ONG ou voluntário, use **Trocar conta** para entrar como administrador.

Para a demonstração, o comando de criação das contas fictícias acima disponibiliza `admin@example.com`, com a senha informada em `DEMO_PASSWORD`. Não há uma senha administrativa fixa no código nem criação automática de administradores na inicialização.

O painel permite pesquisar por nome ou e-mail, filtrar por perfil e situação, consultar os dados cadastrados e criar contas de voluntário, ONG ou administrador. Contas ativas podem entrar com o e-mail e a senha definidos no formulário. O cadastro administrativo de ONG exige os dados institucionais e permite escolher se ela já pode publicar vagas; ele não registra aceite de termos em nome da organização.

A exclusão exige confirmação e bloqueia a remoção da conta administrativa em uso. Ao excluir uma ONG com vagas, o painel informa a quantidade e exige confirmar também a remoção das vagas e dos encontros vinculados. Os demais cadastros permanecem no banco.

| Endpoint | Acesso e comportamento |
| --- | --- |
| `POST /api/v1/admin/login` | Recebe `email` e `senha` e autentica somente administradores. |
| `GET /api/v1/admin/usuarios` | Lista paginada; aceita `busca`, `perfil`, `ativo`, `pagina` e `por_pagina`. |
| `GET /api/v1/admin/usuarios/{id}` | Consulta os dados e a quantidade de vagas vinculadas. |
| `POST /api/v1/admin/usuarios` | Cria uma conta com `perfil=VOLUNTARIO`, `ORGANIZACAO` ou `ADMINISTRADOR`. |
| `DELETE /api/v1/admin/usuarios/{id}` | Remove a conta; exige `excluir_vagas=true` quando há vagas vinculadas. |

Todas as operações de cadastro exigem JWT de administrador. Senhas e hashes não são retornados nas consultas. Os contratos completos estão no Swagger em `/docs`, na porta da API.

## Publicação e consulta de vagas

Na página `/vagas`, use **Entrar** para autenticar e retornar ao catálogo. A área da organização também oferece **Publicar vaga**, que abre o formulário diretamente.

- `GET /api/v1/vagas?pagina=1&por_pagina=20` é público e retorna `itens`, `total`, `pagina` e `por_pagina`. A listagem inclui vagas abertas de organizações ativas e homologadas, com dados públicos e todos os encontros.
- `POST /api/v1/vagas` exige JWT de uma ONG. A organização proprietária vem da sessão. O servidor retorna HTTP 201 depois de confirmar a gravação da vaga e dos encontros na mesma transação.
- O formulário usa seletores de calendário e horário para cada encontro. Datas e horários são informados em Brasília, enviados e armazenados em UTC e exibidos novamente no horário de Brasília.
- Todo encontro deve terminar após seu início. Encontros sobrepostos dentro da mesma vaga são recusados; intervalos consecutivos e atividades que atravessam a meia-noite são permitidos.
- A verificação de conflitos com compromissos de voluntários depende das candidaturas e será integrada em RF26/RF27. Vagas distintas podem ocupar os mesmos horários.

Exemplo de corpo para publicação:

```json
{
  "titulo": "Oficina de leitura",
  "descricao": "Leitura compartilhada com a comunidade.",
  "atividades": "Organizar livros e apoiar as atividades de leitura.",
  "causa": "Educação",
  "modalidade": "PRESENCIAL",
  "local": "Brasília, DF",
  "periodo": "MANHA",
  "carga_horaria": 3,
  "numero_vagas": 10,
  "ocorrencias": [
    {
      "inicio": "2026-11-16T09:00:00-03:00",
      "fim": "2026-11-16T12:00:00-03:00"
    }
  ]
}
```

Ao atualizar o sistema, `docker compose up --build -d --wait` aplica a migração de vagas na inicialização da API. As publicações usam o volume persistente já configurado para o MySQL.

## Contrato de autenticação

O backend usa a porta 8000: abra <http://localhost:8000/docs> para consultar e testar as rotas no Swagger. O ReDoc está em <http://localhost:8000/redoc> e o esquema OpenAPI em <http://localhost:8000/openapi.json>. O frontend usa uma porta separada, definida em `WEB_PORT`.

`POST /api/v1/auth/login` recebe JSON:

```json
{
  "email": "voluntario@example.com",
  "senha": "SenhaDeTeste123!"
}
```

Retorna `access_token`, `token_type=bearer`, `expires_in=3600`, `expires_at` em segundos UTC e `usuario` com `id`, `nome`, `email`, `perfil` e `tipo`. O hash da senha e o estado interno da conta não são enviados ao cliente. Campos extras, incluindo um perfil escolhido no pedido de login, são rejeitados.

O perfil é obtido do banco. Uma organização mantém `tipo=ONG` ou `tipo=PROJETO_SOCIAL`, conforme sua conta.

`GET /api/v1/auth/me` exige `Authorization: Bearer <token>` e restaura a sessão. Cada requisição protegida valida a assinatura e a expiração do JWT e consulta novamente a existência, o estado ativo e o perfil atual da conta.

| Endpoint protegido | Perfil permitido |
| --- | --- |
| GET /api/v1/voluntarios/me | VOLUNTARIO |
| GET /api/v1/organizacoes/me | ORGANIZACAO |
| GET /api/v1/admin/me | ADMINISTRADOR |

Credenciais inválidas ou conta inativa retornam HTTP 401 com a mesma mensagem. Sessão ausente, inválida, expirada, de conta removida ou cujo perfil mudou também retorna 401. Um perfil autenticado que solicita a área de outro perfil recebe 403.

O JWT utiliza HS256, com os campos obrigatórios `sub`, `perfil`, `iat` e `exp`. A chave vem de `JWT_SECRET_KEY`, com pelo menos 32 bytes.

## Cliente

- Axios centraliza os pedidos em `services/http.js`.
- HTTP 401 em recurso protegido remove a sessão e encaminha para o login. O 401 do próprio login é apresentado no formulário.
- Uma resposta 401 atrasada de uma sessão antiga não encerra uma sessão nova.
- O token e sua expiração ficam em `sessionStorage`. A senha não é armazenada.
- O provedor restaura a conta pela API após recarregar a página, encerra a sessão na expiração e confere novamente o prazo ao retornar à janela.
- Logout remove o token e a conta do cliente. Conforme a issue #1, esse logout é do cliente; um JWT copiado anteriormente continua sujeito à sua expiração e às verificações da conta no servidor.
- As rotas `/voluntario`, `/organizacao` e `/admin` têm proteção por perfil. Elas oferecem acesso ao catálogo público de vagas; a área da ONG também oferece publicação. Candidaturas e moderação pertencem às próximas funcionalidades.
- O login compartilhado atende à entrada do voluntário da #2, com validação, carregamento, bloqueio de envios repetidos, erros e navegação por perfil. O link de cadastro abre `/cadastro/voluntario`, inclusive após uma sessão expirar.
- **Dependência da #2:** o formulário e a API de cadastro pertencem às issues #9 e #10 e ainda não estão implementados. Por enquanto, a rota de cadastro informa a indisponibilidade e permite voltar ao login. A #2 só deve ser fechada quando esse destino oferecer o cadastro; a conferência visual final com o Figma e a entrada da ONG da #4 também continuam pendentes.

## Organização do código

| Arquivos | Responsabilidade |
| --- | --- |
| app/core/config.py, security.py, database.py, errors.py | Configuração, JWT/Argon2, sessão do banco e tradução central de erros. |
| app/usuarios/models.py e enums.py | Conta comum e especializações Voluntario/Organizacao com tabelas associadas, conforme o DA. |
| app/usuarios/repository.py e service.py | Consultas ao banco e interface de contas usada pelo módulo auth. |
| app/auth/schemas.py, service.py, router.py | Contratos JSON, regras de autenticação e endpoints. |
| app/admin/ e src/frontend/src/pages/AdminPage.jsx | Entrada administrativa e consulta, criação e exclusão de cadastros. |
| app/dependencies.py | Composição das dependências e autorização por perfil. |
| migrations/ | Evolução versionada do esquema via Alembic. |
| src/frontend/src/services/ | Cliente HTTP, API de autenticação e armazenamento da sessão. |
| src/frontend/src/contexts/, hooks/, components/ProtectedRoute.jsx | Estado de autenticação e proteção da navegação. |
| infra/nginx/default.conf | Proxy da API, entrega da SPA e limite de tentativas de login. |
| .github/workflows/backend.yml | Verificações da API, do cliente e do fluxo completo. |

Os cadastros RF01/RF02 devem criar contas nessas mesmas tabelas e gerar `senha_hash` com `hash_password`. As entradas comum e administrativa usam essas contas e a mesma autenticação JWT.

## Nginx

O proxy permite uma média de 5 pedidos por minuto e por IP aos endpoints de login comum e administrativo, com uma rajada inicial de até 5 pedidos. As duas entradas compartilham o mesmo limite. Excesso retorna 429; o cliente mostra a mensagem correspondente. O acesso local pela porta 8000 chega diretamente à API; o limite de tentativas é aplicado nas requisições que passam pelo Nginx.

Cabeçalhos enviados pelo visitante, como `X-Forwarded-For`, não definem a chave do limitador. Ao acrescentar Cloudflare Tunnel, configure `real_ip` somente para o proxy confiável antes de usar o IP encaminhado. O túnel não faz parte deste pacote.

## Testes locais

No PowerShell, em `src/backend`, usando a sua virtualenv existente:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m ruff check app tests migrations
.\.venv\Scripts\python.exe -m ruff format --check app tests migrations
.\.venv\Scripts\python.exe -m pytest
```

Os testes locais usam um banco SQLite efêmero por caso, quando `TEST_DATABASE_URL` não está definida. A integração contínua aplica as migrações e executa os mesmos testes em MySQL 8.4. A meta de cobertura de `app` continua em 80%.

Em `src/frontend`:

```powershell
npm ci
npm run lint
npm test
npm run build
```

Com o sistema completo e as contas fictícias já iniciados em `localhost:8080`:

```powershell
npx playwright install chromium
$env:DEMO_PASSWORD = 'SenhaDeTeste123!'
npm run test:e2e
```

Os testes Playwright validam os três perfis, erros de entrada, restauração, logout, 401 global, limitação real no proxy e acessibilidade/responsividade em 360, 768 e 1280 px.

Para executar a API fora do Docker, configure `src/backend/.env` a partir do exemplo, apontando `DATABASE_URL` para seu MySQL. Execute `python -m alembic upgrade head` antes do Uvicorn. O Vite encaminha `/api` para `127.0.0.1:8000`.

## GitHub Actions e conclusão da issue

O workflow mantém Ruff e o limite de cobertura e acrescenta:

1. Backend com MySQL 8.4 e migrações.
2. Lint, testes e build do frontend.
3. Sistema em Docker Compose e testes Playwright/axe-core contra o Nginx.

Os segredos do workflow são dados fictícios do ambiente de teste. O relatório de cobertura e as evidências de navegação são publicados como artefatos.

Para cumprir o conceito de pronto do projeto, aplique a alteração, confira os checks do novo commit e abra um PR para `developer` com revisão de outro integrante. A issue não foi fechada automaticamente.
