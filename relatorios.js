// ============================================================
// relatorios.js
// Lê dados já existentes do Financeiro de Funcionários e do
// Extrato Bancário (qualquer um dos 3 bancos) direto do
// localStorage, aplica os filtros configurados, e gera um PDF
// com jsPDF + autotable. Guarda um histórico de configurações
// salvas, que podem ser reabertas e editadas (o que regenera
// o PDF) ou excluídas.
// ============================================================

const CHAVE_RELATORIOS = "relatorios_salvos";

// Mapeia o valor do <select> de banco para as chaves usadas
// nas páginas de extrato (extrato.js usa esse mesmo padrão).
const BANCOS = {
  "extrato-mensal": { nome: "Interbanking", chaveLancamentos: "extrato_interbanking_lancamentos", chaveClassificacoes: "extrato_interbanking_classificacoes" },
  "extrato-anual": { nome: "Sicredi", chaveLancamentos: "extrato_sicredi_lancamentos", chaveClassificacoes: "extrato_sicredi_classificacoes" },
  "extrato-personalizado": { nome: "Credcrea", chaveLancamentos: "extrato_credcrea_lancamentos", chaveClassificacoes: "extrato_credcrea_classificacoes" },
};

// ====================================================
// ELEMENTOS
// ====================================================
const listaRelatorios = document.getElementById("listaRelatorios");
const semRelatorios = document.getElementById("semRelatorios");
const btnNovoRelatorio = document.getElementById("btnNovoRelatorio");

const modalRelatorio = document.getElementById("modalRelatorio");
const tituloModalRelatorio = document.getElementById("tituloModalRelatorio");
const fecharModalRelatorio = document.getElementById("fecharModalRelatorio");
const btnCancelarRelatorio = document.getElementById("btnCancelarRelatorio");
const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
const nomeRelatorioInput = document.getElementById("nomeRelatorio");

const btnTipoFuncionarios = document.getElementById("btnTipoFuncionarios");
const btnTipoExtrato = document.getElementById("btnTipoExtrato");
const btnTipoMateriais = document.getElementById("btnTipoMateriais");
const btnTipoObras = document.getElementById("btnTipoObras");
const btnTipoCombinado = document.getElementById("btnTipoCombinado");
const secaoFuncionarios = document.getElementById("secaoFuncionarios");
const secaoExtrato = document.getElementById("secaoExtrato");
const secaoMateriais = document.getElementById("secaoMateriais");
const secaoObras = document.getElementById("secaoObras");

const bancosExtratoSel = new Set(); // vazio = nenhum banco ainda (obrigatório escolher ao menos um)
const tipoLancamentoExtratoSelect = document.getElementById("tipoLancamentoExtrato");

// ====================================================
// ESTADO
// ====================================================
let relatorios = JSON.parse(localStorage.getItem(CHAVE_RELATORIOS)) || [];
let idEditando = null; // id do relatório sendo editado, ou null se for novo
let tipoSelecionado = "funcionarios";

let mesesFuncSel = new Set();
let obrasFuncSel = new Set();
let nomesFuncSel = new Set();
let classificacoesExtratoSel = new Set();
let setoresMaterialSel = new Set();
let obrasRelatorioSel = new Set(); // vazio = todas as obras

// ====================================================
// LEITURA DOS DADOS EXISTENTES (Funcionários / Extrato)
// ====================================================
function lerFuncionarios() {
  return JSON.parse(localStorage.getItem("financeiro")) || [];
}
function lerObrasFinanceiro() {
  return JSON.parse(localStorage.getItem("obrasFinanceiro")) || [];
}
function lerExtrato(bancoKey) {
  const banco = BANCOS[bancoKey];
  if (!banco) return { lancamentos: [], classificacoes: [] };
  return {
    lancamentos: JSON.parse(localStorage.getItem(banco.chaveLancamentos)) || [],
    classificacoes: JSON.parse(localStorage.getItem(banco.chaveClassificacoes)) || [],
  };
}
function lerMateriais() {
  return JSON.parse(localStorage.getItem("materiais_lista")) || [];
}
function lerSetoresMaterial() {
  return JSON.parse(localStorage.getItem("materiais_setores")) || [];
}

// ====================================================
// MODAL — abrir / fechar
// ====================================================
function abrirModal() {
  modalRelatorio.classList.add("active");
}
function fecharModal() {
  modalRelatorio.classList.remove("active");
}

btnNovoRelatorio.addEventListener("click", () => {
  idEditando = null;
  nomeRelatorioInput.value = "";
  mesesFuncSel.clear();
  obrasFuncSel.clear();
  nomesFuncSel.clear();
  classificacoesExtratoSel.clear();
  bancosExtratoSel.clear();
  tipoLancamentoExtratoSelect.value = "todos";
  setoresMaterialSel.clear();
  buscaMaterialInput.value = "";
  obrasRelatorioSel.clear();
  definirTipo("funcionarios");
  tituloModalRelatorio.textContent = "Novo Relatório";
  btnSalvarRelatorio.textContent = "Salvar e Gerar PDF";
  atualizarOpcoesMultiSelect();
  abrirModal();
});

fecharModalRelatorio.addEventListener("click", fecharModal);
btnCancelarRelatorio.addEventListener("click", fecharModal);
modalRelatorio.addEventListener("click", (e) => {
  if (e.target === modalRelatorio) fecharModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharModal();
});

// ====================================================
// TOGGLE DE TIPO (Funcionários / Extrato / Combinado)
// ====================================================
function definirTipo(tipo) {
  tipoSelecionado = tipo;
  [btnTipoFuncionarios, btnTipoExtrato, btnTipoMateriais, btnTipoObras, btnTipoCombinado].forEach((b) => b.classList.remove("active"));
  if (tipo === "funcionarios") btnTipoFuncionarios.classList.add("active");
  if (tipo === "extrato") btnTipoExtrato.classList.add("active");
  if (tipo === "materiais") btnTipoMateriais.classList.add("active");
  if (tipo === "obras") btnTipoObras.classList.add("active");
  if (tipo === "combinado") btnTipoCombinado.classList.add("active");

  // "Combinado" reúne Funcionários + Extrato. Materiais e Obras são
  // abas próprias, separadas (não entram no Combinado por enquanto).
  secaoFuncionarios.style.display = tipo === "funcionarios" || tipo === "combinado" ? "block" : "none";
  secaoExtrato.style.display = tipo === "extrato" || tipo === "combinado" ? "block" : "none";
  secaoMateriais.style.display = tipo === "materiais" ? "block" : "none";
  secaoObras.style.display = tipo === "obras" ? "block" : "none";
}
btnTipoFuncionarios.addEventListener("click", () => definirTipo("funcionarios"));
btnTipoExtrato.addEventListener("click", () => definirTipo("extrato"));
btnTipoMateriais.addEventListener("click", () => definirTipo("materiais"));
btnTipoObras.addEventListener("click", () => definirTipo("obras"));
btnTipoCombinado.addEventListener("click", () => definirTipo("combinado"));

// ====================================================
// MULTI-SELECT GENÉRICO (reaproveitado)
// ====================================================
function configurarMultiSelect({ painel, toggle, container, resumoEl, getOpcoes, selecionados, labelTodos, onChange, rotulo }) {
  const obterRotulo = rotulo || ((valor) => valor);

  function renderPainel() {
    const opcoes = getOpcoes();
    painel.innerHTML = "";
    if (opcoes.length === 0) {
      painel.innerHTML = '<div class="multi-select-vazio">Nenhuma opção disponível.</div>';
      return;
    }
    opcoes.forEach((opcao) => {
      const linha = document.createElement("label");
      linha.className = "multi-select-opcao";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selecionados.has(opcao);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selecionados.add(opcao);
        else selecionados.delete(opcao);
        atualizarResumo();
        if (onChange) onChange();
      });
      linha.appendChild(checkbox);
      linha.appendChild(document.createTextNode(obterRotulo(opcao)));
      painel.appendChild(linha);
    });

    const acoes = document.createElement("div");
    acoes.className = "multi-select-acoes";
    const btnTodos = document.createElement("button");
    btnTodos.type = "button";
    btnTodos.textContent = "Todos";
    btnTodos.addEventListener("click", () => {
      opcoes.forEach((o) => selecionados.add(o));
      renderPainel();
      atualizarResumo();
      if (onChange) onChange();
    });
    const btnLimpar = document.createElement("button");
    btnLimpar.type = "button";
    btnLimpar.textContent = "Limpar";
    btnLimpar.addEventListener("click", () => {
      selecionados.clear();
      renderPainel();
      atualizarResumo();
      if (onChange) onChange();
    });
    acoes.appendChild(btnTodos);
    acoes.appendChild(btnLimpar);
    painel.appendChild(acoes);
  }

  function atualizarResumo() {
    if (selecionados.size === 0) resumoEl.textContent = labelTodos;
    else if (selecionados.size === 1) resumoEl.textContent = obterRotulo([...selecionados][0]);
    else resumoEl.textContent = `${selecionados.size} selecionados`;
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const estavaAberto = container.classList.contains("open");
    document.querySelectorAll(".multi-select.open").forEach((el) => el.classList.remove("open"));
    if (!estavaAberto) {
      renderPainel();
      container.classList.add("open");
    }
  });
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) container.classList.remove("open");
  });

  atualizarResumo();
  return { renderPainel, atualizarResumo };
}

const msMesFunc = configurarMultiSelect({
  painel: document.getElementById("painelMesFunc"),
  toggle: document.getElementById("toggleMesFunc"),
  container: document.getElementById("multiMesFunc"),
  resumoEl: document.getElementById("resumoMesFunc"),
  getOpcoes: () => ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],
  selecionados: mesesFuncSel,
  labelTodos: "Todos",
});

const msObraFunc = configurarMultiSelect({
  painel: document.getElementById("painelObraFunc"),
  toggle: document.getElementById("toggleObraFunc"),
  container: document.getElementById("multiObraFunc"),
  resumoEl: document.getElementById("resumoObraFunc"),
  getOpcoes: () => lerObrasFinanceiro(),
  selecionados: obrasFuncSel,
  labelTodos: "Todas",
});

const msNomeFunc = configurarMultiSelect({
  painel: document.getElementById("painelNomeFunc"),
  toggle: document.getElementById("toggleNomeFunc"),
  container: document.getElementById("multiNomeFunc"),
  resumoEl: document.getElementById("resumoNomeFunc"),
  getOpcoes: () => [...new Set(lerFuncionarios().map((f) => f.nome))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  selecionados: nomesFuncSel,
  labelTodos: "Todos",
});

const msBancoExtrato = configurarMultiSelect({
  painel: document.getElementById("painelBancoExtrato"),
  toggle: document.getElementById("toggleBancoExtrato"),
  container: document.getElementById("multiBancoExtrato"),
  resumoEl: document.getElementById("resumoBancoExtrato"),
  getOpcoes: () => Object.keys(BANCOS), // ["extrato-mensal", "extrato-anual", "extrato-personalizado"]
  rotulo: (key) => BANCOS[key].nome,
  selecionados: bancosExtratoSel,
  labelTodos: "Selecione",
  onChange: () => {
    classificacoesExtratoSel.clear();
    msClassificacaoExtrato.atualizarResumo();
  },
});

const msClassificacaoExtrato = configurarMultiSelect({
  painel: document.getElementById("painelClassificacaoExtrato"),
  toggle: document.getElementById("toggleClassificacaoExtrato"),
  container: document.getElementById("multiClassificacaoExtrato"),
  resumoEl: document.getElementById("resumoClassificacaoExtrato"),
  getOpcoes: () => {
    // Junta (sem repetir) as classificações de todos os bancos selecionados.
    const todasClassificacoes = new Set();
    bancosExtratoSel.forEach((key) => {
      lerExtrato(key).classificacoes.forEach((c) => todasClassificacoes.add(c));
    });
    return [...todasClassificacoes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  },
  selecionados: classificacoesExtratoSel,
  labelTodos: "Todas",
});

const msSetorMaterial = configurarMultiSelect({
  painel: document.getElementById("painelSetorMaterial"),
  toggle: document.getElementById("toggleSetorMaterial"),
  container: document.getElementById("multiSetorMaterial"),
  resumoEl: document.getElementById("resumoSetorMaterial"),
  getOpcoes: () => lerSetoresMaterial(),
  selecionados: setoresMaterialSel,
  labelTodos: "Todos",
});

const buscaMaterialInput = document.getElementById("buscaMaterial");

const msObrasRelatorio = configurarMultiSelect({
  painel: document.getElementById("painelObrasRelatorio"),
  toggle: document.getElementById("toggleObrasRelatorio"),
  container: document.getElementById("multiObrasRelatorio"),
  resumoEl: document.getElementById("resumoObrasRelatorio"),
  getOpcoes: () => lerObras().map((o) => o.id),
  rotulo: (id) => {
    const obra = buscarObra(id);
    if (!obra) return id;
    return `${obra.cliente || "(sem cliente)"} — ${obra.servico || ""}`.trim();
  },
  selecionados: obrasRelatorioSel,
  labelTodos: "Todas",
});

function atualizarOpcoesMultiSelect() {
  // Força reconstrução das opções (ex: obras/classificações podem ter mudado)
  msMesFunc.atualizarResumo();
  msObraFunc.atualizarResumo();
  msNomeFunc.atualizarResumo();
  msBancoExtrato.atualizarResumo();
  msClassificacaoExtrato.atualizarResumo();
  msSetorMaterial.atualizarResumo();
  msObrasRelatorio.atualizarResumo();
}

// ====================================================
// SALVAR CONFIGURAÇÃO DO RELATÓRIO (histórico)
// ====================================================
function salvarRelatorios() {
  localStorage.setItem(CHAVE_RELATORIOS, JSON.stringify(relatorios));
}

btnSalvarRelatorio.addEventListener("click", () => {
  limparErrosDoFormulario(modalRelatorio);

  const nome = nomeRelatorioInput.value.trim();
  let temErro = false;

  if (!nome) {
    marcarCampoComErro(nomeRelatorioInput, "Dê um nome para o relatório.");
    temErro = true;
  }

  if ((tipoSelecionado === "extrato" || tipoSelecionado === "combinado") && bancosExtratoSel.size === 0) {
    marcarCampoComErro(document.getElementById("toggleBancoExtrato"), "Selecione ao menos um banco.");
    temErro = true;
  }

  if (temErro) {
    focarPrimeiroErro(modalRelatorio);
    return;
  }

  const config = {
    id: idEditando || `rel_${Date.now()}`,
    nome,
    tipo: tipoSelecionado,
    criadoEm: idEditando ? buscarRelatorio(idEditando).criadoEm : new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    filtrosFuncionarios: {
      meses: [...mesesFuncSel],
      obras: [...obrasFuncSel],
      nomes: [...nomesFuncSel],
    },
    filtrosExtrato: {
      bancos: [...bancosExtratoSel],
      tipoLancamento: tipoLancamentoExtratoSelect.value,
      classificacoes: [...classificacoesExtratoSel],
    },
    filtrosMateriais: {
      setores: [...setoresMaterialSel],
      busca: buscaMaterialInput.value.trim(),
    },
    filtrosObras: {
      obraIds: [...obrasRelatorioSel],
    },
  };

  if (idEditando) {
    const idx = relatorios.findIndex((r) => r.id === idEditando);
    if (idx !== -1) relatorios[idx] = config;
  } else {
    relatorios.push(config);
  }

  salvarRelatorios();
  fecharModal();
  renderListaRelatorios();
  gerarPDF(config);
});

function buscarRelatorio(id) {
  return relatorios.find((r) => r.id === id);
}

// ====================================================
// EDITAR / EXCLUIR
// ====================================================
function editarRelatorio(id) {
  const r = buscarRelatorio(id);
  if (!r) return;

  idEditando = id;
  nomeRelatorioInput.value = r.nome;
  definirTipo(r.tipo);

  // IMPORTANTE: mutamos os Sets existentes (clear + add) em vez de
  // reatribuir com "new Set(...)" — os componentes multi-select foram
  // configurados apontando para essas instâncias específicas, então
  // trocar a referência faria os checkboxes pararem de refletir o
  // estado real.
  mesesFuncSel.clear();
  r.filtrosFuncionarios.meses.forEach((m) => mesesFuncSel.add(m));

  obrasFuncSel.clear();
  r.filtrosFuncionarios.obras.forEach((o) => obrasFuncSel.add(o));

  nomesFuncSel.clear();
  r.filtrosFuncionarios.nomes.forEach((n) => nomesFuncSel.add(n));

  bancosExtratoSel.clear();
  // Retrocompatibilidade: relatórios salvos antes desta atualização
  // guardavam um único "banco" (string). Os novos guardam "bancos" (array).
  if (Array.isArray(r.filtrosExtrato.bancos)) {
    r.filtrosExtrato.bancos.forEach((b) => bancosExtratoSel.add(b));
  } else if (r.filtrosExtrato.banco) {
    bancosExtratoSel.add(r.filtrosExtrato.banco);
  }
  tipoLancamentoExtratoSelect.value = r.filtrosExtrato.tipoLancamento;

  classificacoesExtratoSel.clear();
  r.filtrosExtrato.classificacoes.forEach((c) => classificacoesExtratoSel.add(c));

  setoresMaterialSel.clear();
  // Retrocompatibilidade: relatórios salvos antes de Materiais existir
  // não têm filtrosMateriais.
  if (r.filtrosMateriais) {
    r.filtrosMateriais.setores.forEach((s) => setoresMaterialSel.add(s));
    buscaMaterialInput.value = r.filtrosMateriais.busca || "";
  } else {
    buscaMaterialInput.value = "";
  }

  obrasRelatorioSel.clear();
  // Retrocompatibilidade: relatórios salvos antes de Obras existir
  // não têm filtrosObras.
  if (r.filtrosObras) {
    r.filtrosObras.obraIds.forEach((id) => obrasRelatorioSel.add(id));
  }

  atualizarOpcoesMultiSelect();

  tituloModalRelatorio.textContent = "Editar Relatório";
  btnSalvarRelatorio.textContent = "Salvar Alterações e Gerar PDF";
  abrirModal();
}

async function excluirRelatorio(id) {
  const r = buscarRelatorio(id);
  if (!r) return;
  const confirmado = await confirmarAcao(
    `Excluir o relatório "${r.nome}"?`,
    "Essa ação não pode ser desfeita."
  );
  if (!confirmado) return;
  relatorios = relatorios.filter((rel) => rel.id !== id);
  salvarRelatorios();
  renderListaRelatorios();
}

function baixarPdfDeNovo(id) {
  const r = buscarRelatorio(id);
  if (!r) return;
  gerarPDF(r);
}

// ====================================================
// RENDER DA LISTA DE RELATÓRIOS SALVOS
// ====================================================
function formatarDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function rotuloTipo(tipo) {
  if (tipo === "funcionarios") return "Funcionários";
  if (tipo === "extrato") return "Extrato";
  if (tipo === "materiais") return "Materiais";
  if (tipo === "obras") return "Obras";
  return "Combinado";
}

function renderListaRelatorios() {
  listaRelatorios.innerHTML = "";

  if (relatorios.length === 0) {
    semRelatorios.style.display = "block";
    return;
  }
  semRelatorios.style.display = "none";

  const ordenados = [...relatorios].sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

  ordenados.forEach((r) => {
    const card = document.createElement("div");
    card.className = "relatorio-card";

    const bancosKeys = Array.isArray(r.filtrosExtrato.bancos)
      ? r.filtrosExtrato.bancos
      : (r.filtrosExtrato.banco ? [r.filtrosExtrato.banco] : []);
    const bancosNomes = bancosKeys.filter((k) => BANCOS[k]).map((k) => BANCOS[k].nome).join(", ");

    card.innerHTML = `
      <div class="relatorio-info">
        <div class="relatorio-nome">${r.nome}</div>
        <div class="relatorio-meta">
          <span class="tag-tipo ${r.tipo}">${rotuloTipo(r.tipo)}</span>
          ${ (r.tipo === "extrato" || r.tipo === "combinado") && bancosNomes ? `<span>Banco(s): ${bancosNomes}</span>` : "" }
          <span>Atualizado em ${formatarDataHora(r.atualizadoEm)}</span>
        </div>
      </div>
      <div class="relatorio-acoes">
        <button class="btn-pdf" data-pdf-id="${r.id}">Baixar PDF</button>
        <button class="btn-editar" data-edit-id="${r.id}">Editar</button>
        <button class="btn-excluir-item" data-delete-id="${r.id}">Excluir</button>
      </div>
    `;
    listaRelatorios.appendChild(card);
  });

  listaRelatorios.querySelectorAll("[data-pdf-id]").forEach((btn) => {
    btn.addEventListener("click", () => baixarPdfDeNovo(btn.dataset.pdfId));
  });
  listaRelatorios.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => editarRelatorio(btn.dataset.editId));
  });
  listaRelatorios.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => excluirRelatorio(btn.dataset.deleteId));
  });
}

// ====================================================
// GERAÇÃO DO PDF
// ====================================================
function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatarDataBR(isoDate) {
  if (!isoDate) return "";
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function filtrarFuncionarios(config) {
  const { meses, obras, nomes } = config.filtrosFuncionarios;
  return lerFuncionarios().filter((f) => {
    const mesOK = meses.length === 0 || meses.includes(f.mes);
    const obraOK = obras.length === 0 || obras.includes(f.obra);
    const nomeOK = nomes.length === 0 || nomes.includes(f.nome);
    return mesOK && obraOK && nomeOK;
  });
}

function filtrarExtrato(config) {
  const { bancos, tipoLancamento, classificacoes } = config.filtrosExtrato;

  // Para cada banco selecionado, filtra seus lançamentos separadamente —
  // o resultado é uma lista de blocos (um por banco), preservando bancos
  // distintos em tabelas distintas no PDF.
  return bancos.map((bancoKey) => {
    const dados = lerExtrato(bancoKey);
    const itens = dados.lancamentos.filter((l) => {
      const tipoOK = tipoLancamento === "todos" || l.tipo === tipoLancamento;
      const classOK = classificacoes.length === 0 || classificacoes.includes(l.classificacao);
      return tipoOK && classOK;
    });
    return {
      bancoKey,
      bancoNome: BANCOS[bancoKey] ? BANCOS[bancoKey].nome : bancoKey,
      itens,
    };
  });
}

function gerarPDF(config) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margemEsquerda = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(config.nome, margemEsquerda, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margemEsquerda, y);
  doc.setTextColor(0);
  y += 24;

  if (config.tipo === "funcionarios" || config.tipo === "combinado") {
    y = secaoFuncionariosPDF(doc, config, y, margemEsquerda);
  }
  if (config.tipo === "extrato" || config.tipo === "combinado") {
    y = secaoExtratoPDF(doc, config, y, margemEsquerda);
  }
  if (config.tipo === "materiais") {
    y = secaoMateriaisPDF(doc, config, y, margemEsquerda);
  }
  if (config.tipo === "obras") {
    y = secaoObrasPDF(doc, config, y, margemEsquerda);
  }

  const nomeArquivo = config.nome.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "relatorio";
  doc.save(`${nomeArquivo}.pdf`);
}

function garantirEspaco(doc, y, minimo) {
  const alturaPagina = doc.internal.pageSize.getHeight();
  if (y + minimo > alturaPagina - 40) {
    doc.addPage();
    return 50;
  }
  return y;
}

function secaoFuncionariosPDF(doc, config, y, margemEsquerda) {
  y = garantirEspaco(doc, y, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Financeiro de Funcionários", margemEsquerda, y);
  y += 16;

  const itens = filtrarFuncionarios(config);

  if (itens.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum lançamento encontrado com os filtros selecionados.", margemEsquerda, y);
    return y + 20;
  }

  const linhas = itens.map((f) => [
    f.nome,
    f.obra,
    f.mes,
    `R$ ${formatarMoeda(parseFloat(f.valor))}`,
  ]);

  const total = itens.reduce((soma, f) => soma + parseFloat(f.valor || 0), 0);

  doc.autoTable({
    startY: y,
    head: [["Funcionário", "Obra", "Mês", "Valor"]],
    body: linhas,
    margin: { left: margemEsquerda, right: margemEsquerda },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [235, 153, 28] },
    foot: [["", "", "Total", `R$ ${formatarMoeda(total)}`]],
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  return doc.lastAutoTable.finalY + 24;
}

function secaoExtratoPDF(doc, config, y, margemEsquerda) {
  const blocosBanco = filtrarExtrato(config);

  blocosBanco.forEach((bloco) => {
    y = garantirEspaco(doc, y, 60);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Extrato Bancário — ${bloco.bancoNome}`, margemEsquerda, y);
    y += 16;

    if (bloco.itens.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Nenhum lançamento encontrado com os filtros selecionados.", margemEsquerda, y);
      y += 24;
      return;
    }

    const ordenados = [...bloco.itens].sort((a, b) => new Date(a.data) - new Date(b.data));

    const linhas = ordenados.map((l) => [
      formatarDataBR(l.data),
      l.descricao,
      l.classificacao,
      l.tipo === "entrada" ? "Entrada" : "Saída",
      `${l.tipo === "entrada" ? "+" : "-"} R$ ${formatarMoeda(l.valor)}`,
    ]);

    const totalEntradas = ordenados.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
    const totalSaidas = ordenados.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
    const saldo = totalEntradas - totalSaidas;

    doc.autoTable({
      startY: y,
      head: [["Data", "Descrição", "Classificação", "Tipo", "Valor"]],
      body: linhas,
      margin: { left: margemEsquerda, right: margemEsquerda },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [28, 138, 75] },
      foot: [
        ["", "", "", "Entradas", `R$ ${formatarMoeda(totalEntradas)}`],
        ["", "", "", "Saídas", `R$ ${formatarMoeda(totalSaidas)}`],
        ["", "", "", "Saldo", `R$ ${formatarMoeda(saldo)}`],
      ],
      footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    y = doc.lastAutoTable.finalY + 24;
  });

  return y;
}

function filtrarMateriais(config) {
  const { setores, busca } = config.filtrosMateriais;
  const termo = (busca || "").trim().toLowerCase();

  return lerMateriais().filter((m) => {
    const setorOK = setores.length === 0 || setores.includes(m.setor);
    const buscaOK =
      termo === "" ||
      m.nome.toLowerCase().includes(termo) ||
      m.codigo.toLowerCase().includes(termo) ||
      (m.observacao || "").toLowerCase().includes(termo);
    return setorOK && buscaOK;
  });
}

function secaoMateriaisPDF(doc, config, y, margemEsquerda) {
  y = garantirEspaco(doc, y, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Gestão de Materiais", margemEsquerda, y);
  y += 16;

  const itens = filtrarMateriais(config);

  if (itens.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum material encontrado com os filtros selecionados.", margemEsquerda, y);
    return y + 20;
  }

  const ordenados = [...itens].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));

  const linhas = ordenados.map((m) => [
    m.nome,
    m.setor,
    m.codigo,
    `R$ ${formatarMoeda(m.valor)}`,
    String(m.quantidade),
    `R$ ${formatarMoeda(m.valor * m.quantidade)}`,
  ]);

  const totalQuantidade = ordenados.reduce((s, m) => s + Number(m.quantidade || 0), 0);
  const totalValor = ordenados.reduce((s, m) => s + m.valor * m.quantidade, 0);

  doc.autoTable({
    startY: y,
    head: [["Material", "Setor", "Código", "Valor Unit.", "Qtd.", "Subtotal"]],
    body: linhas,
    margin: { left: margemEsquerda, right: margemEsquerda },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [43, 108, 176] },
    foot: [["", "", "", "", "Total", `R$ ${formatarMoeda(totalValor)} (${totalQuantidade} itens)`]],
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  return doc.lastAutoTable.finalY + 24;
}

function obrasFiltradas(config) {
  const { obraIds } = config.filtrosObras;
  const todas = lerObras();
  if (obraIds.length === 0) return todas;
  return todas.filter((o) => obraIds.includes(o.id));
}

function secaoObrasPDF(doc, config, y, margemEsquerda) {
  const obras = obrasFiltradas(config);

  if (obras.length === 0) {
    y = garantirEspaco(doc, y, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhuma obra encontrada com os filtros selecionados.", margemEsquerda, y);
    return y + 20;
  }

  obras.forEach((obra, indice) => {
    y = garantirEspaco(doc, y, 100);

    // ----- Cabeçalho da obra -----
    doc.setFillColor(235, 153, 28);
    doc.rect(margemEsquerda, y, doc.internal.pageSize.getWidth() - margemEsquerda * 2, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${obra.cliente || "(sem cliente)"} — ${obra.servico || ""}`, margemEsquerda + 8, y + 15);
    doc.setTextColor(0, 0, 0);
    y += 32;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Criada em ${new Date(obra.criadoEm).toLocaleDateString("pt-BR")}`, margemEsquerda, y);
    y += 14;

    if (obra.observacao) {
      doc.setFont("helvetica", "bold");
      doc.text("Observação:", margemEsquerda, y);
      doc.setFont("helvetica", "normal");
      const linhasObs = doc.splitTextToSize(obra.observacao, doc.internal.pageSize.getWidth() - margemEsquerda * 2 - 70);
      doc.text(linhasObs, margemEsquerda + 65, y);
      y += 13 * linhasObs.length + 6;
    }

    // ----- Tabela: funcionários -----
    y = garantirEspaco(doc, y, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Funcionários", margemEsquerda, y);
    y += 6;

    const linhasFunc = obra.funcionarios.map((f) => [
      f.nome,
      `R$ ${formatarMoeda(f.valorCobrado)}`,
      `R$ ${formatarMoeda(f.valorPago)}`,
    ]);

    doc.autoTable({
      startY: y,
      head: [["Funcionário", "Cobrado", "Pago"]],
      body: linhasFunc.length ? linhasFunc : [["Nenhum funcionário", "-", "-"]],
      margin: { left: margemEsquerda, right: margemEsquerda },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [92, 92, 92] },
    });
    y = doc.lastAutoTable.finalY + 14;

    // ----- Tabela: materiais -----
    y = garantirEspaco(doc, y, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Materiais anotados", margemEsquerda, y);
    y += 6;

    const linhasMat = obra.materiais.map((m) => [
      m.nome || "-",
      m.codigo || "-",
      `R$ ${formatarMoeda(m.valor)}`,
      m.data ? new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR") : "-",
    ]);

    doc.autoTable({
      startY: y,
      head: [["Material", "Código", "Valor", "Data"]],
      body: linhasMat.length ? linhasMat : [["Nenhum material anotado", "-", "-", "-"]],
      margin: { left: margemEsquerda, right: margemEsquerda },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [92, 92, 92] },
    });
    y = doc.lastAutoTable.finalY + 14;

    // ----- Resumo de lucro da obra -----
    y = garantirEspaco(doc, y, 50);
    const lucroMO = lucroMaoDeObraObra(obra);
    const lucroMat = lucroMaterialObra(obra);
    const lucroTot = lucroTotalObra(obra);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Lucro Mão de Obra: R$ ${formatarMoeda(lucroMO)}`, margemEsquerda, y);
    doc.text(`Lucro Material: R$ ${formatarMoeda(lucroMat)}`, margemEsquerda + 200, y);
    doc.text(`Lucro Total: R$ ${formatarMoeda(lucroTot)}`, margemEsquerda + 380, y);
    y += 20;

    // Linha divisória entre obras (exceto na última)
    if (indice < obras.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margemEsquerda, y, doc.internal.pageSize.getWidth() - margemEsquerda, y);
      y += 20;
    }
  });

  return y;
}

// ====================================================
// INICIALIZAÇÃO
// ====================================================
limparErroAoEditar(nomeRelatorioInput);

definirTipo("funcionarios");
renderListaRelatorios();