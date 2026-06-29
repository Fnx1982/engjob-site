// ============================================================
// obras.js
// Lista de obras (criadas automaticamente ao aprovar uma
// proposta), agrupadas por mês/ano de criação. Clicar num card
// abre obra-detalhe.html?id=...
// ============================================================

const gruposMesesEl = document.getElementById("gruposMeses");
const semResultadosEl = document.getElementById("semResultados");
const buscaInput = document.getElementById("buscaTexto");
const filtroAno = document.getElementById("filtroAno");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function popularFiltroAno() {
  const obras = lerObras();
  const anos = [...new Set(obras.map((o) => new Date(o.criadoEm).getFullYear()))].sort((a, b) => b - a);
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
  const anoSel = filtroAno.value;

  return lerObras().filter((o) => {
    const data = new Date(o.criadoEm);
    const buscaOK =
      termo === "" ||
      (o.cliente || "").toLowerCase().includes(termo) ||
      (o.local || "").toLowerCase().includes(termo) ||
      (o.servico || "").toLowerCase().includes(termo);
    const anoOK = anoSel === "todos" || data.getFullYear() === parseInt(anoSel, 10);
    return buscaOK && anoOK;
  });
}

function renderLista() {
  popularFiltroAno();
  const itens = aplicarFiltros();
  gruposMesesEl.innerHTML = "";

  if (itens.length === 0) {
    semResultadosEl.style.display = "block";
    return;
  }
  semResultadosEl.style.display = "none";

  // Agrupa por "Mês/Ano" (ex: "Junho 2026")
  const grupos = new Map();
  itens.forEach((obra) => {
    const data = new Date(obra.criadoEm);
    const chave = `${NOMES_MESES[data.getMonth()]} ${data.getFullYear()}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(obra);
  });

  // Ordena os grupos do mais recente para o mais antigo
  const chavesOrdenadas = [...grupos.keys()].sort((a, b) => {
    const [, anoA] = a.split(" ");
    const [, anoB] = b.split(" ");
    const dataA = grupos.get(a)[0].criadoEm;
    const dataB = grupos.get(b)[0].criadoEm;
    return new Date(dataB) - new Date(dataA);
  });

  chavesOrdenadas.forEach((chave) => {
    const obrasDoMes = grupos.get(chave).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    const grupoEl = document.createElement("div");
    grupoEl.className = "grupo-mes";
    grupoEl.innerHTML = `<div class="grupo-mes-titulo">${chave}</div>`;

    const grade = document.createElement("div");
    grade.className = "grade-obras";

    obrasDoMes.forEach((obra) => {
      const lucro = lucroTotalObra(obra);
      const card = document.createElement("div");
      card.className = "card-obra";
      card.innerHTML = `
        <div class="card-obra-cliente">${obra.cliente || "(sem nome do cliente)"}</div>
        <div class="card-obra-servico">${obra.servico || ""}</div>
        <div class="card-obra-lucro ${lucro >= 0 ? "positivo" : "negativo"}">
          Lucro total: R$ ${formatarMoeda(lucro)}
        </div>
        <div class="card-obra-data">Criada em ${new Date(obra.criadoEm).toLocaleDateString("pt-BR")}</div>
      `;
      card.addEventListener("click", () => {
        window.location.href = `obra-detalhe.html?id=${obra.id}`;
      });
      grade.appendChild(card);
    });

    grupoEl.appendChild(grade);
    gruposMesesEl.appendChild(grupoEl);
  });
}

buscaInput.addEventListener("input", renderLista);
filtroAno.addEventListener("change", renderLista);
btnLimparFiltros.addEventListener("click", () => {
  buscaInput.value = "";
  filtroAno.value = "todos";
  renderLista();
});

// ====================================================
// INICIALIZAÇÃO
// ====================================================
const paramsUrlObras = new URLSearchParams(window.location.search);
if (paramsUrlObras.get("erro") === "obra_nao_encontrada") {
  mostrarToast("Obra não encontrada.", "erro");
  window.history.replaceState({}, "", "obras.html");
}

renderLista();