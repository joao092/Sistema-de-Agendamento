// ============================================================
// Sistema de Agendamento para Barbearia do Evandro
// Backend: Node.js + Express + PostgreSQL
// ============================================================

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html e demais arquivos estáticos

// Conexão com o PostgreSQL.
// Em produção (Render) DATABASE_URL é fornecida automaticamente pelo banco gerenciado.
// Localmente, use o arquivo .env (veja .env.example).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
});

// Horários de funcionamento oferecidos para agendamento (grade fixa, 1h em 1h)
const HORARIOS_PADRAO = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// -------------------- SERVIÇOS --------------------

// Lista os serviços ativos (uso público - tela inicial e agendamento)
app.get("/api/servicos", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM servicos WHERE ativo = TRUE ORDER BY nome ASC"
    );
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao listar serviços:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Lista TODOS os serviços, inclusive inativos (uso administrativo)
app.get("/api/admin/servicos", async (req, res) => {
  try {
    const resultado = await pool.query("SELECT * FROM servicos ORDER BY nome ASC");
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao listar serviços (admin):", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Cadastra um novo serviço
app.post("/api/servicos", async (req, res) => {
  const { nome, descricao, preco, duracao_minutos } = req.body;
  if (!nome || preco === undefined || preco === null) {
    return res.status(400).json({ erro: "Nome e preço são obrigatórios." });
  }
  try {
    const resultado = await pool.query(
      `INSERT INTO servicos (nome, descricao, preco, duracao_minutos, ativo)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [nome, descricao || null, preco, duracao_minutos || 30]
    );
    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao cadastrar serviço:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Edita um serviço existente (dados e/ou disponibilidade)
app.put("/api/servicos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, duracao_minutos, ativo } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE servicos SET
         nome = COALESCE($1, nome),
         descricao = COALESCE($2, descricao),
         preco = COALESCE($3, preco),
         duracao_minutos = COALESCE($4, duracao_minutos),
         ativo = COALESCE($5, ativo)
       WHERE id_servico = $6 RETURNING *`,
      [nome, descricao, preco, duracao_minutos, ativo, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado." });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao editar serviço:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Exclui um serviço (bloqueado se já houver agendamentos vinculados)
app.delete("/api/servicos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM servicos WHERE id_servico = $1", [id]);
    return res.status(200).json({ mensagem: "Serviço excluído com sucesso." });
  } catch (err) {
    if (err.code === "23503") {
      // violação de chave estrangeira: existem agendamentos usando esse serviço
      return res.status(409).json({
        erro: "Não é possível excluir: existem agendamentos vinculados a este serviço. Desative-o em vez de excluir.",
      });
    }
    console.error("Erro ao excluir serviço:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// -------------------- BARBEIRO --------------------

// Retorna as informações públicas do barbeiro (tela "Barbeiro")
app.get("/api/barbeiros", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM barbeiros WHERE ativo = TRUE ORDER BY id_barbeiro ASC"
    );
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao listar barbeiros:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Atualiza os dados do barbeiro (uso administrativo)
app.put("/api/barbeiros/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, telefone, instagram, horario_inicio, horario_fim, ativo } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE barbeiros SET
         nome = COALESCE($1, nome),
         telefone = COALESCE($2, telefone),
         instagram = COALESCE($3, instagram),
         horario_inicio = COALESCE($4, horario_inicio),
         horario_fim = COALESCE($5, horario_fim),
         ativo = COALESCE($6, ativo)
       WHERE id_barbeiro = $7 RETURNING *`,
      [nome, telefone, instagram, horario_inicio, horario_fim, ativo, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Barbeiro não encontrado." });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao editar barbeiro:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// -------------------- AGENDAMENTOS --------------------

// Retorna os horários da grade padrão que já estão ocupados em uma data
app.get("/api/horarios-disponiveis", async (req, res) => {
  const { data, id_barbeiro } = req.query;
  if (!data) {
    return res.status(400).json({ erro: "Informe a data (?data=AAAA-MM-DD)." });
  }
  try {
    const resultado = await pool.query(
      `SELECT hora_agendamento FROM agendamentos
       WHERE data_agendamento = $1
         AND status <> 'cancelado'
         AND ($2::int IS NULL OR id_barbeiro = $2)`,
      [data, id_barbeiro || null]
    );
    const ocupados = resultado.rows.map((r) => r.hora_agendamento.substring(0, 5));
    return res.status(200).json({ horarios: HORARIOS_PADRAO, ocupados });
  } catch (err) {
    console.error("Erro ao consultar horários:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Cria um novo agendamento, validando conflito de horário
app.post("/api/agendamentos", async (req, res) => {
  const {
    id_servico,
    id_barbeiro,
    data_agendamento,
    hora_agendamento,
    nome_cliente,
    telefone_cliente,
    email_cliente,
    observacao,
  } = req.body;

  if (!id_servico || !data_agendamento || !hora_agendamento || !nome_cliente || !telefone_cliente) {
    return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // barbeiro único cadastrado nesta versão inicial, salvo se informado
    let barbeiroId = id_barbeiro;
    if (!barbeiroId) {
      const b = await client.query("SELECT id_barbeiro FROM barbeiros WHERE ativo = TRUE ORDER BY id_barbeiro ASC LIMIT 1");
      if (b.rows.length === 0) throw new Error("Nenhum barbeiro cadastrado.");
      barbeiroId = b.rows[0].id_barbeiro;
    }

    let clienteRes = await client.query("SELECT id_cliente FROM clientes WHERE telefone = $1", [telefone_cliente]);
    let id_cliente;
    if (clienteRes.rows.length > 0) {
      id_cliente = clienteRes.rows[0].id_cliente;
    } else {
      const novoCliente = await client.query(
        "INSERT INTO clientes (nome, telefone, email) VALUES ($1,$2,$3) RETURNING id_cliente",
        [nome_cliente, telefone_cliente, email_cliente || null]
      );
      id_cliente = novoCliente.rows[0].id_cliente;
    }

    const resultado = await client.query(
      `INSERT INTO agendamentos (id_cliente, id_barbeiro, id_servico, data_agendamento, hora_agendamento, observacao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_cliente, barbeiroId, id_servico, data_agendamento, hora_agendamento, observacao || null]
    );

    await client.query("COMMIT");
    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar agendamento:", err);
    if (err.message && err.message.includes("indisponível")) {
      return res.status(409).json({ erro: "Horário indisponível para o barbeiro selecionado." });
    }
    return res.status(500).json({ erro: "Erro ao registrar agendamento." });
  } finally {
    client.release();
  }
});

// Lista os agendamentos (uso administrativo)
app.get("/api/agendamentos", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT a.id_agendamento, c.nome AS cliente, c.telefone AS telefone_cliente,
             b.nome AS barbeiro, s.nome AS servico, s.preco,
             a.data_agendamento, a.hora_agendamento, a.status, a.observacao
      FROM agendamentos a
      JOIN clientes c ON c.id_cliente = a.id_cliente
      JOIN barbeiros b ON b.id_barbeiro = a.id_barbeiro
      JOIN servicos s ON s.id_servico = a.id_servico
      ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC
    `);
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao listar agendamentos:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Atualiza o status de um agendamento
app.put("/api/agendamentos/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const statusValidos = ["agendado", "confirmado", "concluido", "cancelado"];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: "Status inválido." });
  }
  try {
    const resultado = await pool.query(
      "UPDATE agendamentos SET status = $1 WHERE id_agendamento = $2 RETURNING *",
      [status, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Agendamento não encontrado." });
    }
    return res.status(200).json({ mensagem: "Status atualizado com sucesso.", agendamento: resultado.rows[0] });
  } catch (err) {
    console.error("Erro ao atualizar status:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// -------------------- AUTENTICAÇÃO DO ADMINISTRADOR --------------------

app.post("/api/login", async (req, res) => {
  const { nome, senha } = req.body;
  if (!nome || !senha) {
    return res.status(400).json({ erro: "Informe usuário e senha." });
  }
  try {
    const resultado = await pool.query("SELECT * FROM usuarios WHERE nome = $1", [nome]);
    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }
    const usuario = resultado.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }
    return res.status(200).json({ mensagem: "Login realizado com sucesso.", nivel_acesso: usuario.nivel_acesso });
  } catch (err) {
    console.error("Erro ao autenticar:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Verificação simples de saúde do servidor (útil para checar o deploy no Render)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Qualquer outra rota devolve o front-end (SPA simples de seções)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor do sistema de agendamento rodando na porta ${PORT}`);
});
