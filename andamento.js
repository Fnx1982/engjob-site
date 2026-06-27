// ============================================================
// andamento.js
// Mostra propostas com status "andamento" ou "finalizada"
// (ambas têm status === "andamento" ou "finalizada" no campo
// status principal, refletindo statusExecucao). A aba ativa
// filtra entre as duas.
// ============================================================

const listaPropostasEl = document.getElementById("listaPropostas");
const semResultadosEl = document.getElementById("semResultados");
const buscaInput = document.getElementById("buscaTexto");
const filtroMes = document.getElementById("filtroMes");
const filtroAno = document.getElementById("filtroAno");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const abasStatus = document.querySelectorAll("[data-status-aba]");

const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

let abaAtiva = "andamento";

function propostasDestaPagina() {
  return lerPropostas().filter((p) => p.status === "andamento" || p.status === "finalizada");
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
    const abaOK = p.status === abaAtiva;
    return buscaOK && mesOK && anoOK && abaOK;
  });
}

function renderLista() {
  popularFiltrosMesAno();
  const itens = aplicarFiltros().sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));
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

    const botaoStatus =
      p.status === "andamento"
        ? `<button class="btn-finalizar" data-finalizar-id="${p.id}">Marcar como Finalizada</button>
           <button class="btn-negar" data-reverter-id="${p.id}">Voltar para Propostas</button>`
        : `<button class="btn-andamento" data-reabrir-id="${p.id}">Voltar para Em Andamento</button>`;

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
        ${botaoStatus}
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
  listaPropostasEl.querySelectorAll("[data-finalizar-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Marcar como finalizada?", "A obra vai para a aba 'Finalizada'.");
      if (!confirmado) return;
      mudarStatusExecucao(btn.dataset.finalizarId, "finalizada");
      renderLista();
    });
  });
  listaPropostasEl.querySelectorAll("[data-reverter-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Voltar para Propostas?", "A aprovação será desfeita e a proposta volta para 'Em Análise'.");
      if (!confirmado) return;
      reverterParaAnalise(btn.dataset.reverterId);
      renderLista();
    });
  });
  listaPropostasEl.querySelectorAll("[data-reabrir-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Voltar para Em Andamento?", "A obra deixará de estar marcada como finalizada.");
      if (!confirmado) return;
      mudarStatusExecucao(btn.dataset.reabrirId, "andamento");
      renderLista();
    });
  });
  listaPropostasEl.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Excluir obra?", "Essa ação não pode ser desfeita.");
      if (!confirmado) return;
      excluirProposta(btn.dataset.deleteId);
      renderLista();
    });
  });
}

abasStatus.forEach((aba) => {
  aba.addEventListener("click", () => {
    abasStatus.forEach((a) => a.classList.remove("active"));
    aba.classList.add("active");
    abaAtiva = aba.dataset.statusAba;
    renderLista();
  });
});

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