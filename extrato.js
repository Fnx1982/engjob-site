// ============================================================
// extrato.js
// Motor genérico de extrato bancário (entradas/saídas), usado
// pelas 3 páginas de banco (Interbanking, Sicredi, Credcrea).
// Cada página define window.EXTRATO_CONFIG antes de carregar
// este script, com o nome do banco e as chaves de localStorage
// a usar — assim os três extratos ficam independentes.
// ============================================================

(function () {
  const config = window.EXTRATO_CONFIG;
  if (!config) {
    console.error("extrato.js: defina window.EXTRATO_CONFIG antes de carregar este script.");
    return;
  }
  const CHAVE_LANCAMENTOS = config.chaveLancamentos;
  const CHAVE_CLASSIFICACOES = config.chaveClassificacoes;

  // ====================================================
  // ELEMENTOS
  // ====================================================
  const modalClassificacao = document.getElementById("modalClassificacao");
  const btnAbrirClassificacao = document.getElementById("btnAbrirClassificacao");
  const fecharModalClassificacao = document.getElementById("fecharModalClassificacao");
  const formClassificacao = document.getElementById("form-classificacao");
  const novaClassificacaoInput = document.getElementById("novaClassificacaoInput");
  const listaClassificacoes = document.getElementById("listaClassificacoes");

  const modalLancamento = document.getElementById("modalLancamento");
  const btnAbrirLancamento = document.getElementById("btnAbrirLancamento");
  const fecharModalLancamento = document.getElementById("fecharModalLancamento");
  const tituloModalLancamento = document.getElementById("tituloModalLancamento");
  const form = document.getElementById("form-lancamento");
  const btnTipoEntrada = document.getElementById("btnTipoEntrada");
  const btnTipoSaida = document.getElementById("btnTipoSaida");
  const inputTipo = document.getElementById("tipoLancamento");
  const selectClassificacao = document.getElementById("classificacao");
  const btnSubmitLancamento = document.getElementById("btnSubmitLancamento");

  const buscaInput = document.getElementById("buscaTexto");
  const filtroTipo = document.getElementById("filtroTipo");

  const multiClassificacao = document.getElementById("multiClassificacao");
  const toggleClassificacao = document.getElementById("toggleClassificacao");
  const painelClassificacao = document.getElementById("painelClassificacao");
  const resumoClassificacao = document.getElementById("resumoClassificacao");

  const btnLimparFiltros = document.getElementById("btnLimparFiltros");

  const tabelaBody = document.querySelector("#tabelaLancamentos tbody");
  const semResultados = document.getElementById("semResultados");

  const resumoEntradaValor = document.getElementById("resumoEntradaValor");
  const resumoSaidaValor = document.getElementById("resumoSaidaValor");
  const resumoSaldoValor = document.getElementById("resumoSaldoValor");

  const totalEntradaValor = document.getElementById("totalEntradaValor");
  const totalSaidaValor = document.getElementById("totalSaidaValor");
  const totalSaldoValor = document.getElementById("totalSaldoValor");

  // ====================================================
  // ESTADO
  // ====================================================
  let classificacoes = JSON.parse(localStorage.getItem(CHAVE_CLASSIFICACOES)) || [];
  let lancamentos = JSON.parse(localStorage.getItem(CHAVE_LANCAMENTOS)) || [];

  let indiceEditando = null;
  let tipoSelecionadoModal = "entrada";
  let classificacoesSelecionadas = new Set(); // vazio = todas

  // ====================================================
  // MODAIS — abrir / fechar
  // ====================================================
  function abrirModal(modal) {
    modal.classList.add("active");
  }
  function fecharModalEl(modal) {
    modal.classList.remove("active");
  }

  btnAbrirClassificacao.addEventListener("click", () => abrirModal(modalClassificacao));
  fecharModalClassificacao.addEventListener("click", () => fecharModalEl(modalClassificacao));
  modalClassificacao.addEventListener("click", (e) => {
    if (e.target === modalClassificacao) fecharModalEl(modalClassificacao);
  });

  btnAbrirLancamento.addEventListener("click", () => {
    if (indiceEditando === null) {
      form.reset();
      definirTipoModal("entrada");
      tituloModalLancamento.textContent = "Novo lançamento";
      btnSubmitLancamento.textContent = "Adicionar";
    }
    abrirModal(modalLancamento);
  });
  fecharModalLancamento.addEventListener("click", () => fecharModalEl(modalLancamento));
  modalLancamento.addEventListener("click", (e) => {
    if (e.target === modalLancamento) fecharModalEl(modalLancamento);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    fecharModalEl(modalClassificacao);
    fecharModalEl(modalLancamento);
  });

  // ====================================================
  // TOGGLE ENTRADA / SAÍDA NO MODAL
  // ====================================================
  function definirTipoModal(tipo) {
    tipoSelecionadoModal = tipo;
    inputTipo.value = tipo;
    btnTipoEntrada.classList.toggle("active", tipo === "entrada");
    btnTipoSaida.classList.toggle("active", tipo === "saida");
  }
  btnTipoEntrada.addEventListener("click", () => definirTipoModal("entrada"));
  btnTipoSaida.addEventListener("click", () => definirTipoModal("saida"));

  // ====================================================
  // CLASSIFICAÇÕES (cadastro fixo)
  // ====================================================
  function salvarClassificacoes() {
    localStorage.setItem(CHAVE_CLASSIFICACOES, JSON.stringify(classificacoes));
  }

  function renderClassificacoes() {
    const valorSelecionado = selectClassificacao.value;
    selectClassificacao.innerHTML = '<option value="" disabled selected>Selecione</option>';
    classificacoes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selectClassificacao.appendChild(opt);
    });
    if (classificacoes.includes(valorSelecionado)) {
      selectClassificacao.value = valorSelecionado;
    }

    listaClassificacoes.innerHTML = "";
    if (classificacoes.length === 0) {
      listaClassificacoes.innerHTML = '<p class="sem-obras">Nenhuma classificação cadastrada ainda.</p>';
      return;
    }
    classificacoes.forEach((c, index) => {
      const chip = document.createElement("div");
      chip.className = "chip-obra";
      chip.innerHTML = `<span>${c}</span>`;
      const btnRemover = document.createElement("button");
      btnRemover.textContent = "×";
      btnRemover.title = "Excluir classificação";
      btnRemover.addEventListener("click", () => excluirClassificacao(index));
      chip.appendChild(btnRemover);
      listaClassificacoes.appendChild(chip);
    });
  }

  async function excluirClassificacao(index) {
    const nome = classificacoes[index];
    const usada = lancamentos.some((l) => l.classificacao === nome);
    if (usada) {
      const confirmado = await confirmarAcao(
        `Excluir a classificação "${nome}"?`,
        "Os lançamentos já registrados não serão apagados, mas essa classificação não vai mais aparecer na lista para novos lançamentos."
      );
      if (!confirmado) return;
    }
    classificacoes.splice(index, 1);
    salvarClassificacoes();
    renderClassificacoes();
  }

  formClassificacao.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = novaClassificacaoInput.value.trim();
    if (!nome) return;
    if (classificacoes.includes(nome)) {
      alert("Essa classificação já está cadastrada.");
      return;
    }
    classificacoes.push(nome);
    salvarClassificacoes();
    renderClassificacoes();
    novaClassificacaoInput.value = "";
  });

  // ====================================================
  // LANÇAMENTOS (cadastro / edição)
  // ====================================================
  function salvarLancamentos() {
    localStorage.setItem(CHAVE_LANCAMENTOS, JSON.stringify(lancamentos));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = document.getElementById("dataLancamento").value;
    const descricao = document.getElementById("descricao").value.trim();
    const valor = parseFloat(document.getElementById("valor").value);
    const classificacao = selectClassificacao.value;
    const observacao = document.getElementById("observacao").value.trim();

    if (!data || !descricao || isNaN(valor) || !classificacao) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const registro = { data, descricao, valor: Math.abs(valor), tipo: tipoSelecionadoModal, classificacao, observacao };

    if (indiceEditando !== null) {
      lancamentos[indiceEditando] = registro;
      indiceEditando = null;
      btnSubmitLancamento.textContent = "Adicionar";
      tituloModalLancamento.textContent = "Novo lançamento";
    } else {
      lancamentos.push(registro);
    }

    salvarLancamentos();
    form.reset();
    fecharModalEl(modalLancamento);
    renderTudo();
  });

  function editar(index) {
    const l = lancamentos[index];
    document.getElementById("dataLancamento").value = l.data;
    document.getElementById("descricao").value = l.descricao;
    document.getElementById("valor").value = l.valor;
    selectClassificacao.value = l.classificacao;
    document.getElementById("observacao").value = l.observacao || "";
    definirTipoModal(l.tipo);
    indiceEditando = index;
    tituloModalLancamento.textContent = "Editar lançamento";
    btnSubmitLancamento.textContent = "Salvar alterações";
    abrirModal(modalLancamento);
  }

  async function excluir(index) {
    const confirmado = await confirmarAcao(
      "Excluir lançamento?",
      "Essa ação não pode ser desfeita."
    );
    if (!confirmado) return;
    lancamentos.splice(index, 1);
    salvarLancamentos();
    if (indiceEditando === index) {
      indiceEditando = null;
      form.reset();
      btnSubmitLancamento.textContent = "Adicionar";
      tituloModalLancamento.textContent = "Novo lançamento";
    }
    renderTudo();
  }

  // ====================================================
  // MULTI-SELECT (Classificação no filtro)
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
          onChange();
        });
        linha.appendChild(checkbox);
        linha.appendChild(document.createTextNode(opcao));
        painel.appendChild(linha);
      });

      const acoes = document.createElement("div");
      acoes.className = "multi-select-acoes";
      const btnTodos = document.createElement("button");
      btnTodos.type = "button";
      btnTodos.textContent = "Selecionar todas";
      btnTodos.addEventListener("click", () => {
        opcoes.forEach((o) => selecionados.add(o));
        renderPainel();
        atualizarResumo();
        onChange();
      });
      const btnLimpar = document.createElement("button");
      btnLimpar.type = "button";
      btnLimpar.textContent = "Limpar";
      btnLimpar.addEventListener("click", () => {
        selecionados.clear();
        renderPainel();
        atualizarResumo();
        onChange();
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
        resumoEl.textContent = `${selecionados.size} selecionadas`;
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
  }

  configurarMultiSelect({
    painel: painelClassificacao,
    toggle: toggleClassificacao,
    container: multiClassificacao,
    resumoEl: resumoClassificacao,
    getOpcoes: () => classificacoes,
    selecionados: classificacoesSelecionadas,
    labelTodos: "Todas",
    onChange: () => renderTabela(),
  });

  // ====================================================
  // FILTRAGEM
  // ====================================================
  function aplicarFiltros() {
    const termo = buscaInput.value.trim().toLowerCase();
    const tipoSel = filtroTipo.value;

    return lancamentos
      .map((l, indexOriginal) => ({ ...l, indexOriginal }))
      .filter((l) => {
        const buscaOK =
          termo === "" ||
          l.descricao.toLowerCase().includes(termo) ||
          (l.observacao || "").toLowerCase().includes(termo);
        const tipoOK = tipoSel === "todos" || l.tipo === tipoSel;
        const classificacaoOK =
          classificacoesSelecionadas.size === 0 || classificacoesSelecionadas.has(l.classificacao);
        return buscaOK && tipoOK && classificacaoOK;
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatarData(isoDate) {
    if (!isoDate) return "";
    const [ano, mes, dia] = isoDate.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // ====================================================
  // RENDERIZAÇÃO
  // ====================================================
  function renderTabela() {
    const itens = aplicarFiltros();
    tabelaBody.innerHTML = "";

    let totalEntradas = 0;
    let totalSaidas = 0;

    itens.forEach((l) => {
      if (l.tipo === "entrada") totalEntradas += l.valor;
      else totalSaidas += l.valor;

      const tr = document.createElement("tr");
      const valorClasse = l.tipo === "entrada" ? "valor-entrada" : "valor-saida";
      const valorSinal = l.tipo === "entrada" ? "+" : "−";

      tr.innerHTML = `
        <td data-label="Data">${formatarData(l.data)}</td>
        <td data-label="Descrição">${l.descricao}</td>
        <td data-label="Classificação"><span class="tag-classificacao">${l.classificacao}</span></td>
        <td data-label="Observação" class="coluna-observacao">${l.observacao || "—"}</td>
        <td data-label="Valor" class="${valorClasse}">${valorSinal} R$ ${formatarMoeda(l.valor)}</td>
        <td data-label="Ações">
          <button class="btn-editar" data-edit-index="${l.indexOriginal}">Editar</button>
          <button class="btn-excluir-item" data-delete-index="${l.indexOriginal}">Excluir</button>
        </td>
      `;
      tabelaBody.appendChild(tr);
    });

    semResultados.style.display = itens.length === 0 ? "block" : "none";
    document.getElementById("tabelaLancamentos").style.display = itens.length === 0 ? "none" : "table";

    tabelaBody.querySelectorAll("[data-edit-index]").forEach((btn) => {
      btn.addEventListener("click", () => editar(parseInt(btn.dataset.editIndex, 10)));
    });
    tabelaBody.querySelectorAll("[data-delete-index]").forEach((btn) => {
      btn.addEventListener("click", () => excluir(parseInt(btn.dataset.deleteIndex, 10)));
    });

    const saldo = totalEntradas - totalSaidas;
    totalEntradaValor.textContent = `R$ ${formatarMoeda(totalEntradas)}`;
    totalSaidaValor.textContent = `R$ ${formatarMoeda(totalSaidas)}`;
    totalSaldoValor.textContent = `R$ ${formatarMoeda(saldo)}`;
  }

  function renderResumoGeral() {
    // Resumo geral (cards no topo) considera TODOS os lançamentos,
    // não só os filtrados — dá uma visão geral da conta.
    let totalEntradas = 0;
    let totalSaidas = 0;
    lancamentos.forEach((l) => {
      if (l.tipo === "entrada") totalEntradas += l.valor;
      else totalSaidas += l.valor;
    });
    const saldo = totalEntradas - totalSaidas;
    resumoEntradaValor.textContent = `R$ ${formatarMoeda(totalEntradas)}`;
    resumoSaidaValor.textContent = `R$ ${formatarMoeda(totalSaidas)}`;
    resumoSaldoValor.textContent = `R$ ${formatarMoeda(saldo)}`;
  }

  function renderTudo() {
    renderClassificacoes();
    renderResumoGeral();
    renderTabela();
  }

  // ====================================================
  // FILTROS — disparam nova renderização
  // ====================================================
  buscaInput.addEventListener("input", renderTabela);
  filtroTipo.addEventListener("change", renderTabela);

  btnLimparFiltros.addEventListener("click", () => {
    buscaInput.value = "";
    filtroTipo.value = "todos";
    classificacoesSelecionadas.clear();
    resumoClassificacao.textContent = "Todas";
    renderTabela();
  });

  // ====================================================
  // INICIALIZAÇÃO
  // ====================================================
  definirTipoModal("entrada");
  renderTudo();
})();