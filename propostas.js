// ============================================================
// propostas.js
// Mostra propostas com status "analise" ou "negada". Aprovar
// muda o status para "andamento" automaticamente, fazendo o item
// sair desta lista e aparecer em andamento.html.
// ============================================================

const STATUS_DESTA_PAGINA = ["analise", "negada"];

const listaPropostasEl = document.getElementById("listaPropostas");
const semResultadosEl = document.getElementById("semResultados");
const buscaInput = document.getElementById("buscaTexto");
const filtroMes = document.getElementById("filtroMes");
const filtroAno = document.getElementById("filtroAno");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const abasStatus = document.querySelectorAll("[data-status-aba]");

const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── Gatilho de emissão a partir da proposta aprovada ─────────────
// Depois que uma proposta é aprovada, pergunta se a pessoa quer já
// emitir as notas fiscais dela. Materiais viram itens de NF-e,
// mão de obra vira itens de NFS-e — cada um numa aba própria, já
// que são documentos fiscais diferentes.
function valorFinalItemProposta(item) {
  if (item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "") {
    return parseFloat(item.valorFinal) || 0;
  }
  return (parseFloat(item.qtd) || 0) * (parseFloat(item.valorUnit) || 0);
}

function codificarDadosParaUrl(dados) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(dados))));
}

async function oferecerEmissaoDeNotas(proposta) {
  if (!proposta) return;

  const temMateriais = (proposta.itensMateriais || []).some((i) => (i.nome || "").trim());
  const temMaoDeObra = (proposta.itensMaoDeObra || []).some((i) => (i.descricao || "").trim());
  if (!temMateriais && !temMaoDeObra) return; // nada pra faturar, não incomoda com a pergunta

  const dadosNfe = temMateriais ? {
    cliente: proposta.cliente,
    local: proposta.local,
    observacao: proposta.observacao,
    propostaId: proposta.id,
    itens: proposta.itensMateriais
      .filter((i) => (i.nome || "").trim())
      .map((i) => ({ descricao: i.nome, quantidade: parseFloat(i.qtd) || 1, valorUnitario: parseFloat(i.valorUnit) || (valorFinalItemProposta(i) / (parseFloat(i.qtd) || 1)) })),
  } : null;

  const dadosNfse = temMaoDeObra ? {
    cliente: proposta.cliente,
    local: proposta.local,
    observacao: proposta.observacao,
    propostaId: proposta.id,
    itens: proposta.itensMaoDeObra
      .filter((i) => (i.descricao || "").trim())
      .map((i) => ({ descricao: i.descricao, quantidade: parseFloat(i.qtd) || 1, valorUnitario: parseFloat(i.valorUnit) || (valorFinalItemProposta(i) / (parseFloat(i.qtd) || 1)) })),
  } : null;

  // Se a proposta tem só um tipo de item, pergunta direto (sim/não).
  // Se tem os dois, deixa a pessoa escolher qual quer emitir agora —
  // nunca abre as duas de uma vez sem perguntar.
  let destino = null; // "nfe.html?..." ou "nfse.html?..."

  if (temMateriais && !temMaoDeObra) {
    const quer = await confirmarAcao("Deseja emitir a NF-e desta proposta agora?", "Você vai poder conferir tudo antes de qualquer coisa ser enviada.");
    if (quer) destino = `nfe.html?dados=${encodeURIComponent(codificarDadosParaUrl(dadosNfe))}`;
  } else if (temMaoDeObra && !temMateriais) {
    const quer = await confirmarAcao("Deseja emitir a NFS-e desta proposta agora?", "Você vai poder conferir tudo antes de qualquer coisa ser enviada.");
    if (quer) destino = `nfse.html?dados=${encodeURIComponent(codificarDadosParaUrl(dadosNfse))}`;
  } else {
    const escolha = await escolherOpcao(
      "Qual nota você quer emitir?",
      "Esta proposta tem materiais e mão de obra. Escolha uma agora — a outra você pode emitir depois, voltando aqui.",
      ["NF-e (materiais)", "NFS-e (mão de obra)"]
    );
    if (escolha === "NF-e (materiais)") destino = `nfe.html?dados=${encodeURIComponent(codificarDadosParaUrl(dadosNfe))}`;
    else if (escolha === "NFS-e (mão de obra)") destino = `nfse.html?dados=${encodeURIComponent(codificarDadosParaUrl(dadosNfse))}`;
  }

  // Sempre navega na MESMA aba (nunca abre aba nova) — troca a página
  // atual pela tela de emissão da nota escolhida.
  if (destino) navegarParaNota(destino);
}

function navegarParaNota(url) {
  window.location.href = url;
}

let abaAtiva = "todos";

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
    const abaOK = abaAtiva === "todos" || p.status === abaAtiva;
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

    const botoesStatus =
      p.status === "negada"
        ? `<button class="btn-aprovar" data-aprovar-id="${p.id}">Aprovar</button>`
        : `<button class="btn-aprovar" data-aprovar-id="${p.id}">Aprovar</button>
           <button class="btn-negar" data-negar-id="${p.id}">Negar</button>`;

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
        ${botoesStatus}
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
  listaPropostasEl.querySelectorAll("[data-aprovar-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Aprovar esta proposta?", "Ela vai para 'Em Andamento' automaticamente.");
      if (!confirmado) return;
      mudarStatusProposta(btn.dataset.aprovarId, "aprovada");
      renderLista();
      await oferecerEmissaoDeNotas(buscarProposta(btn.dataset.aprovarId));
    });
  });
  listaPropostasEl.querySelectorAll("[data-negar-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Negar esta proposta?", "Ela ficará marcada como negada.");
      if (!confirmado) return;
      mudarStatusProposta(btn.dataset.negarId, "negada");
      renderLista();
    });
  });
  listaPropostasEl.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmado = await confirmarAcao("Excluir proposta?", "Essa ação não pode ser desfeita.");
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