// Script de inicialização do banco de dados.
// Executa o schema.sql e cadastra os dados iniciais (seed):
// o barbeiro Evandro, os serviços da barbearia e o usuário administrador.
//
// Uso:
//   npm run db:setup

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function executarSchema() {
  const caminho = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(caminho, "utf8");
  await pool.query(sql);
  console.log("✔ Estrutura do banco criada/atualizada (tabelas, índices, trigger e views).");
}

async function seedBarbeiro() {
  const existente = await pool.query("SELECT id_barbeiro FROM barbeiros LIMIT 1");
  if (existente.rows.length > 0) {
    console.log("→ Barbeiro já cadastrado, etapa ignorada.");
    return;
  }
  await pool.query(
    `INSERT INTO barbeiros (nome, telefone, instagram, especialidades, descricao)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      "Evandro Henrique de Oliveira",
      "+55 12 98185-7618",
      "@barberevandrooliveira",
      "Corte clássico, Degradê, Barba",
      "Mais de 10 anos de experiência em cortes clássicos e modernos, com atendimento personalizado para cada cliente.",
    ]
  );
  console.log("✔ Barbeiro Evandro cadastrado.");
}

async function seedServicos() {
  const existente = await pool.query("SELECT id_servico FROM servicos LIMIT 1");
  if (existente.rows.length > 0) {
    console.log("→ Serviços já cadastrados, etapa ignorada.");
    return;
  }
  const servicos = [
    ["Corte masculino", "Acabamento na máquina e tesoura", 40.0, 30],
    ["Barba", "Toalha quente e navalha", 25.0, 20],
    ["Corte + barba", "O pacote mais pedido", 60.0, 50],
    ["Sobrancelha", "Design e acabamento na navalha", 15.0, 10],
    ["Pézinho", "Acabamento de contorno", 15.0, 10],
  ];
  for (const [nome, descricao, preco, duracao] of servicos) {
    await pool.query(
      `INSERT INTO servicos (nome, descricao, preco, duracao_minutos)
       VALUES ($1, $2, $3, $4)`,
      [nome, descricao, preco, duracao]
    );
  }
  console.log("✔ Serviços iniciais cadastrados.");
}

async function seedAdmin() {
  const nome = process.env.ADMIN_NOME || "evandro";
  const senha = process.env.ADMIN_SENHA || "barbearia123";

  const existente = await pool.query("SELECT id_usuario FROM usuarios WHERE nome = $1", [nome]);
  if (existente.rows.length > 0) {
    console.log("→ Usuário administrador já existe, etapa ignorada.");
    return;
  }
  const hash = await bcrypt.hash(senha, 10);
  await pool.query(
    "INSERT INTO usuarios (nome, senha, nivel_acesso) VALUES ($1, $2, 'admin')",
    [nome, hash]
  );
  console.log(`✔ Usuário administrador criado (login: ${nome}).`);
}

async function main() {
  try {
    await executarSchema();
    await seedBarbeiro();
    await seedServicos();
    await seedAdmin();
    console.log("\nBanco de dados pronto para uso.");
  } catch (err) {
    console.error("Erro ao configurar o banco de dados:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
