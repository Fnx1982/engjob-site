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
// Estrutura salva em localStorage["pontos_jornadas"]:
// {
//   "registro": {
//     horaEntrada: "08:00",
//     horaSaida: "17:00",
//     horasDia: 9   // calculado automaticamente: saida - entrada
//   }
// }
// Retrocompatibilidade: se o valor salvo for um número (formato
// antigo), converte para o novo formato automaticamente.

function getJornadaFuncionario(registroFuncionario) {
  const jornadas = lerJornadas();
  const jornadaSalva = jornadas[registroFuncionario];

  // Formato antigo: número de horas direto
  if (typeof jornadaSalva === "number") return jornadaSalva;

  // Formato novo: objeto com horário
  if (jornadaSalva && typeof jornadaSalva === "object") {
    return jornadaSalva.horasDia || JORNADA_PADRAO_HORAS;
  }

  return JORNADA_PADRAO_HORAS;
}

function getJornadaCompleta(registroFuncionario) {
  const jornadas = lerJornadas();
  const jornadaSalva = jornadas[registroFuncionario];

  if (typeof jornadaSalva === "object" && jornadaSalva !== null) {
    return jornadaSalva;
  }

  // Retrocompatibilidade com formato antigo (número)
  if (typeof jornadaSalva === "number") {
    return { horaEntrada: null, horaSaida: null, horasDia: jornadaSalva };
  }

  return { horaEntrada: null, horaSaida: null, horasDia: JORNADA_PADRAO_HORAS };
}

function setJornadaFuncionario(registroFuncionario, horaEntrada, horaSaida, inicioAlmoco, fimAlmoco) {
  const jornadas = lerJornadas();

  let horasDia = JORNADA_PADRAO_HORAS;
  if (horaEntrada && horaSaida) {
    const [he, me] = horaEntrada.split(":").map(Number);
    const [hs, ms] = horaSaida.split(":").map(Number);
    let totalMin = (hs * 60 + ms) - (he * 60 + me);

    // Desconta o intervalo de almoço se configurado
    if (inicioAlmoco && fimAlmoco) {
      const [ha1, ma1] = inicioAlmoco.split(":").map(Number);
      const [ha2, ma2] = fimAlmoco.split(":").map(Number);
      const almoco = (ha2 * 60 + ma2) - (ha1 * 60 + ma1);
      if (almoco > 0) totalMin -= almoco;
    }

    if (totalMin > 0) horasDia = totalMin / 60;
  }

  jornadas[registroFuncionario] = {
    horaEntrada,
    horaSaida,
    inicioAlmoco: inicioAlmoco || null,
    fimAlmoco: fimAlmoco || null,
    horasDia,
  };
  salvarJornadas(jornadas);
  return horasDia;
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
  ferias:      { rotulo: "Férias",       efeito: "neutro"  },
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
  // Delega para a versão completa que respeita feriados e fins de semana
  return calcularBancoHorasCompleto(registroFuncionario);
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

// ====================================================
// FERIADOS
// ====================================================
const CHAVE_FERIADOS_NACIONAIS = "feriados_nacionais";
const CHAVE_FERIADOS_FUNCIONARIO = "feriados_por_funcionario";

// Feriados nacionais fixos do Brasil (formato MM-DD para comparar com qualquer ano)
const FERIADOS_NACIONAIS_PADRAO = [
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra
  "12-25", // Natal
];

// Verifica se o usuário logado pode editar feriados
function podeEditarFeriados() {
  const userType = (localStorage.getItem("userType") || "").toLowerCase();
  if (userType === "ceo") return true;
  const userId = localStorage.getItem("userId");
  if (!userId) return false;
  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const usuario = usuarios.find((u) => String(u.registro) === String(userId));
  if (!usuario || !usuario.setor) return false;
  const permissoes = getPermissoesDoSetor(usuario.setor);
  return permissoes.includes("pontos-editar-feriados") || permissoes.includes("pontos-alterar-outros");
}

function lerFeriadosNacionais() {
  const salvo = localStorage.getItem(CHAVE_FERIADOS_NACIONAIS);
  if (salvo) return JSON.parse(salvo);
  // Primeira vez: inicializa com os padrões
  localStorage.setItem(CHAVE_FERIADOS_NACIONAIS, JSON.stringify(FERIADOS_NACIONAIS_PADRAO));
  return FERIADOS_NACIONAIS_PADRAO;
}
function salvarFeriadosNacionais(lista) {
  localStorage.setItem(CHAVE_FERIADOS_NACIONAIS, JSON.stringify(lista));
}

function lerFeriadosFuncionario(registroFuncionario) {
  const mapa = JSON.parse(localStorage.getItem(CHAVE_FERIADOS_FUNCIONARIO)) || {};
  return mapa[registroFuncionario] || [];
}
function salvarFeriadosFuncionario(registroFuncionario, datas) {
  const mapa = JSON.parse(localStorage.getItem(CHAVE_FERIADOS_FUNCIONARIO)) || {};
  mapa[registroFuncionario] = datas;
  localStorage.setItem(CHAVE_FERIADOS_FUNCIONARIO, JSON.stringify(mapa));
}

// Verifica se uma data ISO (YYYY-MM-DD) é feriado para um funcionário
function ehFeriado(dataISO, registroFuncionario) {
  const mmdd = dataISO.slice(5); // "MM-DD"
  const nacionais = lerFeriadosNacionais();
  if (nacionais.includes(mmdd)) return true;
  const especificos = lerFeriadosFuncionario(registroFuncionario);
  return especificos.includes(dataISO);
}

// Verifica se é fim de semana (0=Dom, 6=Sáb)
function ehFimDeSemana(dataISO) {
  const d = new Date(dataISO + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

// Verifica se é dia útil (não é fim de semana nem feriado)
function ehDiaUtil(dataISO, registroFuncionario) {
  return !ehFimDeSemana(dataISO) && !ehFeriado(dataISO, registroFuncionario);
}

// Retorna todos os dias de um mês/ano
function diasDoMes(mes, ano) {
  const dias = [];
  const total = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(mes + 1).padStart(2, "0");
    dias.push(`${ano}-${mm}-${dd}`);
  }
  return dias;
}

// ====================================================
// BANCO DE HORAS (versão com dias úteis automáticos)
// ====================================================
function calcularBancoHorasCompleto(registroFuncionario, mesReferencia, anoReferencia) {
  const jornada = getJornadaFuncionario(registroFuncionario);
  const registros = lerRegistros().filter((r) => r.registroFuncionario === registroFuncionario);
  const lancamentos = getLancamentosFuncionario(registroFuncionario);

  // Se não passar mês/ano, calcula sobre todos os registros existentes
  const usarMes = mesReferencia !== undefined && anoReferencia !== undefined;

  // Todos os dias que têm batida
  const todasDatasComBatida = [...new Set(registros.map((r) => r.dataHora.slice(0, 10)))];

  // Dias do mês de referência (para falta automática)
  const hoje = new Date();
  const diasParaVerificar = usarMes
    ? diasDoMes(mesReferencia, anoReferencia).filter((d) => new Date(d + "T12:00:00") <= hoje)
    : [];

  let horasTrabalhadas = 0;
  let horasExtrasAutomaticas = 0; // fins de semana/feriados trabalhados
  let horasEsperadas = 0;
  let diasTrabalhados = 0;
  let faltasAutomaticas = 0; // dias úteis sem batida

  // Calcula horas das batidas
  todasDatasComBatida.forEach((data) => {
    if (usarMes) {
      const d = new Date(data + "T12:00:00");
      if (d.getMonth() !== mesReferencia || d.getFullYear() !== anoReferencia) return;
    }

    const batidasDia = registros
      .filter((r) => r.dataHora.startsWith(data))
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

    const hDia = calcularHorasTrabalhadasNoDia(batidasDia);
    if (hDia > 0) {
      diasTrabalhados++;
      if (ehFimDeSemana(data) || ehFeriado(data, registroFuncionario)) {
        // Fim de semana/feriado: tudo vira hora extra automática
        horasExtrasAutomaticas += hDia;
      } else {
        // Dia útil: conta normalmente
        horasTrabalhadas += hDia;
        horasEsperadas += jornada;
      }
    }
  });

  // Verifica dias úteis sem batida no mês de referência = falta automática
  if (usarMes) {
    diasParaVerificar.forEach((data) => {
      if (!ehDiaUtil(data, registroFuncionario)) return; // pula fim de semana e feriado
      const temBatida = todasDatasComBatida.includes(data);
      if (!temBatida) {
        faltasAutomaticas += jornada;
        horasEsperadas += jornada;
      }
    });
  }

  // Lançamentos manuais
  let creditosExtras = 0;
  let debitosExtras = 0;
  let horasCobertas = 0;

  lancamentos.forEach((l) => {
    if (usarMes) {
      const d = new Date(l.data + "T12:00:00");
      if (d.getMonth() !== mesReferencia || d.getFullYear() !== anoReferencia) return;
    }
    switch (l.tipo) {
      case "hora_extra":  creditosExtras += Math.abs(l.horas); break;
      case "falta":       horasEsperadas += Math.abs(l.horas) || jornada; break;
      case "abono":
      case "atestado":
      case "declaracao":
      case "ferias":      horasCobertas += Math.abs(l.horas); break;
      case "ajuste":
        if (l.horas > 0) creditosExtras += l.horas;
        else debitosExtras += Math.abs(l.horas);
        break;
    }
  });

  const totalTrabalhadas = horasTrabalhadas + creditosExtras + horasCobertas + horasExtrasAutomaticas;
  const totalEsperadas = horasEsperadas + debitosExtras;
  const saldo = totalTrabalhadas - totalEsperadas;

  return {
    horasTrabalhadas: totalTrabalhadas,
    horasEsperadas: totalEsperadas,
    saldo,
    diasTrabalhados,
    jornada,
    horasExtrasAutomaticas,
    faltasAutomaticas,
  };
}