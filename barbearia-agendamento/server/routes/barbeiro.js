const express = require("express");
const pool = require("../db");
const { exigirAutenticacao } = require("../middleware/auth");

const router = express.Router();

// GET /api/barbeiro — dados públicos do barbeiro (tela "Barbeiro" e seleção no agendamento)
router.get("/barbeiro", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM barbeiros WHERE ativo = TRUE ORDER BY id_barbeiro ASC"
    );
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao consultar barbeiro:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// PUT /api/barbeiro/:id — edição das informações do barbeiro (área administrativa)
router.put("/barbeiro/:id", exigirAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { nome, telefone, instagram, especialidades, descricao, ativo } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE barbeiros
       SET nome = COALESCE($1, nome),
           telefone = COALESCE($2, telefone),
           instagram = COALESCE($3, instagram),
           especialidades = COALESCE($4, especialidades),
           descricao = COALESCE($5, descricao),
           ativo = COALESCE($6, ativo)
       WHERE id_barbeiro = $7
       RETURNING *`,
      [nome, telefone, instagram, especialidades, descricao, ativo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Barbeiro não encontrado." });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao editar barbeiro:", err);
    return res.status(500).json({ erro: "Erro ao editar informações do barbeiro." });
  }
});

module.exports = router;
