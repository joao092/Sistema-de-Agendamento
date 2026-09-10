const express = require("express");
const pool = require("../db");
const { exigirAutenticacao } = require("../middleware/auth");

const router = express.Router();

// GET /api/servicos — lista pública dos serviços ativos (tela Início / Serviços e preços)
router.get("/servicos", async (req, res) => {
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

// GET /api/servicos/todos — lista completa (uso administrativo, inclui inativos)
router.get("/servicos/todos", exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query("SELECT * FROM servicos ORDER BY nome ASC");
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao listar serviços:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// POST /api/servicos — cadastro de um novo serviço
router.post("/servicos", exigirAutenticacao, async (req, res) => {
  const { nome, descricao, preco, duracao_minutos } = req.body;

  if (!nome || preco === undefined || preco === null) {
    return res.status(400).json({ erro: "Informe ao menos o nome e o preço do serviço." });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO servicos (nome, descricao, preco, duracao_minutos)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nome, descricao || null, preco, duracao_minutos || 30]
    );
    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao cadastrar serviço:", err);
    return res.status(500).json({ erro: "Erro ao cadastrar serviço." });
  }
});

// PUT /api/servicos/:id — edição de um serviço existente
router.put("/servicos/:id", exigirAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, duracao_minutos, ativo } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE servicos
       SET nome = COALESCE($1, nome),
           descricao = COALESCE($2, descricao),
           preco = COALESCE($3, preco),
           duracao_minutos = COALESCE($4, duracao_minutos),
           ativo = COALESCE($5, ativo)
       WHERE id_servico = $6
       RETURNING *`,
      [nome, descricao, preco, duracao_minutos, ativo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado." });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao editar serviço:", err);
    return res.status(500).json({ erro: "Erro ao editar serviço." });
  }
});

// DELETE /api/servicos/:id — remove (desativa) um serviço
// Serviços com agendamentos vinculados não podem ser excluídos (chave estrangeira RESTRICT),
// por isso a exclusão aqui é lógica: o serviço deixa de ficar disponível para novos agendamentos.
router.delete("/servicos/:id", exigirAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      "UPDATE servicos SET ativo = FALSE WHERE id_servico = $1 RETURNING *",
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado." });
    }
    return res.status(200).json({ mensagem: "Serviço removido com sucesso." });
  } catch (err) {
    console.error("Erro ao remover serviço:", err);
    return res.status(500).json({ erro: "Erro ao remover serviço." });
  }
});

module.exports = router;
