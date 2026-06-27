// ============================================================
// obra-detalhe.js
// Página de detalhe de uma obra específica: observação,
// funcionários (vinculados ao Financeiro), materiais (anotação
// livre) e os 3 números de lucro.
// ============================================================

function getObraIdDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

const obraId = getObraIdDaUrl();
let obraAtual = buscarObra(obraId);

if (!obraAtual) {
  alert("Obra não encontrada.");
  window.location.href = "obras.html";
}

const tituloObraEl = document.getElementById("tituloObra");
const clienteObraEl = document.getElementById("clienteObra");
const servicoObraEl = document.getElementById("servicoObra");
const campoObservacaoObra = document.getElementById("campoObservacaoObra");

const lucroMaoDeObraValor = document.getElementById("lucroMaoDeObraValor");
const lucroMaoDeObraConta = document.getElementById("lucroMaoDeObraConta");
const lucroMaterialValor = document.getElementById("lucroMaterialValor");
const lucroMaterialConta = document.getElementById("lucroMaterialConta");
const lucroTotalValor = document.getElementById("lucroTotalValor");

const listaFuncionariosObraEl = document.getElementById("listaFuncionariosObra");
const novoFuncNome = document.getElementById("novoFuncNome");
const novoFuncCobrado = document.getElementById("novoFuncCobrado");
const novoFuncPago = document.getElementById("novoFuncPago");
const btnAddFuncionarioObra = document.getElementById("btnAddFuncionarioObra");

const listaMateriaisObraEl = document.getElementById("listaMateriaisObra");
const novoMatNome = document.getElementById("novoMatNome");
const novoMatCodigo = document.getElementById("novoMatCodigo");
const novoMatValor = document.getElementById("novoMatValor");
const novoMatData = document.getElementById("novoMatData");
const btnAddMaterialObra = document.getElementById("btnAddMaterialObra");

// ====================================================
// CABEÇALHO / INFOS
// ====================================================
function renderCabecalho() {
  tituloObraEl.textContent = obraAtual.cliente || "Obra";
  clienteObraEl.textContent = obraAtual.cliente || "(sem nome do cliente)";
  servicoObraEl.textContent = obraAtual.servico || "";
  campoObservacaoObra.value = obraAtual.observacao || "";
}

// Salva a observação automaticamente, com um pequeno debounce
// para não gravar no localStorage a cada tecla digitada.
let debounceObservacao = null;
campoObservacaoObra.addEventListener("input", () => {
  clearTimeout(debounceObservacao);
  debounceObservacao = setTimeout(() => {
    obraAtual.observacao = campoObservacaoObra.value;
    salvarObra(obraAtual);
  }, 500);
});

// ====================================================
// LUCROS
// ====================================================
function renderLucros() {
  const lucroMO = lucroMaoDeObraObra(obraAtual);
  const lucroMat = lucroMaterialObra(obraAtual);
  const lucroTot = lucroTotalObra(obraAtual);

  lucroMaoDeObraValor.textContent = `R$ ${formatarMoeda(lucroMO)}`;
  lucroMaoDeObraValor.className = "valor " + (lucroMO >= 0 ? "positivo" : "negativo");
  lucroMaoDeObraConta.textContent = `Orçamento R$ ${formatarMoeda(obraAtual.valorMaoDeObraOrcamento)} − Pago R$ ${formatarMoeda(totalPagoFuncionariosObra(obraAtual))}`;

  lucroMaterialValor.textContent = `R$ ${formatarMoeda(lucroMat)}`;
  lucroMaterialValor.className = "valor " + (lucroMat >= 0 ? "positivo" : "negativo");
  lucroMaterialConta.textContent = `Orçamento R$ ${formatarMoeda(obraAtual.valorMateriaisOrcamento)} − Gasto R$ ${formatarMoeda(totalGastoMateriaisObra(obraAtual))}`;

  lucroTotalValor.textContent = `R$ ${formatarMoeda(lucroTot)}`;
  lucroTotalValor.className = "valor " + (lucroTot >= 0 ? "positivo" : "negativo");
}

// ====================================================
// FUNCIONÁRIOS DA OBRA
// ====================================================
function renderFuncionarios() {
  listaFuncionariosObraEl.innerHTML = "";

  if (obraAtual.funcionarios.length === 0) {
    listaFuncionariosObraEl.innerHTML = '<p class="texto-ajuda">Nenhum funcionário adicionado ainda.</p>';
    return;
  }

  obraAtual.funcionarios.forEach((f) => {
    const linha = document.createElement("div");
    linha.className = "item-obra-linha";
    linha.innerHTML = `
      <div class="info">
        <strong>${f.nome}</strong><br/>
        Cobrado: R$ ${formatarMoeda(f.valorCobrado)} · Pago: R$ ${formatarMoeda(f.valorPago)}
      </div>
      <div class="acoes">
        <button class="btn-editar" data-edit-func="${f.id}">Editar</button>
        <button class="btn-excluir-item" data-del-func="${f.id}">Excluir</button>
      </div>
    `;
    listaFuncionariosObraEl.appendChild(linha);
  });

  listaFuncionariosObraEl.querySelectorAll("[data-edit-func]").forEach((btn) => {
    btn.addEventListener("click", () => editarFuncionarioInline(btn.dataset.editFunc));
  });
  listaFuncionariosObraEl.querySelectorAll("[data-del-func]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Excluir funcionário desta obra?", "Isso também remove o pagamento vinculado no Financeiro de Funcionários.");
      if (!confirmado) return;
      excluirFuncionarioDaObra(obraAtual.id, btn.dataset.delFunc);
      obraAtual = buscarObra(obraAtual.id);
      renderTudo();
    });
  });
}

function editarFuncionarioInline(funcionarioId) {
  const func = obraAtual.funcionarios.find((f) => f.id === funcionarioId);
  if (!func) return;

  const novoNome = prompt("Nome do funcionário:", func.nome);
  if (novoNome === null) return;
  const novoCobradoStr = prompt("Valor cobrado:", func.valorCobrado);
  if (novoCobradoStr === null) return;
  const novoPagoStr = prompt("Valor pago:", func.valorPago);
  if (novoPagoStr === null) return;

  editarFuncionarioNaObra(obraAtual.id, funcionarioId, {
    nome: novoNome.trim() || func.nome,
    valorCobrado: parseFloat(novoCobradoStr) || 0,
    valorPago: parseFloat(novoPagoStr) || 0,
  });

  obraAtual = buscarObra(obraAtual.id);
  renderTudo();
}

btnAddFuncionarioObra.addEventListener("click", () => {
  const nome = novoFuncNome.value.trim();
  if (!nome) {
    marcarCampoComErro(novoFuncNome, "Informe o nome do funcionário.");
    return;
  }
  limparErroCampo(novoFuncNome);

  const valorCobrado = parseFloat(novoFuncCobrado.value) || 0;
  const valorPago = parseFloat(novoFuncPago.value) || 0;

  adicionarFuncionarioNaObra(obraAtual.id, { nome, valorCobrado, valorPago });
  obraAtual = buscarObra(obraAtual.id);

  novoFuncNome.value = "";
  novoFuncCobrado.value = "";
  novoFuncPago.value = "";

  renderTudo();
});
limparErroAoEditar(novoFuncNome);

// ====================================================
// MATERIAIS DA OBRA
// ====================================================
function renderMateriais() {
  listaMateriaisObraEl.innerHTML = "";

  if (obraAtual.materiais.length === 0) {
    listaMateriaisObraEl.innerHTML = '<p class="texto-ajuda">Nenhum material anotado ainda.</p>';
    return;
  }

  obraAtual.materiais.forEach((m) => {
    const dataFormatada = m.data ? new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR") : "—";
    const linha = document.createElement("div");
    linha.className = "item-obra-linha";
    linha.innerHTML = `
      <div class="info">
        <strong>${m.nome || "(sem nome)"}</strong> ${m.codigo ? `· Código: ${m.codigo}` : ""}<br/>
        Valor: R$ ${formatarMoeda(m.valor)} · Data: ${dataFormatada}
      </div>
      <div class="acoes">
        <button class="btn-editar" data-edit-mat="${m.id}">Editar</button>
        <button class="btn-excluir-item" data-del-mat="${m.id}">Excluir</button>
      </div>
    `;
    listaMateriaisObraEl.appendChild(linha);
  });

  listaMateriaisObraEl.querySelectorAll("[data-edit-mat]").forEach((btn) => {
    btn.addEventListener("click", () => editarMaterialInline(btn.dataset.editMat));
  });
  listaMateriaisObraEl.querySelectorAll("[data-del-mat]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Excluir material anotado?", "Essa ação não pode ser desfeita.");
      if (!confirmado) return;
      excluirMaterialDaObra(obraAtual.id, btn.dataset.delMat);
      obraAtual = buscarObra(obraAtual.id);
      renderTudo();
    });
  });
}

function editarMaterialInline(materialId) {
  const mat = obraAtual.materiais.find((m) => m.id === materialId);
  if (!mat) return;

  const novoNome = prompt("Nome do material:", mat.nome);
  if (novoNome === null) return;
  const novoCodigo = prompt("Código:", mat.codigo);
  if (novoCodigo === null) return;
  const novoValorStr = prompt("Valor:", mat.valor);
  if (novoValorStr === null) return;
  const novaDataStr = prompt("Data (AAAA-MM-DD):", mat.data);
  if (novaDataStr === null) return;

  editarMaterialNaObra(obraAtual.id, materialId, {
    nome: novoNome.trim(),
    codigo: novoCodigo.trim(),
    valor: parseFloat(novoValorStr) || 0,
    data: novaDataStr.trim(),
  });

  obraAtual = buscarObra(obraAtual.id);
  renderTudo();
}

btnAddMaterialObra.addEventListener("click", () => {
  adicionarMaterialNaObra(obraAtual.id, {
    nome: novoMatNome.value.trim(),
    codigo: novoMatCodigo.value.trim(),
    valor: parseFloat(novoMatValor.value) || 0,
    data: novoMatData.value,
  });
  obraAtual = buscarObra(obraAtual.id);

  novoMatNome.value = "";
  novoMatCodigo.value = "";
  novoMatValor.value = "";
  novoMatData.value = "";

  renderTudo();
});

// ====================================================
// INICIALIZAÇÃO
// ====================================================
function renderTudo() {
  renderCabecalho();
  renderLucros();
  renderFuncionarios();
  renderMateriais();
}

renderTudo();