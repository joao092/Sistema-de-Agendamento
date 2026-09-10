const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { SEGREDO } = require("../middleware/auth");

const router = express.Router();

// POST /api/login — autenticação do administrador
// Regra lógica: SE usuário e senha forem válidos ENTÃO permitir acesso.
// CASO CONTRÁRIO bloquear o acesso e informar que as credenciais são inválidas.
router.post("/login", async (req, res) => {
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
    const senhaConfere = await bcrypt.compare(senha, usuario.senha);

    if (!senhaConfere) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, nome: usuario.nome, nivel_acesso: usuario.nivel_acesso },
      SEGREDO,
      { expiresIn: "8h" }
    );

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: { nome: usuario.nome, nivel_acesso: usuario.nivel_acesso },
    });
  } catch (err) {
    console.error("Erro ao autenticar:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

module.exports = router;
