// ============================================================
// contatos.js — cadastro de clientes/fornecedores.
// ============================================================

let tipoPessoaAtual = "PJ";
let contatoEmEdicaoId = null;
let contatosCache = [];

const CAMPOS_APENAS_PJ = ["blocoNomeFantasia", "blocoIE", "blocoIM"];

function aplicarTipoPessoa(tipo) {
  tipoPessoaAtual = tipo;
  document.getElementById("btnTipoPJ").classList.toggle("ativo", tipo === "PJ");
  document.getElementById("btnTipoPF").classList.toggle("ativo", tipo === "PF");

  document.getElementById("labelDocumento").textContent = tipo === "PJ" ? "CNPJ" : "CPF";
  document.getElementById("campoDocumento").placeholder = tipo === "PJ" ? "00.000.000/0000-00" : "000.000.000-00";
  document.getElementById("labelNome").textContent = tipo === "PJ" ? "Razão Social" : "Nome completo";

  CAMPOS_APENAS_PJ.forEach((id) => {
    document.getElementById(id).style.display = tipo === "PJ" ? "block" : "none";
  });
  document.getElementById("btnBuscarCnpj").style.display = tipo === "PJ" ? "inline-block" : "none";
}

document.getElementById("btnTipoPJ").addEventListener("click", () => aplicarTipoPessoa("PJ"));
document.getElementById("btnTipoPF").addEventListener("click", () => aplicarTipoPessoa("PF"));

// ── Validação em tempo real do documento ────────────────────────
document.getElementById("campoDocumento").addEventListener("blur", () => {
  const campo = document.getElementById("campoDocumento");
  const erro = document.getElementById("erroDocumento");
  const valor = campo.value.trim();
  if (!valor) { campo.classList.remove("invalido"); erro.classList.remove("visivel"); return; }

  const valido = validarDocumento(valor);
  campo.classList.toggle("invalido", !valido);
  erro.classList.toggle("visivel", !valido);
  if (valido) {
    campo.value = tipoPessoaAtual === "PJ" ? formatarCNPJ(valor) : formatarCPF(valor);
  }
});

// ── Buscar CNPJ na BrasilAPI ─────────────────────────────────────
document.getElementById("btnBuscarCnpj").addEventListener("click", async () => {
  const campoDoc = document.getElementById("campoDocumento");
  const valor = campoDoc.value.trim();
  if (!valor) { mostrarToast("Digite o CNPJ primeiro.", "erro"); return; }

  const botao = document.getElementById("btnBuscarCnpj");
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Buscando...";

  try {
    const resposta = await buscarCnpjNaBrasilApi(valor);
    if (!resposta.ok) { mostrarToast(resposta.erro, "erro"); return; }

    const d = resposta.dados;
    document.getElementById("campoNome").value = d.nome;
    document.getElementById("campoNomeFantasia").value = d.nomeFantasia;
    document.getElementById("campoCep").value = d.cep;
    document.getElementById("campoLogradouro").value = d.logradouro;
    document.getElementById("campoNumero").value = d.numero;
    document.getElementById("campoComplemento").value = d.complemento;
    document.getElementById("campoBairro").value = d.bairro;
    document.getElementById("campoCidade").value = d.cidade;
    document.getElementById("campoUf").value = d.uf;
    if (d.telefone) document.getElementById("campoTelefone").value = d.telefone;
    if (d.email) document.getElementById("campoEmail").value = d.email;
    campoDoc.value = formatarCNPJ(valor);
    campoDoc.classList.remove("invalido");
    document.getElementById("erroDocumento").classList.remove("visivel");

    mostrarToast(
      d.situacaoCadastral && d.situacaoCadastral !== "ATIVA"
        ? `Dados preenchidos. Atenção: situação cadastral é "${d.situacaoCadastral}".`
        : "Dados preenchidos a partir da Receita Federal. Confira a Inscrição Estadual manualmente — isso não vem nessa consulta."
    );
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

// ── Formulário: limpar / preencher ──────────────────────────────
function limparFormulario() {
  contatoEmEdicaoId = null;
  document.getElementById("campoId").value = "";
  ["campoDocumento", "campoNome", "campoNomeFantasia", "campoInscricaoEstadual", "campoInscricaoMunicipal",
   "campoTelefone", "campoEmail", "campoCep", "campoLogradouro", "campoNumero", "campoComplemento",
   "campoBairro", "campoCidade", "campoUf", "campoObservacoes"].forEach((id) => { document.getElementById(id).value = ""; });
  document.getElementById("campoDocumento").classList.remove("invalido");
  document.getElementById("erroDocumento").classList.remove("visivel");
  aplicarTipoPessoa("PJ");
  document.getElementById("tituloFormulario").textContent = "Novo cadastro";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

function preencherFormulario(contato) {
  contatoEmEdicaoId = contato.id;
  document.getElementById("campoId").value = contato.id;
  aplicarTipoPessoa(contato.tipoPessoa || "PJ");
  document.getElementById("campoDocumento").value = contato.documento || "";
  document.getElementById("campoNome").value = contato.nome || "";
  document.getElementById("campoNomeFantasia").value = contato.nomeFantasia || "";
  document.getElementById("campoInscricaoEstadual").value = contato.inscricaoEstadual || "";
  document.getElementById("campoInscricaoMunicipal").value = contato.inscricaoMunicipal || "";
  document.getElementById("campoTelefone").value = contato.telefone || "";
  document.getElementById("campoEmail").value = contato.email || "";
  document.getElementById("campoCep").value = contato.cep || "";
  document.getElementById("campoLogradouro").value = contato.logradouro || "";
  document.getElementById("campoNumero").value = contato.numero || "";
  document.getElementById("campoComplemento").value = contato.complemento || "";
  document.getElementById("campoBairro").value = contato.bairro || "";
  document.getElementById("campoCidade").value = contato.cidade || "";
  document.getElementById("campoUf").value = contato.uf || "";
  document.getElementById("campoObservacoes").value = contato.observacoes || "";
  document.getElementById("tituloFormulario").textContent = `Editando — ${contato.nome}`;
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("btnCancelarEdicao").addEventListener("click", limparFormulario);

// ── Salvar ────────────────────────────────────────────────────
document.getElementById("btnSalvarContato").addEventListener("click", async () => {
  const nome = document.getElementById("campoNome").value.trim();
  const documento = document.getElementById("campoDocumento").value.trim();

  if (!nome) { mostrarToast("Informe o nome/razão social.", "erro"); return; }
  if (!documento) { mostrarToast("Informe o CPF/CNPJ.", "erro"); return; }
  if (!validarDocumento(documento)) {
    document.getElementById("campoDocumento").classList.add("invalido");
    document.getElementById("erroDocumento").classList.add("visivel");
    mostrarToast("O CPF/CNPJ informado é inválido — confira os números.", "erro");
    return;
  }

  const botao = document.getElementById("btnSalvarContato");
  const textoOriginal = botao.textContent;
  botao.disabled = true;

  try {
    const dados = {
      id: contatoEmEdicaoId,
      tipoPessoa: tipoPessoaAtual,
      documento,
      nome,
      nomeFantasia: document.getElementById("campoNomeFantasia").value.trim(),
      inscricaoEstadual: document.getElementById("campoInscricaoEstadual").value.trim(),
      inscricaoMunicipal: document.getElementById("campoInscricaoMunicipal").value.trim(),
      telefone: document.getElementById("campoTelefone").value.trim(),
      email: document.getElementById("campoEmail").value.trim(),
      cep: document.getElementById("campoCep").value.trim(),
      logradouro: document.getElementById("campoLogradouro").value.trim(),
      numero: document.getElementById("campoNumero").value.trim(),
      complemento: document.getElementById("campoComplemento").value.trim(),
      bairro: document.getElementById("campoBairro").value.trim(),
      cidade: document.getElementById("campoCidade").value.trim(),
      uf: document.getElementById("campoUf").value.trim().toUpperCase(),
      observacoes: document.getElementById("campoObservacoes").value.trim(),
    };
    const resposta = await apiSalvarContato(dados);
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao salvar.", "erro"); return; }
    mostrarToast("Contato salvo.");
    limparFormulario();
    carregarContatos();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

// ── Listar / buscar / excluir ────────────────────────────────────
async function carregarContatos() {
  const resposta = await apiListarContatos();
  if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao carregar contatos.", "erro"); return; }
  contatosCache = resposta.contatos;
  renderizarLista();
}

function renderizarLista() {
  const busca = document.getElementById("buscaContatos").value.trim().toLowerCase();
  let filtrados = contatosCache;
  if (busca) {
    filtrados = filtrados.filter((c) =>
      (c.nome || "").toLowerCase().includes(busca) ||
      (c.documento || "").toLowerCase().includes(busca) ||
      (c.cidade || "").toLowerCase().includes(busca)
    );
  }

  const lista = document.getElementById("listaContatos");
  const vazio = document.getElementById("vazioContatos");
  lista.innerHTML = "";

  if (filtrados.length === 0) { vazio.style.display = "block"; return; }
  vazio.style.display = "none";

  filtrados.forEach((c) => {
    const el = document.createElement("div");
    el.className = "item-contato";
    el.innerHTML = `
      <div>
        <div class="nome">${escaparHtml(c.nome)}<span class="badge-tipo">${c.tipoPessoa}</span></div>
        <div class="meta">${escaparHtml(c.documento)} ${c.cidade ? "· " + escaparHtml(c.cidade) + (c.uf ? "/" + escaparHtml(c.uf) : "") : ""}</div>
      </div>
      <div class="acoes">
        <button class="btn-editar-contato">Editar</button>
        <button class="btn-excluir-contato">Excluir</button>
      </div>
    `;
    el.querySelector(".btn-editar-contato").addEventListener("click", () => preencherFormulario(c));
    el.querySelector(".btn-excluir-contato").addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir "${c.nome}"?`, "");
      if (!ok) return;
      const resp = await apiExcluirContato(c.id);
      if (!resp.ok) { mostrarToast(resp.erro || "Erro ao excluir.", "erro"); return; }
      mostrarToast("Excluído.");
      carregarContatos();
    });
    lista.appendChild(el);
  });
}

document.getElementById("buscaContatos").addEventListener("input", renderizarLista);

aplicarTipoPessoa("PJ");
carregarContatos();