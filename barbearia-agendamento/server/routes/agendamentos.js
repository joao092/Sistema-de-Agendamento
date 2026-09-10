const express = require("express");
const pool = require("../db");
const { exigirAutenticacao } = require("../middleware/auth");

const router = express.Router();

// Grade de horários de funcionamento: terça a sábado, 9h às 19h, com intervalo de almoço.
const HORARIOS_FUNCIONAMENTO = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];

// GET /api/horarios-disponiveis?data=AAAA-MM-DD&id_barbeiro=1
// Retorna a grade completa de horários, indicando quais já estão ocupados.
router.get("/horarios-disponiveis", async (req, res) => {
  const { data, id_barbeiro } = req.query;

  if (!data) {
    return res.status(400).json({ erro: "Informe a data para consultar os horários." });
  }

  try {
    const barbeiroId = id_barbeiro || 1;
    const resultado = await pool.query(
      `SELECT hora_agendamento FROM agendamentos
       WHERE data_agendamento = $1 AND id_barbeiro = $2 AND status <> 'cancelado'`,
      [data, barbeiroId]
    );
    const ocupados = resultado.rows.map((r) => r.hora_agendamento.substring(0, 5));

    const grade = HORARIOS_FUNCIONAMENTO.map((hora) => ({
      hora,
      disponivel: !ocupados.includes(hora),
    }));

    return res.status(200).json(grade);
  } catch (err) {
    console.error("Erro ao consultar horários:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// POST /api/agendamentos — cria um novo agendamento, validando conflito de horário
// Processamento lógico: Serviço → Data → Horário → Verificação de disponibilidade → Criação.
router.post("/agendamentos", async (req, res) => {
  const {
    id_servico,
    id_barbeiro,
    data_agendamento,
    hora_agendamento,
    nome_cliente,
    telefone_cliente,
    email_cliente,
  } = req.body;

  const barbeiroId = id_barbeiro || 1; // barbeiro único cadastrado nesta versão inicial

  if (!id_servico || !data_agendamento || !hora_agendamento || !nome_cliente || !telefone_cliente) {
    return res.status(400).json({ erro: "Preencha todos os campos obrigatórios e selecione um horário." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let clienteRes = await client.query(
      "SELECT id_cliente FROM clientes WHERE telefone = $1",
      [telefone_cliente]
    );

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

    const query = `
      INSERT INTO agendamentos (id_cliente, id_barbeiro, id_servico, data_agendamento, hora_agendamento)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const resultado = await client.query(query, [
      id_cliente,
      barbeiroId,
      id_servico,
      data_agendamento,
      hora_agendamento,
    ]);

    await client.query("COMMIT");

    // Monta a resposta com os dados completos para a tela de confirmação
    const detalhes = await pool.query(
      `SELECT a.id_agendamento, c.nome AS cliente, s.nome AS servico, s.preco,
              b.nome AS barbeiro, a.data_agendamento, a.hora_agendamento, a.status
       FROM agendamentos a
       JOIN clientes c ON c.id_cliente = a.id_cliente
       JOIN servicos s ON s.id_servico = a.id_servico
       JOIN barbeiros b ON b.id_barbeiro = a.id_barbeiro
       WHERE a.id_agendamento = $1`,
      [resultado.rows[0].id_agendamento]
    );

    return res.status(201).json(detalhes.rows[0]);
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

// GET /api/agendamentos — lista os agendamentos (uso administrativo)
// Suporta filtros opcionais: ?data=AAAA-MM-DD&status=agendado
router.get("/agendamentos", exigirAutenticacao, async (req, res) => {
  const { data, status } = req.query;
  const condicoes = [];
  const valores = [];

  if (data) {
    valores.push(data);
    condicoes.push(`a.data_agendamento = $${valores.length}`);
  }
  if (status) {
    valores.push(status);
    condicoes.push(`a.status = $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

  try {
    const resultado = await pool.query(
      `SELECT a.id_agendamento, c.nome AS cliente, c.telefone AS telefone_cliente,
              s.nome AS servico, s.preco, b.nome AS barbeiro,
              a.data_agendamento, a.hora_agendamento, a.status
       FROM agendamentos a
       JOIN clientes c ON c.id_cliente = a.id_cliente
       JOIN servicos s ON s.id_servico = a.id_servico
       JOIN barbeiros b ON b.id_barbeiro = a.id_barbeiro
       ${where}
       ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC`,
      valores
    );
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error("Erro ao listar agendamentos:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// PUT /api/agendamentos/:id/status — atualiza o status de um agendamento
router.put("/agendamentos/:id/status", exigirAutenticacao, async (req, res) => {
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

// GET /api/dashboard — estatísticas do dia para o painel administrativo
router.get("/dashboard", exigirAutenticacao, async (req, res) => {
  try {
    const hoje = await pool.query(
      `SELECT a.status, s.preco
       FROM agendamentos a
       JOIN servicos s ON s.id_servico = a.id_servico
       WHERE a.data_agendamento = CURRENT_DATE`
    );

    const linhas = hoje.rows;
    const total = linhas.length;
    const confirmados = linhas.filter((l) => l.status === "confirmado").length;
    const cancelados = linhas.filter((l) => l.status === "cancelado").length;
    const receita = linhas
      .filter((l) => l.status !== "cancelado")
      .reduce((soma, l) => soma + Number(l.preco), 0);

    return res.status(200).json({
      agendamentos_hoje: total,
      confirmados,
      cancelados,
      receita_do_dia: receita,
    });
  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

module.exports = router;
