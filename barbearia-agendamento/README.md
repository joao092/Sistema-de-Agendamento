# Sistema de Agendamento — Barbearia do Evandro

Projeto Integrador V — Engenharia da Computação (EAD) — UNISAL
Aluno: João Gabriel Correa Cotta

Aplicação web completa para agendamento online de serviços de barbearia,
implementada conforme os requisitos, o modelo de banco de dados e o
protótipo de interface definidos nas Etapas A1 e A2 do projeto.

## Stack

- **Front-end:** HTML, CSS e JavaScript puro (SPA com roteamento por hash), fiel à
  identidade visual do protótipo de média fidelidade (fontes Fraunces + Inter,
  paleta dourado/âmbar sobre fundo escuro e creme).
- **Back-end:** Node.js + Express (API REST).
- **Banco de dados:** PostgreSQL (modelo físico da Etapa A2, com trigger de
  conflito de horário, índice único e views de relatório).
- **Autenticação administrativa:** JWT + senha com hash bcrypt.
- **Hospedagem:** Render (Web Service + PostgreSQL).

## Estrutura do projeto

```
barbearia-agendamento/
├── db/
│   ├── schema.sql        # tabelas, índices, trigger e views
│   └── setup.js          # cria o schema e insere os dados iniciais (seed)
├── server/
│   ├── index.js          # servidor Express
│   ├── db.js             # pool de conexão com o PostgreSQL
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js
│       ├── servicos.js
│       ├── barbeiro.js
│       └── agendamentos.js
├── public/
│   ├── index.html         # SPA com todas as telas (cliente + admin)
│   ├── css/style.css
│   └── js/app.js
├── package.json
├── render.yaml             # configuração de deploy (Render Blueprint)
└── .env.example
```

## Funcionalidades

**Área do cliente**
- Página inicial com destaque de serviços;
- Lista de serviços e preços;
- Página do barbeiro;
- Novo agendamento (serviço → data → grade de horários disponíveis → dados do cliente);
- Bloqueio automático de horários já ocupados (validado no back-end e no banco de dados);
- Tela de confirmação do agendamento;
- Página de contato e localização.

**Área administrativa** (login com usuário e senha)
- Dashboard com estatísticas do dia (agendamentos, confirmados, cancelados, receita);
- Listagem de todos os agendamentos com alteração de status
  (agendado, confirmado, concluído, cancelado);
- Cadastro, ativação/desativação de serviços;
- Edição das informações do barbeiro.

## Executando localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL (local ou um banco gratuito, por exemplo no Render)

### Passos

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env
# edite o .env com a DATABASE_URL do seu banco PostgreSQL

# 3. criar as tabelas e os dados iniciais (barbeiro, serviços e usuário admin)
npm run db:setup

# 4. iniciar o servidor
npm start
```

A aplicação ficará disponível em `http://localhost:10000`.

O login administrativo padrão é definido pelas variáveis `ADMIN_NOME` e
`ADMIN_SENHA` do `.env` (usadas apenas na primeira execução do `db:setup`).

## Deploy no Render

1. Suba este projeto para um repositório no GitHub.
2. No Render, escolha **New > Blueprint** e aponte para o repositório —
   o arquivo `render.yaml` já cria automaticamente o Web Service e o banco
   PostgreSQL gratuito.
   - Alternativamente, crie manualmente um **Web Service** (build:
     `npm install`, start: `npm start`) e um **PostgreSQL** gratuito, depois
     copie a *Internal Database URL* para a variável `DATABASE_URL` do Web
     Service.
3. Defina a variável de ambiente `ADMIN_SENHA` (e, se quiser, `ADMIN_NOME`)
   no painel do Render antes do primeiro deploy.
4. Após o primeiro deploy, abra o **Shell** do Web Service no Render e rode:
   ```bash
   npm run db:setup
   ```
   Isso cria as tabelas e os dados iniciais no banco de produção.
5. Acesse a URL pública gerada pelo Render — o site do cliente estará na
   raiz (`/`) e a área administrativa em `/#/admin`.

## Notas sobre as regras de negócio implementadas

- **Conflito de horário:** além da verificação feita pela API, o banco de
  dados possui um índice único parcial e um trigger (`fn_verifica_conflito_agendamento`)
  que impedem, mesmo em caso de requisições simultâneas, que dois
  agendamentos ativos sejam criados para o mesmo barbeiro, data e horário.
- **Status do agendamento:** segue o fluxo definido na Etapa A1 —
  Agendado → Confirmado → Concluído, com a possibilidade de Cancelado em
  qualquer etapa.
- **Autenticação do administrador:** a senha é armazenada com hash bcrypt e o
  acesso às rotas administrativas exige um token JWT válido.
