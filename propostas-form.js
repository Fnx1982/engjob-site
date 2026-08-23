// ============================================================
// propostas-form.js
// Modal de criar/editar proposta — compartilhado entre
// orcamento.html, propostas.html e andamento.html.
// ============================================================

let propostaEmEdicao = null;
let onSalvarPropostaCallback = null;

const UNIDADES_PADRAO = ["UND", "CM", "CM²", "M", "M²", "ML"];

// Gera as <option> do select de unidade, com o valor atual já
// selecionado — inclusive se for um valor antigo que não está na
// lista padrão (nesse caso, adiciona ele como opção extra, pra não
// perder o dado de itens já cadastrados antes dessa lista existir).
function opcoesUnidadeHtml(valorAtual) {
  const valor = (valorAtual || "UND").toUpperCase();
  let opcoes = UNIDADES_PADRAO.map((u) => `<option value="${u}"${u === valor ? " selected" : ""}>${u}</option>`).join("");
  if (!UNIDADES_PADRAO.includes(valor)) {
    opcoes += `<option value="${escaparHtml(valor)}" selected>${escaparHtml(valor)} (valor antigo)</option>`;
  }
  return opcoes;
}

function montarModalFormularioProposta() {
  if (document.getElementById("modalProposta")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalProposta";
  overlay.innerHTML = `
    <div class="modal-caixa-grande">
      <div class="modal-cabecalho">
        <h2 id="tituloModalProposta">Novo Orçamento</h2>
        <button type="button" class="modal-fechar" id="fecharModalProposta">&times;</button>
      </div>

      <div class="form-secao">
        <h3>Dados do Cliente / Obra</h3>
        <div class="form-grid">
          <label>Número do Orçamento
            <input type="text" id="campoNumeroOrcamento" placeholder="Ex: 2026-001" />
          </label>
          <label>Cliente
            <input type="text" id="campoCliente" placeholder="Nome do cliente" />
          </label>
          <label>Telefone
            <input type="text" id="campoTelefone" placeholder="(99) 9 9999-9999" maxlength="17" />
          </label>
          <label class="campo-largura-total">Local
            <input type="text" id="campoLocal" placeholder="Endereço / local da obra" />
          </label>
          <label class="campo-largura-total">Serviço
            <textarea id="campoServico" rows="2" placeholder="Descrição do serviço"></textarea>
          </label>
          <label class="campo-largura-total">Observação <span class="texto-opcional-inline">(opcional)</span>
            <textarea id="campoObservacao" rows="2" placeholder="Alguma observação sobre esta proposta..."></textarea>
          </label>
        </div>
      </div>

      <div class="form-secao">
        <h3>Mão de Obra</h3>
        <p class="texto-ajuda" style="margin-bottom:8px;">
          Digitar uma descrição que já existe no catálogo de Serviços preenche o valor sozinho.
          Descrições novas são salvas no catálogo automaticamente, pra aparecer aqui e na NFS-e depois.
        </p>
        <table class="itens-tabela" id="tabelaMaoDeObra">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Unid</th>
              <th>Valor Unit. <span style="font-weight:normal;font-size:10px;">(opcional)</span></th>
              <th>Valor Final</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <datalist id="listaServicosPropostaDatalist"></datalist>
        <button type="button" class="btn-add-item" id="btnAddMaoDeObra">+ Adicionar item de mão de obra</button>
        <div class="linha-total-secao" style="flex-direction:column;align-items:flex-end;gap:6px;">
          <div>Subtotal M.O.: <span id="subtotalMaoDeObraTexto">R$ 0,00</span></div>
          <div style="display:flex;align-items:center;gap:8px;font-size:14px;">
            <label style="font-weight:600;font-size:13px;margin:0;">Ajuste M.O.
              <span style="font-weight:normal;font-size:11px;color:#888;">(desconto= negativo, acréscimo= positivo)</span>
            </label>
            <input type="number" id="ajusteMaoDeObra" step="0.01" placeholder="0,00"
              style="width:130px;padding:7px 10px;border-radius:6px;border:1px solid #ccc;font-family:inherit;font-size:14px;text-align:right;" />
          </div>
          <div style="font-size:16px;font-weight:700;">Total M.O.: <span id="totalMaoDeObraTexto">R$ 0,00</span></div>
        </div>
      </div>

      <div class="form-secao">
        <h3>Materiais do estoque</h3>
        <p class="texto-ajuda">Marque os materiais que entram neste orçamento. A quantidade pode ser ajustada depois, na tabela abaixo.</p>
        <div class="checklist-materiais" id="checklistMateriaisEstoque"></div>

        <div class="cadastro-rapido-material">
          <input type="text" id="rapidoNomeMaterial" placeholder="Nome do novo material" />
          <input type="number" id="rapidoValorMaterial" placeholder="Valor unit." step="0.01" min="0" />
          <input type="text" id="rapidoSetorMaterial" placeholder="Setor" />
          <button type="button" class="btn-laranja" id="btnCadastroRapidoMaterial">+ Cadastrar e usar</button>
        </div>
      </div>

      <div class="form-secao">
        <h3>Itens de Materiais no Orçamento</h3>
        <p class="texto-ajuda" style="margin-bottom:8px;">
          Você pode preencher <strong>Qtd × Valor Unit.</strong> para calcular automaticamente,
          ou deixar em branco e preencher o <strong>Valor Final</strong> diretamente.
        </p>
        <table class="itens-tabela" id="tabelaMateriais">
          <thead>
            <tr>
              <th>Material</th>
              <th>Qtd</th>
              <th>Unid</th>
              <th>Valor Unit. <span style="font-weight:normal;font-size:10px;">(opcional)</span></th>
              <th>Valor Final</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <button type="button" class="btn-add-item" id="btnAddMaterial">+ Adicionar item manual (é salvo no catálogo ao salvar o orçamento)</button>
        <div class="linha-total-secao" style="flex-direction:column;align-items:flex-end;gap:6px;">
          <div>Subtotal Materiais: <span id="subtotalMateriaisTexto">R$ 0,00</span></div>
          <div style="display:flex;align-items:center;gap:8px;font-size:14px;">
            <label style="font-weight:600;font-size:13px;margin:0;">Ajuste Materiais
              <span style="font-weight:normal;font-size:11px;color:#888;">(desconto= negativo, acréscimo= positivo)</span>
            </label>
            <input type="number" id="ajusteMateriais" step="0.01" placeholder="0,00"
              style="width:130px;padding:7px 10px;border-radius:6px;border:1px solid #ccc;font-family:inherit;font-size:14px;text-align:right;" />
          </div>
          <div style="font-size:16px;font-weight:700;">Total Materiais: <span id="totalMateriaisTexto">R$ 0,00</span></div>
        </div>
      </div>

      <div class="form-secao">
        <h3>Condições</h3>
        <div class="form-grid">
          <label>Forma de pagamento
            <input type="text" id="campoFormaPagamento" placeholder="Ex: à vista, débito, PIX e boleto" />
          </label>
          <label>Planejamento (dias úteis)
            <input type="number" id="campoPlanejamento" min="0" placeholder="Ex: 10" />
          </label>
          <label class="campo-largura-total">Proposta válida por (dias)
            <input type="number" id="campoValidade" min="0" placeholder="Ex: 10" />
          </label>
        </div>
      </div>

      <div class="linha-total-secao" style="font-size:16px;">TOTAL GERAL: <span id="totalGeralTexto">R$ 0,00</span></div>

      <div class="modal-rodape">
        <button type="button" class="btn-secundario" id="btnCancelarProposta">Cancelar</button>
        <button type="button" class="btn-laranja" id="btnSalvarProposta">Salvar Orçamento</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("fecharModalProposta").addEventListener("click", fecharFormularioProposta);
  document.getElementById("btnCancelarProposta").addEventListener("click", fecharFormularioProposta);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharFormularioProposta();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) fecharFormularioProposta();
  });

  document.getElementById("btnAddMaoDeObra").addEventListener("click", adicionarLinhaMaoDeObra);
  document.getElementById("btnAddMaterial").addEventListener("click", adicionarLinhaMaterial);
  document.getElementById("btnSalvarProposta").addEventListener("click", salvarFormularioProposta);
  document.getElementById("btnCadastroRapidoMaterial").addEventListener("click", cadastrarMaterialRapido);
  document.getElementById("campoTelefone").addEventListener("input", aplicarMascaraTelefoneProposta);
  document.getElementById("ajusteMaoDeObra").addEventListener("input", atualizarTotaisFormulario);
  document.getElementById("ajusteMateriais").addEventListener("input", atualizarTotaisFormulario);
  limparErroAoEditar(document.getElementById("campoCliente"));
}

function aplicarMascaraTelefoneProposta(event) {
  let input = event.target;
  let valor = input.value.replace(/\D/g, "");
  if (valor.length > 11) valor = valor.slice(0, 11);
  if (valor.length > 7) valor = valor.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4}).*/, "($1) $2 $3-$4");
  else if (valor.length > 3) valor = valor.replace(/^(\d{2})(\d{1})(\d{0,4})/, "($1) $2 $3");
  else if (valor.length > 2) valor = valor.replace(/^(\d{2})(\d{0,1})/, "($1) $2");
  else if (valor.length > 0) valor = valor.replace(/^(\d{0,2})/, "($1");
  input.value = valor.trim();
}

async function abrirFormularioProposta(id, onSalvar, dadosPreenchidos) {
  montarModalFormularioProposta();
  onSalvarPropostaCallback = onSalvar || null;
  propostaEmEdicao = id ? JSON.parse(JSON.stringify(buscarProposta(id))) : criarPropostaVazia();
  if (!id && dadosPreenchidos) Object.assign(propostaEmEdicao, dadosPreenchidos);

  document.getElementById("tituloModalProposta").textContent = id ? "Editar Orçamento" : "Novo Orçamento";
  document.getElementById("campoNumeroOrcamento").value = propostaEmEdicao.numeroOrcamento || "";
  document.getElementById("campoCliente").value = propostaEmEdicao.cliente;
  document.getElementById("campoTelefone").value = propostaEmEdicao.telefone;
  document.getElementById("campoLocal").value = propostaEmEdicao.local;
  document.getElementById("campoServico").value = propostaEmEdicao.servico;
  document.getElementById("campoObservacao").value = propostaEmEdicao.observacao || "";
  document.getElementById("campoFormaPagamento").value = propostaEmEdicao.formaPagamento;
  document.getElementById("campoPlanejamento").value = propostaEmEdicao.planejamentoDias;
  document.getElementById("campoValidade").value = propostaEmEdicao.validadeDias;

  document.getElementById("modalProposta").classList.add("active");

  // Carrega os catálogos de material/serviço da nuvem antes de montar
  // os checklists e o autocomplete — abre o modal já, e preenche essa
  // parte assim que a resposta chegar (evita travar a tela esperando).
  await carregarCatalogosDeItens();

  renderChecklistMateriaisEstoque();
  atualizarDatalistServicos();
  renderTabelaMaoDeObra();
  renderTabelaMateriais();

  // Preenche ajustes salvos (ou zera se for nova proposta)
  const ajusteMOEl = document.getElementById("ajusteMaoDeObra");
  const ajusteMatEl = document.getElementById("ajusteMateriais");
  if (ajusteMOEl) ajusteMOEl.value = propostaEmEdicao.ajusteMaoDeObra || "";
  if (ajusteMatEl) ajusteMatEl.value = propostaEmEdicao.ajusteMateriais || "";

  atualizarTotaisFormulario();

  document.getElementById("rapidoNomeMaterial").value = "";
  document.getElementById("rapidoValorMaterial").value = "";
  document.getElementById("rapidoSetorMaterial").value = "";
}

function fecharFormularioProposta() {
  const modal = document.getElementById("modalProposta");
  if (modal) modal.classList.remove("active");
  propostaEmEdicao = null;
}

// ============================================================
// Calcula o valor final de um item:
// - Se valorFinal foi digitado diretamente, usa ele.
// - Caso contrário, calcula qtd * valorUnit.
// ============================================================
function valorFinalItem(item) {
  if (item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "") {
    return parseFloat(item.valorFinal) || 0;
  }
  return (parseFloat(item.qtd) || 0) * (parseFloat(item.valorUnit) || 0);
}

// ====================================================
// TABELA: MÃO DE OBRA
// ====================================================
function atualizarDatalistServicos() {
  const datalist = document.getElementById("listaServicosPropostaDatalist");
  if (!datalist) return;
  datalist.innerHTML = servicosCatalogoCache.map((s) => `<option value="${escaparHtml(s.nome)}"></option>`).join("");
}

function renderTabelaMaoDeObra() {
  const tbody = document.querySelector("#tabelaMaoDeObra tbody");
  tbody.innerHTML = "";
  propostaEmEdicao.itensMaoDeObra.forEach((item, index) => {
    const tr = document.createElement("tr");
    const vf = valorFinalItem(item);
    // Se valorFinal está preenchido, desabilita Qtd e Valor Unit
    const bloqueado = item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "";
    const vinculado = !!item.servicoId;
    const rotuloVinculo = vinculado ? '<span class="tag-vinculado">catálogo</span>' : "";
    tr.innerHTML = `
      <td class="col-descricao">
        ${rotuloVinculo}
        <input type="text" value="${escaparHtml(item.descricao || "")}" placeholder="Descrição do serviço"
          data-mo-campo="descricao" data-mo-index="${index}" list="listaServicosPropostaDatalist" />
      </td>
      <td>
        <input type="number" min="0" step="0.01" value="${item.qtd || ""}"
          placeholder="Qtd" data-mo-campo="qtd" data-mo-index="${index}"
          ${bloqueado ? 'disabled style="opacity:0.4;"' : ''} />
      </td>
      <td>
        <select data-mo-campo="unid" data-mo-index="${index}">${opcoesUnidadeHtml(item.unid)}</select>
      </td>
      <td>
        <input type="number" min="0" step="0.01" value="${item.valorUnit || ""}"
          placeholder="R$" data-mo-campo="valorUnit" data-mo-index="${index}"
          ${bloqueado ? 'disabled style="opacity:0.4;"' : ''} />
      </td>
      <td>
        <input type="number" min="0" step="0.01"
          value="${item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "" ? item.valorFinal : ""}"
          placeholder="R$ final" data-mo-campo="valorFinal" data-mo-index="${index}"
          style="font-weight:700;color:rgb(180,110,10);" />
        <small style="display:block;font-size:10px;color:#aaa;">
          ${!bloqueado ? "= R$ " + formatarMoeda(vf) : "valor fixo"}
        </small>
      </td>
      <td><button type="button" class="btn-remover-item" data-mo-remover="${index}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-mo-index]").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = parseInt(input.dataset.moIndex, 10);
      const campo = input.dataset.moCampo;
      if (campo === "qtd" || campo === "valorUnit") {
        propostaEmEdicao.itensMaoDeObra[idx][campo] = parseFloat(input.value) || 0;
      } else if (campo === "valorFinal") {
        // Valor Final preenchido sobrescreve o cálculo automático
        propostaEmEdicao.itensMaoDeObra[idx].valorFinal = input.value === "" ? null : parseFloat(input.value) || 0;
        // Rerender só após blur para não perder foco enquanto digita
      } else {
        propostaEmEdicao.itensMaoDeObra[idx][campo] = input.value;
      }

      const item = propostaEmEdicao.itensMaoDeObra[idx];
      const linha = input.closest("tr");
      const vf = valorFinalItem(item);
      const small = linha.querySelector("small");
      if (small) {
        const bloqueado = item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "";
        small.textContent = bloqueado ? "valor fixo" : "= R$ " + formatarMoeda(vf);
      }

      atualizarTotaisFormulario();
    });

    // Descrição que bate com um serviço já cadastrado: liga o item a
    // ele e preenche o valor (só se ainda estiver vazio).
    if (input.dataset.moCampo === "descricao") {
      input.addEventListener("change", () => {
        const idx = parseInt(input.dataset.moIndex, 10);
        const item = propostaEmEdicao.itensMaoDeObra[idx];
        const servico = servicosCatalogoCache.find((s) => s.nome.trim().toLowerCase() === input.value.trim().toLowerCase());
        if (servico) {
          item.servicoId = servico.id;
          if (!item.valorUnit) {
            item.valorUnit = servico.valor;
            renderTabelaMaoDeObra();
            atualizarTotaisFormulario();
          }
        } else {
          item.servicoId = null; // descrição nova/alterada — deixa de estar vinculada até salvar
        }
      });
    }

    // Ao sair do campo valorFinal, rerenderiza para habilitar/desabilitar os outros
    if (input.dataset.moCampo === "valorFinal") {
      input.addEventListener("blur", async () => {
        const idx = parseInt(input.dataset.moIndex, 10);
        const item = propostaEmEdicao.itensMaoDeObra[idx];
        if (item.servicoId) {
          const sincronizar = await perguntarSincronizarServico(item.descricao);
          if (sincronizar) await atualizarServicoNoCatalogo(item.servicoId, { nome: item.descricao, valorUnit: item.valorUnit });
        }
        renderTabelaMaoDeObra();
        atualizarTotaisFormulario();
      });
    }
  });

  tbody.querySelectorAll("[data-mo-remover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      propostaEmEdicao.itensMaoDeObra.splice(parseInt(btn.dataset.moRemover, 10), 1);
      renderTabelaMaoDeObra();
      atualizarTotaisFormulario();
    });
  });
}

function adicionarLinhaMaoDeObra() {
  propostaEmEdicao.itensMaoDeObra.push({ qtd: null, unid: "UND", descricao: "", valorUnit: null, valorFinal: null, servicoId: null });
  renderTabelaMaoDeObra();
  atualizarTotaisFormulario();
}

// ====================================================
// CHECKLIST DE MATERIAIS DO ESTOQUE
// ====================================================
function renderChecklistMateriaisEstoque() {
  const container = document.getElementById("checklistMateriaisEstoque");
  const estoque = lerMateriaisEstoque();

  if (estoque.length === 0) {
    container.innerHTML = '<p class="texto-ajuda">Nenhum material cadastrado ainda no estoque.</p>';
    return;
  }

  const idsJaAdicionados = new Set(
    propostaEmEdicao.itensMateriais
      .map((item) => item.materialId)
      .filter((id) => id !== null && id !== undefined)
  );

  container.innerHTML = "";
  estoque.forEach((material) => {
    const linha = document.createElement("label");
    linha.className = "checklist-item-material";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = idsJaAdicionados.has(material.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        propostaEmEdicao.itensMateriais.push({
          qtd: 1, unid: material.unidade || "un", nome: material.nome,
          valorUnit: material.valor, valorFinal: null, materialId: material.id,
        });
      } else {
        propostaEmEdicao.itensMateriais = propostaEmEdicao.itensMateriais.filter(
          (item) => item.materialId !== material.id
        );
      }
      renderTabelaMateriais();
      atualizarTotaisFormulario();
    });
    linha.appendChild(checkbox);
    linha.appendChild(document.createTextNode(`${material.nome} — R$ ${formatarMoeda(material.valor)}${material.setor ? " (" + material.setor + ")" : ""}`));
    container.appendChild(linha);
  });
}

async function cadastrarMaterialRapido() {
  const campoNome = document.getElementById("rapidoNomeMaterial");
  const campoValor = document.getElementById("rapidoValorMaterial");
  const campoSetor = document.getElementById("rapidoSetorMaterial");

  limparErroCampo(campoNome); limparErroCampo(campoValor); limparErroCampo(campoSetor);

  const nome = campoNome.value.trim();
  const valor = parseFloat(campoValor.value);
  const setor = campoSetor.value.trim();

  let temErro = false;
  if (!nome) { marcarCampoComErro(campoNome, "Informe o nome."); temErro = true; }
  if (isNaN(valor) || valor < 0) { marcarCampoComErro(campoValor, "Informe um valor válido."); temErro = true; }
  if (!setor) { marcarCampoComErro(campoSetor, "Informe o setor."); temErro = true; }
  if (temErro) return;

  const botao = document.getElementById("btnCadastroRapidoMaterial");
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    // Garante que o setor existe na Gestão de Materiais (mesma lista
    // usada por lá), antes de salvar o material propriamente dito.
    const respSetores = await apiDataGet("materiaisSetores");
    const setoresAtuais = (respSetores.ok && respSetores.valor) ? respSetores.valor : [];
    if (!setoresAtuais.includes(setor)) {
      setoresAtuais.push(setor);
      await apiDataSet("materiaisSetores", setoresAtuais);
    }

    const resposta = await apiSalvarMaterial({ nome, setor, codigo: "", valor, quantidade: 0, observacao: "" });
    if (!resposta.ok) { mostrarToast(resposta.erro || "Erro ao cadastrar material.", "erro"); return; }

    const novoMaterial = { id: resposta.id, nome, setor, codigo: "", valor, quantidade: 0, observacao: "" };
    materiaisEstoqueCache.push(novoMaterial);

    propostaEmEdicao.itensMateriais.push({ qtd: 1, unid: "UND", nome, valorUnit: valor, valorFinal: null, materialId: resposta.id });

    campoNome.value = ""; campoValor.value = ""; campoSetor.value = "";
    renderChecklistMateriaisEstoque();
    renderTabelaMateriais();
    atualizarTotaisFormulario();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

// ====================================================
// TABELA: MATERIAIS
// ====================================================
function renderTabelaMateriais() {
  const tbody = document.querySelector("#tabelaMateriais tbody");
  tbody.innerHTML = "";

  propostaEmEdicao.itensMateriais.forEach((item, index) => {
    const tr = document.createElement("tr");
    const vf = valorFinalItem(item);
    const vinculado = item.materialId !== null && item.materialId !== undefined;
    const bloqueado = item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "";
    const rotuloVinculo = vinculado ? '<span class="tag-vinculado">estoque</span>' : "";

    tr.innerHTML = `
      <td class="col-descricao">
        ${rotuloVinculo}
        <input type="text" value="${escaparHtml(item.nome || "")}" placeholder="Nome do material"
          data-mat-campo="nome" data-mat-index="${index}" />
      </td>
      <td>
        <input type="number" min="0" step="0.01" value="${item.qtd || ""}"
          placeholder="Qtd" data-mat-campo="qtd" data-mat-index="${index}"
          ${bloqueado ? 'disabled style="opacity:0.4;"' : ''} />
      </td>
      <td>
        <select data-mat-campo="unid" data-mat-index="${index}">${opcoesUnidadeHtml(item.unid)}</select>
      </td>
      <td>
        <input type="number" min="0" step="0.01" value="${item.valorUnit || ""}"
          placeholder="R$" data-mat-campo="valorUnit" data-mat-index="${index}"
          ${bloqueado ? 'disabled style="opacity:0.4;"' : ''} />
      </td>
      <td>
        <input type="number" min="0" step="0.01"
          value="${item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "" ? item.valorFinal : ""}"
          placeholder="R$ final" data-mat-campo="valorFinal" data-mat-index="${index}"
          style="font-weight:700;color:rgb(180,110,10);" />
        <small style="display:block;font-size:10px;color:#aaa;">
          ${!bloqueado ? "= R$ " + formatarMoeda(vf) : "valor fixo"}
        </small>
      </td>
      <td><button type="button" class="btn-remover-item" data-mat-remover="${index}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-mat-index]").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = parseInt(input.dataset.matIndex, 10);
      const campo = input.dataset.matCampo;
      const item = propostaEmEdicao.itensMateriais[idx];

      if (campo === "qtd" || campo === "valorUnit") {
        item[campo] = parseFloat(input.value) || 0;
      } else if (campo === "valorFinal") {
        item.valorFinal = input.value === "" ? null : parseFloat(input.value) || 0;
      } else {
        item[campo] = input.value;
      }

      const vf = valorFinalItem(item);
      const small = input.closest("tr").querySelector("small");
      if (small) {
        const bloqueado = item.valorFinal !== undefined && item.valorFinal !== null && item.valorFinal !== "";
        small.textContent = bloqueado ? "valor fixo" : "= R$ " + formatarMoeda(vf);
      }

      atualizarTotaisFormulario();
    });

    if (input.dataset.matCampo === "valorFinal") {
      input.addEventListener("blur", async () => {
        const idx = parseInt(input.dataset.matIndex, 10);
        const item = propostaEmEdicao.itensMateriais[idx];
        if (item.materialId) {
          const sincronizar = await perguntarSincronizarMaterial(item.nome);
          if (sincronizar) await atualizarMaterialNoEstoque(item.materialId, item);
        }
        renderTabelaMateriais();
        atualizarTotaisFormulario();
      });
    }
  });

  tbody.querySelectorAll("[data-mat-remover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      propostaEmEdicao.itensMateriais.splice(parseInt(btn.dataset.matRemover, 10), 1);
      renderChecklistMateriaisEstoque();
      renderTabelaMateriais();
      atualizarTotaisFormulario();
    });
  });
}

function adicionarLinhaMaterial() {
  propostaEmEdicao.itensMateriais.push({ qtd: null, unid: "UND", nome: "", valorUnit: null, valorFinal: null, materialId: null });
  renderTabelaMateriais();
  atualizarTotaisFormulario();
}

// ====================================================
// TOTAIS
// ====================================================
function totalMaoDeObraForm(proposta) {
  return (proposta.itensMaoDeObra || []).reduce((s, item) => s + valorFinalItem(item), 0);
}
function totalMateriaisForm(proposta) {
  return (proposta.itensMateriais || []).reduce((s, item) => s + valorFinalItem(item), 0);
}

function atualizarTotaisFormulario() {
  const subtotalMO  = totalMaoDeObraForm(propostaEmEdicao);
  const subtotalMat = totalMateriaisForm(propostaEmEdicao);
  const ajusteMO    = parseFloat(document.getElementById("ajusteMaoDeObra")?.value) || 0;
  const ajusteMat   = parseFloat(document.getElementById("ajusteMateriais")?.value) || 0;
  const totalMO     = subtotalMO + ajusteMO;
  const totalMat    = subtotalMat + ajusteMat;
  const totalGeral  = totalMO + totalMat;

  const subtotalMOEl = document.getElementById("subtotalMaoDeObraTexto");
  if (subtotalMOEl) subtotalMOEl.textContent = `R$ ${formatarMoeda(subtotalMO)}`;
  document.getElementById("totalMaoDeObraTexto").textContent = `R$ ${formatarMoeda(totalMO)}`;

  const subtotalMatEl = document.getElementById("subtotalMateriaisTexto");
  if (subtotalMatEl) subtotalMatEl.textContent = `R$ ${formatarMoeda(subtotalMat)}`;
  document.getElementById("totalMateriaisTexto").textContent = `R$ ${formatarMoeda(totalMat)}`;

  document.getElementById("totalGeralTexto").textContent = `R$ ${formatarMoeda(totalGeral)}`;

  // Salva os ajustes na proposta para serem gravados
  propostaEmEdicao.ajusteMaoDeObra = ajusteMO;
  propostaEmEdicao.ajusteMateriais = ajusteMat;
}

// ====================================================
// SALVAR
// ====================================================
async function salvarFormularioProposta() {
  const campoCliente = document.getElementById("campoCliente");
  limparErrosDoFormulario(document.getElementById("modalProposta"));

  propostaEmEdicao.numeroOrcamento = document.getElementById("campoNumeroOrcamento").value.trim();
  propostaEmEdicao.cliente = campoCliente.value.trim();
  propostaEmEdicao.telefone = document.getElementById("campoTelefone").value.trim();
  propostaEmEdicao.local = document.getElementById("campoLocal").value.trim();
  propostaEmEdicao.servico = document.getElementById("campoServico").value.trim();
  propostaEmEdicao.observacao = document.getElementById("campoObservacao").value.trim();
  propostaEmEdicao.formaPagamento = document.getElementById("campoFormaPagamento").value.trim();
  propostaEmEdicao.planejamentoDias = document.getElementById("campoPlanejamento").value;
  propostaEmEdicao.validadeDias = document.getElementById("campoValidade").value;

  if (!propostaEmEdicao.cliente) {
    marcarCampoComErro(campoCliente, "Informe o nome do cliente.");
    focarPrimeiroErro(document.getElementById("modalProposta"));
    return;
  }

  const botaoSalvar = document.getElementById("btnSalvarProposta");
  const textoOriginalBotao = botaoSalvar.textContent;
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    // Qualquer item de material/mão de obra digitado manualmente (sem
    // ter sido escolhido do catálogo) vira uma entrada nova no
    // catálogo agora — assim fica disponível depois em Gestão de
    // Material / na NFS-e, sem precisar cadastrar de novo.
    for (const item of propostaEmEdicao.itensMateriais) {
      if (!item.materialId && item.nome && item.nome.trim()) {
        item.materialId = await garantirMaterialNoCatalogo(item.nome, item.valorUnit);
      }
    }
    for (const item of propostaEmEdicao.itensMaoDeObra) {
      if (!item.servicoId && item.descricao && item.descricao.trim()) {
        item.servicoId = await garantirServicoNoCatalogo(item.descricao, item.valorUnit);
      }
    }

    salvarProposta(propostaEmEdicao);
    fecharFormularioProposta();
    if (onSalvarPropostaCallback) onSalvarPropostaCallback();
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = textoOriginalBotao;
  }
}