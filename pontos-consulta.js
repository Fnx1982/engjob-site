// ============================================================
// pontos-consulta.js
// Tela do gestor: consulta pontos de todos os funcionários,
// edita batidas, adiciona lançamentos, configura jornadas.
// ============================================================

// CEO (login fixo) e qualquer usuário com permissão sempre têm acesso.
const _userTypePontos = (localStorage.getItem("userType") || "").toLowerCase();
const _temPermissaoPontos = _userTypePontos === "ceo" || podeAlterarPontosDeOutros();

if (!_temPermissaoPontos) {
  mostrarToast("Sem permissão para acessar esta área.", "erro");
  setTimeout(() => window.location.href = "home.html", 1500);
}

const NOMES_MESES = NOMES_MESES_PONTO;
let abaAtiva = "funcionarios";
let funcSelecionado = null; // { registro, nome } do funcionário no modal de detalhe
let batidaEditandoId = null;
let lancamentoEditandoId = null;

// ====================================================
// ABAS
// ====================================================
document.querySelectorAll("[data-aba]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-aba]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    abaAtiva = btn.dataset.aba;
    document.getElementById("abaFuncionarios").style.display = abaAtiva === "funcionarios" ? "block" : "none";
    document.getElementById("abaLancamentos").style.display = abaAtiva === "lancamentos" ? "block" : "none";
    document.getElementById("abaJornadas").style.display = abaAtiva === "jornadas" ? "block" : "none";
    if (abaAtiva === "lancamentos") renderLancamentosGestor();
    if (abaAtiva === "jornadas") renderJornadas();
  });
});

// ====================================================
// FUNCIONÁRIOS (aba principal)
// ====================================================
function listarFuncionarios() {
  return JSON.parse(localStorage.getItem("usuarios")) || [];
}

function popularFiltrosConsulta() {
  const mesEl = document.getElementById("filtroMesConsulta");
  const anoEl = document.getElementById("filtroAnoConsulta");
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  mesEl.innerHTML = "";
  NOMES_MESES.forEach((nome, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = nome;
    if (i === mesAtual) opt.selected = true;
    mesEl.appendChild(opt);
  });

  anoEl.innerHTML = "";
  for (let a = anoAtual; a >= anoAtual - 3; a--) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    if (a === anoAtual) opt.selected = true;
    anoEl.appendChild(opt);
  }

  mesEl.addEventListener("change", renderTabelaFuncionarios);
  anoEl.addEventListener("change", renderTabelaFuncionarios);
}

function renderTabelaFuncionarios() {
  const termo = document.getElementById("buscaFuncionario").value.trim().toLowerCase();
  const tbody = document.getElementById("tbodyFuncionarios");
  const semEl = document.getElementById("semFuncionarios");
  const funcionarios = listarFuncionarios().filter((f) =>
    termo === "" || f.nome.toLowerCase().includes(termo) || String(f.registro).includes(termo)
  );

  tbody.innerHTML = "";
  if (funcionarios.length === 0) { semEl.style.display = "block"; return; }
  semEl.style.display = "none";

  funcionarios.forEach((f) => {
    const banco = calcularBancoHoras(f.registro);
    const tr = document.createElement("tr");
    const corSaldo = banco.saldo >= 0 ? "#1c8a4b" : "crimson";
    tr.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.registro}</td>
      <td>${formatarHoras(banco.jornada)}/dia</td>
      <td>${formatarHoras(banco.horasTrabalhadas)}</td>
      <td style="color:${corSaldo};font-weight:700;">${banco.saldo >= 0 ? "+" : ""}${formatarHoras(banco.saldo)}</td>
      <td>
        <button class="btn-editar-mini" data-ver="${f.registro}" data-nome="${f.nome}">Ver Detalhes</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-ver]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalDetalhe(btn.dataset.ver, btn.dataset.nome));
  });
}

document.getElementById("buscaFuncionario").addEventListener("input", renderTabelaFuncionarios);
document.getElementById("btnLimparFiltros").addEventListener("click", () => {
  document.getElementById("buscaFuncionario").value = "";
  renderTabelaFuncionarios();
});

// ====================================================
// MODAL DETALHE DO FUNCIONÁRIO
// ====================================================
function abrirModalDetalhe(registro, nome) {
  funcSelecionado = { registro, nome };
  document.getElementById("tituloModalDetalhe").textContent = nome;
  popularFiltrosModal();
  renderModalBanco();
  renderModalBatidas();
  renderModalLancamentos();
  document.getElementById("modalDetalhe").classList.add("active");
}

document.getElementById("fecharModalDetalhe").addEventListener("click", () => {
  document.getElementById("modalDetalhe").classList.remove("active");
  funcSelecionado = null;
});
document.getElementById("modalDetalhe").addEventListener("click", (e) => {
  if (e.target.id === "modalDetalhe") {
    document.getElementById("modalDetalhe").classList.remove("active");
    funcSelecionado = null;
  }
});

function popularFiltrosModal() {
  const mesEl = document.getElementById("modalFiltroMes");
  const anoEl = document.getElementById("modalFiltroAno");
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  mesEl.innerHTML = "";
  NOMES_MESES.forEach((nome, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = nome;
    if (i === mesAtual) opt.selected = true;
    mesEl.appendChild(opt);
  });

  anoEl.innerHTML = "";
  for (let a = anoAtual; a >= anoAtual - 3; a--) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    if (a === anoAtual) opt.selected = true;
    anoEl.appendChild(opt);
  }

  mesEl.addEventListener("change", () => { renderModalBatidas(); renderModalBanco(); });
  anoEl.addEventListener("change", () => { renderModalBatidas(); renderModalBanco(); });
}

function renderModalBanco() {
  if (!funcSelecionado) return;
  const banco = calcularBancoHoras(funcSelecionado.registro);
  const container = document.getElementById("bancoModalCards");
  const corSaldo = banco.saldo >= 0 ? "positivo" : "negativo";
  container.innerHTML = `
    <div class="card-banco"><div class="rotulo">Jornada</div><div class="valor neutro">${formatarHoras(banco.jornada)}/dia</div></div>
    <div class="card-banco"><div class="rotulo">Trabalhadas</div><div class="valor neutro">${formatarHoras(banco.horasTrabalhadas)}</div></div>
    <div class="card-banco"><div class="rotulo">Saldo</div><div class="valor ${corSaldo}">${banco.saldo >= 0 ? "+" : ""}${formatarHoras(banco.saldo)}</div></div>
    <div class="card-banco"><div class="rotulo">Dias</div><div class="valor neutro">${banco.diasTrabalhados}</div></div>
  `;
}

function renderModalBatidas() {
  if (!funcSelecionado) return;
  const mes = parseInt(document.getElementById("modalFiltroMes").value);
  const ano = parseInt(document.getElementById("modalFiltroAno").value);
  const container = document.getElementById("batidasModalContainer");
  const jornada = getJornadaFuncionario(funcSelecionado.registro);

  const registros = lerRegistros().filter((r) => {
    if (r.registroFuncionario !== funcSelecionado.registro) return false;
    const d = new Date(r.dataHora);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const dias = [...new Set(registros.map((r) => r.dataHora.slice(0, 10)))].sort((a, b) => b.localeCompare(a));

  if (dias.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Sem batidas neste mês.</p>';
    return;
  }

  container.innerHTML = "";
  dias.forEach((data) => {
    const batidasDia = registros
      .filter((r) => r.dataHora.startsWith(data))
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

    const horasDia = calcularHorasTrabalhadasNoDia(batidasDia);
    const saldoDia = horasDia - jornada;
    const corSaldo = saldoDia >= 0 ? "#1c8a4b" : "crimson";

    const div = document.createElement("div");
    div.style.cssText = "background:rgba(255,255,255,0.8);border-radius:8px;padding:12px;margin-bottom:8px;";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong>${formatarDataBR(data)}</strong>
        <span style="color:${corSaldo};font-weight:700;">${formatarHoras(horasDia)} (${saldoDia >= 0 ? "+" : ""}${formatarHoras(saldoDia)})</span>
      </div>
      <div class="lista-batidas" style="margin-bottom:0;">
        ${batidasDia.map((b) => `
          <div class="chip-batida">
            <span class="horario">${formatarHoraBR(b.dataHora)}</span>
            <span class="tipo-batida tipo-${b.tipo}">${b.tipo === "entrada" ? "Entrada" : "Saída"}</span>
            ${b.obs ? `<span style="font-size:11px;color:#888;">${b.obs}</span>` : ""}
            <button class="btn-editar-mini" data-edit-bat="${b.id}">Editar</button>
            <button class="btn-excluir-mini" data-del-bat="${b.id}">Excluir</button>
          </div>
        `).join("")}
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll("[data-edit-bat]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalBatida(btn.dataset.editBat));
  });
  container.querySelectorAll("[data-del-bat]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmarAcao("Excluir esta batida?", "Essa ação não pode ser desfeita.");
      if (!ok) return;
      excluirBatida(btn.dataset.delBat);
      renderModalBatidas();
      renderModalBanco();
      renderTabelaFuncionarios();
    });
  });
}

function renderDocumentoLanc(l) {
  if (!l.documentoUrl) return "";
  return `<button class="btn-editar-mini" onclick="window.open('${l.documentoUrl}','_blank')" style="background:rgba(43,108,176,0.15);color:#2b6cb0;">📄 ${l.documentoNome || "Ver doc"}</button>`;
}

function renderDocumentoLanc(l) {
  if (!l.documentoUrl) return "";
  return `<button class="btn-editar-mini" onclick="window.open('${l.documentoUrl}','_blank')" style="background:rgba(43,108,176,0.15);color:#2b6cb0;">📄 ${l.documentoNome || "Ver doc"}</button>`;
}

function renderModalLancamentos() {
  if (!funcSelecionado) return;
  const container = document.getElementById("lancamentosModalContainer");
  const lancamentos = getLancamentosFuncionario(funcSelecionado.registro);

  if (lancamentos.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Sem lançamentos.</p>';
    return;
  }

  container.innerHTML = "";
  lancamentos.forEach((l) => {
    const info = TIPOS_LANCAMENTO[l.tipo] || { rotulo: l.tipo, efeito: "neutro" };
    const item = document.createElement("div");
    item.className = "lancamento-item";
    item.innerHTML = `
      <div class="lancamento-info">
        <span class="lancamento-tipo tipo-${info.efeito}">${info.rotulo}</span>
        <div class="lancamento-descricao">${formatarDataBR(l.data)} ${l.descricao ? "— " + l.descricao : ""} ${renderDocumentoLanc(l)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="lancamento-horas">${info.efeito === "credito" ? "+" : info.efeito === "debito" ? "-" : ""}${formatarHoras(Math.abs(l.horas))}</div>
        <div class="lancamento-acoes">
          <button class="btn-editar-mini" data-edit-lanc="${l.id}">Editar</button>
          <button class="btn-excluir-mini" data-del-lanc="${l.id}">Excluir</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-edit-lanc]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalLancamento(btn.dataset.editLanc));
  });
  container.querySelectorAll("[data-del-lanc]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmarAcao("Excluir lançamento?", "Essa ação não pode ser desfeita.");
      if (!ok) return;
      excluirLancamento(btn.dataset.delLanc);
      renderModalLancamentos();
      renderModalBanco();
      renderTabelaFuncionarios();
    });
  });
}

document.getElementById("btnAdicionarBatida").addEventListener("click", () => abrirModalBatida(null));
document.getElementById("btnAdicionarLancamentoDetalhe").addEventListener("click", () => abrirModalLancamento(null));
document.getElementById("btnExportarPdfPontos").addEventListener("click", () => {
  if (funcSelecionado) gerarPdfMensalPontos(funcSelecionado.registro, funcSelecionado.nome);
});

// ====================================================
// MODAL BATIDA
// ====================================================
function abrirModalBatida(id) {
  batidaEditandoId = id || null;
  document.getElementById("tituloModalBatida").textContent = id ? "Editar Batida" : "Adicionar Batida";

  if (id) {
    const bat = lerRegistros().find((r) => r.id === id);
    if (bat) {
      const dt = new Date(bat.dataHora);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById("campoDataHoraBatida").value = local;
      document.getElementById("campoTipoBatida").value = bat.tipo;
      document.getElementById("campoObsBatida").value = bat.obs || "";
    }
  } else {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById("campoDataHoraBatida").value = local;
    document.getElementById("campoTipoBatida").value = "entrada";
    document.getElementById("campoObsBatida").value = "";
  }
  document.getElementById("modalBatida").classList.add("active");
}

document.getElementById("fecharModalBatida").addEventListener("click", () => document.getElementById("modalBatida").classList.remove("active"));
document.getElementById("cancelarModalBatida").addEventListener("click", () => document.getElementById("modalBatida").classList.remove("active"));

document.getElementById("salvarModalBatida").addEventListener("click", () => {
  const dataHoraVal = document.getElementById("campoDataHoraBatida").value;
  const tipo = document.getElementById("campoTipoBatida").value;
  const obs = document.getElementById("campoObsBatida").value.trim();

  if (!dataHoraVal) { mostrarToast("Informe a data e hora.", "erro"); return; }

  const dataHoraISO = new Date(dataHoraVal).toISOString();

  if (batidaEditandoId) {
    editarBatida(batidaEditandoId, { dataHora: dataHoraISO, tipo, obs });
  } else {
    const registros = lerRegistros();
    registros.push({
      id: `bat_${Date.now()}`,
      registroFuncionario: funcSelecionado.registro,
      nomeFuncionario: funcSelecionado.nome,
      dataHora: dataHoraISO,
      tipo,
      obs,
    });
    salvarRegistros(registros);
  }

  document.getElementById("modalBatida").classList.remove("active");
  renderModalBatidas();
  renderModalBanco();
  renderTabelaFuncionarios();
  mostrarToast("Batida salva.");
});

// ====================================================
// MODAL LANÇAMENTO
// ====================================================
function popularSelectFuncionarios(registroFixo) {
  const select = document.getElementById("campoFuncLancamento");
  const funcionarios = listarFuncionarios();
  select.innerHTML = "";
  funcionarios.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.registro;
    opt.textContent = `${f.nome} (${f.registro})`;
    if (String(f.registro) === String(registroFixo)) opt.selected = true;
    select.appendChild(opt);
  });
  if (registroFixo) select.disabled = true;
  else select.disabled = false;
}

let _urlDocumentoAtual = null; // URL do arquivo do lançamento sendo editado

function abrirModalLancamento(id) {
  lancamentoEditandoId = id || null;
  _urlDocumentoAtual = null;
  document.getElementById("tituloModalLancamento").textContent = id ? "Editar Lançamento" : "Novo Lançamento";
  document.getElementById("campoDataLancamento").value = dataHoje();
  document.getElementById("campoArquivoLancamento").value = "";
  document.getElementById("docAtualLancamento").style.display = "none";

  if (id) {
    const l = lerLancamentos().find((x) => x.id === id);
    if (l) {
      popularSelectFuncionarios(l.registroFuncionario);
      document.getElementById("campoTipoLancamento").value = l.tipo;
      document.getElementById("campoDataLancamento").value = l.data;
      document.getElementById("campoHorasLancamento").value = Math.trunc(l.horas);
      document.getElementById("campoMinutosLancamento").value = Math.round((Math.abs(l.horas) % 1) * 60);
      document.getElementById("campoDescLancamento").value = l.descricao || "";
      if (l.documentoUrl) {
        _urlDocumentoAtual = l.documentoUrl;
        document.getElementById("docAtualNome").textContent = l.documentoNome || "documento";
        document.getElementById("docAtualLancamento").style.display = "block";
      }
    }
  } else {
    popularSelectFuncionarios(funcSelecionado ? funcSelecionado.registro : null);
    document.getElementById("campoTipoLancamento").value = "hora_extra";
    document.getElementById("campoHorasLancamento").value = "";
    document.getElementById("campoMinutosLancamento").value = "";
    document.getElementById("campoDescLancamento").value = "";
  }

  document.getElementById("modalLancamento").classList.add("active");
}

document.getElementById("fecharModalLancamento").addEventListener("click", () => document.getElementById("modalLancamento").classList.remove("active"));
document.getElementById("cancelarModalLancamento").addEventListener("click", () => document.getElementById("modalLancamento").classList.remove("active"));
document.getElementById("btnRemoverDocLancamento").addEventListener("click", () => {
  _urlDocumentoAtual = null;
  document.getElementById("docAtualLancamento").style.display = "none";
});

document.getElementById("salvarModalLancamento").addEventListener("click", () => {
  const registroFunc = document.getElementById("campoFuncLancamento").value;
  const tipo = document.getElementById("campoTipoLancamento").value;
  const data = document.getElementById("campoDataLancamento").value;
  const horasVal = document.getElementById("campoHorasLancamento").value;
  const minutosVal = document.getElementById("campoMinutosLancamento").value;
  const descricao = document.getElementById("campoDescLancamento").value.trim();
  const arquivoInput = document.getElementById("campoArquivoLancamento");
  const arquivo = arquivoInput.files[0];

  if (!data || (horasVal === "" && minutosVal === "")) {
    mostrarToast("Informe a data e a duração.", "erro"); return;
  }

  const horasInt = parseInt(horasVal) || 0;
  const minutosInt = Math.min(59, Math.abs(parseInt(minutosVal) || 0));
  const sinal = horasInt < 0 ? -1 : 1;
  const horas = sinal * (Math.abs(horasInt) + minutosInt / 60);
  const funcObj = listarFuncionarios().find((f) => String(f.registro) === String(registroFunc));
  const nomeFuncionario = funcObj ? funcObj.nome : registroFunc;

  // Processa arquivo: se novo arquivo selecionado, cria URL; senão mantém o atual
  let documentoUrl = _urlDocumentoAtual;
  let documentoNome = null;
  if (arquivo) {
    documentoUrl = URL.createObjectURL(arquivo);
    documentoNome = arquivo.name;
  } else if (_urlDocumentoAtual) {
    const l = lancamentoEditandoId ? lerLancamentos().find((x) => x.id === lancamentoEditandoId) : null;
    documentoNome = l ? l.documentoNome : null;
  }

  const dadosLanc = { tipo, data, horas, descricao, documentoUrl, documentoNome };

  if (lancamentoEditandoId) {
    editarLancamento(lancamentoEditandoId, dadosLanc);
  } else {
    adicionarLancamento({ registroFuncionario: registroFunc, nomeFuncionario, ...dadosLanc });
  }

  document.getElementById("modalLancamento").classList.remove("active");
  if (funcSelecionado) { renderModalLancamentos(); renderModalBanco(); }
  renderTabelaFuncionarios();
  renderLancamentosGestor();
  mostrarToast("Lançamento salvo.");
});

// ====================================================
// ABA LANÇAMENTOS (visão global)
// ====================================================
function renderLancamentosGestor() {
  const container = document.getElementById("listaLancamentosGestor");
  const todos = lerLancamentos().sort((a, b) => new Date(b.data) - new Date(a.data));

  if (todos.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Nenhum lançamento registrado.</p>';
    return;
  }

  container.innerHTML = "";
  todos.forEach((l) => {
    const info = TIPOS_LANCAMENTO[l.tipo] || { rotulo: l.tipo, efeito: "neutro" };
    const item = document.createElement("div");
    item.className = "lancamento-item";
    item.innerHTML = `
      <div class="lancamento-info">
        <span class="lancamento-tipo tipo-${info.efeito}">${info.rotulo}</span>
        <div class="lancamento-descricao"><strong>${l.nomeFuncionario}</strong> — ${formatarDataBR(l.data)} ${l.descricao ? "— " + l.descricao : ""} ${renderDocumentoLanc(l)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="lancamento-horas">${info.efeito === "credito" ? "+" : info.efeito === "debito" ? "-" : ""}${formatarHoras(Math.abs(l.horas))}</div>
        <div class="lancamento-acoes">
          <button class="btn-editar-mini" data-gl-edit="${l.id}">Editar</button>
          <button class="btn-excluir-mini" data-gl-del="${l.id}">Excluir</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-gl-edit]").forEach((btn) => {
    btn.addEventListener("click", () => { funcSelecionado = null; abrirModalLancamento(btn.dataset.glEdit); });
  });
  container.querySelectorAll("[data-gl-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmarAcao("Excluir lançamento?", "Essa ação não pode ser desfeita.");
      if (!ok) return;
      excluirLancamento(btn.dataset.glDel);
      renderLancamentosGestor();
      renderTabelaFuncionarios();
    });
  });
}

document.getElementById("btnNovoLancamento").addEventListener("click", () => {
  funcSelecionado = null;
  abrirModalLancamento(null);
});

// ====================================================
// ABA JORNADAS
// ====================================================
function renderJornadas() {
  const tbody = document.getElementById("tbodyJornadas");
  const funcionarios = listarFuncionarios();
  tbody.innerHTML = "";

  funcionarios.forEach((f) => {
    const jornada = getJornadaFuncionario(f.registro);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.registro}</td>
      <td id="jornadaValor_${f.registro}">${formatarHoras(jornada)}/dia</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="number" min="1" max="24" step="0.5" value="${jornada}"
            id="jornadaInput_${f.registro}"
            style="width:70px;padding:6px;border:1px solid #ccc;border-radius:6px;font-family:inherit;"
            placeholder="horas"
          />
          <button class="btn-editar-mini" data-salvar-jornada="${f.registro}">Salvar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-salvar-jornada]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reg = btn.dataset.salvarJornada;
      const horas = parseFloat(document.getElementById(`jornadaInput_${reg}`).value);
      if (!horas || horas <= 0) { mostrarToast("Informe um valor válido.", "erro"); return; }
      setJornadaFuncionario(reg, horas);
      document.getElementById(`jornadaValor_${reg}`).textContent = formatarHoras(horas) + "/dia";
      mostrarToast("Jornada salva.");
      renderTabelaFuncionarios();
    });
  });
}

// ====================================================
// INICIALIZAÇÃO
// ====================================================
popularFiltrosConsulta();
renderTabelaFuncionarios();

// ====================================================
// PDF MENSAL DE PONTOS
// ====================================================
function gerarPdfMensalPontos(registroFuncionario, nomeFuncionario) {
  const mes = parseInt(document.getElementById("modalFiltroMes").value);
  const ano = parseInt(document.getElementById("modalFiltroAno").value);
  const nomeMes = NOMES_MESES_PONTO[mes];
  const jornada = getJornadaFuncionario(registroFuncionario);
  const banco = calcularBancoHoras(registroFuncionario);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 40;
  let y = 50;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RELATÓRIO DE PONTO MENSAL", margem, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Funcionário: ${nomeFuncionario}`, margem, y);
  doc.text(`Período: ${nomeMes} / ${ano}`, margem + 280, y);
  y += 14;
  doc.text(`Jornada diária: ${formatarHoras(jornada)}`, margem, y);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, margem + 280, y);
  y += 22;

  doc.setDrawColor(235, 153, 28);
  doc.setLineWidth(1);
  doc.line(margem, y, doc.internal.pageSize.getWidth() - margem, y);
  y += 18;

  // Resumo do banco de horas
  doc.autoTable({
    startY: y,
    head: [["Horas Trabalhadas", "Horas Esperadas", "Saldo do Banco", "Dias Trabalhados"]],
    body: [[
      formatarHoras(banco.horasTrabalhadas),
      formatarHoras(banco.horasEsperadas),
      (banco.saldo >= 0 ? "+" : "") + formatarHoras(banco.saldo),
      String(banco.diasTrabalhados),
    ]],
    margin: { left: margem, right: margem },
    styles: { fontSize: 10, halign: "center" },
    headStyles: { fillColor: [235, 153, 28] },
  });
  y = doc.lastAutoTable.finalY + 20;

  // Batidas do mês agrupadas por dia
  const registros = lerRegistros().filter((r) => {
    if (r.registroFuncionario !== registroFuncionario) return false;
    const d = new Date(r.dataHora);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const dias = [...new Set(registros.map((r) => r.dataHora.slice(0, 10)))].sort();

  const linhasBatidas = [];
  let totalHorasMes = 0;

  dias.forEach((data) => {
    const batidasDia = registros
      .filter((r) => r.dataHora.startsWith(data))
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

    const horasDia = calcularHorasTrabalhadasNoDia(batidasDia);
    const saldoDia = horasDia - jornada;
    totalHorasMes += horasDia;

    const horarios = batidasDia.map((b) =>
      `${formatarHoraBR(b.dataHora)} (${b.tipo === "entrada" ? "E" : "S"})${b.endereco ? " 📍" : ""}`
    ).join("  |  ");

    const enderecos = batidasDia
      .filter((b) => b.endereco)
      .map((b) => `${formatarHoraBR(b.dataHora)}: ${b.endereco}`)
      .join(" | ");

    linhasBatidas.push([
      formatarDataBR(data),
      horarios || "—",
      enderecos || "—",
      formatarHoras(horasDia),
      (saldoDia >= 0 ? "+" : "") + formatarHoras(saldoDia),
    ]);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Registro de Batidas", margem, y);
  y += 8;

  doc.autoTable({
    startY: y,
    head: [["Data", "Batidas (E=Entrada / S=Saída)", "Localização", "Horas", "Saldo dia"]],
    body: linhasBatidas.length ? linhasBatidas : [["—", "Sem registros neste mês", "—", "—"]],
    foot: [["", "TOTAL DO MÊS", "", formatarHoras(totalHorasMes), ""]],
    margin: { left: margem, right: margem },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [235, 153, 28] },
    footStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
  });
  y = doc.lastAutoTable.finalY + 20;

  // Lançamentos do mês
  const lancamentos = getLancamentosFuncionario(registroFuncionario).filter((l) => {
    const d = new Date(l.data);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  if (lancamentos.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 50; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Lançamentos Especiais", margem, y);
    y += 8;

    doc.autoTable({
      startY: y,
      head: [["Data", "Tipo", "Horas", "Descrição", "Documento"]],
      body: lancamentos.map((l) => {
        const info = TIPOS_LANCAMENTO[l.tipo] || { rotulo: l.tipo };
        return [
          formatarDataBR(l.data),
          info.rotulo,
          formatarHoras(Math.abs(l.horas)),
          l.descricao || "—",
          l.documentoNome || "—",
        ];
      }),
      margin: { left: margem, right: margem },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [70, 70, 70] },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  // Seção de localização: todas as batidas do mês que têm endereço
  const batidasComLoc = registros
    .filter((r) => r.endereco)
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

  if (batidasComLoc.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 50; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Registro de Localização", margem, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Endereços registrados automaticamente no momento de cada batida.", margem, y + 8);
    y += 16;

    doc.autoTable({
      startY: y,
      head: [["Data", "Hora", "Tipo", "Endereço", "Coordenadas"]],
      body: batidasComLoc.map((b) => [
        formatarDataBR(b.dataHora.slice(0, 10)),
        formatarHoraBR(b.dataHora),
        b.tipo === "entrada" ? "Entrada" : "Saída",
        b.endereco || "—",
        b.lat && b.lng ? `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : "—",
      ]),
      margin: { left: margem, right: margem },
      styles: { fontSize: 8, overflow: "linebreak" },
      headStyles: { fillColor: [43, 108, 176] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 40 },
        2: { cellWidth: 40 },
        3: { cellWidth: 280 },
        4: { cellWidth: 90 },
      },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  // Rodapé com assinatura
  const alturaPagina = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`EnJob Engenharia e Manutenção — Relatório gerado em ${new Date().toLocaleString("pt-BR")}`, margem, alturaPagina - 30);

  const nomeArquivo = `ponto_${nomeFuncionario.replace(/\s+/g, "_").toLowerCase()}_${nomeMes}_${ano}.pdf`;
  doc.save(nomeArquivo);
}
