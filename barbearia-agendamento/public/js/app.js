// =========================================================
// Sistema de Agendamento para Barbearia do Evandro — Front-end
// Roteamento simples por hash + consumo da API REST (Node/Express)
// =========================================================

const API_URL = "/api";

// -------- Estado em memória --------
let servicosCache = [];
let barbeiroCache = null;
let horarioSelecionado = null;
let ultimoAgendamentoConfirmado = null;
let secaoAdminAtual = "dashboard";

// -------- Utilidades --------
function formatarMoeda(valor) {
  return "R$ " + Number(valor).toFixed(2).replace(".", ",");
}

function formatarData(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = String(dataISO).substring(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  return String(hora).substring(0, 5);
}

function getToken() {
  return localStorage.getItem("barbearia_token");
}

function getUsuarioAdmin() {
  const bruto = localStorage.getItem("barbearia_usuario");
  return bruto ? JSON.parse(bruto) : null;
}

async function apiFetch(caminho, opcoes = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opcoes.headers || {});
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  const resposta = await fetch(API_URL + caminho, Object.assign({}, opcoes, { headers }));
  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401) {
    // Sessão expirada ou inválida: envia de volta para o login administrativo
    localStorage.removeItem("barbearia_token");
    localStorage.removeItem("barbearia_usuario");
    navegarPara("admin");
  }

  if (!resposta.ok) {
    const erro = new Error(dados.erro || "Ocorreu um erro ao comunicar com o servidor.");
    erro.dados = dados;
    throw erro;
  }
  return dados;
}

// =========================================================
// ROTEAMENTO
// =========================================================
const ROTAS_CLIENTE = ["home", "servicos", "barbeiro", "agendamento", "confirmacao", "contato"];
const ROTAS_ADMIN = ["admin"];

function rotaAtual() {
  const hash = window.location.hash.replace("#/", "").replace("#", "");
  return hash || "home";
}

function navegarPara(rota) {
  window.location.hash = "/" + rota;
}

window.addEventListener("hashchange", renderizarRota);
window.addEventListener("DOMContentLoaded", () => {
  renderizarRota();

  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("aberto"));
  }
});

function renderizarRota() {
  const rota = rotaAtual();
  const app = document.getElementById("app");
  const nav = document.getElementById("site-nav");
  const footer = document.getElementById("site-footer");
  const navLinks = document.getElementById("nav-links");
  if (navLinks) navLinks.classList.remove("aberto");

  const ehAdmin = ROTAS_ADMIN.includes(rota);
  nav.classList.toggle("oculto", ehAdmin);
  footer.classList.toggle("oculto", ehAdmin);

  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("current", a.dataset.rota === rota);
  });

  if (ehAdmin) {
    const token = getToken();
    if (token) {
      montarTemplate("tpl-admin-painel");
      inicializarPainelAdmin();
    } else {
      montarTemplate("tpl-admin-login");
    }
    return;
  }

  if (!ROTAS_CLIENTE.includes(rota)) {
    navegarPara("home");
    return;
  }

  montarTemplate("tpl-" + rota);

  const iniciadores = {
    home: inicializarHome,
    servicos: inicializarServicos,
    barbeiro: inicializarBarbeiro,
    agendamento: inicializarAgendamento,
    confirmacao: inicializarConfirmacao,
  };
  if (iniciadores[rota]) iniciadores[rota]();
}

function montarTemplate(idTemplate) {
  const app = document.getElementById("app");
  const template = document.getElementById(idTemplate);
  app.innerHTML = "";
  app.appendChild(template.content.cloneNode(true));
  window.scrollTo(0, 0);
}

// =========================================================
// TELA: HOME
// =========================================================
async function inicializarHome() {
  const destino = document.getElementById("home-servicos-destaque");
  try {
    const servicos = await carregarServicos();
    const destaque = servicos.slice(0, 3);
    destino.innerHTML = destaque
      .map(
        (s) => `
      <div class="mini-card">
        <h4>${s.nome}</h4>
        <p>${s.descricao || ""}</p>
        <div class="price">${formatarMoeda(s.preco)}</div>
      </div>`
      )
      .join("");
  } catch (err) {
    destino.innerHTML = `<div class="estado-vazio">Não foi possível carregar os serviços no momento.</div>`;
  }
}

// =========================================================
// TELA: SERVIÇOS E PREÇOS
// =========================================================
async function inicializarServicos() {
  const destino = document.getElementById("lista-servicos-completa");
  try {
    const servicos = await carregarServicos();
    if (servicos.length === 0) {
      destino.innerHTML = `<div class="estado-vazio">Nenhum serviço disponível no momento.</div>`;
      return;
    }
    destino.innerHTML = servicos
      .map(
        (s) => `
      <div class="price-item">
        <div>
          <div class="name">${s.nome}</div>
          <div class="meta">${s.duracao_minutos} min${s.descricao ? " · " + s.descricao : ""}</div>
        </div>
        <div class="right">
          <span class="amount">${formatarMoeda(s.preco)}</span>
          <button class="btn btn-ghost" onclick="navegarPara('agendamento')">Agendar</button>
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    destino.innerHTML = `<div class="estado-vazio">Não foi possível carregar os serviços no momento.</div>`;
  }
}

async function carregarServicos() {
  if (servicosCache.length > 0) return servicosCache;
  const dados = await apiFetch("/servicos");
  servicosCache = dados;
  return dados;
}

// =========================================================
// TELA: BARBEIRO
// =========================================================
async function inicializarBarbeiro() {
  const destino = document.getElementById("barber-wrap");
  try {
    const lista = await apiFetch("/barbeiro");
    const barbeiro = lista[0];
    barbeiroCache = barbeiro;
    if (!barbeiro) {
      destino.innerHTML = `<div class="estado-vazio">Nenhum barbeiro cadastrado no momento.</div>`;
      return;
    }
    const tags = (barbeiro.especialidades || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<span class="tag">${t}</span>`)
      .join("");

    destino.innerHTML = `
      <div class="barber-photo"></div>
      <div class="barber-info">
        <p class="eyebrow">Barbeiro responsável</p>
        <h2 class="headline">${barbeiro.nome}</h2>
        <p class="lede">${barbeiro.descricao || ""}</p>
        <div class="tag-row">${tags}</div>
        ${barbeiro.instagram ? `<div class="info-line"><b>Instagram:</b> ${barbeiro.instagram}</div>` : ""}
        <div class="info-line"><b>Atendimento:</b> Terça a sábado, 9h às 19h</div>
      </div>`;
  } catch (err) {
    destino.innerHTML = `<div class="estado-vazio">Não foi possível carregar as informações do barbeiro.</div>`;
  }
}

// =========================================================
// TELA: NOVO AGENDAMENTO
// =========================================================
async function inicializarAgendamento() {
  horarioSelecionado = null;
  const selectServico = document.getElementById("ag-servico");
  const inputData = document.getElementById("ag-data");

  const hoje = new Date().toISOString().substring(0, 10);
  inputData.min = hoje;

  try {
    const servicos = await carregarServicos();
    selectServico.innerHTML =
      '<option value="">Selecione o serviço</option>' +
      servicos
        .map((s) => `<option value="${s.id_servico}">${s.nome} — ${formatarMoeda(s.preco)}</option>`)
        .join("");
  } catch (err) {
    mostrarAviso("ag-aviso", "Não foi possível carregar os serviços.", "erro");
  }

  inputData.addEventListener("change", carregarGradeHorarios);
}

async function carregarGradeHorarios() {
  const data = document.getElementById("ag-data").value;
  const grade = document.getElementById("grade-horarios");
  horarioSelecionado = null;

  if (!data) {
    grade.innerHTML = `<div class="estado-vazio">Selecione uma data para ver os horários.</div>`;
    return;
  }

  grade.innerHTML = `<div class="estado-vazio">Carregando horários...</div>`;

  try {
    const dados = await apiFetch(`/horarios-disponiveis?data=${data}&id_barbeiro=1`);
    grade.innerHTML = dados
      .map(
        (h) => `
      <div class="slot${h.disponivel ? "" : " taken"}" data-hora="${h.hora}"
           onclick="${h.disponivel ? "selecionarHorario(this)" : ""}">${h.hora}</div>`
      )
      .join("");
  } catch (err) {
    grade.innerHTML = `<div class="estado-vazio">Não foi possível carregar os horários. Tente novamente.</div>`;
  }
}

function selecionarHorario(elemento) {
  document.querySelectorAll("#grade-horarios .slot").forEach((el) => el.classList.remove("selected"));
  elemento.classList.add("selected");
  horarioSelecionado = elemento.dataset.hora;
}

async function confirmarAgendamento() {
  const dados = {
    id_servico: document.getElementById("ag-servico").value,
    id_barbeiro: 1,
    data_agendamento: document.getElementById("ag-data").value,
    hora_agendamento: horarioSelecionado,
    nome_cliente: document.getElementById("ag-nome").value.trim(),
    telefone_cliente: document.getElementById("ag-telefone").value.trim(),
  };

  if (!dados.id_servico || !dados.data_agendamento || !dados.hora_agendamento || !dados.nome_cliente || !dados.telefone_cliente) {
    mostrarAviso("ag-aviso", "Preencha todos os campos e selecione um horário disponível.", "erro");
    return;
  }

  const botao = document.getElementById("ag-confirmar-btn");
  botao.disabled = true;
  botao.textContent = "Confirmando...";

  try {
    const resultado = await apiFetch("/agendamentos", {
      method: "POST",
      body: JSON.stringify(dados),
    });
    ultimoAgendamentoConfirmado = resultado;
    navegarPara("confirmacao");
  } catch (err) {
    mostrarAviso("ag-aviso", err.message, "erro");
    if (err.dados && err.dados.erro && err.dados.erro.includes("indisponível")) {
      carregarGradeHorarios();
    }
  } finally {
    botao.disabled = false;
    botao.textContent = "Confirmar agendamento";
  }
}

function mostrarAviso(idContainer, mensagem, tipo) {
  const container = document.getElementById(idContainer);
  if (!container) return;
  container.innerHTML = `<div class="aviso aviso-${tipo === "erro" ? "erro" : "sucesso"}">${mensagem}</div>`;
}

// =========================================================
// TELA: CONFIRMAÇÃO
// =========================================================
function inicializarConfirmacao() {
  const destino = document.getElementById("confirm-detalhes");
  if (!ultimoAgendamentoConfirmado) {
    destino.innerHTML = `<div class="detail-row"><span>Nenhum agendamento recente encontrado.</span></div>`;
    return;
  }
  const a = ultimoAgendamentoConfirmado;
  destino.innerHTML = `
    <div class="detail-row"><span>Serviço</span><span>${a.servico}</span></div>
    <div class="detail-row"><span>Barbeiro</span><span>${a.barbeiro}</span></div>
    <div class="detail-row"><span>Data</span><span>${formatarData(a.data_agendamento)}</span></div>
    <div class="detail-row"><span>Horário</span><span>${formatarHora(a.hora_agendamento)}</span></div>
    <div class="detail-row"><span>Total</span><span>${formatarMoeda(a.preco)}</span></div>`;
}

// =========================================================
// ADMINISTRAÇÃO — LOGIN
// =========================================================
async function fazerLogin() {
  const nome = document.getElementById("login-nome").value.trim();
  const senha = document.getElementById("login-senha").value;
  const erroContainer = document.getElementById("login-erro");
  const botao = document.getElementById("login-btn");

  erroContainer.innerHTML = "";

  if (!nome || !senha) {
    erroContainer.innerHTML = `<div class="login-erro">Informe usuário e senha.</div>`;
    return;
  }

  botao.disabled = true;
  botao.textContent = "Entrando...";

  try {
    const resultado = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ nome, senha }),
    });
    localStorage.setItem("barbearia_token", resultado.token);
    localStorage.setItem("barbearia_usuario", JSON.stringify(resultado.usuario));
    renderizarRota();
  } catch (err) {
    erroContainer.innerHTML = `<div class="login-erro">${err.message}</div>`;
  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
}

function sairAdmin() {
  localStorage.removeItem("barbearia_token");
  localStorage.removeItem("barbearia_usuario");
  navegarPara("home");
}

// =========================================================
// ADMINISTRAÇÃO — PAINEL
// =========================================================
function inicializarPainelAdmin() {
  trocarSecaoAdmin("dashboard");
}

function trocarSecaoAdmin(secao) {
  secaoAdminAtual = secao;
  document.querySelectorAll(".side-link[data-secao]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.secao === secao);
  });

  const mapa = {
    dashboard: renderizarDashboardAdmin,
    agendamentos: renderizarAgendamentosAdmin,
    servicos: renderizarServicosAdmin,
    barbeiro: renderizarBarbeiroAdmin,
  };
  if (mapa[secao]) mapa[secao]();
}

// -------- Dashboard --------
async function renderizarDashboardAdmin() {
  const conteudo = document.getElementById("admin-conteudo");
  conteudo.innerHTML = `<div class="carregando">Carregando painel...</div>`;

  try {
    const [stats, hoje] = await Promise.all([
      apiFetch("/dashboard"),
      apiFetch(`/agendamentos?data=${new Date().toISOString().substring(0, 10)}`),
    ]);

    conteudo.innerHTML = `
      <div class="crumb">Home / Dashboard</div>
      <h2>Agendamentos de hoje</h2>
      <div class="stat-row">
        <div class="stat-card"><div class="label">Agendamentos hoje</div><div class="value">${stats.agendamentos_hoje}</div></div>
        <div class="stat-card"><div class="label">Confirmados</div><div class="value">${stats.confirmados}</div></div>
        <div class="stat-card"><div class="label">Cancelados</div><div class="value">${stats.cancelados}</div></div>
        <div class="stat-card"><div class="label">Receita do dia</div><div class="value">${formatarMoeda(stats.receita_do_dia)}</div></div>
      </div>
      <div id="tabela-hoje"></div>`;

    document.getElementById("tabela-hoje").innerHTML = montarTabelaAgendamentos(hoje);
  } catch (err) {
    conteudo.innerHTML = `<div class="carregando">Não foi possível carregar o painel: ${err.message}</div>`;
  }
}

// -------- Agendamentos --------
async function renderizarAgendamentosAdmin() {
  const conteudo = document.getElementById("admin-conteudo");
  conteudo.innerHTML = `<div class="carregando">Carregando agendamentos...</div>`;

  try {
    const lista = await apiFetch("/agendamentos");
    conteudo.innerHTML = `
      <div class="crumb">Home / Agendamentos</div>
      <h2>Todos os agendamentos</h2>
      <div id="tabela-agendamentos">${montarTabelaAgendamentos(lista, true)}</div>`;
  } catch (err) {
    conteudo.innerHTML = `<div class="carregando">Não foi possível carregar os agendamentos: ${err.message}</div>`;
  }
}

function montarTabelaAgendamentos(lista, comAcoes) {
  if (!lista || lista.length === 0) {
    return `<div class="carregando">Nenhum agendamento encontrado.</div>`;
  }
  const linhas = lista
    .map(
      (a) => `
    <tr>
      <td>${a.cliente}</td>
      <td>${a.servico}</td>
      <td>${formatarData(a.data_agendamento)} · ${formatarHora(a.hora_agendamento)}</td>
      <td><span class="badge badge-${a.status}">${rotuloStatus(a.status)}</span></td>
      <td>${
        comAcoes
          ? `<select class="status-select" onchange="alterarStatusAgendamento(${a.id_agendamento}, this.value)">
              ${["agendado", "confirmado", "concluido", "cancelado"]
                .map((s) => `<option value="${s}" ${s === a.status ? "selected" : ""}>${rotuloStatus(s)}</option>`)
                .join("")}
            </select>`
          : ""
      }</td>
    </tr>`
    )
    .join("");

  return `
    <table class="agenda">
      <thead><tr><th>Cliente</th><th>Serviço</th><th>Data / Horário</th><th>Status</th><th>${comAcoes ? "Alterar status" : ""}</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function rotuloStatus(status) {
  const rotulos = { agendado: "Agendado", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado" };
  return rotulos[status] || status;
}

async function alterarStatusAgendamento(id, status) {
  try {
    await apiFetch(`/agendamentos/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    trocarSecaoAdmin(secaoAdminAtual);
  } catch (err) {
    alert("Erro ao atualizar status: " + err.message);
  }
}

// -------- Serviços (CRUD) --------
async function renderizarServicosAdmin() {
  const conteudo = document.getElementById("admin-conteudo");
  conteudo.innerHTML = `<div class="carregando">Carregando serviços...</div>`;

  try {
    const lista = await apiFetch("/servicos/todos");
    conteudo.innerHTML = `
      <div class="crumb">Home / Serviços</div>
      <div class="admin-header-row"><h2>Gerenciar serviços</h2></div>

      <div class="admin-form-card">
        <h3>Novo serviço</h3>
        <div class="field-grid">
          <div class="field"><label>Nome</label><input type="text" id="novo-servico-nome" placeholder="Ex: Corte masculino"></div>
          <div class="field"><label>Preço (R$)</label><input type="number" step="0.01" min="0" id="novo-servico-preco" placeholder="40.00"></div>
          <div class="field"><label>Duração (min)</label><input type="number" min="5" id="novo-servico-duracao" placeholder="30"></div>
          <div class="field"><label>Descrição</label><input type="text" id="novo-servico-descricao" placeholder="Opcional"></div>
        </div>
        <div class="form-actions" style="padding:16px 0 0;">
          <button class="btn btn-primary" onclick="cadastrarServico()">Adicionar serviço</button>
        </div>
      </div>

      <table class="agenda">
        <thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${lista
            .map(
              (s) => `
            <tr>
              <td>${s.nome}</td>
              <td>${formatarMoeda(s.preco)}</td>
              <td>${s.duracao_minutos} min</td>
              <td><span class="badge ${s.ativo ? "badge-confirmado" : "badge-cancelado"}">${s.ativo ? "Ativo" : "Inativo"}</span></td>
              <td>
                <button class="row-action" onclick="alternarServicoAtivo(${s.id_servico}, ${!s.ativo})">${s.ativo ? "Desativar" : "Ativar"}</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  } catch (err) {
    conteudo.innerHTML = `<div class="carregando">Não foi possível carregar os serviços: ${err.message}</div>`;
  }
}

async function cadastrarServico() {
  const nome = document.getElementById("novo-servico-nome").value.trim();
  const preco = document.getElementById("novo-servico-preco").value;
  const duracao = document.getElementById("novo-servico-duracao").value;
  const descricao = document.getElementById("novo-servico-descricao").value.trim();

  if (!nome || !preco) {
    alert("Informe ao menos o nome e o preço do serviço.");
    return;
  }

  try {
    await apiFetch("/servicos", {
      method: "POST",
      body: JSON.stringify({
        nome,
        preco: Number(preco),
        duracao_minutos: duracao ? Number(duracao) : 30,
        descricao,
      }),
    });
    servicosCache = []; // força recarregar a lista pública na próxima visita
    renderizarServicosAdmin();
  } catch (err) {
    alert("Erro ao cadastrar serviço: " + err.message);
  }
}

async function alternarServicoAtivo(id, novoStatus) {
  try {
    await apiFetch(`/servicos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ativo: novoStatus }),
    });
    servicosCache = [];
    renderizarServicosAdmin();
  } catch (err) {
    alert("Erro ao atualizar serviço: " + err.message);
  }
}

// -------- Barbeiro --------
async function renderizarBarbeiroAdmin() {
  const conteudo = document.getElementById("admin-conteudo");
  conteudo.innerHTML = `<div class="carregando">Carregando informações do barbeiro...</div>`;

  try {
    const lista = await apiFetch("/barbeiro");
    const b = lista[0];
    if (!b) {
      conteudo.innerHTML = `<div class="carregando">Nenhum barbeiro cadastrado.</div>`;
      return;
    }
    conteudo.innerHTML = `
      <div class="crumb">Home / Barbeiro</div>
      <h2>Informações do barbeiro</h2>
      <div class="admin-form-card" style="max-width:620px;">
        <div class="field-grid">
          <div class="field"><label>Nome</label><input type="text" id="barb-nome" value="${b.nome || ""}"></div>
          <div class="field"><label>Telefone / WhatsApp</label><input type="text" id="barb-telefone" value="${b.telefone || ""}"></div>
          <div class="field"><label>Instagram</label><input type="text" id="barb-instagram" value="${b.instagram || ""}"></div>
          <div class="field"><label>Especialidades (separadas por vírgula)</label><input type="text" id="barb-especialidades" value="${b.especialidades || ""}"></div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Descrição</label>
          <textarea id="barb-descricao">${b.descricao || ""}</textarea>
        </div>
        <div class="form-actions" style="padding:16px 0 0;">
          <button class="btn btn-primary" onclick="salvarBarbeiro(${b.id_barbeiro})">Salvar alterações</button>
        </div>
      </div>`;
  } catch (err) {
    conteudo.innerHTML = `<div class="carregando">Não foi possível carregar o barbeiro: ${err.message}</div>`;
  }
}

async function salvarBarbeiro(id) {
  const dados = {
    nome: document.getElementById("barb-nome").value.trim(),
    telefone: document.getElementById("barb-telefone").value.trim(),
    instagram: document.getElementById("barb-instagram").value.trim(),
    especialidades: document.getElementById("barb-especialidades").value.trim(),
    descricao: document.getElementById("barb-descricao").value.trim(),
  };
  try {
    await apiFetch(`/barbeiro/${id}`, { method: "PUT", body: JSON.stringify(dados) });
    barbeiroCache = null;
    alert("Informações atualizadas com sucesso.");
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}
