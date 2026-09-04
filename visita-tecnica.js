// ============================================================
// visita-tecnica.js
// ============================================================

let visitaEmEdicaoId = null;
let visitasCache = [];
let fotosSelecionadas = []; // arquivos escolhidos, ainda não enviados
let fotosJaSalvas = []; // chaves R2 de fotos já salvas (ao editar uma visita existente)
let rascunhoAtualId = null; // id do rascunho de auto-save em andamento (null = ainda não criado)

const WORKER_URL_VISITA = "https://engjob-storage.engjobmanut.workers.dev";

function uploadFotoVisita(arquivo) {
  return new Promise((resolve, reject) => {
    const chave = `visitas/${Date.now()}_${arquivo.name}`;
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${WORKER_URL_VISITA}?action=put&key=${encodeURIComponent(chave)}`);
    xhr.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
    const token = localStorage.getItem("sessionToken") || "";
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onload = () => { if (xhr.status < 300) resolve(chave); else reject(new Error("Falha ao enviar foto (" + xhr.status + ")")); };
    xhr.onerror = () => reject(new Error("Falha de conexão ao enviar foto"));
    xhr.send(arquivo);
  });
}

function urlFotoVisita(chave) {
  const token = pegarTokenDownloadCache();
  return `${WORKER_URL_VISITA}?action=get&key=${encodeURIComponent(chave)}&token=${encodeURIComponent(token)}`;
}

// ── Máscara de telefone: (41) 9 9999-9999 ──────────────────────
function aplicarMascaraTelefoneVisita(event) {
  let input = event.target;
  let valor = input.value.replace(/\D/g, "");
  if (valor.length > 11) valor = valor.slice(0, 11);
  if (valor.length > 7) valor = valor.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4}).*/, "($1) $2 $3-$4");
  else if (valor.length > 3) valor = valor.replace(/^(\d{2})(\d{1})(\d{0,4})/, "($1) $2 $3");
  else if (valor.length > 2) valor = valor.replace(/^(\d{2})(\d{0,1})/, "($1) $2");
  else if (valor.length > 0) valor = valor.replace(/^(\d{0,2})/, "($1");
  input.value = valor.trim();
}
document.getElementById("campoTelefone").addEventListener("input", aplicarMascaraTelefoneVisita);

// ── Prévia das fotos escolhidas (antes de salvar) ────────────────
document.getElementById("campoFotos").addEventListener("change", (e) => {
  fotosSelecionadas = [...e.target.files];
  renderPreviaFotos();
});

function renderPreviaFotos() {
  const container = document.getElementById("previaFotos");
  container.innerHTML = "";

  fotosJaSalvas.forEach((chave, idx) => {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;";
    wrapper.innerHTML = `
      <img src="${urlFotoVisita(chave)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" />
      <button type="button" class="btn-remover-foto-salva" data-idx="${idx}" style="position:absolute;top:-6px;right:-6px;background:#DC143C;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;">✕</button>
    `;
    wrapper.querySelector(".btn-remover-foto-salva").addEventListener("click", () => {
      fotosJaSalvas.splice(idx, 1);
      renderPreviaFotos();
    });
    container.appendChild(wrapper);
  });

  fotosSelecionadas.forEach((arquivo, idx) => {
    const url = URL.createObjectURL(arquivo);
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;";
    wrapper.innerHTML = `
      <img src="${url}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid var(--laranja);" />
      <button type="button" class="btn-remover-foto-nova" data-idx="${idx}" style="position:absolute;top:-6px;right:-6px;background:#DC143C;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;">✕</button>
    `;
    wrapper.querySelector(".btn-remover-foto-nova").addEventListener("click", () => {
      fotosSelecionadas.splice(idx, 1);
      renderPreviaFotos();
    });
    container.appendChild(wrapper);
  });
}

// ── Formulário: limpar / preencher ──────────────────────────────
function limparFormulario() {
  visitaEmEdicaoId = null;
  rascunhoAtualId = null;
  document.getElementById("campoId").value = "";
  ["campoClienteNome", "campoTelefone", "campoLocal", "campoEndereco", "campoBairro", "campoCidade", "campoDescricao"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  fotosSelecionadas = [];
  fotosJaSalvas = [];
  document.getElementById("campoFotos").value = "";
  renderPreviaFotos();
  document.getElementById("tituloFormulario").textContent = "Nova visita";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

function preencherFormulario(visita) {
  visitaEmEdicaoId = visita.id;
  rascunhoAtualId = null;
  document.getElementById("campoId").value = visita.id;
  document.getElementById("campoClienteNome").value = visita.clienteNome || "";
  document.getElementById("campoTelefone").value = visita.telefone || "";
  document.getElementById("campoLocal").value = visita.local || "";
  document.getElementById("campoEndereco").value = visita.endereco || "";
  document.getElementById("campoBairro").value = visita.bairro || "";
  document.getElementById("campoCidade").value = visita.cidade || "";
  document.getElementById("campoDescricao").value = visita.descricao || "";
  fotosSelecionadas = [];
  fotosJaSalvas = [...(visita.fotos || [])];
  renderPreviaFotos();
  document.getElementById("tituloFormulario").textContent = `Editando — ${visita.clienteNome}`;
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("btnCancelarEdicao").addEventListener("click", limparFormulario);

// ====================================================
// RASCUNHO AUTOMÁTICO (auto-save) — salva sozinho ao sair de
// qualquer campo, e ao trocar/fechar a aba. Fotos ainda não
// enviadas (selecionadas mas sem upload concluído) NÃO entram no
// rascunho — só o que já está de fato no R2.
// ====================================================
function coletarDadosRascunhoVisita() {
  return {
    id: visitaEmEdicaoId,
    clienteNome: document.getElementById("campoClienteNome").value.trim(),
    telefone: document.getElementById("campoTelefone").value.trim(),
    local: document.getElementById("campoLocal").value.trim(),
    endereco: document.getElementById("campoEndereco").value.trim(),
    bairro: document.getElementById("campoBairro").value.trim(),
    cidade: document.getElementById("campoCidade").value.trim(),
    descricao: document.getElementById("campoDescricao").value.trim(),
    fotos: [...fotosJaSalvas],
  };
}

function formularioVisitaTemConteudo(d) {
  return !!(d.clienteNome || d.telefone || d.local || d.endereco || d.bairro || d.cidade || d.descricao || d.fotos.length);
}

async function salvarRascunhoAtual() {
  const dados = coletarDadosRascunhoVisita();
  if (!formularioVisitaTemConteudo(dados)) return;
  const resposta = await apiSalvarRascunho("visita", rascunhoAtualId, dados);
  if (resposta.ok) { rascunhoAtualId = resposta.id; renderPendentes(); }
}

function salvarRascunhoAtualImediato() {
  const dados = coletarDadosRascunhoVisita();
  if (!formularioVisitaTemConteudo(dados)) return;
  if (!rascunhoAtualId) rascunhoAtualId = `rascunho_visita_${Date.now()}`;
  apiSalvarRascunhoImediato("visita", rascunhoAtualId, dados);
}

["campoClienteNome", "campoTelefone", "campoLocal", "campoEndereco", "campoBairro", "campoCidade", "campoDescricao"].forEach((idCampo) => {
  document.getElementById(idCampo).addEventListener("blur", salvarRascunhoAtual);
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") salvarRascunhoAtualImediato(); });
window.addEventListener("beforeunload", salvarRascunhoAtualImediato);

function preencherFormularioComRascunho(dados, idRascunho) {
  rascunhoAtualId = idRascunho;
  visitaEmEdicaoId = dados.id || null;
  document.getElementById("campoId").value = dados.id || "";
  document.getElementById("campoClienteNome").value = dados.clienteNome || "";
  document.getElementById("campoTelefone").value = dados.telefone || "";
  document.getElementById("campoLocal").value = dados.local || "";
  document.getElementById("campoEndereco").value = dados.endereco || "";
  document.getElementById("campoBairro").value = dados.bairro || "";
  document.getElementById("campoCidade").value = dados.cidade || "";
  document.getElementById("campoDescricao").value = dados.descricao || "";
  fotosSelecionadas = [];
  fotosJaSalvas = [...(dados.fotos || [])];
  renderPreviaFotos();
  document.getElementById("tituloFormulario").textContent = dados.clienteNome ? `Continuando rascunho — ${dados.clienteNome}` : "Continuando rascunho";
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function renderPendentes() {
  const resposta = await apiListarRascunhos("visita");
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
        <div class="nome">${escaparHtml(d.clienteNome) || "(sem cliente)"} <span class="badge-tipo" style="background:#FEF3DC;color:#7A5300;">Pendente</span></div>
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
      await apiExcluirRascunho("visita", r.id);
      renderPendentes();
    });
    listaEl.appendChild(el);
  });
}

// ── Salvar ────────────────────────────────────────────────────
document.getElementById("btnSalvarVisita").addEventListener("click", async () => {
  const clienteNome = document.getElementById("campoClienteNome").value.trim();
  if (!clienteNome) { mostrarToast("Informe o cliente.", "erro"); return; }

  const botao = document.getElementById("btnSalvarVisita");
  const textoOriginal = botao.textContent;
  botao.disabled = true;

  try {
    let chavesFotos = [...fotosJaSalvas];
    if (fotosSelecionadas.length > 0) {
      botao.textContent = "Enviando fotos...";
      for (const arquivo of fotosSelecionadas) {
        const chave = await uploadFotoVisita(arquivo);
        chavesFotos.push(chave);
      }
    }

    botao.textContent = "Salvando...";
    const dados = {
      id: visitaEmEdicaoId,
      clienteNome,
      telefone: document.getElementById("campoTelefone").value.trim(),
      local: document.getElementById("campoLocal").value.trim(),
      endereco: document.getElementById("campoEndereco").value.trim(),
      bairro: document.getElementById("campoBairro").value.trim(),
      cidade: document.getElementById("campoCidade").value.trim(),
      descricao: document.getElementById("campoDescricao").value.trim(),
      fotos: chavesFotos,
    };
    const resposta = await apiSalvarVisita(dados);
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao salvar.", "erro"); return; }
    mostrarToast("Visita salva.");
    if (rascunhoAtualId) { await apiExcluirRascunho("visita", rascunhoAtualId); rascunhoAtualId = null; }
    limparFormulario();
    carregarVisitas();
    renderPendentes();
  } catch (e) {
    mostrarToast(e.message || "Erro ao salvar a visita.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

// ── Listar / buscar / excluir / gerar orçamento ──────────────────
async function carregarVisitas() {
  const resposta = await apiListarVisitas();
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar visitas.", "erro"); return; }
  visitasCache = resposta.visitas;
  renderizarLista();
}

function renderizarLista() {
  const busca = document.getElementById("buscaVisitas").value.trim().toLowerCase();
  let filtradas = visitasCache;
  if (busca) {
    filtradas = filtradas.filter((v) =>
      (v.clienteNome || "").toLowerCase().includes(busca) || (v.local || "").toLowerCase().includes(busca)
    );
  }

  const lista = document.getElementById("listaVisitas");
  const vazio = document.getElementById("vazioVisitas");
  lista.innerHTML = "";

  if (filtradas.length === 0) { vazio.style.display = "block"; return; }
  vazio.style.display = "none";

  filtradas.forEach((v) => {
    const el = document.createElement("div");
    el.className = "item-contato";
    const enderecoPartes = [v.local, v.endereco, v.bairro, v.cidade].filter(Boolean).map(escaparHtml).join(" · ");
    const fotoThumb = v.fotos && v.fotos[0] ? `<img src="${urlFotoVisita(v.fotos[0])}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-right:10px;" />` : "";
    el.innerHTML = `
      <div style="display:flex; align-items:center;">
        ${fotoThumb}
        <div>
          <div class="nome">${escaparHtml(v.clienteNome)} ${v.convertidaEmPropostaId ? '<span class="badge-tipo" style="background:#E7F6EC;color:#1C8A4B;">Já virou orçamento</span>' : ""}</div>
          <div class="meta">${enderecoPartes || "Sem endereço"} · ${new Date(v.criadoEm).toLocaleDateString("pt-BR")} · ${v.fotos.length} foto(s)</div>
        </div>
      </div>
      <div class="acoes">
        <button class="btn-editar-visita">Editar</button>
        <button class="btn-gerar-orcamento">📝 Gerar orçamento</button>
        <button class="btn-excluir-visita">Excluir</button>
      </div>
    `;
    el.querySelector(".btn-editar-visita").addEventListener("click", () => preencherFormulario(v));

    el.querySelector(".btn-gerar-orcamento").addEventListener("click", () => {
      const dadosProposta = {
        cliente: v.clienteNome,
        telefone: v.telefone,
        local: [v.local, v.endereco, v.bairro, v.cidade].filter(Boolean).join(", "),
        observacao: v.descricao,
      };
      const codificado = btoa(unescape(encodeURIComponent(JSON.stringify(dadosProposta))));
      navegarParaOrcamento(`orcamento.html?dadosVisita=${encodeURIComponent(codificado)}`);
    });

    el.querySelector(".btn-excluir-visita").addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir a visita de "${v.clienteNome}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirVisita(v.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Excluída.");
      carregarVisitas();
    });

    lista.appendChild(el);
  });
}

document.getElementById("buscaVisitas").addEventListener("input", renderizarLista);

function navegarParaOrcamento(url) {
  window.location.href = url;
}

limparFormulario();
garantirTokenDownload().then(() => {
  carregarVisitas();
  renderPendentes();
});