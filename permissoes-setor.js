// ============================================================
// permissoes-setor.js
// Define quais itens do menu cada SETOR pode ver. Usado tanto na
// tela de Cadastro (gerenciarcontas.html, para configurar) quanto
// no home.js (para aplicar a visibilidade do menu).
//
// Armazenamento: localStorage["setoresPermissoes"], um objeto:
//   { "Financeiro": ["financeiro-menu", "relatorios-menu", ...], ... }
// Setores sem entrada aqui ainda (recém-criados) não liberam nada
// até alguém configurar as permissões deles.
// ============================================================

const CHAVE_SETORES_PERMISSOES = "setoresPermissoes";

// Todos os itens de menu que existem no site, com um rótulo amigável
// para exibir nos checkboxes de configuração.
const ITENS_MENU_DISPONIVEIS = [
  { id: "gerenciarcontas-menu", rotulo: "Cadastro" },
  { id: "financeiro-menu", rotulo: "Financeiro" },
  { id: "relatorios-menu", rotulo: "Relatórios" },
  { id: "obras-menu", rotulo: "Obras" },
  { id: "gestaomaterial-menu", rotulo: "Gestão de Material" },
  { id: "armazenamento-menu", rotulo: "Armazenamento" },
  { id: "boletos-menu", rotulo: "Boletos" },
  { id: "notas-menu", rotulo: "Notas" },
  { id: "propostas-menu", rotulo: "Propostas" },
  { id: "reuniao-menu", rotulo: "Reunião" },
  { id: "midias-menu", rotulo: "Mídias Sociais" },
  { id: "pontos-menu", rotulo: "Pontos (Confirmação + Consulta)" },
  { id: "calendario-menu", rotulo: "Calendário" },
];

function lerSetoresPermissoes() {
  return JSON.parse(localStorage.getItem(CHAVE_SETORES_PERMISSOES)) || {};
}
function salvarSetoresPermissoes(mapa) {
  localStorage.setItem(CHAVE_SETORES_PERMISSOES, JSON.stringify(mapa));
}

function getPermissoesDoSetor(nomeSetor) {
  const mapa = lerSetoresPermissoes();
  return mapa[nomeSetor] || [];
}

function salvarPermissoesDoSetor(nomeSetor, idsPermitidos) {
  const mapa = lerSetoresPermissoes();
  mapa[nomeSetor] = idsPermitidos;
  salvarSetoresPermissoes(mapa);
}

// Renomear ou excluir um setor também deve atualizar o mapa de
// permissões, para não deixar "lixo" órfão.
function renomearSetorNasPermissoes(nomeAntigo, nomeNovo) {
  const mapa = lerSetoresPermissoes();
  if (mapa[nomeAntigo] !== undefined) {
    mapa[nomeNovo] = mapa[nomeAntigo];
    delete mapa[nomeAntigo];
    salvarSetoresPermissoes(mapa);
  }
}
function excluirSetorDasPermissoes(nomeSetor) {
  const mapa = lerSetoresPermissoes();
  delete mapa[nomeSetor];
  salvarSetoresPermissoes(mapa);
}

// ====================================================
// CONFIGURAÇÃO INICIAL (executada apenas uma vez)
// ====================================================
// Se ainda não existir nenhuma configuração de permissões salva,
// pré-configura os 5 setores padrão do sistema com um mapeamento
// inicial razoável — o usuário pode editar cada um livremente
// depois pela tela de Cadastro.
function inicializarPermissoesPadrao() {
  const jaConfigurado = localStorage.getItem(CHAVE_SETORES_PERMISSOES);
  if (jaConfigurado !== null) return; // já existe configuração, não sobrescreve

  const todos = ITENS_MENU_DISPONIVEIS.map((i) => i.id);
  const todosMenosCadastro = todos.filter((id) => id !== "gerenciarcontas-menu");

  const configuracaoInicial = {
    "TI": todos,
    "Outro": todos,
    "Financeiro": todosMenosCadastro,
    "Comercial": ["obras-menu", "reuniao-menu", "midias-menu", "pontos-menu", "calendario-menu"],
    "Recursos Humanos": ["notas-menu", "reuniao-menu", "midias-menu", "calendario-menu"],
  };

  salvarSetoresPermissoes(configuracaoInicial);

  // Garante que esses 5 setores também existam na lista de setores
  // cadastrados (localStorage["setores"]), para aparecerem nos
  // seletores de cadastro de usuário.
  const setores = JSON.parse(localStorage.getItem("setores")) || [];
  Object.keys(configuracaoInicial).forEach((nome) => {
    if (!setores.includes(nome)) setores.push(nome);
  });
  localStorage.setItem("setores", JSON.stringify(setores));
}

inicializarPermissoesPadrao();