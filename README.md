# Sistema de Agendamento — Barbearia do Evandro

Sistema web completo para agendamento online de serviços de barbearia, desenvolvido
como Projeto Integrador (UNISAL — Engenharia da Computação). Front-end estático servido
pelo próprio back-end (Node.js/Express) e persistência em PostgreSQL.

## Estrutura do projeto

```
agendamento-barbearia/
├── backend.js          # servidor Express + rotas da API + serve o front-end
├── index.html           # front-end (SPA: área do cliente + painel administrativo)
├── package.json
├── .env.example          # modelo das variáveis de ambiente (copie para .env)
├── .gitignore
└── db/
    ├── schema.sql        # tabelas, índices, trigger e views
    └── seed.js           # popula o schema + dados iniciais (admin, barbeiro, serviços)
```

## Como executar localmente

### 1. Pré-requisitos
- Node.js 18 ou superior
- PostgreSQL instalado localmente (ou acesso a um PostgreSQL remoto)

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as variáveis de ambiente
```bash
cp .env.example .env
```
Edite o `.env` e ajuste `DATABASE_URL` para apontar para o seu PostgreSQL local, por exemplo:
```
DATABASE_URL=postgresql://postgres:SUASENHA@localhost:5432/agendamento_barbearia
```
Se o banco `agendamento_barbearia` ainda não existir, crie-o antes:
```bash
psql -U postgres -c "CREATE DATABASE agendamento_barbearia;"
```

### 4. Criar as tabelas e os dados iniciais
```bash
npm run seed
```
Esse comando aplica `db/schema.sql` (cria as tabelas, índices, trigger e views) e, se ainda não
existirem, cadastra:
- usuário administrador (`admin` / senha definida em `ADMIN_SENHA_INICIAL`, padrão `barbearia123`)
- o barbeiro (Evandro)
- os serviços iniciais (Corte, Barba, Corte + Barba, Sobrancelha)

### 5. Executar o projeto
```bash
npm start
```
O servidor sobe em `http://localhost:10000` (ou na porta definida em `PORT` no `.env`).

## Como testar no localhost

1. Acesse `http://localhost:10000` no navegador.
2. Navegue por **Serviços**, **Barbeiro** e **Contato** para conferir o conteúdo público.
3. Em **Agendar**, escolha um serviço, uma data e um horário livre, preencha nome/WhatsApp e confirme.
   Tente agendar duas vezes no mesmo horário: o sistema deve bloquear o segundo agendamento.
4. Em **Área Administrativa**, entre com `admin` e a senha definida no seed.
5. No painel, confira a lista de agendamentos, altere o status de um deles, cadastre um novo
   serviço, desative/ative um serviço existente e edite os dados do barbeiro.
6. Verifique rapidamente que a API responde: `http://localhost:10000/api/health` deve retornar `{"status":"ok"}`.

## Comandos Git (versionamento e envio para o GitHub)

```bash
git init
git add .
git commit -m "Sistema de Agendamento para Barbearia - versao inicial completa"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```
> Substitua a URL do `remote add` pela URL do repositório que você criar no GitHub.
> O arquivo `.env` nunca é enviado ao GitHub (já está no `.gitignore`).

---

## CONFIGURAÇÃO DO RENDER — WEB SERVICE SEM BLUEPRINT

Este projeto é publicado inteiramente como um único **Web Service** no Render, configurado
manualmente pelo painel — **sem `render.yaml` e sem Blueprint**.

### Passo a passo do deploy

**1. Criar o banco de dados PostgreSQL no Render**
- No painel do Render: **New +** → **PostgreSQL**.
- Dê um nome (ex.: `agendamento-barbearia-db`) e crie.
- Depois de criado, copie a **Internal Database URL** (ou External, se preferir) — você vai
  usar esse valor na variável `DATABASE_URL` do Web Service.

**2. Criar o Web Service**
- No painel do Render: **New +** → **Web Service**.
- Conecte o repositório do GitHub criado no passo anterior.
- Preencha os campos exatamente assim:

```
Runtime:
Node

Build Command:
npm install

Start Command:
npm start
```

- **Root Directory:** deixe em branco (o `package.json` está na raiz do repositório).

**3. Environment Variables** (aba *Environment* do Web Service, adicionar manualmente):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a URL do banco PostgreSQL criado no passo 1 |
| `ADMIN_SENHA_INICIAL` | uma senha à sua escolha para o primeiro acesso do admin |

Não é necessário configurar `PORT` manualmente — o Render injeta essa variável automaticamente
e o `backend.js` já lê `process.env.PORT`.

**4. Executar o seed em produção (uma única vez)**
Depois do primeiro deploy concluído, abra a aba **Shell** do próprio Web Service no painel do
Render e rode:
```bash
npm run seed
```
Isso cria as tabelas e os dados iniciais (admin, barbeiro, serviços) diretamente no banco de
produção. Você só precisa fazer isso uma vez (rodar de novo não duplica dados, pois o script
verifica o que já existe antes de inserir).

**5. Deploy automático**
Qualquer novo `git push` na branch `main` dispara um novo deploy automaticamente, pois o Web
Service está conectado ao repositório do GitHub.

### Resumo da configuração

| Item | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Root Directory | (vazio) |
| Porta | lida de `process.env.PORT` (sem localhost fixo) |
| Blueprint / render.yaml | **não utilizado** |

## Checklist final

- [ ] `npm install` roda sem erros
- [ ] `npm run seed` cria as tabelas e os dados iniciais sem erros
- [ ] `npm start` sobe o servidor e `http://localhost:10000` carrega a página
- [ ] Cadastro de novo agendamento funciona e bloqueia horário já ocupado
- [ ] Login administrativo funciona com o usuário/senha do seed
- [ ] Painel lista agendamentos e permite alterar status
- [ ] Painel permite cadastrar, ativar/desativar e excluir serviços
- [ ] Painel permite editar os dados do barbeiro
- [ ] Repositório enviado ao GitHub (sem o arquivo `.env`)
- [ ] Banco PostgreSQL criado no Render
- [ ] Web Service criado no Render (Build/Start Command configurados, sem Blueprint)
- [ ] Variável `DATABASE_URL` configurada no Web Service
- [ ] `npm run seed` executado uma vez pela Shell do Render
- [ ] URL pública do Render carrega o sistema e permite agendar normalmente

## Observações importantes

- O `senha` do administrador é armazenada com hash (`bcryptjs`), nunca em texto puro.
- A regra "não permitir dois agendamentos no mesmo horário para o mesmo barbeiro" é garantida
  em duas camadas: um índice único parcial no PostgreSQL e um trigger (`trg_verifica_conflito`),
  então mesmo requisições simultâneas não conseguem burlar a regra.
- Nesta primeira versão existe apenas um barbeiro cadastrado (conforme escopo definido no TAP),
  por isso o formulário de agendamento não pede escolha de barbeiro.
