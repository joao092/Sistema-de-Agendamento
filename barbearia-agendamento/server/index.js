require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const rotasServicos = require("./routes/servicos");
const rotasBarbeiro = require("./routes/barbeiro");
const rotasAgendamentos = require("./routes/agendamentos");
const rotasAuth = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

// Front-end estático (HTML, CSS e JavaScript do site e da área administrativa)
app.use(express.static(path.join(__dirname, "..", "public")));

// Rotas da API REST
app.use("/api", rotasServicos);
app.use("/api", rotasBarbeiro);
app.use("/api", rotasAgendamentos);
app.use("/api", rotasAuth);

// Verificação simples de disponibilidade do serviço (útil para o Render)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Qualquer outra rota devolve o index.html, permitindo a navegação da SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor do Sistema de Agendamento da Barbearia do Evandro rodando na porta ${PORT}`);
});
