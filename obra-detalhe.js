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
  // Redireciona direto, sem popup bloqueante. O parâmetro avisa a
  // tela de obras para mostrar um aviso discreto, se quiser tratar.
  window.location.href = "obras.html?erro=obra_nao_encontrada";
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
  // Busca a proposta vinculada para pegar número do orçamento e status
  const propostaVinculada = obraAtual.propostaId ? buscarProposta(obraAtual.propostaId) : null;
  const numOrc = propostaVinculada && propostaVinculada.numeroOrcamento
    ? ` — Nº ${propostaVinculada.numeroOrcamento}` : "";
  const statusObra = propostaVinculada
    ? (propostaVinculada.statusObra || propostaVinculada.status || "andamento")
    : "andamento";

  tituloObraEl.textContent = (obraAtual.cliente || "Obra") + numOrc;
  clienteObraEl.textContent = obraAtual.cliente || "(sem nome do cliente)";
  servicoObraEl.textContent = obraAtual.servico || "";
  campoObservacaoObra.value = obraAtual.observacao || "";

  // Renderiza o selo e botão de status
  const statusEl = document.getElementById("statusObraDetalhe");
  if (statusEl) {
    const eFinalizada = statusObra === "finalizada";
    statusEl.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:10px;">
        <span style="background:${eFinalizada ? "#E8F5EF" : "#EBF2FB"};color:${eFinalizada ? "#1c8a4b" : "#2B6CB0"};
          font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;">
          ${eFinalizada ? "✓ Finalizada" : "⚙ Em Andamento"}
        </span>
        <button id="btnAlternarStatusObra" style="background:none;border:1px solid #ccc;border-radius:20px;
          padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#555;">
          ${eFinalizada ? "Reabrir" : "Finalizar Obra"}
        </button>
      </span>
    `;
    document.getElementById("btnAlternarStatusObra").addEventListener("click", async () => {
      if (!propostaVinculada) return;
      const novoStatus = eFinalizada ? "andamento" : "finalizada";
      const ok = await confirmarAcao(
        eFinalizada ? "Reabrir esta obra?" : "Finalizar esta obra?",
        eFinalizada ? "O status volta para Em Andamento." : "A obra será marcada como Finalizada."
      );
      if (!ok) return;
      propostaVinculada.statusObra = novoStatus;
      propostaVinculada.status = novoStatus;
      salvarProposta(propostaVinculada);
      renderCabecalho();
    });
  }
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
// DEMANDAS
// ====================================================
const WORKER_URL_DEMANDAS = "https://engjob-storage.engjobmanut.workers.dev";
let demandasCache = [];
let idDemandaEmConclusao = null;

function uploadFotoDemanda(prefixo, arquivo) {
  return new Promise((resolve, reject) => {
    const chave = `demandas/${prefixo}_${Date.now()}_${arquivo.name}`;
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${WORKER_URL_DEMANDAS}?action=put&key=${encodeURIComponent(chave)}`);
    xhr.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
    const token = localStorage.getItem("sessionToken") || "";
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onload = () => { if (xhr.status < 300) resolve(chave); else reject(new Error("Falha ao enviar a foto (" + xhr.status + ")")); };
    xhr.onerror = () => reject(new Error("Falha de conexão ao enviar a foto"));
    xhr.send(arquivo);
  });
}

function urlFotoDemanda(chave) {
  const token = localStorage.getItem("sessionToken") || "";
  return `${WORKER_URL_DEMANDAS}?action=get&key=${encodeURIComponent(chave)}&token=${encodeURIComponent(token)}`;
}

async function popularSelectAtribuidoDemanda() {
  const select = document.getElementById("novaDemandaAtribuido");
  const resposta = await apiListarUsuariosBasico();
  if (!resposta.ok) return;
  resposta.usuarios.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.registro;
    opt.textContent = u.nome;
    select.appendChild(opt);
  });
}

async function carregarDemandas() {
  const resposta = await apiListarDemandas(obraId);
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar demandas.", "erro"); return; }
  demandasCache = resposta.demandas;
  renderDemandas();
}

function renderDemandas() {
  const lista = document.getElementById("listaDemandasObra");
  lista.innerHTML = "";

  if (demandasCache.length === 0) {
    lista.innerHTML = `<p class="texto-ajuda">Nenhuma demanda ainda.</p>`;
    return;
  }

  const meuRegistro = localStorage.getItem("userId") || "";

  demandasCache.forEach((d) => {
    const el = document.createElement("div");
    el.className = "item-obra-linha";
    const concluida = d.status === "concluida";
    const souEuQueExecuto = d.atribuidoPara === meuRegistro;

    el.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start; width:100%;">
        ${d.fotoChave ? `<img src="${urlFotoDemanda(d.fotoChave)}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;" />` : ""}
        <div style="flex:1;">
          <div style="font-weight:700; font-size:13.5px;">
            ${d.titulo}
            <span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 8px; border-radius:100px; margin-left:6px; background:${concluida ? "#E7F6EC" : "#FEF3DC"}; color:${concluida ? "#1C8A4B" : "#D07F00"};">${concluida ? "Concluída" : "Aberta"}</span>
          </div>
          ${d.descricao ? `<div style="font-size:12px; color:#666; margin-top:2px;">${d.descricao}</div>` : ""}
          <div style="font-size:11px; color:#999; margin-top:4px;">
            Pedido por ${d.criadoPorNome} · Atribuído a ${d.atribuidoParaNome}
          </div>
          ${concluida && d.observacaoConclusao ? `<div style="font-size:12px; color:#1C8A4B; margin-top:4px;">✓ ${d.observacaoConclusao}</div>` : ""}
          ${concluida && d.fotoConclusaoChave ? `<img src="${urlFotoDemanda(d.fotoConclusaoChave)}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;margin-top:6px;" />` : ""}
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${!concluida ? `<button type="button" class="btn-concluir-demanda" data-id="${d.id}" style="background:#1C8A4B;color:#fff;border:none;border-radius:100px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;">✓ Marcar feito</button>` : ""}
          <button type="button" class="btn-excluir-demanda" data-id="${d.id}" style="background:#f7f7f7;border:1px solid #ddd;border-radius:100px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;color:#DC143C;">Excluir</button>
        </div>
      </div>
    `;

    const btnConcluir = el.querySelector(".btn-concluir-demanda");
    if (btnConcluir) {
      btnConcluir.addEventListener("click", () => {
        idDemandaEmConclusao = d.id;
        document.getElementById("fotoConclusaoDemanda").value = "";
        document.getElementById("obsConclusaoDemanda").value = "";
        document.getElementById("modalConcluirDemanda").classList.add("active");
      });
    }

    el.querySelector(".btn-excluir-demanda").addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir a demanda "${d.titulo}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirDemanda(d.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Demanda excluída.");
      carregarDemandas();
    });

    lista.appendChild(el);
  });
}

document.getElementById("btnAddDemanda").addEventListener("click", async () => {
  const titulo = document.getElementById("novaDemandaTitulo").value.trim();
  const atribuidoPara = document.getElementById("novaDemandaAtribuido").value;
  const atribuidoParaNome = document.getElementById("novaDemandaAtribuido").selectedOptions[0]?.textContent || "";
  const descricao = document.getElementById("novaDemandaDescricao").value.trim();
  const arquivoFoto = document.getElementById("novaDemandaFoto").files[0] || null;

  if (!titulo) { mostrarToast("Informe o título/local da demanda.", "erro"); return; }
  if (!atribuidoPara) { mostrarToast("Escolha pra quem atribuir.", "erro"); return; }

  const botao = document.getElementById("btnAddDemanda");
  const textoOriginal = botao.textContent;
  botao.disabled = true;

  try {
    let fotoChave = "";
    if (arquivoFoto) {
      botao.textContent = "Enviando foto...";
      fotoChave = await uploadFotoDemanda("pedido", arquivoFoto);
    }
    botao.textContent = "Salvando...";
    const resposta = await apiSalvarDemanda({ obraId, titulo, descricao, atribuidoPara, atribuidoParaNome, fotoChave });
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao criar demanda.", "erro"); return; }

    mostrarToast("Demanda criada — a pessoa foi avisada.");
    document.getElementById("novaDemandaTitulo").value = "";
    document.getElementById("novaDemandaDescricao").value = "";
    document.getElementById("novaDemandaFoto").value = "";
    document.getElementById("novaDemandaAtribuido").value = "";
    carregarDemandas();
  } catch (e) {
    mostrarToast(e.message || "Erro ao criar demanda.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

document.getElementById("fecharModalConcluirDemanda").addEventListener("click", () => {
  document.getElementById("modalConcluirDemanda").classList.remove("active");
});

document.getElementById("btnConfirmarConclusaoDemanda").addEventListener("click", async () => {
  if (!idDemandaEmConclusao) return;
  const arquivoFoto = document.getElementById("fotoConclusaoDemanda").files[0] || null;
  const observacao = document.getElementById("obsConclusaoDemanda").value.trim();

  const botao = document.getElementById("btnConfirmarConclusaoDemanda");
  const textoOriginal = botao.textContent;
  botao.disabled = true;

  try {
    let fotoConclusaoChave = "";
    if (arquivoFoto) {
      botao.textContent = "Enviando foto...";
      fotoConclusaoChave = await uploadFotoDemanda("conclusao", arquivoFoto);
    }
    botao.textContent = "Confirmando...";
    const resposta = await apiConcluirDemanda(idDemandaEmConclusao, fotoConclusaoChave, observacao);
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao concluir.", "erro"); return; }

    mostrarToast("Demanda concluída — quem pediu foi avisado.");
    document.getElementById("modalConcluirDemanda").classList.remove("active");
    idDemandaEmConclusao = null;
    carregarDemandas();
  } catch (e) {
    mostrarToast(e.message || "Erro ao concluir.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
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
popularSelectAtribuidoDemanda();
carregarDemandas(); 