// ============================================================
// servicos.js — cadastro de serviços/mão de obra, usado na
// emissão de NFS-e. Serviços criados automaticamente a partir de
// propostas ou da própria tela de NFS-e também aparecem aqui —
// esta tela serve pra completar os códigos fiscais e organizar.
// ============================================================

let servicoEmEdicaoId = null;
let servicosCache = [];

// ── Campos extras (livres, key/valor) ────────────────────────────
function adicionarLinhaExtra(campo) {
  campo = campo || { nome: "", valor: "" };
  const container = document.getElementById("listaCamposExtras");
  const linha = document.createElement("div");
  linha.style.cssText = "display:flex; gap:8px;";
  linha.innerHTML = `
    <input type="text" class="extra-nome" placeholder="Nome do código" value="${campo.nome || ""}" style="flex:1;" />
    <input type="text" class="extra-valor" placeholder="Valor" value="${campo.valor || ""}" style="flex:1;" />
    <button type="button" class="btn-remover-linha" style="background:none;border:none;color:#DC143C;cursor:pointer;font-size:16px;">✕</button>
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

// ── Formulário: limpar / preencher ──────────────────────────────
function limparFormulario() {
  servicoEmEdicaoId = null;
  document.getElementById("campoId").value = "";
  ["campoNome", "campoValor", "campoCodigoLC116", "campoCnae", "campoAliquotaIss", "campoObservacao"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("campoUnidade").value = "UN";
  document.getElementById("listaCamposExtras").innerHTML = "";
  document.getElementById("tituloFormulario").textContent = "Novo serviço";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

function preencherFormulario(servico) {
  servicoEmEdicaoId = servico.id;
  document.getElementById("campoId").value = servico.id;
  document.getElementById("campoNome").value = servico.nome || "";
  document.getElementById("campoValor").value = servico.valor || "";
  document.getElementById("campoUnidade").value = servico.unidade || "UN";
  document.getElementById("campoCodigoLC116").value = servico.codigoServicoLC116 || "";
  document.getElementById("campoCnae").value = servico.cnae || "";
  document.getElementById("campoAliquotaIss").value = servico.aliquotaIss ?? "";
  document.getElementById("campoObservacao").value = servico.observacao || "";
  document.getElementById("listaCamposExtras").innerHTML = "";
  (servico.camposAdicionais || []).forEach((c) => adicionarLinhaExtra(c));
  document.getElementById("tituloFormulario").textContent = `Editando — ${servico.nome}`;
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("btnCancelarEdicao").addEventListener("click", limparFormulario);

// ── Salvar ────────────────────────────────────────────────────
document.getElementById("btnSalvarServico").addEventListener("click", async () => {
  const nome = document.getElementById("campoNome").value.trim();
  if (!nome) { mostrarToast("Informe a descrição do serviço.", "erro"); return; }

  const botao = document.getElementById("btnSalvarServico");
  const textoOriginal = botao.textContent;
  botao.disabled = true;

  try {
    const dados = {
      id: servicoEmEdicaoId,
      nome,
      valor: document.getElementById("campoValor").value ? Number(document.getElementById("campoValor").value) : 0,
      unidade: document.getElementById("campoUnidade").value.trim().toUpperCase() || "UN",
      codigoServicoLC116: document.getElementById("campoCodigoLC116").value.trim(),
      cnae: document.getElementById("campoCnae").value.trim(),
      aliquotaIss: document.getElementById("campoAliquotaIss").value ? Number(document.getElementById("campoAliquotaIss").value) : null,
      observacao: document.getElementById("campoObservacao").value.trim(),
      camposAdicionais: lerCamposExtras(),
    };
    const resposta = await apiSalvarServico(dados);
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao salvar.", "erro"); return; }
    mostrarToast("Serviço salvo.");
    limparFormulario();
    carregarServicos();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

// ── Listar / buscar / excluir ────────────────────────────────────
async function carregarServicos() {
  const resposta = await apiListarServicos();
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar serviços.", "erro"); return; }
  servicosCache = resposta.servicos;
  renderizarLista();
}

function renderizarLista() {
  const busca = document.getElementById("buscaServicos").value.trim().toLowerCase();
  let filtrados = servicosCache;
  if (busca) {
    filtrados = filtrados.filter((s) =>
      (s.nome || "").toLowerCase().includes(busca) ||
      (s.codigoServicoLC116 || "").toLowerCase().includes(busca) ||
      (s.cnae || "").toLowerCase().includes(busca)
    );
  }

  const lista = document.getElementById("listaServicos");
  const vazio = document.getElementById("vazioServicos");
  lista.innerHTML = "";

  if (filtrados.length === 0) { vazio.style.display = "block"; return; }
  vazio.style.display = "none";

  filtrados.forEach((s) => {
    const el = document.createElement("div");
    el.className = "item-contato";
    const valorFmt = s.valor ? Number(s.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
    const partesMeta = [s.codigoServicoLC116 ? "LC116 " + s.codigoServicoLC116 : "Sem código LC116", s.unidade];
    if (s.aliquotaIss !== null && s.aliquotaIss !== undefined) partesMeta.push("ISS " + s.aliquotaIss + "%");
    if (valorFmt) partesMeta.push(valorFmt);
    if (s.camposAdicionais && s.camposAdicionais.length) partesMeta.push(`+${s.camposAdicionais.length} código(s) extra`);

    el.innerHTML = `
      <div>
        <div class="nome">${s.nome}</div>
        <div class="meta">${partesMeta.join(" · ")}</div>
      </div>
      <div class="acoes">
        <button class="btn-editar-servico">Editar</button>
        <button class="btn-excluir-servico">Excluir</button>
      </div>
    `;
    el.querySelector(".btn-editar-servico").addEventListener("click", () => preencherFormulario(s));
    el.querySelector(".btn-excluir-servico").addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir "${s.nome}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirServico(s.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Excluído.");
      carregarServicos();
    });
    lista.appendChild(el);
  });
}

document.getElementById("buscaServicos").addEventListener("input", renderizarLista);

carregarServicos();