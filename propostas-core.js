// ============================================================
// propostas-core.js
// Núcleo de dados compartilhado pelas 3 páginas do módulo de
// Propostas: orcamento.html, propostas.html e andamento.html.
// Todas leem/escrevem na MESMA lista (CHAVE_PROPOSTAS) — o que
// muda entre as páginas é só o filtro de status exibido.
//
// Ciclo de vida de uma proposta (campo "status"):
//   orcamento -> analise -> aprovada -> andamento -> finalizada
//                        -> negada
// ============================================================

const CHAVE_PROPOSTAS = "propostas_lista";

// ====================================================
// LEITURA / ESCRITA
// ====================================================
function lerPropostas() {
  return JSON.parse(localStorage.getItem(CHAVE_PROPOSTAS)) || [];
}
function salvarPropostas(lista) {
  localStorage.setItem(CHAVE_PROPOSTAS, JSON.stringify(lista));
}

function buscarProposta(id) {
  return lerPropostas().find((p) => p.id === id);
}

function criarPropostaVazia() {
  return {
    id: `prop_${Date.now()}`,
    cliente: "",
    telefone: "",
    local: "",
    servico: "",
    observacao: "",
    itensMaoDeObra: [],
    itensMateriais: [],
    formaPagamento: "",
    planejamentoDias: "",
    validadeDias: "",
    status: "orcamento",
    statusExecucao: "", // "andamento" | "finalizada" — só usado depois de aprovada
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
}

function salvarProposta(proposta) {
  const lista = lerPropostas();
  proposta.atualizadoEm = new Date().toISOString();
  const idx = lista.findIndex((p) => p.id === proposta.id);
  if (idx !== -1) {
    lista[idx] = proposta;
  } else {
    lista.push(proposta);
  }
  salvarPropostas(lista);
}

function excluirProposta(id) {
  const lista = lerPropostas().filter((p) => p.id !== id);
  salvarPropostas(lista);
}

// ====================================================
// TRANSIÇÕES DE STATUS
// ====================================================
function mudarStatusProposta(id, novoStatus) {
  const lista = lerPropostas();
  const proposta = lista.find((p) => p.id === id);
  if (!proposta) return;

  proposta.status = novoStatus;

  // Ao aprovar, a proposta sai de "Propostas" e entra automaticamente
  // em "Em Andamento" (com sub-status inicial "andamento").
  if (novoStatus === "aprovada") {
    proposta.status = "andamento";
    proposta.statusExecucao = "andamento";
  }

  proposta.atualizadoEm = new Date().toISOString();
  salvarPropostas(lista);
}

function mudarStatusExecucao(id, novoStatusExecucao) {
  const lista = lerPropostas();
  const proposta = lista.find((p) => p.id === id);
  if (!proposta) return;

  proposta.statusExecucao = novoStatusExecucao;
  if (novoStatusExecucao === "finalizada") {
    proposta.status = "finalizada";
  } else {
    proposta.status = "andamento";
  }
  proposta.atualizadoEm = new Date().toISOString();
  salvarPropostas(lista);
}

// Desfaz a aprovação: volta a proposta de "Em Andamento" para
// "Propostas" (status "analise"), permitindo reavaliar.
function reverterParaAnalise(id) {
  const lista = lerPropostas();
  const proposta = lista.find((p) => p.id === id);
  if (!proposta) return;

  proposta.status = "analise";
  proposta.statusExecucao = "";
  proposta.atualizadoEm = new Date().toISOString();
  salvarPropostas(lista);
}

// ====================================================
// SINCRONIZAÇÃO COM GESTÃO DE MATERIAIS
// ====================================================
function lerMateriaisEstoque() {
  return JSON.parse(localStorage.getItem("materiais_lista")) || [];
}
function salvarMateriaisEstoque(lista) {
  localStorage.setItem("materiais_lista", JSON.stringify(lista));
}

// Encontra o índice do material no estoque a partir do índice
// guardado no item da proposta (materialIndex). Retorna -1 se
// não encontrar (ex: material foi excluído do estoque depois).
function encontrarMaterialNoEstoque(materialIndex) {
  const estoque = lerMateriaisEstoque();
  if (materialIndex === null || materialIndex === undefined) return null;
  if (materialIndex < 0 || materialIndex >= estoque.length) return null;
  return estoque[materialIndex];
}

// Pergunta ao usuário se a edição de um item de material vinculado
// deve ser propagada de volta para o estoque (Gestão de Materiais).
// Retorna uma Promise<boolean>.
async function perguntarSincronizarMaterial(nomeMaterial) {
  return confirmarAcao(
    `Atualizar "${nomeMaterial}" na Gestão de Materiais também?`,
    "Isso vai sobrescrever o nome, valor e quantidade desse material no estoque com os novos valores."
  );
}

// Atualiza o material no estoque (Gestão de Materiais) com os
// novos dados, mantendo o setor original do material.
function atualizarMaterialNoEstoque(materialIndex, novosDados) {
  const estoque = lerMateriaisEstoque();
  if (materialIndex === null || materialIndex < 0 || materialIndex >= estoque.length) return;
  estoque[materialIndex] = {
    ...estoque[materialIndex],
    nome: novosDados.nome,
    valor: novosDados.valorUnit,
    quantidade: novosDados.qtd,
  };
  salvarMateriaisEstoque(estoque);
}

// ====================================================
// CÁLCULOS
// ====================================================
function totalMaoDeObra(proposta) {
  return proposta.itensMaoDeObra.reduce((s, item) => s + item.qtd * item.valorUnit, 0);
}
function totalMateriais(proposta) {
  return proposta.itensMateriais.reduce((s, item) => s + item.qtd * item.valorUnit, 0);
}
function totalGeral(proposta) {
  return totalMaoDeObra(proposta) + totalMateriais(proposta);
}

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ====================================================
// RÓTULOS E CORES DE STATUS
// ====================================================
function rotuloStatus(proposta) {
  const mapa = {
    orcamento: "Orçamento",
    analise: "Em Análise",
    negada: "Negada",
    andamento: proposta.statusExecucao === "finalizada" ? "Finalizada" : "Em Andamento",
    finalizada: "Finalizada",
  };
  return mapa[proposta.status] || proposta.status;
}

function corStatus(proposta) {
  if (proposta.status === "analise") return "amarelo";
  if (proposta.status === "negada") return "vermelho";
  if (proposta.status === "andamento" || proposta.status === "finalizada") return "verde";
  return "cinza"; // orcamento (ainda não enviado para análise)
}

// ====================================================
// GERAÇÃO DE PDF
// ============================================================
// Layout inspirado na planilha de proposta da empresa: cabeçalho
// com dados fixos da empresa, dados do cliente/obra, tabela de
// Mão de Obra, tabela de Materiais, totais, condições de
// pagamento e situação atual.
// ============================================================
const EMPRESA_INFO = {
  nome: "ENGJOB ENGENHARIA E MANUTENÇÃO",
  cnpj: "14.426.042/0001-01",
  endereco: "Rua La Salle, 300 - Casa 7",
  bairro: "Pinheirinho",
  cidade: "Curitiba",
  cep: "81880-400",
  estado: "Paraná",
  fone: "(41) 3 3330-8478",
  email: "contato@engjob.com.br",
};

function gerarPdfProposta(proposta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 40;
  const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;
  let y = 40;

  // ----- Cabeçalho da empresa -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(EMPRESA_INFO.nome, margem, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`CNPJ: ${EMPRESA_INFO.cnpj}`, margem, y);
  doc.text(`Endereço: ${EMPRESA_INFO.endereco}`, margem + 220, y);
  y += 13;
  doc.text(`Bairro: ${EMPRESA_INFO.bairro}`, margem, y);
  doc.text(`CEP: ${EMPRESA_INFO.cep}`, margem + 220, y);
  y += 13;
  doc.text(`Cidade: ${EMPRESA_INFO.cidade}`, margem, y);
  doc.text(`Estado: ${EMPRESA_INFO.estado}`, margem + 220, y);
  y += 13;
  doc.text(`Fone: ${EMPRESA_INFO.fone}`, margem, y);
  doc.text(`E-mail: ${EMPRESA_INFO.email}`, margem + 220, y);
  y += 20;

  doc.setDrawColor(235, 153, 28);
  doc.setLineWidth(1.2);
  doc.line(margem, y, margem + larguraUtil, y);
  y += 18;

  // ----- Dados do cliente / obra -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Cliente:", margem, y);
  doc.setFont("helvetica", "normal");
  doc.text(proposta.cliente || "-", margem + 50, y);

  doc.setFont("helvetica", "bold");
  doc.text("Fone:", margem + 300, y);
  doc.setFont("helvetica", "normal");
  doc.text(proposta.telefone || "-", margem + 335, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.text("Local:", margem, y);
  doc.setFont("helvetica", "normal");
  doc.text(proposta.local || "-", margem + 50, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.text("Serviço:", margem, y);
  doc.setFont("helvetica", "normal");
  const servicoLinhas = doc.splitTextToSize(proposta.servico || "-", larguraUtil - 55);
  doc.text(servicoLinhas, margem + 55, y);
  y += 16 * servicoLinhas.length + 8;

  // ----- Tabela: Mão de Obra -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("MÃO DE OBRA", margem, y);
  y += 8;

  const linhasMao = (proposta.itensMaoDeObra || []).map((item, i) => [
    String(i + 1),
    String(item.qtd),
    item.unid || "",
    item.descricao,
    `R$ ${formatarMoeda(item.valorUnit)}`,
    `R$ ${formatarMoeda(item.qtd * item.valorUnit)}`,
  ]);

  doc.autoTable({
    startY: y,
    head: [["Item", "Qtd", "Unid", "Descrição", "Valor Unit.", "Total"]],
    body: linhasMao.length ? linhasMao : [["-", "-", "-", "Nenhum item cadastrado", "-", "-"]],
    margin: { left: margem, right: margem },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [235, 153, 28] },
    foot: [["", "", "", "", "Total Mão de Obra", `R$ ${formatarMoeda(totalMaoDeObra(proposta))}`]],
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
  });
  y = doc.lastAutoTable.finalY + 24;

  // ----- Tabela: Materiais -----
  y = garantirEspacoPdf(doc, y, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("MATERIAIS", margem, y);
  y += 8;

  const linhasMat = (proposta.itensMateriais || []).map((item, i) => [
    String(i + 1),
    String(item.qtd),
    item.unid || "",
    item.nome,
    `R$ ${formatarMoeda(item.valorUnit)}`,
    `R$ ${formatarMoeda(item.qtd * item.valorUnit)}`,
  ]);

  doc.autoTable({
    startY: y,
    head: [["Item", "Qtd", "Unid", "Descrição", "Valor Unit.", "Total"]],
    body: linhasMat.length ? linhasMat : [["-", "-", "-", "Nenhum item cadastrado", "-", "-"]],
    margin: { left: margem, right: margem },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [235, 153, 28] },
    foot: [["", "", "", "", "Total Materiais", `R$ ${formatarMoeda(totalMateriais(proposta))}`]],
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
  });
  y = doc.lastAutoTable.finalY + 16;

  // ----- Total geral -----
  y = garantirEspacoPdf(doc, y, 60);
  doc.setFillColor(235, 153, 28);
  doc.rect(margem, y, larguraUtil, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("MATERIAL E MÃO DE OBRA — TOTAL:", margem + 10, y + 17);
  doc.text(`R$ ${formatarMoeda(totalGeral(proposta))}`, margem + larguraUtil - 10, y + 17, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 44;

  // ----- Condições / avisos -----
  y = garantirEspacoPdf(doc, y, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(200, 0, 0);
  doc.text("Não nos responsabilizamos por compra particular de material.", margem, y);
  doc.setTextColor(0, 0, 0);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.text(`Forma de pagamento: ${proposta.formaPagamento || "-"}`, margem, y);
  y += 16;
  doc.text(`Planejamento: ${proposta.planejamentoDias ? proposta.planejamentoDias + " dias úteis" : "-"}`, margem, y);
  y += 16;
  doc.text(`Proposta válida por: ${proposta.validadeDias ? proposta.validadeDias + " dias" : "-"}`, margem, y);
  y += 16;
  doc.text(`Início da proposta após aprovação.`, margem, y);
  y += 20;

  if (proposta.observacao) {
    const larguraUtilObs = doc.internal.pageSize.getWidth() - margem * 2;
    doc.setFont("helvetica", "bold");
    doc.text("Observação:", margem, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const linhasObs = doc.splitTextToSize(proposta.observacao, larguraUtilObs);
    doc.text(linhasObs, margem, y);
    y += 14 * linhasObs.length + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Situação: ${rotuloStatus(proposta)}`, margem, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${EMPRESA_INFO.cidade}, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`,
    margem,
    y
  );

  const nomeArquivo = `proposta_${(proposta.cliente || "sem_nome").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}

function garantirEspacoPdf(doc, y, minimo) {
  const alturaPagina = doc.internal.pageSize.getHeight();
  if (y + minimo > alturaPagina - 40) {
    doc.addPage();
    return 50;
  }
  return y;
}