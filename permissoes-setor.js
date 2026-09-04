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
  { id: "comissao-menu", rotulo: "Comissão" },
  { id: "relatorios-menu", rotulo: "Relatórios" },
  { id: "obras-menu", rotulo: "Obras" },
  { id: "gestaomaterial-menu", rotulo: "Gestão de Material" },
  { id: "armazenamento-menu", rotulo: "Armazenamento" },
  { id: "boletos-menu", rotulo: "Boletos" },
  { id: "clientes-crm-menu", rotulo: "Contatos (quadro)" },
  { id: "notas-menu", rotulo: "Notas" },
  { id: "propostas-menu", rotulo: "Propostas" },
  { id: "reuniao-menu", rotulo: "Reunião" },
  { id: "midias-menu", rotulo: "Mídias Sociais" },
  { id: "pontos-menu", rotulo: "Pontos (Confirmação + Consulta)" },
  { id: "calendario-menu", rotulo: "Calendário" },
  { id: "pontos-alterar-outros", rotulo: "Pontos — pode alterar registros de outros" },
  { id: "pontos-editar-feriados", rotulo: "Pontos — pode editar feriados" },
];

function lerSetoresPermissoes() {
  return JSON.parse(localStorage.getItem(CHAVE_SETORES_PERMISSOES)) || {};
}
function salvarSetoresPermissoes(mapa) {
  localStorage.setItem(CHAVE_SETORES_PERMISSOES, JSON.stringify(mapa));
  apiDataSet("setoresPermissoes", mapa).catch((e) => console.warn("Falha ao salvar permissões no servidor:", e));
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
// SINCRONIZAÇÃO COM O SERVIDOR (Worker + KV)
// ====================================================
// "setores" e "setoresPermissoes" vivem no servidor agora, para que
// todo mundo (em qualquer computador) veja os mesmos dados. O
// localStorage aqui funciona só como CACHE LOCAL de leitura rápida —
// toda função de escrita abaixo também empurra a mudança pro
// servidor (apiDataSet). Chame sincronizarDadosCompartilhados() e
// espere (await) ela terminar antes de usar getPermissoesDoSetor()
// ou os setores, em qualquer página que acabou de carregar.
async function sincronizarDadosCompartilhados() {
  try {
    const [respSetores, respPermissoes] = await Promise.all([
      apiDataGet("setores"),
      apiDataGet("setoresPermissoes"),
    ]);
    if (respSetores.ok && respSetores.valor) {
      localStorage.setItem("setores", JSON.stringify(respSetores.valor));
    }
    if (respPermissoes.ok && respPermissoes.valor) {
      localStorage.setItem(CHAVE_SETORES_PERMISSOES, JSON.stringify(respPermissoes.valor));
    }
  } catch (e) {
    console.warn("[permissoes-setor.js] Não foi possível sincronizar com o servidor, usando cache local.", e);
  }
}

// Cria a configuração padrão de setores/permissões no SERVIDOR.
// Só deve ser chamada por um admin (a partir de gerenciarcontas.html)
// e só faz algo se ainda não existir nada configurado no servidor.
async function seedPermissoesPadraoSeVazio() {
  const respPermissoes = await apiDataGet("setoresPermissoes");
  if (respPermissoes.ok && respPermissoes.valor) return; // já existe, não sobrescreve

  const todos = ITENS_MENU_DISPONIVEIS.map((i) => i.id);
  const todosMenosCadastro = todos.filter((id) => id !== "gerenciarcontas-menu");

  const configuracaoInicial = {
    "TI": todos,
    "Outro": todos,
    "Financeiro": todosMenosCadastro,
    "Comercial": ["obras-menu", "reuniao-menu", "midias-menu", "pontos-menu", "calendario-menu"],
    "Recursos Humanos": ["notas-menu", "reuniao-menu", "midias-menu", "calendario-menu"],
  };

  const respSetores = await apiDataGet("setores");
  const setores = (respSetores.ok && respSetores.valor) ? respSetores.valor : [];
  Object.keys(configuracaoInicial).forEach((nome) => {
    if (!setores.includes(nome)) setores.push(nome);
  });

  await apiDataSet("setoresPermissoes", configuracaoInicial);
  await apiDataSet("setores", setores);
  await sincronizarDadosCompartilhados();
}