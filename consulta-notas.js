// ============================================================
// consulta-notas.js — visão unificada de todas as notas fiscais
// (NF-e + NFS-e), com filtro por tipo, busca, detalhes, baixar
// PDF e excluir.
// ============================================================

let todasAsNotas = [];
let filtroTipoAtual = "todas"; // "todas" | "NF-e" | "NFS-e"

// Dados da empresa pro cabeçalho do PDF — versão local, só com o
// necessário aqui (evita carregar propostas-core.js inteiro só por
// causa de um cabeçalho).
const EMPRESA_INFO_CONSULTA = {
  nome: "ENGJOB ENGENHARIA E MANUTENÇÃO",
  cnpj: "14.426.042/0001-01",
  endereco: "Rua La Salle, 300 - Casa 7 - Pinheirinho - Curitiba/Paraná - CEP 81880-400",
};

const WORKER_URL_CONSULTA = "https://engjob-storage.engjobmanut.workers.dev";

function uploadBlobParaArmazenamento(chave, blob, contentType) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${WORKER_URL_CONSULTA}?action=put&key=${encodeURIComponent(chave)}`);
    xhr.setRequestHeader("Content-Type", contentType);
    const token = localStorage.getItem("sessionToken") || "";
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onload = () => { if (xhr.status < 300) resolve(); else reject(new Error("Falha ao salvar no Armazenamento (" + xhr.status + ")")); };
    xhr.onerror = () => reject(new Error("Falha de conexão ao salvar no Armazenamento"));
    xhr.send(blob);
  });
}

// Gera o PDF de uma nota fiscal (NF-e ou NFS-e) — layout simples,
// com a logo real e os dados do tomador/itens/impostos.
function gerarPdfNotaFiscal(nota) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 40;
  const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;
  let y = 40;

  const larguraLogo = 140;
  const alturaLogo = larguraLogo / (typeof LOGO_ENGJOB_PROPORCAO !== "undefined" ? LOGO_ENGJOB_PROPORCAO : 3.35);
  try {
    if (typeof LOGO_ENGJOB_BASE64 !== "undefined") doc.addImage(LOGO_ENGJOB_BASE64, "JPEG", margem, y - 6, larguraLogo, alturaLogo);
  } catch (e) { console.warn("[consulta-notas] logo não pôde ser desenhada:", e); }

  const xTexto = margem + larguraLogo + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(EMPRESA_INFO_CONSULTA.endereco, xTexto, y + 6);
  doc.text(`CNPJ: ${EMPRESA_INFO_CONSULTA.cnpj}`, xTexto, y + 18);

  y = Math.max(y + 18, y - 6 + alturaLogo) + 16;
  doc.setDrawColor(235, 153, 28);
  doc.setLineWidth(1.2);
  doc.line(margem, y, margem + larguraUtil, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(nota.tipo === "NF-e" ? "NOTA FISCAL DE MATERIAL (rascunho/conferência)" : "NOTA FISCAL DE SERVIÇO (rascunho/conferência)", margem, y + 14);
  y += 30;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold"); doc.text("Cliente/Tomador:", margem, y);
  doc.setFont("helvetica", "normal"); doc.text(nota.tomadorNome || "-", margem + 110, y);
  y += 15;
  doc.setFont("helvetica", "bold"); doc.text("Documento:", margem, y);
  doc.setFont("helvetica", "normal"); doc.text(nota.tomadorDocumento || "-", margem + 110, y);
  y += 15;
  doc.setFont("helvetica", "bold"); doc.text("Endereço:", margem, y);
  doc.setFont("helvetica", "normal"); doc.text(nota.tomadorEndereco || "-", margem + 110, y);
  y += 25;

  const linhasItens = (nota.itens || []).map((i) => [
    i.descricao, String(i.quantidade || 0), formatarMoedaConsulta(i.valorUnitario),
    formatarMoedaConsulta((i.quantidade || 0) * (i.valorUnitario || 0)),
  ]);
  doc.autoTable({
    startY: y,
    head: [["Descrição", "Qtd.", "Valor Unit.", "Total"]],
    body: linhasItens.length ? linhasItens : [["Nenhum item cadastrado.", "-", "-", "-"]],
    headStyles: { fillColor: [235, 153, 28] },
    margin: { left: margem, right: margem },
  });
  y = doc.lastAutoTable.finalY + 20;

  const { subtotal, totalImpostos, total } = calcularTotalNota(nota);
  doc.setFontSize(10);
  doc.text(`Subtotal: ${formatarMoedaConsulta(subtotal)}`, margem + larguraUtil - 160, y);
  y += 14;
  doc.text(`Impostos: ${formatarMoedaConsulta(totalImpostos)}`, margem + larguraUtil - 160, y);
  y += 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(`Total: ${formatarMoedaConsulta(total)}`, margem + larguraUtil - 160, y);

  if (nota.status === "cancelada") {
    doc.setTextColor(220, 20, 60);
    doc.setFontSize(40);
    doc.text("CANCELADA", 150, 450, { angle: 35 });
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

// Baixa o PDF no computador do usuário E arquiva uma cópia no
// Armazenamento (pasta "Notas Fiscais/NF-e" ou ".../NFS-e"), pra
// ficar organizado e com backup — sem precisar de ação manual.
async function baixarEArquivarNotaFiscal(nota) {
  const doc = gerarPdfNotaFiscal(nota);
  const nomeArquivo = `${nota.tipo}_${nota.tomadorNome.replace(/[^a-z0-9]+/gi, "-")}_${nota.id}.pdf`;

  doc.save(nomeArquivo);

  try {
    const blob = doc.output("blob");
    const chave = `Notas Fiscais/${nota.tipo}/${nomeArquivo}`;
    await uploadBlobParaArmazenamento(chave, blob, "application/pdf");
    mostrarToast("PDF baixado e arquivado no Armazenamento.");
  } catch (e) {
    // O download já aconteceu — o arquivamento é um "extra", se falhar
    // não deve parecer que a ação toda deu errado.
    console.warn("[consulta-notas] Não foi possível arquivar no Armazenamento:", e);
    mostrarToast("PDF baixado (mas não foi possível arquivar automaticamente no Armazenamento).", "erro");
  }
}

function formatarMoedaConsulta(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularTotalNota(nota) {
  const subtotal = (nota.itens || []).reduce((s, i) => s + (i.quantidade || 0) * (i.valorUnitario || 0), 0);
  const totalImpostos = (nota.impostos || []).reduce((s, i) => s + subtotal * ((i.percentual || 0) / 100), 0);
  return { subtotal, totalImpostos, total: subtotal + totalImpostos };
}

async function carregarConsulta() {
  const resposta = await apiListarNotasFiscais();
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar notas.", "erro"); return; }
  todasAsNotas = resposta.notas;
  renderizarConsulta();
}

function renderizarConsulta() {
  const busca = document.getElementById("buscaConsulta").value.trim().toLowerCase();
  let filtradas = todasAsNotas;
  if (filtroTipoAtual !== "todas") filtradas = filtradas.filter((n) => n.tipo === filtroTipoAtual);
  if (busca) filtradas = filtradas.filter((n) => (n.tomadorNome || "").toLowerCase().includes(busca));

  filtradas = [...filtradas].sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0));

  const lista = document.getElementById("listaConsulta");
  const vazio = document.getElementById("vazioConsulta");
  lista.innerHTML = "";

  if (filtradas.length === 0) { vazio.style.display = "block"; return; }
  vazio.style.display = "none";

  filtradas.forEach((nota) => {
    const { total } = calcularTotalNota(nota);
    const el = document.createElement("div");
    el.className = "item-nota-fiscal";
    el.innerHTML = `
      <div>
        <div class="nome-tomador">
          ${nota.tomadorNome}
          <span class="badge-status ${nota.status}">${nota.status}</span>
          <span class="badge-status" style="background:#EDEDED;color:#555;">${nota.tipo}</span>
        </div>
        <div class="meta">${(nota.itens || []).length} item(ns) · ${new Date(nota.atualizadoEm || nota.criadoEm).toLocaleString("pt-BR")}</div>
      </div>
      <div class="valor">${formatarMoedaConsulta(total)}</div>
      <div class="acoes">
        <button class="btn-detalhes-consulta">Detalhes</button>
        <button class="btn-baixar-consulta">⬇ Baixar PDF</button>
        <button class="btn-excluir-nota">Excluir</button>
      </div>
    `;

    const painelDetalhes = document.createElement("div");
    painelDetalhes.style.cssText = "display:none;padding:14px 18px;background:#fafafa;border-top:1px solid #eee;font-size:13px;";
    const linhasItens = (nota.itens || []).map((i) =>
      `<div style="display:flex;justify-content:space-between;padding:3px 0;">
        <span>${i.descricao} (${i.quantidade}×${formatarMoedaConsulta(i.valorUnitario)})</span>
        <span>${formatarMoedaConsulta((i.quantidade || 0) * (i.valorUnitario || 0))}</span>
      </div>`
    ).join("");
    painelDetalhes.innerHTML = `
      <div><b>Documento:</b> ${nota.tomadorDocumento || "—"}</div>
      <div><b>Endereço:</b> ${nota.tomadorEndereco || "—"}</div>
      ${nota.motivoCancelamento ? `<div style="color:var(--vermelho);"><b>Motivo do cancelamento:</b> ${nota.motivoCancelamento}</div>` : ""}
      <div style="margin-top:8px;"><b>Itens:</b></div>
      ${linhasItens || "<div>Nenhum item.</div>"}
    `;

    el.querySelector(".btn-detalhes-consulta").addEventListener("click", () => {
      const aberto = painelDetalhes.style.display === "block";
      painelDetalhes.style.display = aberto ? "none" : "block";
    });

    el.querySelector(".btn-baixar-consulta").addEventListener("click", async () => {
      const botao = el.querySelector(".btn-baixar-consulta");
      const textoOriginal = botao.textContent;
      botao.disabled = true;
      botao.textContent = "Gerando...";
      try {
        await baixarEArquivarNotaFiscal(nota);
      } catch (e) {
        mostrarToast("Erro ao gerar o PDF: " + e.message, "erro");
      } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
      }
    });

    el.querySelector(".btn-excluir-nota").addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir a nota de "${nota.tomadorNome}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirNotaFiscal(nota.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Excluída.");
      carregarConsulta();
    });

    lista.appendChild(el);
    lista.appendChild(painelDetalhes);
  });
}

// ── Abas de filtro ────────────────────────────────────────────
function aplicarFiltro(tipo, botaoAtivo) {
  filtroTipoAtual = tipo;
  [btnFiltroTodas, btnFiltroNfe, btnFiltroNfse].forEach((b) => {
    b.style.background = "transparent";
    b.style.color = "#666";
  });
  botaoAtivo.style.background = "var(--laranja, rgb(235,153,28))";
  botaoAtivo.style.color = "#fff";
  renderizarConsulta();
}

const btnFiltroTodas = document.getElementById("btnFiltroTodas");
const btnFiltroNfe = document.getElementById("btnFiltroNfe");
const btnFiltroNfse = document.getElementById("btnFiltroNfse");

btnFiltroTodas.addEventListener("click", () => aplicarFiltro("todas", btnFiltroTodas));
btnFiltroNfe.addEventListener("click", () => aplicarFiltro("NF-e", btnFiltroNfe));
btnFiltroNfse.addEventListener("click", () => aplicarFiltro("NFS-e", btnFiltroNfse));

document.getElementById("buscaConsulta").addEventListener("input", renderizarConsulta);

carregarConsulta();