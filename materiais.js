// ============================================================
// materiais.js — catálogo de produtos (materiais) usado na
// emissão de NF-e, com os códigos fiscais necessários (NCM, CFOP).
// ============================================================

let materialEmEdicaoId = null;
let materiaisCache = [];
let rascunhoAtualId = null;

// ── Campos extras (livres, key/valor) ────────────────────────────
function adicionarLinhaExtra(campo) {
  campo = campo || { nome: "", valor: "" };
  const container = document.getElementById("listaCamposExtras");
  const linha = document.createElement("div");
  linha.style.cssText = "display:flex; gap:8px;";
  linha.innerHTML = `
    <input type="text" class="extra-nome" placeholder="Nome do código (ex: cÉnq IPI)" value="${campo.nome || ""}" style="flex:1;" />
    <input type="text" class="extra-valor" placeholder="Valor" value="${campo.valor || ""}" style="flex:1;" />
    <button type="button" class="btn-remover-linha" style="background:none;border:none;color:var(--vermelho);cursor:pointer;font-size:16px;">✕</button>
  `;
  linha.querySelector(".btn-remover-linha").addEventListener("click", () => linha.remove());
  container.appendChild(linha);
}

function lerCamposExtras() {
  return [...document.querySelectorAll("#listaCamposExtras > div")]
    .map((linha) => ({ nome: linha.querySelector(".extra-nome").value.trim(), valor: linha.querySelector(".extra-valor").value.trim() }))
    .filter((c) => c.nome);
}

document.getElementById("btnAddCampoExtra").addEventListener("click", () => adicionarLinhaExtra());

function limparFormulario() {
  materialEmEdicaoId = null;
  rascunhoAtualId = null;
  document.getElementById("campoId").value = "";
  ["campoCodigo", "campoDescricao", "campoNcm", "campoCfop", "campoCest", "campoEan", "campoCstCsosn", "campoValorPadrao"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("campoUnidade").value = "UN";
  document.getElementById("campoOrigem").value = "0";
  document.getElementById("listaCamposExtras").innerHTML = "";
  document.getElementById("tituloFormulario").textContent = "Novo material";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

function preencherFormulario(material) {
  materialEmEdicaoId = material.id;
  rascunhoAtualId = null;
  document.getElementById("campoId").value = material.id;
  document.getElementById("campoCodigo").value = material.codigo || "";
  document.getElementById("campoDescricao").value = material.nome || "";
  document.getElementById("campoNcm").value = material.ncm || "";
  document.getElementById("campoCfop").value = material.cfop || "";
  document.getElementById("campoCest").value = material.cest || "";
  document.getElementById("campoEan").value = material.ean || "";
  document.getElementById("campoOrigem").value = material.origem || "0";
  document.getElementById("campoCstCsosn").value = material.cstCsosn || "";
  document.getElementById("campoUnidade").value = material.unidade || "UN";
  document.getElementById("campoValorPadrao").value = material.valor || "";
  document.getElementById("listaCamposExtras").innerHTML = "";
  (material.camposAdicionais || []).forEach((c) => adicionarLinhaExtra(c));
  document.getElementById("tituloFormulario").textContent = `Editando — ${material.nome}`;
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("btnCancelarEdicao").addEventListener("click", limparFormulario);

// ====================================================
// RASCUNHO AUTOMÁTICO (auto-save)
// ====================================================
function coletarDadosRascunhoMaterial() {
  return {
    id: materialEmEdicaoId,
    codigo: document.getElementById("campoCodigo").value.trim(),
    nome: document.getElementById("campoDescricao").value.trim(),
    ncm: document.getElementById("campoNcm").value.trim(),
    cfop: document.getElementById("campoCfop").value.trim(),
    cest: document.getElementById("campoCest").value.trim(),
    ean: document.getElementById("campoEan").value.trim(),
    origem: document.getElementById("campoOrigem").value,
    cstCsosn: document.getElementById("campoCstCsosn").value.trim(),
    unidade: document.getElementById("campoUnidade").value.trim().toUpperCase() || "UN",
    valor: document.getElementById("campoValorPadrao").value ? Number(document.getElementById("campoValorPadrao").value) : 0,
    camposAdicionais: lerCamposExtras(),
  };
}

function formularioMaterialTemConteudo(d) {
  return !!(d.codigo || d.nome || d.ncm || d.cfop || d.cest || d.ean || d.cstCsosn || d.valor || (d.camposAdicionais && d.camposAdicionais.length));
}

async function salvarRascunhoAtual() {
  const dados = coletarDadosRascunhoMaterial();
  if (!formularioMaterialTemConteudo(dados)) return;
  const resposta = await apiSalvarRascunho("material", rascunhoAtualId, dados);
  if (resposta.ok) { rascunhoAtualId = resposta.id; renderPendentes(); }
}

function salvarRascunhoAtualImediato() {
  const dados = coletarDadosRascunhoMaterial();
  if (!formularioMaterialTemConteudo(dados)) return;
  if (!rascunhoAtualId) rascunhoAtualId = `rascunho_material_${Date.now()}`;
  apiSalvarRascunhoImediato("material", rascunhoAtualId, dados);
}

["campoCodigo", "campoDescricao", "campoNcm", "campoCfop", "campoCest", "campoEan", "campoCstCsosn", "campoUnidade", "campoValorPadrao", "campoOrigem"].forEach((idCampo) => {
  document.getElementById(idCampo).addEventListener("blur", salvarRascunhoAtual);
});
document.getElementById("listaCamposExtras").addEventListener("focusout", salvarRascunhoAtual);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") salvarRascunhoAtualImediato(); });
window.addEventListener("beforeunload", salvarRascunhoAtualImediato);

function preencherFormularioComRascunho(dados, idRascunho) {
  rascunhoAtualId = idRascunho;
  materialEmEdicaoId = dados.id || null;
  document.getElementById("campoId").value = dados.id || "";
  document.getElementById("campoCodigo").value = dados.codigo || "";
  document.getElementById("campoDescricao").value = dados.nome || "";
  document.getElementById("campoNcm").value = dados.ncm || "";
  document.getElementById("campoCfop").value = dados.cfop || "";
  document.getElementById("campoCest").value = dados.cest || "";
  document.getElementById("campoEan").value = dados.ean || "";
  document.getElementById("campoOrigem").value = dados.origem || "0";
  document.getElementById("campoCstCsosn").value = dados.cstCsosn || "";
  document.getElementById("campoUnidade").value = dados.unidade || "UN";
  document.getElementById("campoValorPadrao").value = dados.valor || "";
  document.getElementById("listaCamposExtras").innerHTML = "";
  (dados.camposAdicionais || []).forEach((c) => adicionarLinhaExtra(c));
  document.getElementById("tituloFormulario").textContent = dados.nome ? `Continuando rascunho — ${dados.nome}` : "Continuando rascunho";
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function renderPendentes() {
  const resposta = await apiListarRascunhos("material");
  const bloco = document.getElementById("blocoPendentes");
  const listaEl = document.getElementById("listaPendentes");
  if (!bloco || !listaEl) return;
  if (!resposta.ok || !resposta.rascunhos || resposta.rascunhos.length === 0) {
    bloco.style.display = "none";
    listaEl.innerHTML = "";
    return;
  }
  bloco.style.display = "block";
  listaEl.innerHTML = "";
  resposta.rascunhos.forEach((r) => {
    const d = r.dados || {};
    const dataFormatada = new Date(r.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const el = document.createElement("div");
    el.className = "item-contato";
    el.innerHTML = `
      <div>
        <div class="nome">${escaparHtml(d.nome) || "(sem descrição)"} <span class="badge-tipo" style="background:#FEF3DC;color:#7A5300;">Pendente</span></div>
        <div class="meta">Salvo automaticamente em ${dataFormatada}</div>
      </div>
      <div class="acoes">
        <button class="btn-continuar-rascunho">Continuar editando</button>
        <button class="btn-excluir-rascunho">Excluir</button>
      </div>
    `;
    el.querySelector(".btn-continuar-rascunho").addEventListener("click", () => preencherFormularioComRascunho(d, r.id));
    el.querySelector(".btn-excluir-rascunho").addEventListener("click", async () => {
      const ok = await confirmarAcao("Excluir rascunho pendente?", "Essa ação não pode ser desfeita.");
      if (!ok) return;
      await apiExcluirRascunho("material", r.id);
      renderPendentes();
    });
    listaEl.appendChild(el);
  });
}

document.getElementById("btnSalvarMaterial").addEventListener("click", async () => {
  const nome = document.getElementById("campoDescricao").value.trim();
  if (!nome) { mostrarToast("Informe a descrição do material.", "erro"); return; }

  const ncm = document.getElementById("campoNcm").value.trim();
  if (ncm && !/^\d{8}$/.test(ncm)) {
    mostrarToast("NCM precisa ter exatamente 8 dígitos numéricos, ou deixe em branco.", "erro");
    return;
  }

  const botao = document.getElementById("btnSalvarMaterial");
  const textoOriginal = botao.textContent;
  botao.disabled = true;

  try {
    const dados = {
      id: materialEmEdicaoId,
      codigo: document.getElementById("campoCodigo").value.trim(),
      nome,
      ncm,
      cfop: document.getElementById("campoCfop").value.trim(),
      cest: document.getElementById("campoCest").value.trim(),
      ean: document.getElementById("campoEan").value.trim(),
      origem: document.getElementById("campoOrigem").value,
      cstCsosn: document.getElementById("campoCstCsosn").value.trim(),
      unidade: document.getElementById("campoUnidade").value.trim().toUpperCase() || "UN",
      valor: document.getElementById("campoValorPadrao").value ? Number(document.getElementById("campoValorPadrao").value) : 0,
      camposAdicionais: lerCamposExtras(),
    };
    const resposta = await apiSalvarMaterial(dados);
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao salvar.", "erro"); return; }
    mostrarToast("Material salvo.");
    if (rascunhoAtualId) { await apiExcluirRascunho("material", rascunhoAtualId); rascunhoAtualId = null; }
    limparFormulario();
    carregarMateriais();
    renderPendentes();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

async function carregarMateriais() {
  const resposta = await apiListarMateriais();
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar materiais.", "erro"); return; }
  materiaisCache = resposta.materiais;
  renderizarLista();
}

function renderizarLista() {
  const busca = document.getElementById("buscaMateriais").value.trim().toLowerCase();
  let filtrados = materiaisCache;
  if (busca) {
    filtrados = filtrados.filter((m) =>
      (m.nome || "").toLowerCase().includes(busca) ||
      (m.codigo || "").toLowerCase().includes(busca) ||
      (m.ncm || "").includes(busca)
    );
  }

  const lista = document.getElementById("listaMateriais");
  const vazio = document.getElementById("vazioMateriais");
  lista.innerHTML = "";

  if (filtrados.length === 0) { vazio.style.display = "block"; return; }
  vazio.style.display = "none";

  filtrados.forEach((m) => {
    const el = document.createElement("div");
    el.className = "item-contato";
    const valorFmt = m.valor ? Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
    const partesMeta = [m.ncm ? "NCM " + m.ncm : "NCM não informado", m.unidade];
    if (m.cstCsosn) partesMeta.push("CST/CSOSN " + m.cstCsosn);
    if (valorFmt) partesMeta.push(valorFmt);
    if (m.camposAdicionais && m.camposAdicionais.length) partesMeta.push(`+${m.camposAdicionais.length} código(s) extra`);
    el.innerHTML = `
      <div>
        <div class="nome">${escaparHtml(m.nome)} <span class="badge-tipo">${escaparHtml(m.codigo)}</span></div>
        <div class="meta">${escaparHtml(partesMeta.join(" · "))}</div>
      </div>
      <div class="acoes">
        <button class="btn-editar-material">Editar</button>
        <button class="btn-excluir-material">Excluir</button>
      </div>
    `;
    el.querySelector(".btn-editar-material").addEventListener("click", () => preencherFormulario(m));
    el.querySelector(".btn-excluir-material").addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir "${m.nome}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirMaterial(m.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Excluído.");
      carregarMateriais();
    });
    lista.appendChild(el);
  });
}

document.getElementById("buscaMateriais").addEventListener("input", renderizarLista);

carregarMateriais();
renderPendentes();