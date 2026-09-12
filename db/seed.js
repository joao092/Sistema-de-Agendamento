// Popula o banco de dados com os dados iniciais do projeto:
// - usuário administrador (login do painel)
// - barbeiro Evandro
// - serviços oferecidos pela barbearia
//
// Uso local:   npm run seed
// (lê as mesmas variáveis de ambiente do backend.js, veja .env.example)

require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function seed() {
  console.log("Aplicando schema (db/schema.sql)...");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  console.log("Verificando usuário administrador...");
  const { rows: usuarios } = await pool.query("SELECT * FROM usuarios WHERE nome = $1", ["admin"]);
  if (usuarios.length === 0) {
    const senhaPadrao = process.env.ADMIN_SENHA_INICIAL || "barbearia123";
    const hash = await bcrypt.hash(senhaPadrao, 10);
    await pool.query(
      "INSERT INTO usuarios (nome, senha, nivel_acesso) VALUES ($1, $2, 'admin')",
      ["admin", hash]
    );
    console.log(`Usuário administrador criado -> login: admin | senha: ${senhaPadrao}`);
    console.log("IMPORTANTE: altere essa senha depois de publicar o sistema.");
  } else {
    console.log("Usuário administrador já existe, nenhuma alteração feita.");
  }

  console.log("Verificando barbeiro...");
  const { rows: barbeiros } = await pool.query("SELECT * FROM barbeiros");
  if (barbeiros.length === 0) {
    await pool.query(
      `INSERT INTO barbeiros (nome, telefone, instagram, horario_inicio, horario_fim, ativo)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      ["Evandro Henrique de Oliveira", "+55 12 98185-7618", "@barberevandrooliveira", "09:00", "18:00"]
    );
    console.log("Barbeiro Evandro cadastrado.");
  } else {
    console.log("Barbeiro já cadastrado, nenhuma alteração feita.");
  }

  console.log("Verificando serviços...");
  const { rows: servicos } = await pool.query("SELECT * FROM servicos");
  if (servicos.length === 0) {
    const listaServicos = [
      ["Corte de Cabelo", "Corte tradicional ou moderno, com acabamento na navalha", 40.0, 30],
      ["Barba", "Modelagem e acabamento completo da barba", 30.0, 20],
      ["Corte + Barba", "Combo completo de corte e barba", 65.0, 50],
      ["Sobrancelha", "Design e acabamento de sobrancelha", 15.0, 10],
    ];
    for (const [nome, descricao, preco, duracao] of listaServicos) {
      await pool.query(
        `INSERT INTO servicos (nome, descricao, preco, duracao_minutos, ativo)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [nome, descricao, preco, duracao]
      );
    }
    console.log("Serviços iniciais cadastrados.");
  } else {
    console.log("Serviços já cadastrados, nenhuma alteração feita.");
  }

  console.log("Seed concluído com sucesso.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Erro ao executar o seed:", err);
  process.exit(1);
});
