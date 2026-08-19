// ============================================================
// auth-worker.js — funções de autenticação e dados compartilhados
// via Cloudflare Worker (usa o mesmo Worker do armazenamento).
// ============================================================

const AUTH_WORKER_URL = "https://engjob-storage.engjobmanut.workers.dev";

function pegarToken() {
  return localStorage.getItem("sessionToken") || "";
}

async function chamarWorker(action, { method = "GET", body = null, autenticado = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (autenticado) {
    const token = pegarToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }
  const res = await fetch(`${AUTH_WORKER_URL}?action=${action}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = { ok: false, erro: "Resposta inválida do servidor." }; }
  if (!res.ok && !data.erro) data.erro = "Erro " + res.status;
  return data;
}

// ── Autenticação ─────────────────────────────────────────────
async function apiLogin(registro, senha) {
  return chamarWorker("auth-login", { method: "POST", body: { registro, senha }, autenticado: false });
}

async function apiRegistrar(dados) {
  return chamarWorker("auth-register", { method: "POST", body: dados, autenticado: false });
}

async function apiLogout() {
  await chamarWorker("auth-logout", { method: "POST" });
  localStorage.removeItem("sessionToken");
  localStorage.removeItem("userType");
  localStorage.removeItem("userId");
  localStorage.removeItem("userNome");
  localStorage.removeItem("userSetor");
}

async function apiVerificarSessao() {
  return chamarWorker("auth-session-check");
}

// ── Recuperação de senha ────────────────────────────────────
async function apiSolicitarReset(registro) {
  return chamarWorker("reset-request", { method: "POST", body: { registro }, autenticado: false });
}

async function apiListarResetsPendentes() {
  return chamarWorker("reset-list");
}

async function apiAprovarReset(token, novaSenha) {
  return chamarWorker("reset-approve", { method: "POST", body: { token, novaSenha } });
}

async function apiDescartarReset(token) {
  return chamarWorker("reset-dismiss", { method: "POST", body: { token } });
}

// ── Usuários (admin) ─────────────────────────────────────────
async function apiListarUsuarios() {
  return chamarWorker("users-list");
}

// Versão sem restrição de admin — qualquer usuário logado pode ver a
// lista de colegas (nome/registro/setor), usada em telas como Pontos
// e Relatórios. Não serve para editar/excluir cadastros.
async function apiListarUsuariosBasico() {
  return chamarWorker("users-list-basic");
}

async function apiSalvarUsuario(dados) {
  return chamarWorker("users-save", { method: "POST", body: dados });
}

async function apiExcluirUsuario(registro) {
  return chamarWorker("users-delete", { method: "POST", body: { registro } });
}

// ── Dados compartilhados (setores, permissões) ────────────────
async function apiDataGet(key) {
  const r = await chamarWorker(`data-get&key=${encodeURIComponent(key)}`);
  return r;
}

async function apiDataSet(key, valor) {
  return chamarWorker("data-set", { method: "POST", body: { key, valor } });
}

// ── Salas de reunião fixas ────────────────────────────────────
// Lista filtrada — só as salas que o usuário logado pode acessar.
async function apiListarSalasReuniao() {
  return chamarWorker("salas-list");
}

// ── Notas recebidas (documentos de fornecedores para nosso CNPJ) ──
async function apiListarRecebidos() {
  return chamarWorker("recebidos-list");
}

async function apiSalvarRecebido(dados) {
  return chamarWorker("recebidos-salvar", { method: "POST", body: dados });
}

async function apiExcluirRecebido(id) {
  return chamarWorker("recebidos-excluir", { method: "POST", body: { id } });
}

// ── Notas fiscais (NF-e / NFS-e) ────────────────────────────────
async function apiListarNotasFiscais() {
  return chamarWorker("notas-fiscais-list");
}

async function apiSalvarNotaFiscal(dados) {
  return chamarWorker("notas-fiscais-salvar", { method: "POST", body: dados });
}

async function apiExcluirNotaFiscal(id) {
  return chamarWorker("notas-fiscais-excluir", { method: "POST", body: { id } });
}

async function apiEmitirNotaFiscal(id) {
  return chamarWorker("notas-fiscais-emitir", { method: "POST", body: { id } });
}

// ── Contatos (clientes/fornecedores) ────────────────────────────
async function apiListarContatos() {
  return chamarWorker("contatos-list");
}
async function apiSalvarContato(dados) {
  return chamarWorker("contatos-salvar", { method: "POST", body: dados });
}
async function apiExcluirContato(id) {
  return chamarWorker("contatos-excluir", { method: "POST", body: { id } });
}

// ── Materiais (catálogo de produtos, com NCM/CFOP) ───────────────
async function apiListarMateriais() {
  return chamarWorker("materiais-list");
}
async function apiSalvarMaterial(dados) {
  return chamarWorker("materiais-salvar", { method: "POST", body: dados });
}
async function apiExcluirMaterial(id) {
  return chamarWorker("materiais-excluir", { method: "POST", body: { id } });
}

// ── Serviços / Mão de Obra (catálogo paralelo, para NFS-e) ───────
async function apiListarServicos() {
  return chamarWorker("servicos-list");
}
async function apiSalvarServico(dados) {
  return chamarWorker("servicos-salvar", { method: "POST", body: dados });
}
async function apiExcluirServico(id) {
  return chamarWorker("servicos-excluir", { method: "POST", body: { id } });
}

// ── Vínculo automático entre catálogos e onde os itens são usados ──
// Usado por propostas, NF-e e NFS-e: sempre que um item NOVO (nome
// que ainda não existe no catálogo) é digitado em qualquer uma
// dessas telas, ele é automaticamente cadastrado no catálogo certo
// (Gestão de Material ou Serviços), pra aparecer depois em todas as
// outras telas também — sem precisar cadastrar a mesma coisa de novo
// em lugares diferentes.
async function garantirMaterialNoCatalogo(nome, valor) {
  nome = (nome || "").trim();
  if (!nome) return null;
  const resposta = await apiListarMateriais();
  if (!resposta.ok) return null;
  const existente = resposta.materiais.find((m) => m.nome.trim().toLowerCase() === nome.toLowerCase());
  if (existente) return existente.id;

  const criado = await apiSalvarMaterial({ nome, valor: valor || 0 });
  return criado.ok ? criado.id : null;
}

async function garantirServicoNoCatalogo(nome, valor) {
  nome = (nome || "").trim();
  if (!nome) return null;
  const resposta = await apiListarServicos();
  if (!resposta.ok) return null;
  const existente = resposta.servicos.find((s) => s.nome.trim().toLowerCase() === nome.toLowerCase());
  if (existente) return existente.id;

  const criado = await apiSalvarServico({ nome, valor: valor || 0 });
  return criado.ok ? criado.id : null;
}