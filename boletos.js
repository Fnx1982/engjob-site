// ============================================================
// boletos.js
// Controle de boletos (despesas e entradas), com status
// calculado automaticamente pela data de vencimento:
//   - "pago": foi marcado manualmente ou tem comprovante anexado
//   - "atrasado": não pago e data de vencimento já passou
//   - "pendente": não pago e ainda dentro do prazo (ou sem data)
// ============================================================

const CHAVE_BOLETOS = "boletos_lista";

const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ====================================================
// ELEMENTOS
// ====================================================
const modalBoleto = document.getElementById("modalBoleto");
const btnNovoBoleto = document.getElementById("btnNovoBoleto");
const fecharModalBoleto = document.getElementById("fecharModalBoleto");
const tituloModalBoleto = document.getElementById("tituloModalBoleto");
const form = document.getElementById("form-boleto");
const btnSubmitBoleto = document.getElementById("btnSubmitBoleto");
const btnTipoDespesa = document.getElementById("btnTipoDespesa");
const btnTipoEntrada = document.getElementById("btnTipoEntrada");
const inputTipoBoleto = document.getElementById("tipoBoleto");
const campoArquivoComprovante = document.getElementById("campoArquivoComprovante");
const avisoMarcaPago = document.getElementById("avisoMarcaPago");

const listaBoletosEl = document.getElementById("listaBoletos");
const semResultadosEl = document.getElementById("semResultados");
const buscaInput = document.getElementById("buscaTexto");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMes = document.getElementById("filtroMes");
const filtroAno = document.getElementById("filtroAno");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const abasStatus = document.querySelectorAll("[data-status-aba]");
const contadorAtrasadosEl = document.getElementById("contadorAtrasados");

const popupArquivo = document.getElementById("popup-arquivo");
const popupArquivoBody = document.getElementById("popup-arquivo-body");
const fecharPopupArquivo = document.getElementById("fecharPopupArquivo");
const btnFecharPopupArquivo = document.getElementById("btn-fechar-popup-arquivo");

// ====================================================
// ESTADO
// ====================================================
let boletos = JSON.parse(localStorage.getItem(CHAVE_BOLETOS)) || [];
let indiceEditando = null;
let tipoSelecionadoModal = "despesa";
let abaAtiva = "pendente";

function salvarBoletos() {
  localStorage.setItem(CHAVE_BOLETOS, JSON.stringify(boletos));
}

// ====================================================
// CÁLCULO DE STATUS (pendente / atrasado / pago)
// ====================================================
function hojeSemHora() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

function calcularStatus(boleto) {
  if (boleto.pago) return "pago";
  if (!boleto.dataVencimento) return "pendente";

  const vencimento = new Date(boleto.dataVencimento + "T00:00:00");
  const hoje = hojeSemHora();
  return vencimento < hoje ? "atrasado" : "pendente";
}

function diasParaVencer(boleto) {
  if (!boleto.dataVencimento) return null;
  const vencimento = new Date(boleto.dataVencimento + "T00:00:00");
  const hoje = hojeSemHora();
  const diffMs = vencimento - hoje;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function textoPrazo(boleto) {
  const status = calcularStatus(boleto);
  if (status === "pago") return "Pago";

  const dias = diasParaVencer(boleto);
  if (dias === null) return "Sem data de vencimento";
  if (status === "atrasado") {
    const diasAtraso = Math.abs(dias);
    return `Atrasado há ${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""}`;
  }
  if (dias === 0) return "Vence hoje";
  return `Faltam ${dias} dia${dias !== 1 ? "s" : ""} para vencer`;
}

// ====================================================
// MODAL — abrir / fechar
// ====================================================
function abrirModal() {
  modalBoleto.classList.add("active");
}
function fecharModalEl() {
  modalBoleto.classList.remove("active");
}

btnNovoBoleto.addEventListener("click", () => {
  if (indiceEditando === null) {
    form.reset();
    definirTipoModal("despesa");
    tituloModalBoleto.textContent = "Novo Boleto";
    btnSubmitBoleto.textContent = "Adicionar";
    avisoMarcaPago.style.display = "none";
  }
  abrirModal();
});
fecharModalBoleto.addEventListener("click", fecharModalEl);
modalBoleto.addEventListener("click", (e) => {
  if (e.target === modalBoleto) fecharModalEl();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharModalEl();
});

function definirTipoModal(tipo) {
  tipoSelecionadoModal = tipo;
  inputTipoBoleto.value = tipo;
  btnTipoDespesa.classList.toggle("active", tipo === "despesa");
  btnTipoEntrada.classList.toggle("active", tipo === "entrada");
}
btnTipoDespesa.addEventListener("click", () => definirTipoModal("despesa"));
btnTipoEntrada.addEventListener("click", () => definirTipoModal("entrada"));

// Mostra um aviso quando o usuário escolhe um arquivo de comprovante,
// avisando que isso vai marcar o boleto como pago automaticamente.
campoArquivoComprovante.addEventListener("change", () => {
  avisoMarcaPago.style.display = campoArquivoComprovante.files[0] ? "block" : "none";
});

// ====================================================
// CADASTRO / EDIÇÃO
// ====================================================
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const nome = document.getElementById("campoNomeBoleto").value.trim();
  const codigo = document.getElementById("campoCodigoBoleto").value.trim();
  const valorStr = document.getElementById("campoValorBoleto").value;
  const valor = valorStr === "" ? null : parseFloat(valorStr);
  const dataCadastro = document.getElementById("campoDataCadastroBoleto").value;
  const dataVencimento = document.getElementById("campoDataVencimentoBoleto").value;
  const observacao = document.getElementById("campoObservacaoBoleto").value.trim();
  const arquivoBoleto = document.getElementById("campoArquivoBoleto").files[0];
  const arquivoComprovante = campoArquivoComprovante.files[0];

  let registro;
  if (indiceEditando !== null) {
    registro = { ...boletos[indiceEditando] };
  } else {
    registro = {
      nome: "", codigo: "", valor: null, dataCadastro: "", dataVencimento: "",
      observacao: "", tipo: "despesa", arquivoBoleto: null, arquivoComprovante: null, pago: false,
    };
  }

  registro.nome = nome;
  registro.codigo = codigo;
  registro.valor = valor;
  registro.dataCadastro = dataCadastro;
  registro.dataVencimento = dataVencimento;
  registro.observacao = observacao;
  registro.tipo = tipoSelecionadoModal;

  if (arquivoBoleto) registro.arquivoBoleto = URL.createObjectURL(arquivoBoleto);
  if (arquivoComprovante) {
    registro.arquivoComprovante = URL.createObjectURL(arquivoComprovante);
    registro.pago = true; // anexar comprovante marca como pago automaticamente
  }

  if (indiceEditando !== null) {
    boletos[indiceEditando] = registro;
    indiceEditando = null;
    btnSubmitBoleto.textContent = "Adicionar";
    tituloModalBoleto.textContent = "Novo Boleto";
  } else {
    boletos.push(registro);
  }

  salvarBoletos();
  form.reset();
  avisoMarcaPago.style.display = "none";
  fecharModalEl();
  renderTudo();
});

function editar(index) {
  const b = boletos[index];
  document.getElementById("campoNomeBoleto").value = b.nome || "";
  document.getElementById("campoCodigoBoleto").value = b.codigo || "";
  document.getElementById("campoValorBoleto").value = b.valor !== null && b.valor !== undefined ? b.valor : "";
  document.getElementById("campoDataCadastroBoleto").value = b.dataCadastro || "";
  document.getElementById("campoDataVencimentoBoleto").value = b.dataVencimento || "";
  document.getElementById("campoObservacaoBoleto").value = b.observacao || "";
  definirTipoModal(b.tipo || "despesa");
  avisoMarcaPago.style.display = "none";

  indiceEditando = index;
  tituloModalBoleto.textContent = "Editar Boleto";
  btnSubmitBoleto.textContent = "Salvar Alterações";
  abrirModal();
}

async function excluir(index) {
  const confirmado = await confirmarAcao("Excluir boleto?", "Essa ação não pode ser desfeita.");
  if (!confirmado) return;
  boletos.splice(index, 1);
  salvarBoletos();
  if (indiceEditando === index) {
    indiceEditando = null;
    form.reset();
    btnSubmitBoleto.textContent = "Adicionar";
    tituloModalBoleto.textContent = "Novo Boleto";
  }
  renderTudo();
}

async function marcarComoPago(index) {
  const confirmado = await confirmarAcao("Marcar como pago?", "O boleto vai para a aba 'Pago'.");
  if (!confirmado) return;
  boletos[index].pago = true;
  salvarBoletos();
  renderTudo();
}

async function reabrirBoleto(index) {
  const confirmado = await confirmarAcao("Reabrir este boleto?", "Ele deixará de estar marcado como pago.");
  if (!confirmado) return;
  boletos[index].pago = false;
  salvarBoletos();
  renderTudo();
}

// ====================================================
// VISUALIZAÇÃO DE ARQUIVO (boleto / comprovante)
// ====================================================
function abrirArquivo(url, titulo) {
  if (!url) return;
  popupArquivoBody.innerHTML = "";
  if (url.toLowerCase().includes(".pdf") || true) {
    // URLs de blob não têm extensão visível; tentamos exibir como
    // PDF/iframe, que também funciona para a maioria dos tipos.
    const iframe = document.createElement("iframe");
    iframe.src = url;
    popupArquivoBody.appendChild(iframe);
  }
  popupArquivo.style.display = "flex";
}
function fecharPopupArquivoFn() {
  popupArquivo.style.display = "none";
  popupArquivoBody.innerHTML = "";
}
fecharPopupArquivo.addEventListener("click", fecharPopupArquivoFn);
btnFecharPopupArquivo.addEventListener("click", fecharPopupArquivoFn);
popupArquivo.addEventListener("click", (e) => {
  if (e.target === popupArquivo) fecharPopupArquivoFn();
});

// ====================================================
// FILTROS
// ====================================================
function popularFiltrosMesAno() {
  const todosComData = boletos.filter((b) => b.dataVencimento);
  const anos = [...new Set(todosComData.map((b) => new Date(b.dataVencimento + "T00:00:00").getFullYear()))].sort((a, b) => b - a);

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
  const tipoSel = filtroTipo.value;
  const mesSel = filtroMes.value;
  const anoSel = filtroAno.value;

  return boletos
    .map((b, indexOriginal) => ({ ...b, indexOriginal }))
    .filter((b) => {
      const status = calcularStatus(b);
      const abaOK = abaAtiva === "todos" || status === abaAtiva;

      const buscaOK =
        termo === "" ||
        (b.nome || "").toLowerCase().includes(termo) ||
        (b.codigo || "").toLowerCase().includes(termo) ||
        (b.observacao || "").toLowerCase().includes(termo);

      const tipoOK = tipoSel === "todos" || b.tipo === tipoSel;

      let mesAnoOK = true;
      if ((mesSel !== "todos" || anoSel !== "todos") && b.dataVencimento) {
        const data = new Date(b.dataVencimento + "T00:00:00");
        const mesOK = mesSel === "todos" || data.getMonth() === parseInt(mesSel, 10);
        const anoOK = anoSel === "todos" || data.getFullYear() === parseInt(anoSel, 10);
        mesAnoOK = mesOK && anoOK;
      } else if ((mesSel !== "todos" || anoSel !== "todos") && !b.dataVencimento) {
        mesAnoOK = false;
      }

      return abaOK && buscaOK && tipoOK && mesAnoOK;
    });
}

// ====================================================
// RENDERIZAÇÃO
// ====================================================
function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return "—";
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatarDataBR(iso) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function atualizarContadorAtrasados() {
  const totalAtrasados = boletos.filter((b) => calcularStatus(b) === "atrasado").length;
  if (totalAtrasados > 0) {
    contadorAtrasadosEl.textContent = totalAtrasados;
    contadorAtrasadosEl.style.display = "inline-block";
  } else {
    contadorAtrasadosEl.style.display = "none";
  }
}

function renderLista() {
  popularFiltrosMesAno();
  atualizarContadorAtrasados();

  const itens = aplicarFiltros().sort((a, b) => {
    // Ordena por data de vencimento (sem data vai pro final)
    if (!a.dataVencimento) return 1;
    if (!b.dataVencimento) return -1;
    return new Date(a.dataVencimento) - new Date(b.dataVencimento);
  });

  listaBoletosEl.innerHTML = "";

  if (itens.length === 0) {
    semResultadosEl.style.display = "block";
    return;
  }
  semResultadosEl.style.display = "none";

  itens.forEach((b) => {
    const status = calcularStatus(b);
    const card = document.createElement("div");
    card.className = `boleto-card cor-${status}`;

    const botoesArquivo = [];
    if (b.arquivoBoleto) {
      botoesArquivo.push(`<button class="btn-pdf" data-ver-boleto="${b.indexOriginal}">Ver Boleto</button>`);
    }
    if (b.arquivoComprovante) {
      botoesArquivo.push(`<button class="btn-pdf" data-ver-comprovante="${b.indexOriginal}">Ver Comprovante</button>`);
    }

    const botaoStatus =
      status === "pago"
        ? `<button class="btn-reabrir" data-reabrir="${b.indexOriginal}">Reabrir</button>`
        : `<button class="btn-pagar" data-pagar="${b.indexOriginal}">Marcar como Pago</button>`;

    card.innerHTML = `
      <div class="boleto-topo">
        <div>
          <span class="boleto-nome">${b.nome || "(sem nome)"}</span>
          <span class="boleto-tag-tipo ${b.tipo}">${b.tipo === "despesa" ? "Despesa" : "Entrada"}</span>
        </div>
        <span class="selo-status ${status}">${status === "pendente" ? "Pendente" : status === "atrasado" ? "Atrasado" : "Pago"}</span>
      </div>
      <div class="boleto-meta">
        <span>Código: ${b.codigo || "—"}</span>
        <span class="boleto-valor">${formatarMoeda(b.valor)}</span>
        <span>Cadastro: ${formatarDataBR(b.dataCadastro)}</span>
        <span>Vencimento: ${formatarDataBR(b.dataVencimento)}</span>
        <span><strong>${textoPrazo(b)}</strong></span>
      </div>
      ${b.observacao ? `<div class="boleto-observacao">${b.observacao}</div>` : ""}
      <div class="boleto-acoes">
        ${botoesArquivo.join("")}
        <button class="btn-editar" data-edit="${b.indexOriginal}">Editar</button>
        ${botaoStatus}
        <button class="btn-excluir-item" data-delete="${b.indexOriginal}">Excluir</button>
      </div>
    `;
    listaBoletosEl.appendChild(card);
  });

  listaBoletosEl.querySelectorAll("[data-ver-boleto]").forEach((btn) => {
    btn.addEventListener("click", () => abrirArquivo(boletos[btn.dataset.verBoleto].arquivoBoleto, "Boleto"));
  });
  listaBoletosEl.querySelectorAll("[data-ver-comprovante]").forEach((btn) => {
    btn.addEventListener("click", () => abrirArquivo(boletos[btn.dataset.verComprovante].arquivoComprovante, "Comprovante"));
  });
  listaBoletosEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => editar(parseInt(btn.dataset.edit, 10)));
  });
  listaBoletosEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => excluir(parseInt(btn.dataset.delete, 10)));
  });
  listaBoletosEl.querySelectorAll("[data-pagar]").forEach((btn) => {
    btn.addEventListener("click", () => marcarComoPago(parseInt(btn.dataset.pagar, 10)));
  });
  listaBoletosEl.querySelectorAll("[data-reabrir]").forEach((btn) => {
    btn.addEventListener("click", () => reabrirBoleto(parseInt(btn.dataset.reabrir, 10)));
  });
}

function renderTudo() {
  renderLista();
}

// ====================================================
// ABAS DE STATUS
// ====================================================
abasStatus.forEach((aba) => {
  aba.addEventListener("click", () => {
    abasStatus.forEach((a) => a.classList.remove("active"));
    aba.classList.add("active");
    abaAtiva = aba.dataset.statusAba;
    renderLista();
  });
});

// ====================================================
// FILTROS — listeners
// ====================================================
buscaInput.addEventListener("input", renderLista);
filtroTipo.addEventListener("change", renderLista);
filtroMes.addEventListener("change", renderLista);
filtroAno.addEventListener("change", renderLista);
btnLimparFiltros.addEventListener("click", () => {
  buscaInput.value = "";
  filtroTipo.value = "todos";
  filtroMes.value = "todos";
  filtroAno.value = "todos";
  renderLista();
});

// ====================================================
// INICIALIZAÇÃO
// ====================================================
definirTipoModal("despesa");
renderTudo();