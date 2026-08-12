// ============================================================
// pontos-confirmacao.js
// Tela do funcionário: bate ponto, vê batidas do dia,
// histórico do mês e lançamentos especiais próprios.
// ============================================================

const userId = localStorage.getItem("userId");
const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
const usuarioLogado = usuarios.find((u) => String(u.registro) === String(userId)) || null;

if (!usuarioLogado && (localStorage.getItem("userType") || "").toLowerCase() !== "ceo") {
  mostrarToast("Faça login para acessar o ponto.", "erro");
  setTimeout(() => window.location.href = "login.html", 1500);
}

const nomeUsuario = usuarioLogado ? usuarioLogado.nome : "CEO";
const registroUsuario = userId;

document.getElementById("nomeUsuarioLogado").textContent = `Olá, ${nomeUsuario}`;

// ====================================================
// RELÓGIO
// ====================================================
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("relogioDisplay").textContent =
    agora.toLocaleTimeString("pt-BR");
  document.getElementById("dataDisplay").textContent =
    agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000);

// ====================================================
// BATER PONTO
// ====================================================
document.getElementById("btnBaterPonto").addEventListener("click", async () => {
  const confirmado = await confirmarAcao(
    "Registrar ponto agora?",
    `${new Date().toLocaleTimeString("pt-BR")} — ${new Date().toLocaleDateString("pt-BR")}`
  );
  if (!confirmado) return;

  // Desabilita o botão enquanto captura localização (pode demorar até 8s)
  const btn = document.getElementById("btnBaterPonto");
  btn.disabled = true;
  btn.textContent = "Aguardando localização...";

  const batida = await baterPonto(registroUsuario, nomeUsuario);

  btn.disabled = false;
  btn.textContent = "Registrar Ponto";

  const localTexto = batida.endereco ? ` — 📍 ${batida.endereco}` : "";
  mostrarToast(`Ponto registrado: ${batida.tipo === "entrada" ? "Entrada" : "Saída"} às ${formatarHoraBR(batida.dataHora)}${localTexto}`);
  renderTudo();
});

// ====================================================
// BANCO DE HORAS
// ====================================================
function renderBancoHoras() {
  const banco = calcularBancoHoras(registroUsuario);
  document.getElementById("cardJornada").textContent = formatarHoras(banco.jornada);
  document.getElementById("cardTrabalhadas").textContent = formatarHoras(banco.horasTrabalhadas);
  document.getElementById("cardDias").textContent = banco.diasTrabalhados;

  const saldoEl = document.getElementById("cardSaldo");
  saldoEl.textContent = formatarHoras(banco.saldo);
  saldoEl.className = "valor " + (banco.saldo >= 0 ? "positivo" : "negativo");
}

// ====================================================
// BATIDAS DE HOJE
// ====================================================
function renderBatidasHoje() {
  const container = document.getElementById("listaBatidasHoje");
  const batidas = getBatidasFuncionarioData(registroUsuario, dataHoje());

  if (batidas.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Nenhuma batida registrada hoje.</p>';
    atualizarProximaBatida([]);
    return;
  }

  container.innerHTML = "";
  batidas.forEach((b, i) => {
    const chip = document.createElement("div");
    chip.className = "chip-batida";
    const linkMaps = b.lat ? `<a href="https://www.google.com/maps?q=${b.lat},${b.lng}" target="_blank" style="font-size:11px;color:#2b6cb0;text-decoration:none;">📍 ${b.endereco || "Ver no mapa"}</a>` : "";
    chip.innerHTML = `
      <span class="numero">#${i + 1}</span>
      <span class="horario">${formatarHoraBR(b.dataHora)}</span>
      <span class="tipo-batida tipo-${b.tipo}">${b.tipo === "entrada" ? "Entrada" : "Saída"}</span>
      ${linkMaps}
      ${b.obs ? `<span style="font-size:12px;color:#888;">${b.obs}</span>` : ""}
    `;
    container.appendChild(chip);
  });

  atualizarProximaBatida(batidas);
}

function atualizarProximaBatida(batidas) {
  const el = document.getElementById("proximaBatidaTexto");
  if (batidas.length === 0) {
    el.textContent = "Próximo registro: Entrada";
    return;
  }
  const ultima = batidas[batidas.length - 1];
  el.textContent = `Próximo registro: ${ultima.tipo === "entrada" ? "Saída" : "Entrada"}`;
}

// ====================================================
// HISTÓRICO DO MÊS
// ====================================================
function popularFiltrosMesPonto() {
  const mesEl = document.getElementById("filtroMesPonto");
  const anoEl = document.getElementById("filtroAnoPonto");

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  mesEl.innerHTML = "";
  NOMES_MESES_PONTO.forEach((nome, i) => {
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

  mesEl.addEventListener("change", renderHistoricoMes);
  anoEl.addEventListener("change", renderHistoricoMes);
}

function renderHistoricoMes() {
  const mes = parseInt(document.getElementById("filtroMesPonto").value);
  const ano = parseInt(document.getElementById("filtroAnoPonto").value);
  const container = document.getElementById("historicoMes");

  const registros = lerRegistros().filter((r) => {
    if (r.registroFuncionario !== registroUsuario) return false;
    const d = new Date(r.dataHora);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const datasPorDia = [...new Set(registros.map((r) => r.dataHora.slice(0, 10)))].sort((a, b) => b.localeCompare(a));

  if (datasPorDia.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Nenhum registro neste mês.</p>';
    return;
  }

  const jornada = getJornadaFuncionario(registroUsuario);

  container.innerHTML = "";
  datasPorDia.forEach((data) => {
    const batidasDia = registros
      .filter((r) => r.dataHora.startsWith(data))
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

    const horasDia = calcularHorasTrabalhadasNoDia(batidasDia);
    const saldoDia = horasDia - jornada;
    const corSaldo = saldoDia >= 0 ? "#1c8a4b" : "crimson";

    const div = document.createElement("div");
    div.style.cssText = "background:rgba(255,255,255,0.9);border-radius:8px;padding:12px 16px;margin-bottom:8px;box-shadow:0 0 8px rgba(0,0,0,0.07);";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <strong>${formatarDataBR(data)}</strong>
        <span style="color:${corSaldo};font-weight:700;">${formatarHoras(horasDia)} trabalhadas (${saldoDia >= 0 ? "+" : ""}${formatarHoras(saldoDia)})</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
        ${batidasDia.map((b, i) => `
          <span style="font-size:13px;padding:4px 10px;border-radius:10px;background:${b.tipo === "entrada" ? "rgba(28,138,75,0.12)" : "rgba(220,20,60,0.1)"};color:${b.tipo === "entrada" ? "#1c8a4b" : "crimson"};">
            ${formatarHoraBR(b.dataHora)} ${b.tipo === "entrada" ? "▶" : "■"}
          </span>
        `).join("")}
      </div>
    `;
    container.appendChild(div);
  });
}

// ====================================================
// LANÇAMENTOS ESPECIAIS
// ====================================================
function renderLancamentos() {
  const container = document.getElementById("listaLancamentos");
  const lancamentos = getLancamentosFuncionario(registroUsuario);

  if (lancamentos.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Nenhum lançamento registrado.</p>';
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
        <div class="lancamento-descricao">${formatarDataBR(l.data)} ${l.descricao ? "— " + l.descricao : ""} ${l.documento ? '<span style="color:#2b6cb0;font-size:12px;">📄 ' + l.documento + '</span>' : ""}</div>
      </div>
      <div class="lancamento-horas" style="color:${info.efeito === "credito" ? "#1c8a4b" : info.efeito === "debito" ? "crimson" : "#2b6cb0"};">
        ${info.efeito === "credito" ? "+" : info.efeito === "debito" ? "-" : ""}${formatarHoras(Math.abs(l.horas))}
      </div>
    `;
    container.appendChild(item);
  });
}

// ====================================================
// INICIALIZAÇÃO
// ====================================================
function renderTudo() {
  renderBancoHoras();
  renderBatidasHoje();
  renderHistoricoMes();
  renderLancamentos();
}

popularFiltrosMesPonto();
renderTudo();