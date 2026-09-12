-- ============================================================
-- Sistema de Agendamento para Barbearia do Evandro
-- Script de criação das tabelas, índices, trigger e views
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nivel_acesso VARCHAR(20) NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS barbeiros (
    id_barbeiro SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) NULL,
    instagram VARCHAR(100) NULL,
    horario_inicio TIME NOT NULL DEFAULT '09:00',
    horario_fim TIME NOT NULL DEFAULT '18:00',
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS servicos (
    id_servico SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    duracao_minutos INTEGER NOT NULL DEFAULT 30,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(150) NULL,
    data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id_agendamento SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    id_barbeiro INTEGER NOT NULL REFERENCES barbeiros(id_barbeiro) ON DELETE RESTRICT,
    id_servico INTEGER NOT NULL REFERENCES servicos(id_servico) ON DELETE RESTRICT,
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'agendado'
        CHECK (status IN ('agendado','confirmado','concluido','cancelado')),
    observacao TEXT NULL,
    data_criacao TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance em consultas frequentes
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro ON agendamentos(id_barbeiro);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON agendamentos(id_cliente);

-- Impede, no próprio banco, dois agendamentos ativos no mesmo horário/barbeiro
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamento_horario_unico
    ON agendamentos(id_barbeiro, data_agendamento, hora_agendamento)
    WHERE status <> 'cancelado';

-- Trigger de reforço da regra de negócio (defesa em profundidade além do índice único)
CREATE OR REPLACE FUNCTION fn_verifica_conflito_agendamento()
RETURNS TRIGGER AS $$
DECLARE
    qtd_conflitos INTEGER;
BEGIN
    SELECT COUNT(*) INTO qtd_conflitos
    FROM agendamentos
    WHERE id_barbeiro = NEW.id_barbeiro
      AND data_agendamento = NEW.data_agendamento
      AND hora_agendamento = NEW.hora_agendamento
      AND status <> 'cancelado'
      AND id_agendamento <> COALESCE(NEW.id_agendamento, -1);

    IF qtd_conflitos > 0 THEN
        RAISE EXCEPTION 'Horário indisponível para o barbeiro selecionado.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verifica_conflito ON agendamentos;
CREATE TRIGGER trg_verifica_conflito
    BEFORE INSERT OR UPDATE ON agendamentos
    FOR EACH ROW EXECUTE FUNCTION fn_verifica_conflito_agendamento();

-- View: agendamentos do dia
CREATE OR REPLACE VIEW vw_agendamentos_dia AS
SELECT
    a.id_agendamento,
    c.nome AS cliente,
    b.nome AS barbeiro,
    s.nome AS servico,
    a.data_agendamento,
    a.hora_agendamento,
    a.status
FROM agendamentos a
JOIN clientes c ON c.id_cliente = a.id_cliente
JOIN barbeiros b ON b.id_barbeiro = a.id_barbeiro
JOIN servicos s ON s.id_servico = a.id_servico
WHERE a.data_agendamento = CURRENT_DATE
ORDER BY a.hora_agendamento;

-- View: serviços mais realizados
CREATE OR REPLACE VIEW vw_servicos_mais_realizados AS
SELECT
    s.id_servico,
    s.nome,
    COUNT(a.id_agendamento) AS total_realizados
FROM servicos s
LEFT JOIN agendamentos a
    ON a.id_servico = s.id_servico AND a.status = 'concluido'
GROUP BY s.id_servico, s.nome
ORDER BY total_realizados DESC;
