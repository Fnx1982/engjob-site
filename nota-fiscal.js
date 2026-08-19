// ============================================================
// nota-fiscal.js — usado por nfe.html e nfse.html. A página que
// inclui este arquivo deve definir TIPO_NOTA_PAGINA ("NF-e" ou
// "NFS-e") antes de carregá-lo.
//
// IMPORTANTE: isso ainda NÃO emite nota fiscal de verdade — só
// organiza os dados para conferência. A emissão real depende do
// certificado digital A1, que ainda não está configurado. O botão
// "Emitir" mostra isso claramente em vez de fingir que funcionou.
// ============================================================

const IMPOSTOS_PADRAO = {
  "NF-e":  [{ nome: "ICMS", percentual: 18 }, { nome: "IPI", percentual: 0 }, { nome: "PIS", percentual: 0.65 }, { nome: "COFINS", percentual: 3 }],
  "NFS-e": [{ nome: "ISS", percentual: 5 }, { nome: "INSS", percentual: 11 }, { nome: "PIS", percentual: 0.65 }, { nome: "COFINS", percentual: 3 }, { nome: "CSLL", percentual: 1 }, { nome: "IRRF", percentual: 1.5 }],
};

let notaEmEdicaoId = null;
let notasCache = [];
let contatosCache = [];
let materiaisCache = [];
let servicosCache = [];

// ── Autocomplete de clientes/fornecedores e materiais/serviços ────
async function carregarAutocompleteContatos() {
  try {
    const resposta = await apiListarContatos();
    if (!resposta.ok) return;
    contatosCache = resposta.contatos;
    const datalist = document.getElementById("listaContatosDatalist");
    if (!datalist) return;
    datalist.innerHTML = contatosCache.map((c) => `<option value="${c.nome}"></option>`).join("");
  } catch (e) { /* autocomplete é um extra — se falhar, formulário continua funcionando normalmente */ }
}

// Quando o nome digitado bate exatamente com um contato cadastrado,
// preenche documento/endereço automaticamente.
function tentarAutopreencherTomador() {
  const nomeDigitado = document.getElementById("campoTomadorNome").value.trim();
  const contato = contatosCache.find((c) => c.nome === nomeDigitado);
  if (!contato) return;
  document.getElementById("campoTomadorDocumento").value = contato.documento || "";
  const enderecoPartes = [contato.logradouro, contato.numero, contato.bairro, contato.cidade, contato.uf].filter(Boolean);
  document.getElementById("campoTomadorEndereco").value = enderecoPartes.join(", ");
}

async function carregarAutocompleteMateriais() {
  try {
    if (TIPO_NOTA_PAGINA === "NF-e") {
      const resposta = await apiListarMateriais();
      if (!resposta.ok) return;
      materiaisCache = resposta.materiais;
      const datalist = document.getElementById("listaMateriaisDatalist");
      if (datalist) datalist.innerHTML = materiaisCache.map((m) => `<option value="${m.nome}"></option>`).join("");
    } else if (TIPO_NOTA_PAGINA === "NFS-e") {
      const resposta = await apiListarServicos();
      if (!resposta.ok) return;
      servicosCache = resposta.servicos;
      const datalist = document.getElementById("listaServicosDatalist");
      if (datalist) datalist.innerHTML = servicosCache.map((s) => `<option value="${s.nome}"></option>`).join("");
    }
  } catch (e) { /* idem — extra, não bloqueia o uso manual */ }
}

// Quando a descrição de um item bate com um material/serviço já
// cadastrado, preenche o valor automaticamente (só se o campo de
// valor ainda estiver zerado, pra não sobrescrever algo digitado).
function tentarAutopreencherItem(linhaTr) {
  const descricao = linhaTr.querySelector(".item-descricao").value.trim();
  const cache = TIPO_NOTA_PAGINA === "NF-e" ? materiaisCache : servicosCache;
  const item = cache.find((i) => i.nome === descricao);
  if (!item || !item.valor) return;
  const campoValor = linhaTr.querySelector(".item-valor-unitario");
  if (!campoValor.value || Number(campoValor.value) === 0) {
    campoValor.value = item.valor;
    recalcularTotais();
  }
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Linhas de itens (materiais ou serviços) ─────────────────────
function adicionarLinhaItem(item) {
  item = item || { descricao: "", quantidade: 1, valorUnitario: 0 };
  const tbody = document.querySelector("#tabelaItens tbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="item-descricao" placeholder="Descrição" value="${item.descricao || ""}" list="listaMateriaisDatalist" /></td>
    <td style="width:90px;"><input type="number" class="item-quantidade" min="0" step="0.01" value="${item.quantidade ?? 1}" /></td>
    <td style="width:130px;"><input type="number" class="item-valor-unitario" min="0" step="0.01" value="${item.valorUnitario ?? 0}" /></td>
    <td class="col-valor item-valor-total">${formatarMoeda((item.quantidade ?? 1) * (item.valorUnitario ?? 0))}</td>
    <td class="col-remover"><button type="button" class="btn-remover-linha" title="Remover">✕</button></td>
  `;
  tr.querySelectorAll(".item-quantidade, .item-valor-unitario").forEach((input) => {
    input.addEventListener("input", recalcularTotais);
  });
  tr.querySelector(".item-descricao").addEventListener("change", () => tentarAutopreencherItem(tr));
  tr.querySelector(".btn-remover-linha").addEventListener("click", () => { tr.remove(); recalcularTotais(); });
  tbody.appendChild(tr);
}

// ── Linhas de impostos ───────────────────────────────────────────
function adicionarLinhaImposto(imposto) {
  imposto = imposto || { nome: "", percentual: 0 };
  const tbody = document.querySelector("#tabelaImpostos tbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="imposto-nome" placeholder="ex: ISS" value="${imposto.nome || ""}" /></td>
    <td style="width:110px;"><input type="number" class="imposto-percentual" min="0" step="0.01" value="${imposto.percentual ?? 0}" /> %</td>
    <td class="col-valor imposto-valor-calculado">${formatarMoeda(0)}</td>
    <td class="col-remover"><button type="button" class="btn-remover-linha" title="Remover">✕</button></td>
  `;
  tr.querySelector(".imposto-percentual").addEventListener("input", recalcularTotais);
  tr.querySelector(".btn-remover-linha").addEventListener("click", () => { tr.remove(); recalcularTotais(); });
  tbody.appendChild(tr);
}

// ── Cálculo de totais ────────────────────────────────────────────
function lerItensDoFormulario() {
  return [...document.querySelectorAll("#tabelaItens tbody tr")].map((tr) => ({
    descricao: tr.querySelector(".item-descricao").value.trim(),
    quantidade: Number(tr.querySelector(".item-quantidade").value) || 0,
    valorUnitario: Number(tr.querySelector(".item-valor-unitario").value) || 0,
  }));
}

function lerImpostosDoFormulario() {
  return [...document.querySelectorAll("#tabelaImpostos tbody tr")].map((tr) => ({
    nome: tr.querySelector(".imposto-nome").value.trim(),
    percentual: Number(tr.querySelector(".imposto-percentual").value) || 0,
  }));
}

function recalcularTotais() {
  // Atualiza o valor de cada linha de item
  document.querySelectorAll("#tabelaItens tbody tr").forEach((tr) => {
    const qtd = Number(tr.querySelector(".item-quantidade").value) || 0;
    const valorUnit = Number(tr.querySelector(".item-valor-unitario").value) || 0;
    tr.querySelector(".item-valor-total").textContent = formatarMoeda(qtd * valorUnit);
  });

  const subtotal = lerItensDoFormulario().reduce((soma, i) => soma + i.quantidade * i.valorUnitario, 0);

  // Atualiza o valor calculado de cada imposto (% sobre o subtotal dos itens)
  let totalImpostos = 0;
  document.querySelectorAll("#tabelaImpostos tbody tr").forEach((tr) => {
    const pct = Number(tr.querySelector(".imposto-percentual").value) || 0;
    const valorCalculado = subtotal * (pct / 100);
    tr.querySelector(".imposto-valor-calculado").textContent = formatarMoeda(valorCalculado);
    totalImpostos += valorCalculado;
  });

  document.getElementById("resumoSubtotal").textContent = formatarMoeda(subtotal);
  document.getElementById("resumoImpostos").textContent = formatarMoeda(totalImpostos);
  document.getElementById("resumoTotal").textContent = formatarMoeda(subtotal + totalImpostos);
}

// ── Preencher / limpar formulário ───────────────────────────────
function limparFormulario() {
  notaEmEdicaoId = null;
  document.getElementById("campoTomadorNome").value = "";
  document.getElementById("campoTomadorDocumento").value = "";
  document.getElementById("campoTomadorEndereco").value = "";
  document.getElementById("campoObservacoes").value = "";
  document.querySelector("#tabelaItens tbody").innerHTML = "";
  document.querySelector("#tabelaImpostos tbody").innerHTML = "";
  adicionarLinhaItem();
  (IMPOSTOS_PADRAO[TIPO_NOTA_PAGINA] || []).forEach((i) => adicionarLinhaImposto(i));
  recalcularTotais();
  document.getElementById("tituloFormulario").textContent = `Nova ${TIPO_NOTA_PAGINA}`;
}

function preencherFormulario(nota) {
  notaEmEdicaoId = nota.id;
  document.getElementById("campoTomadorNome").value = nota.tomadorNome || "";
  document.getElementById("campoTomadorDocumento").value = nota.tomadorDocumento || "";
  document.getElementById("campoTomadorEndereco").value = nota.tomadorEndereco || "";
  document.getElementById("campoObservacoes").value = nota.observacoes || "";
  document.querySelector("#tabelaItens tbody").innerHTML = "";
  document.querySelector("#tabelaImpostos tbody").innerHTML = "";
  (nota.itens && nota.itens.length ? nota.itens : [{}]).forEach((i) => adicionarLinhaItem(i));
  (nota.impostos && nota.impostos.length ? nota.impostos : (IMPOSTOS_PADRAO[TIPO_NOTA_PAGINA] || [])).forEach((i) => adicionarLinhaImposto(i));
  recalcularTotais();
  document.getElementById("tituloFormulario").textContent = `Editando ${TIPO_NOTA_PAGINA} — ${nota.tomadorNome}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Preenchimento vindo de uma proposta aceita (via propostas-core.js),
// passado pela URL como JSON codificado em base64 no parâmetro "dados".
function tentarPreencherAPartirDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const dadosCodificados = params.get("dados");
  if (!dadosCodificados) return;
  try {
    const dados = JSON.parse(decodeURIComponent(escape(atob(dadosCodificados))));
    preencherFormulario({
      tomadorNome: dados.cliente || "",
      tomadorDocumento: "",
      tomadorEndereco: dados.local || "",
      observacoes: dados.observacao || "",
      itens: dados.itens || [],
      propostaId: dados.propostaId || null,
    });
    if (dados.propostaId) {
      const campoOculto = document.getElementById("campoPropostaId");
      if (campoOculto) campoOculto.value = dados.propostaId;
    }
  } catch (e) {
    console.warn("[nota-fiscal] Não foi possível ler os dados da proposta na URL:", e);
  }
}

// ── Salvar rascunho ──────────────────────────────────────────────
async function salvarRascunho() {
  const tomadorNome = document.getElementById("campoTomadorNome").value.trim();
  if (!tomadorNome) { mostrarToast("Informe o cliente/tomador.", "erro"); return; }

  const itens = lerItensDoFormulario().filter((i) => i.descricao);
  if (itens.length === 0) { mostrarToast("Adicione pelo menos um item.", "erro"); return; }

  const botao = document.getElementById("btnSalvarRascunho");
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    const dados = {
      id: notaEmEdicaoId,
      tipo: TIPO_NOTA_PAGINA,
      propostaId: document.getElementById("campoPropostaId")?.value || null,
      tomadorNome,
      tomadorDocumento: document.getElementById("campoTomadorDocumento").value.trim(),
      tomadorEndereco: document.getElementById("campoTomadorEndereco").value.trim(),
      itens,
      impostos: lerImpostosDoFormulario().filter((i) => i.nome),
      observacoes: document.getElementById("campoObservacoes").value.trim(),
      status: "rascunho",
    };
    const resposta = await apiSalvarNotaFiscal(dados);
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao salvar.", "erro"); return; }
    mostrarToast("Rascunho salvo.");
    limparFormulario();
    carregarNotas();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

// ── "Emitir" — hoje mostra claramente que falta o certificado ──────
async function tentarEmitir() {
  // Primeiro salva como rascunho, garantindo que os dados não se percam
  // mesmo a emissão de verdade ainda não sendo possível.
  await salvarRascunhoSilencioso();

  const resposta = await apiEmitirNotaFiscal(notaEmEdicaoId);
  if (!resposta.ok) {
    mostrarToast(resposta.erro || "Não foi possível emitir a nota.", "erro");
    return;
  }
  // (quando o certificado estiver configurado, este caminho vai
  // efetivamente emitir e mostrar o número da nota, protocolo, etc.)
  mostrarToast("Nota emitida com sucesso!");
  limparFormulario();
  carregarNotas();
}

async function salvarRascunhoSilencioso() {
  const tomadorNome = document.getElementById("campoTomadorNome").value.trim();
  if (!tomadorNome) return;
  const dados = {
    id: notaEmEdicaoId,
    tipo: TIPO_NOTA_PAGINA,
    propostaId: document.getElementById("campoPropostaId")?.value || null,
    tomadorNome,
    tomadorDocumento: document.getElementById("campoTomadorDocumento").value.trim(),
    tomadorEndereco: document.getElementById("campoTomadorEndereco").value.trim(),
    itens: lerItensDoFormulario().filter((i) => i.descricao),
    impostos: lerImpostosDoFormulario().filter((i) => i.nome),
    observacoes: document.getElementById("campoObservacoes").value.trim(),
    status: "rascunho",
  };
  const resposta = await apiSalvarNotaFiscal(dados);
  if (resposta.ok) notaEmEdicaoId = resposta.id;
}

// ── Lista de rascunhos/notas salvas ──────────────────────────────
async function carregarNotas() {
  const resposta = await apiListarNotasFiscais();
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar notas.", "erro"); return; }
  notasCache = resposta.notas.filter((n) => n.tipo === TIPO_NOTA_PAGINA);
  renderizarListaNotas();
}

function renderizarListaNotas() {
  const lista = document.getElementById("listaNotas");
  const vazio = document.getElementById("vazioNotas");
  lista.innerHTML = "";

  if (notasCache.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  notasCache.forEach((nota) => {
    const subtotal = (nota.itens || []).reduce((s, i) => s + (i.quantidade || 0) * (i.valorUnitario || 0), 0);
    const totalImpostos = (nota.impostos || []).reduce((s, i) => s + subtotal * ((i.percentual || 0) / 100), 0);

    const el = document.createElement("div");
    el.className = "item-nota-fiscal";
    el.innerHTML = `
      <div>
        <div class="nome-tomador">${nota.tomadorNome} <span class="badge-status ${nota.status}">${nota.status}</span></div>
        <div class="meta">${(nota.itens || []).length} item(ns) · ${new Date(nota.atualizadoEm || nota.criadoEm).toLocaleString("pt-BR")}</div>
      </div>
      <div class="valor">${formatarMoeda(subtotal + totalImpostos)}</div>
      <div class="acoes">
        <button class="btn-abrir-nota">Abrir</button>
        <button class="btn-excluir-nota">Excluir</button>
      </div>
    `;
    el.querySelector(".btn-abrir-nota").addEventListener("click", () => preencherFormulario(nota));
    el.querySelector(".btn-excluir-nota").addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const ok = await confirmarAcao(`Excluir esta ${TIPO_NOTA_PAGINA} de "${nota.tomadorNome}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirNotaFiscal(nota.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Excluída.");
      carregarNotas();
    });
    lista.appendChild(el);
  });
}

// ── Inicialização ────────────────────────────────────────────────
document.getElementById("btnAddItem").addEventListener("click", () => adicionarLinhaItem());
document.getElementById("btnAddImposto").addEventListener("click", () => adicionarLinhaImposto());
document.getElementById("btnSalvarRascunho").addEventListener("click", salvarRascunho);
document.getElementById("btnEmitir").addEventListener("click", tentarEmitir);
document.getElementById("btnNovaNota").addEventListener("click", limparFormulario);
document.getElementById("campoTomadorNome").addEventListener("change", tentarAutopreencherTomador);

limparFormulario();
tentarPreencherAPartirDaUrl();
carregarNotas();
carregarAutocompleteContatos();
carregarAutocompleteMateriais();