// ============================================================
// pontos-core.js
// Lógica central do módulo de Pontos. Compartilhado entre
// pontos-confirmacao.html (funcionário bate ponto) e
// pontos-consulta.html (gestor consulta e edita).
//
// Estrutura do localStorage:
//   "pontos_registros"  → array de registros de batida
//   "pontos_lancamentos"→ array de lançamentos especiais
//   "pontos_jornadas"   → objeto { "registro_funcionario": horas }
// ============================================================

const CHAVE_REGISTROS   = "pontos_registros";
const CHAVE_LANCAMENTOS = "pontos_lancamentos";
const CHAVE_JORNADAS    = "pontos_jornadas";

const JORNADA_PADRAO_HORAS = 8; // horas/dia padrão se não configurada

// ====================================================
// LEITURA / ESCRITA
// ====================================================
function lerRegistros() {
  return JSON.parse(localStorage.getItem(CHAVE_REGISTROS)) || [];
}
function salvarRegistros(lista) {
  localStorage.setItem(CHAVE_REGISTROS, JSON.stringify(lista));
}

function lerLancamentos() {
  return JSON.parse(localStorage.getItem(CHAVE_LANCAMENTOS)) || [];
}
function salvarLancamentos(lista) {
  localStorage.setItem(CHAVE_LANCAMENTOS, JSON.stringify(lista));
}

function lerJornadas() {
  return JSON.parse(localStorage.getItem(CHAVE_JORNADAS)) || {};
}
function salvarJornadas(obj) {
  localStorage.setItem(CHAVE_JORNADAS, JSON.stringify(obj));
}

// ====================================================
// JORNADA POR FUNCIONÁRIO
// ====================================================
function getJornadaFuncionario(registroFuncionario) {
  const jornadas = lerJornadas();
  return jornadas[registroFuncionario] || JORNADA_PADRAO_HORAS;
}

function setJornadaFuncionario(registroFuncionario, horas) {
  const jornadas = lerJornadas();
  jornadas[registroFuncionario] = parseFloat(horas) || JORNADA_PADRAO_HORAS;
  salvarJornadas(jornadas);
}

// ====================================================
// BATIDAS DE PONTO
// ====================================================
// Estrutura de cada registro:
// {
//   id, registroFuncionario, nomeFuncionario,
//   dataHora (ISO string), tipo ("entrada"|"saida"),
//   obs (opcional, para ajustes manuais)
// }

// Captura a localização atual via API do navegador e retorna uma
// Promise com { lat, lng, endereco } ou null se negado/indisponível.
function capturarLocalizacao() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Reverter para endereço usando OpenStreetMap (gratuito, sem API key)
        let endereco = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "pt-BR" } }
          );
          const data = await resp.json();
          if (data && data.display_name) {
            // Pega só as primeiras partes do endereço (rua, bairro, cidade)
            const partes = data.display_name.split(",").slice(0, 3);
            endereco = partes.join(",").trim();
          }
        } catch (_) { /* mantém lat/lng se falhar */ }
        resolve({ lat, lng, endereco });
      },
      () => resolve(null), // usuário negou ou erro
      { timeout: 8000, maximumAge: 0 }
    );
  });
}

async function baterPonto(registroFuncionario, nomeFuncionario) {
  const registros = lerRegistros();
  const hoje = dataHoje();

  const batidasHoje = registros.filter(
    (r) => r.registroFuncionario === registroFuncionario && r.dataHora.startsWith(hoje)
  );

  const ultimaBatida = batidasHoje[batidasHoje.length - 1];
  const tipo = (!ultimaBatida || ultimaBatida.tipo === "saida") ? "entrada" : "saida";

  // Captura localização antes de registrar (aguarda até 8s)
  const localizacao = await capturarLocalizacao();

  const novo = {
    id: `bat_${Date.now()}`,
    registroFuncionario,
    nomeFuncionario,
    dataHora: new Date().toISOString(),
    tipo,
    obs: "",
    lat: localizacao ? localizacao.lat : null,
    lng: localizacao ? localizacao.lng : null,
    endereco: localizacao ? localizacao.endereco : null,
  };

  registros.push(novo);
  salvarRegistros(registros);
  return novo;
}

function editarBatida(id, novosDados) {
  const registros = lerRegistros();
  const idx = registros.findIndex((r) => r.id === id);
  if (idx === -1) return;
  registros[idx] = { ...registros[idx], ...novosDados };
  salvarRegistros(registros);
}

function excluirBatida(id) {
  salvarRegistros(lerRegistros().filter((r) => r.id !== id));
}

function getBatidasFuncionarioData(registroFuncionario, data) {
  return lerRegistros()
    .filter((r) => r.registroFuncionario === registroFuncionario && r.dataHora.startsWith(data))
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}

// ====================================================
// LANÇAMENTOS ESPECIAIS
// ====================================================
// Tipos:
//   "hora_extra"   → crédito (horas a mais trabalhadas)
//   "falta"        → débito (dia não trabalhado)
//   "abono"        → zera débito de uma falta
//   "atestado"     → abate jornada sem débito (médico)
//   "declaracao"   → abate jornada sem débito (outro documento)
//   "ajuste"       → ajuste manual livre (pode ser + ou -)
//
// Estrutura:
// {
//   id, registroFuncionario, nomeFuncionario,
//   tipo, data, horas (positivo = crédito, negativo = débito),
//   descricao, documento (nome do arquivo, opcional)
// }

const TIPOS_LANCAMENTO = {
  hora_extra:  { rotulo: "Hora Extra",   efeito: "credito" },
  falta:       { rotulo: "Falta",        efeito: "debito"  },
  abono:       { rotulo: "Abono",        efeito: "neutro"  },
  atestado:    { rotulo: "Atestado",     efeito: "neutro"  },
  declaracao:  { rotulo: "Declaração",   efeito: "neutro"  },
  ajuste:      { rotulo: "Ajuste Manual",efeito: "neutro"  },
};

function adicionarLancamento(dados) {
  const lista = lerLancamentos();
  const novo = {
    id: `lanc_${Date.now()}`,
    registroFuncionario: dados.registroFuncionario,
    nomeFuncionario: dados.nomeFuncionario,
    tipo: dados.tipo,
    data: dados.data,
    horas: parseFloat(dados.horas) || 0,
    descricao: dados.descricao || "",
    documento: dados.documento || "",
    criadoEm: new Date().toISOString(),
  };
  lista.push(novo);
  salvarLancamentos(lista);
  return novo;
}

function editarLancamento(id, novosDados) {
  const lista = lerLancamentos();
  const idx = lista.findIndex((l) => l.id === id);
  if (idx === -1) return;
  lista[idx] = { ...lista[idx], ...novosDados };
  salvarLancamentos(lista);
}

function excluirLancamento(id) {
  salvarLancamentos(lerLancamentos().filter((l) => l.id !== id));
}

function getLancamentosFuncionario(registroFuncionario) {
  return lerLancamentos()
    .filter((l) => l.registroFuncionario === registroFuncionario)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
}

// ====================================================
// CÁLCULO DE HORAS TRABALHADAS (por dia)
// ====================================================
// Calcula as horas trabalhadas somando pares entrada/saída.
// Batidas ímpares (sem par de saída) são ignoradas no cálculo.
function calcularHorasTrabalhadasNoDia(batidas) {
  let totalMinutos = 0;
  const ordenadas = [...batidas].sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

  for (let i = 0; i + 1 < ordenadas.length; i += 2) {
    const entrada = ordenadas[i];
    const saida = ordenadas[i + 1];
    if (entrada.tipo === "entrada" && saida.tipo === "saida") {
      const diffMs = new Date(saida.dataHora) - new Date(entrada.dataHora);
      totalMinutos += diffMs / 60000;
    }
  }
  return totalMinutos / 60; // retorna em horas decimais
}

// ====================================================
// BANCO DE HORAS (saldo acumulado)
// ====================================================
function calcularBancoHoras(registroFuncionario) {
  const jornada = getJornadaFuncionario(registroFuncionario);
  const registros = lerRegistros().filter((r) => r.registroFuncionario === registroFuncionario);
  const lancamentos = getLancamentosFuncionario(registroFuncionario);

  // Agrupa batidas por data
  const datasComBatidas = [...new Set(registros.map((r) => r.dataHora.slice(0, 10)))];

  let horasTrabalhadas = 0;
  let horasEsperadas = 0;
  let diasTrabalhados = 0;

  datasComBatidas.forEach((data) => {
    const batidasDia = registros
      .filter((r) => r.dataHora.startsWith(data))
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

    const hDia = calcularHorasTrabalhadasNoDia(batidasDia);
    if (hDia > 0) {
      horasTrabalhadas += hDia;
      horasEsperadas += jornada;
      diasTrabalhados++;
    }
  });

  // Aplica lançamentos especiais
  let creditosExtras = 0;
  let debitosExtras = 0;
  let horasCobertas = 0;

  lancamentos.forEach((l) => {
    switch (l.tipo) {
      case "hora_extra":
        creditosExtras += Math.abs(l.horas);
        break;
      case "falta":
        horasEsperadas += Math.abs(l.horas) || jornada;
        break;
      case "abono":
      case "atestado":
      case "declaracao":
        // Conta como horas trabalhadas (aparece no card)
        // mas também reduz as esperadas para não duplicar no saldo
        horasCobertas += Math.abs(l.horas);
        break;
      case "ajuste":
        if (l.horas > 0) creditosExtras += l.horas;
        else debitosExtras += Math.abs(l.horas);
        break;
    }
  });

  const totalTrabalhadas = horasTrabalhadas + creditosExtras + horasCobertas;
  const totalEsperadas   = horasEsperadas + debitosExtras;
  const saldo = totalTrabalhadas - totalEsperadas;

  return {
    horasTrabalhadas: totalTrabalhadas,
    horasEsperadas: totalEsperadas,
    saldo,
    diasTrabalhados,
    jornada,
  };
}

// ====================================================
// PERMISSÃO DE ALTERAÇÃO DE PONTOS DE OUTROS
// ====================================================
// Verifica se o usuário logado tem permissão para editar
// registros de outros funcionários (não só os próprios).
function podeAlterarPontosDeOutros() {
  const userId = localStorage.getItem("userId");
  if (!userId) return false;

  // CEO (login fixo do sistema) tem acesso total.
  const userType = (localStorage.getItem("userType") || "").toLowerCase();
  if (userType === "ceo") return true;

  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const usuario = usuarios.find((u) => String(u.registro) === String(userId));
  if (!usuario || !usuario.setor) return false;

  const permissoes = getPermissoesDoSetor(usuario.setor);
  return permissoes.includes("pontos-alterar-outros");
}

function getUsuarioLogado() {
  const userId = localStorage.getItem("userId");
  if (!userId) return null;
  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  return usuarios.find((u) => String(u.registro) === String(userId)) || null;
}

// ====================================================
// UTILITÁRIOS
// ====================================================
function dataHoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarHoras(horas) {
  const sinal = horas < 0 ? "-" : "";
  const abs = Math.abs(horas);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sinal}${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m`;
}

function formatarDataBR(isoDate) {
  if (!isoDate) return "—";
  const [a, m, d] = isoDate.split("-");
  return `${d}/${m}/${a}`;
}

function formatarHoraBR(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const NOMES_MESES_PONTO = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

// cache-bust: Wed Aug 12 00:26:21 UTC 2026