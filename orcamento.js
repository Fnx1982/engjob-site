// ============================================================
// orcamento.js
// Mostra apenas propostas com status === "orcamento".
// Ao enviar para análise, o status muda e o item desaparece
// desta lista, passando a aparecer em propostas.html.
// ============================================================

const STATUS_DESTA_PAGINA = ["orcamento"];

const listaPropostasEl = document.getElementById("listaPropostas");
const semResultadosEl = document.getElementById("semResultados");
const buscaInput = document.getElementById("buscaTexto");
const filtroMes = document.getElementById("filtroMes");
const filtroAno = document.getElementById("filtroAno");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const btnNovoOrcamento = document.getElementById("btnNovoOrcamento");

const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function propostasDestaPagina() {
  return lerPropostas().filter((p) => STATUS_DESTA_PAGINA.includes(p.status));
}

function popularFiltrosMesAno() {
  const todas = propostasDestaPagina();
  const anos = [...new Set(todas.map((p) => new Date(p.criadoEm).getFullYear()))].sort((a, b) => b - a);

  const mesAtual = filtroMes.value;
  filtroMes.innerHTML = '<option value="todos">Todos</option>';
  NOMES_MESES.forEach((nome, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = nome;
    filtroMes.appendChild(opt);
  });
  filtroMes.value = mesAtual || "todos";

  const anoAtual = filtroAno.value;
  filtroAno.innerHTML = '<option value="todos">Todos</option>';
  anos.forEach((ano) => {
    const opt = document.createElement("option");
    opt.value = String(ano);
    opt.textContent = ano;
    filtroAno.appendChild(opt);
  });
  filtroAno.value = anoAtual || "todos";
}

function aplicarFiltros() {
  const termo = buscaInput.value.trim().toLowerCase();
  const mesSel = filtroMes.value;
  const anoSel = filtroAno.value;

  return propostasDestaPagina().filter((p) => {
    const data = new Date(p.criadoEm);
    const buscaOK =
      termo === "" ||
      (p.cliente || "").toLowerCase().includes(termo) ||
      (p.local || "").toLowerCase().includes(termo) ||
      (p.servico || "").toLowerCase().includes(termo);
    const mesOK = mesSel === "todos" || data.getMonth() === parseInt(mesSel, 10);
    const anoOK = anoSel === "todos" || data.getFullYear() === parseInt(anoSel, 10);
    return buscaOK && mesOK && anoOK;
  });
}

function renderLista() {
  popularFiltrosMesAno();
  const itens = aplicarFiltros().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  listaPropostasEl.innerHTML = "";

  if (itens.length === 0) {
    semResultadosEl.style.display = "block";
    return;
  }
  semResultadosEl.style.display = "none";

  itens.forEach((p) => {
    const card = document.createElement("div");
    card.className = `proposta-card status-${corStatus(p)}`;
    const dataFormatada = new Date(p.criadoEm).toLocaleDateString("pt-BR");

    card.innerHTML = `
      <div class="proposta-topo">
        <div>
          <div class="proposta-cliente">${p.cliente || "(sem nome do cliente)"}</div>
          <div class="proposta-servico">${p.servico || ""}</div>
        </div>
        <span class="selo-status ${corStatus(p)}">${rotuloStatus(p)}</span>
      </div>
      <div class="proposta-meta">
        <span>Criado em ${dataFormatada}</span>
        <span class="proposta-total">Total: R$ ${formatarMoeda(totalGeral(p))}</span>
      </div>
      <div class="proposta-acoes">
        <button class="btn-pdf" data-pdf-id="${p.id}">Baixar PDF</button>
        <button class="btn-editar" data-edit-id="${p.id}">Editar</button>
        <button class="btn-aprovar" data-enviar-id="${p.id}">Enviar para Análise</button>
        <button class="btn-excluir-item" data-delete-id="${p.id}">Excluir</button>
      </div>
    `;
    listaPropostasEl.appendChild(card);
  });

  listaPropostasEl.querySelectorAll("[data-pdf-id]").forEach((btn) => {
    btn.addEventListener("click", () => gerarPdfProposta(buscarProposta(btn.dataset.pdfId)));
  });
  listaPropostasEl.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => abrirFormularioProposta(btn.dataset.editId, renderLista));
  });
  listaPropostasEl.querySelectorAll("[data-enviar-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Enviar para análise?", "O orçamento vai para a aba de Propostas, onde pode ser aprovado ou negado.");
      if (!confirmado) return;
      mudarStatusProposta(btn.dataset.enviarId, "analise");
      renderLista();
    });
  });
  listaPropostasEl.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Excluir orçamento?", "Essa ação não pode ser desfeita.");
      if (!confirmado) return;
      excluirProposta(btn.dataset.deleteId);
      renderLista();
    });
  });
}

btnNovoOrcamento.addEventListener("click", () => abrirFormularioProposta(null, renderLista));
buscaInput.addEventListener("input", renderLista);
filtroMes.addEventListener("change", renderLista);
filtroAno.addEventListener("change", renderLista);
btnLimparFiltros.addEventListener("click", () => {
  buscaInput.value = "";
  filtroMes.value = "todos";
  filtroAno.value = "todos";
  renderLista();
});

renderLista();