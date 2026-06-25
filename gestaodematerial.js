// ====================================================
// CHAVES DE ARMAZENAMENTO
// ====================================================
const CHAVE_SETORES = "materiais_setores";
const CHAVE_MATERIAIS = "materiais_lista";

// ====================================================
// ELEMENTOS
// ====================================================
const modalSetor = document.getElementById("modalSetor");
const btnAbrirSetor = document.getElementById("btnAbrirSetor");
const fecharModalSetor = document.getElementById("fecharModalSetor");
const formSetor = document.getElementById("form-setor");
const novoSetorInput = document.getElementById("novoSetorInput");
const listaSetores = document.getElementById("listaSetores");

const modalMaterial = document.getElementById("modalMaterial");
const btnAbrirMaterial = document.getElementById("btnAbrirMaterial");
const fecharModalMaterial = document.getElementById("fecharModalMaterial");
const tituloModalMaterial = document.getElementById("tituloModalMaterial");
const form = document.getElementById("form-material");
const selectSetorMaterial = document.getElementById("setorMaterial");
const btnSubmitMaterial = document.getElementById("btnSubmitMaterial");

const buscaInput = document.getElementById("buscaTexto");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

// Multi-select de Setor (filtro)
const multiFiltroSetor = document.getElementById("multiFiltroSetor");
const toggleFiltroSetor = document.getElementById("toggleFiltroSetor");
const painelFiltroSetor = document.getElementById("painelFiltroSetor");
const resumoFiltroSetor = document.getElementById("resumoFiltroSetor");

const btnVisaoSetor = document.getElementById("btnVisaoSetor");
const btnVisaoMaterial = document.getElementById("btnVisaoMaterial");
const gruposDiv = document.getElementById("grupos");
const semResultados = document.getElementById("semResultados");

const totalItensValor = document.getElementById("totalItensValor");
const totalQuantidadeValor = document.getElementById("totalQuantidadeValor");
const totalValorValor = document.getElementById("totalValorValor");

// ====================================================
// ESTADO
// ====================================================
let setores = JSON.parse(localStorage.getItem(CHAVE_SETORES)) || [];
let materiais = JSON.parse(localStorage.getItem(CHAVE_MATERIAIS)) || [];

let visaoAtual = "setor"; // "setor" ou "material"
let indiceEditando = null;
let gruposFechados = new Set();
let setoresFiltroSel = new Set(); // vazio = todos os setores

// ====================================================
// MODAIS — abrir / fechar
// ====================================================
function abrirModal(modal) {
  modal.classList.add("active");
}
function fecharModalEl(modal) {
  modal.classList.remove("active");
}

btnAbrirSetor.addEventListener("click", () => abrirModal(modalSetor));
fecharModalSetor.addEventListener("click", () => fecharModalEl(modalSetor));
modalSetor.addEventListener("click", (e) => {
  if (e.target === modalSetor) fecharModalEl(modalSetor);
});

btnAbrirMaterial.addEventListener("click", () => {
  if (indiceEditando === null) {
    form.reset();
    tituloModalMaterial.textContent = "Novo Material";
    btnSubmitMaterial.textContent = "Adicionar";
  }
  abrirModal(modalMaterial);
});
fecharModalMaterial.addEventListener("click", () => fecharModalEl(modalMaterial));
modalMaterial.addEventListener("click", (e) => {
  if (e.target === modalMaterial) fecharModalEl(modalMaterial);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  fecharModalEl(modalSetor);
  fecharModalEl(modalMaterial);
});

// ====================================================
// SETORES (cadastro fixo)
// ====================================================
function salvarSetores() {
  localStorage.setItem(CHAVE_SETORES, JSON.stringify(setores));
}

function renderSetores() {
  // <select> do formulário de material
  const valorSelecionado = selectSetorMaterial.value;
  selectSetorMaterial.innerHTML = '<option value="" disabled selected>Selecione o setor</option>';
  setores.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    selectSetorMaterial.appendChild(opt);
  });
  if (setores.includes(valorSelecionado)) {
    selectSetorMaterial.value = valorSelecionado;
  }

  // O filtro de Setor agora é multi-select (configurado em
  // configurarMultiSelect / msFiltroSetor); aqui só atualizamos
  // o resumo, já que as opções são lidas direto de "setores".
  if (typeof msFiltroSetor !== "undefined") {
    msFiltroSetor.atualizarResumo();
  }

  // Chips
  listaSetores.innerHTML = "";
  if (setores.length === 0) {
    listaSetores.innerHTML = '<p class="sem-obras">Nenhum setor cadastrado ainda.</p>';
    return;
  }
  setores.forEach((s, index) => {
    const chip = document.createElement("div");
    chip.className = "chip-obra";
    chip.innerHTML = `<span>${s}</span>`;
    const btnRemover = document.createElement("button");
    btnRemover.textContent = "×";
    btnRemover.title = "Excluir setor";
    btnRemover.addEventListener("click", () => excluirSetor(index));
    chip.appendChild(btnRemover);
    listaSetores.appendChild(chip);
  });
}

async function excluirSetor(index) {
  const nome = setores[index];
  const usado = materiais.some((m) => m.setor === nome);
  if (usado) {
    const confirmado = await confirmarAcao(
      `Excluir o setor "${nome}"?`,
      "Os materiais já cadastrados não serão apagados, mas esse setor não vai mais aparecer na lista para novos materiais."
    );
    if (!confirmado) return;
  }
  setores.splice(index, 1);
  salvarSetores();
  renderSetores();
}

formSetor.addEventListener("submit", (e) => {
  e.preventDefault();
  limparErroCampo(novoSetorInput);
  const nome = novoSetorInput.value.trim();
  if (!nome) return;
  if (setores.includes(nome)) {
    marcarCampoComErro(novoSetorInput, "Esse setor já está cadastrado.");
    return;
  }
  setores.push(nome);
  salvarSetores();
  renderSetores();
  novoSetorInput.value = "";
});
limparErroAoEditar(novoSetorInput);

// ====================================================
// MATERIAIS (cadastro / edição)
// ====================================================
function salvarMateriais() {
  localStorage.setItem(CHAVE_MATERIAIS, JSON.stringify(materiais));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const campoNome = document.getElementById("nomeMaterial");
  const campoCodigo = document.getElementById("codigoMaterial");
  const campoValor = document.getElementById("valorMaterial");
  const campoQuantidade = document.getElementById("quantidadeMaterial");

  limparErrosDoFormulario(form);

  const nome = campoNome.value.trim();
  const setor = selectSetorMaterial.value;
  const codigo = campoCodigo.value.trim();
  const valor = parseFloat(campoValor.value);
  // Quantidade é opcional: campo vazio é tratado como 0.
  const quantidadeBruta = campoQuantidade.value.trim();
  const quantidade = quantidadeBruta === "" ? 0 : parseInt(quantidadeBruta, 10);
  const observacao = document.getElementById("obsMaterial").value.trim();

  let temErro = false;
  if (!nome) {
    marcarCampoComErro(campoNome, "Informe o nome do material.");
    temErro = true;
  }
  if (!setor) {
    marcarCampoComErro(selectSetorMaterial, "Selecione um setor.");
    temErro = true;
  }
  if (!codigo) {
    marcarCampoComErro(campoCodigo, "Informe o código do material.");
    temErro = true;
  }
  if (isNaN(valor) || valor < 0) {
    marcarCampoComErro(campoValor, "Informe um valor válido.");
    temErro = true;
  }
  if (isNaN(quantidade) || quantidade < 0) {
    marcarCampoComErro(campoQuantidade, "Informe uma quantidade válida (ou deixe em branco).");
    temErro = true;
  }

  if (temErro) {
    focarPrimeiroErro(form);
    return;
  }

  const registro = { nome, setor, codigo, valor, quantidade, observacao };

  if (indiceEditando !== null) {
    materiais[indiceEditando] = registro;
    indiceEditando = null;
    btnSubmitMaterial.textContent = "Adicionar";
    tituloModalMaterial.textContent = "Novo Material";
  } else {
    materiais.push(registro);
  }

  salvarMateriais();
  form.reset();
  fecharModalEl(modalMaterial);
  renderTudo();
});

function editar(index) {
  const m = materiais[index];
  document.getElementById("nomeMaterial").value = m.nome;
  selectSetorMaterial.value = m.setor;
  document.getElementById("codigoMaterial").value = m.codigo;
  document.getElementById("valorMaterial").value = m.valor;
  document.getElementById("quantidadeMaterial").value = m.quantidade;
  document.getElementById("obsMaterial").value = m.observacao || "";
  indiceEditando = index;
  tituloModalMaterial.textContent = "Editar Material";
  btnSubmitMaterial.textContent = "Salvar Alterações";
  abrirModal(modalMaterial);
}

async function excluir(index) {
  const confirmado = await confirmarAcao(
    "Excluir material?",
    "Essa ação não pode ser desfeita."
  );
  if (!confirmado) return;
  materiais.splice(index, 1);
  salvarMateriais();
  if (indiceEditando === index) {
    indiceEditando = null;
    form.reset();
    btnSubmitMaterial.textContent = "Adicionar";
    tituloModalMaterial.textContent = "Novo Material";
  }
  renderTudo();
}

// ====================================================
// MULTI-SELECT GENÉRICO (Filtro de Setor)
// ====================================================
function configurarMultiSelect({ painel, toggle, container, resumoEl, getOpcoes, selecionados, labelTodos, onChange }) {
  function renderPainel() {
    const opcoes = getOpcoes();
    painel.innerHTML = "";

    if (opcoes.length === 0) {
      painel.innerHTML = '<div class="multi-select-vazio">Nenhuma opção disponível ainda.</div>';
      return;
    }

    opcoes.forEach((opcao) => {
      const linha = document.createElement("label");
      linha.className = "multi-select-opcao";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selecionados.has(opcao);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selecionados.add(opcao);
        } else {
          selecionados.delete(opcao);
        }
        atualizarResumo();
        if (onChange) onChange();
      });
      linha.appendChild(checkbox);
      linha.appendChild(document.createTextNode(opcao));
      painel.appendChild(linha);
    });

    const acoes = document.createElement("div");
    acoes.className = "multi-select-acoes";
    const btnTodos = document.createElement("button");
    btnTodos.type = "button";
    btnTodos.textContent = "Selecionar todos";
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
    if (selecionados.size === 0) {
      resumoEl.textContent = labelTodos;
    } else if (selecionados.size === 1) {
      resumoEl.textContent = [...selecionados][0];
    } else {
      resumoEl.textContent = `${selecionados.size} selecionados`;
    }
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
    if (!container.contains(e.target)) {
      container.classList.remove("open");
    }
  });

  atualizarResumo();

  return { renderPainel, atualizarResumo };
}

const msFiltroSetor = configurarMultiSelect({
  painel: painelFiltroSetor,
  toggle: toggleFiltroSetor,
  container: multiFiltroSetor,
  resumoEl: resumoFiltroSetor,
  getOpcoes: () => setores,
  selecionados: setoresFiltroSel,
  labelTodos: "Todos",
  onChange: renderGrupos,
});

// ====================================================
// FILTRAGEM
// ====================================================
function aplicarFiltros() {
  const termo = buscaInput.value.trim().toLowerCase();

  return materiais
    .map((m, indexOriginal) => ({ ...m, indexOriginal }))
    .filter((m) => {
      const buscaOK =
        termo === "" ||
        m.nome.toLowerCase().includes(termo) ||
        m.codigo.toLowerCase().includes(termo) ||
        (m.observacao || "").toLowerCase().includes(termo);
      const setorOK = setoresFiltroSel.size === 0 || setoresFiltroSel.has(m.setor);
      return buscaOK && setorOK;
    });
}

// ====================================================
// RENDERIZAÇÃO AGRUPADA
// ====================================================
function chaveGrupo(item) {
  return visaoAtual === "setor" ? item.setor : item.nome;
}

function tituloGrupo(item) {
  return visaoAtual === "setor" ? item.setor : item.nome;
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderGrupos() {
  const itensFiltrados = aplicarFiltros();
  gruposDiv.innerHTML = "";

  if (itensFiltrados.length === 0) {
    semResultados.style.display = "block";
    atualizarTotalFixo([]);
    return;
  }
  semResultados.style.display = "none";

  const grupos = new Map();
  itensFiltrados.forEach((item) => {
    const chave = chaveGrupo(item);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  });

  const chavesOrdenadas = [...grupos.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  chavesOrdenadas.forEach((chave) => {
    const itens = grupos.get(chave);
    const subtotalValor = itens.reduce((soma, m) => soma + m.valor * m.quantidade, 0);

    const fechado = gruposFechados.has(chave);

    const grupoEl = document.createElement("div");
    grupoEl.className = "grupo" + (fechado ? " fechado" : "");

    const cabecalho = document.createElement("div");
    cabecalho.className = "grupo-cabecalho";
    cabecalho.innerHTML = `
      <span class="grupo-titulo"><span class="grupo-seta">▾</span> ${tituloGrupo(itens[0])}</span>
      <span class="grupo-subtotal">R$ ${formatarMoeda(subtotalValor)}</span>
    `;
    cabecalho.addEventListener("click", () => {
      if (gruposFechados.has(chave)) gruposFechados.delete(chave);
      else gruposFechados.add(chave);
      renderGrupos();
    });

    const corpo = document.createElement("div");
    corpo.className = "grupo-corpo";

    const table = document.createElement("table");
    const colunaExtra = visaoAtual === "setor" ? "Material" : "Setor";
    table.innerHTML = `
      <thead>
        <tr>
          <th>${colunaExtra}</th>
          <th>Código</th>
          <th>Valor Unit.</th>
          <th>Qtd.</th>
          <th>Subtotal</th>
          <th>Observação</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    itens.forEach((m) => {
      const tr = document.createElement("tr");
      const valorColunaExtra = visaoAtual === "setor" ? m.nome : m.setor;
      const subtotalItem = m.valor * m.quantidade;
      tr.innerHTML = `
        <td>${valorColunaExtra}</td>
        <td>${m.codigo}</td>
        <td>R$ ${formatarMoeda(m.valor)}</td>
        <td>${m.quantidade}</td>
        <td>R$ ${formatarMoeda(subtotalItem)}</td>
        <td class="coluna-obs">${m.observacao || "—"}</td>
        <td>
          <button class="btn-editar" data-edit-index="${m.indexOriginal}">Editar</button>
          <button class="btn-excluir-item" data-delete-index="${m.indexOriginal}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    corpo.appendChild(table);
    grupoEl.appendChild(cabecalho);
    grupoEl.appendChild(corpo);
    gruposDiv.appendChild(grupoEl);
  });

  gruposDiv.querySelectorAll("[data-edit-index]").forEach((btn) => {
    btn.addEventListener("click", () => editar(parseInt(btn.dataset.editIndex, 10)));
  });
  gruposDiv.querySelectorAll("[data-delete-index]").forEach((btn) => {
    btn.addEventListener("click", () => excluir(parseInt(btn.dataset.deleteIndex, 10)));
  });

  atualizarTotalFixo(itensFiltrados);
}

function atualizarTotalFixo(itens) {
  const totalItens = itens.length;
  const totalQuantidade = itens.reduce((soma, m) => soma + Number(m.quantidade || 0), 0);
  const totalValor = itens.reduce((soma, m) => soma + m.valor * m.quantidade, 0);

  totalItensValor.textContent = totalItens;
  totalQuantidadeValor.textContent = totalQuantidade;
  totalValorValor.textContent = `R$ ${formatarMoeda(totalValor)}`;
}

function renderTudo() {
  renderSetores();
  renderGrupos();
}

// ====================================================
// ALTERNADOR DE VISÃO
// ====================================================
btnVisaoSetor.addEventListener("click", () => {
  visaoAtual = "setor";
  btnVisaoSetor.classList.add("active");
  btnVisaoMaterial.classList.remove("active");
  gruposFechados.clear();
  renderGrupos();
});

btnVisaoMaterial.addEventListener("click", () => {
  visaoAtual = "material";
  btnVisaoMaterial.classList.add("active");
  btnVisaoSetor.classList.remove("active");
  gruposFechados.clear();
  renderGrupos();
});

// ====================================================
// FILTROS
// ====================================================
buscaInput.addEventListener("input", renderGrupos);
btnLimparFiltros.addEventListener("click", () => {
  buscaInput.value = "";
  setoresFiltroSel.clear();
  msFiltroSetor.atualizarResumo();
  renderGrupos();
});

// ====================================================
// INICIALIZAÇÃO
// ====================================================
["nomeMaterial", "setorMaterial", "codigoMaterial", "valorMaterial", "quantidadeMaterial"].forEach((id) => {
  limparErroAoEditar(document.getElementById(id));
});

renderTudo();