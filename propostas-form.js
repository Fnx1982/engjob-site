// ============================================================
// propostas-form.js
// Lógica do modal de criar/editar proposta — compartilhada entre
// orcamento.html, propostas.html e andamento.html. Cada página
// inclui este script e chama abrirFormularioProposta(id) para
// editar, ou abrirFormularioProposta(null) para criar uma nova.
//
// Esse arquivo monta o HTML do modal dinamicamente e o insere no
// final do <body>, então as páginas que o usam não precisam
// repetir o HTML do formulário inteiro.
// ============================================================

let propostaEmEdicao = null; // objeto da proposta sendo editada (ou nova)
let onSalvarPropostaCallback = null; // chamado depois de salvar, para a página atualizar a lista

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
          <label>Cliente
            <input type="text" id="campoCliente" placeholder="Nome do cliente" />
          </label>
          <label>Telefone</span>
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
        <table class="itens-tabela" id="tabelaMaoDeObra">
          <thead>
            <tr><th>Qtd</th><th>Unid</th><th>Descrição</th><th>Valor Unit.</th><th>Total</th><th></th></tr>
          </thead>
          <tbody></tbody>
        </table>
        <button type="button" class="btn-add-item" id="btnAddMaoDeObra">+ Adicionar item de mão de obra</button>
        <div class="linha-total-secao">Total Mão de Obra: <span id="totalMaoDeObraTexto">R$ 0,00</span></div>
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
        <table class="itens-tabela" id="tabelaMateriais">
          <thead>
            <tr><th>Qtd</th><th>Unid</th><th>Material</th><th>Valor Unit.</th><th>Total</th><th></th></tr>
          </thead>
          <tbody></tbody>
        </table>
        <button type="button" class="btn-add-item" id="btnAddMaterial">+ Adicionar item manual (sem vincular ao estoque)</button>
        <div class="linha-total-secao">Total Materiais: <span id="totalMateriaisTexto">R$ 0,00</span></div>
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

  limparErroAoEditar(document.getElementById("campoCliente"));
}

// Máscara (99) 9 9999-9999, igual ao padrão usado no cadastro de usuários
function aplicarMascaraTelefoneProposta(event) {
  let input = event.target;
  let valor = input.value.replace(/\D/g, "");
  if (valor.length > 11) valor = valor.slice(0, 11);

  if (valor.length > 7) {
    valor = valor.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4}).*/, "($1) $2 $3-$4");
  } else if (valor.length > 3) {
    valor = valor.replace(/^(\d{2})(\d{1})(\d{0,4})/, "($1) $2 $3");
  } else if (valor.length > 2) {
    valor = valor.replace(/^(\d{2})(\d{0,1})/, "($1) $2");
  } else if (valor.length > 0) {
    valor = valor.replace(/^(\d{0,2})/, "($1");
  }
  input.value = valor.trim();
}

function abrirFormularioProposta(id, onSalvar) {
  montarModalFormularioProposta();
  onSalvarPropostaCallback = onSalvar || null;

  propostaEmEdicao = id ? JSON.parse(JSON.stringify(buscarProposta(id))) : criarPropostaVazia();

  document.getElementById("tituloModalProposta").textContent = id ? "Editar Orçamento" : "Novo Orçamento";
  document.getElementById("campoCliente").value = propostaEmEdicao.cliente;
  document.getElementById("campoTelefone").value = propostaEmEdicao.telefone;
  document.getElementById("campoLocal").value = propostaEmEdicao.local;
  document.getElementById("campoServico").value = propostaEmEdicao.servico;
  document.getElementById("campoObservacao").value = propostaEmEdicao.observacao || "";
  document.getElementById("campoFormaPagamento").value = propostaEmEdicao.formaPagamento;
  document.getElementById("campoPlanejamento").value = propostaEmEdicao.planejamentoDias;
  document.getElementById("campoValidade").value = propostaEmEdicao.validadeDias;

  renderChecklistMateriaisEstoque();
  renderTabelaMaoDeObra();
  renderTabelaMateriais();
  atualizarTotaisFormulario();

  document.getElementById("rapidoNomeMaterial").value = "";
  document.getElementById("rapidoValorMaterial").value = "";
  document.getElementById("rapidoSetorMaterial").value = "";

  document.getElementById("modalProposta").classList.add("active");
}

function fecharFormularioProposta() {
  const modal = document.getElementById("modalProposta");
  if (modal) modal.classList.remove("active");
  propostaEmEdicao = null;
}

// ====================================================
// TABELA: MÃO DE OBRA
// ====================================================
function renderTabelaMaoDeObra() {
  const tbody = document.querySelector("#tabelaMaoDeObra tbody");
  tbody.innerHTML = "";
  propostaEmEdicao.itensMaoDeObra.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" min="0" step="0.01" value="${item.qtd}" data-mo-campo="qtd" data-mo-index="${index}" /></td>
      <td><input type="text" value="${item.unid || ""}" placeholder="un" data-mo-campo="unid" data-mo-index="${index}" /></td>
      <td class="col-descricao"><input type="text" value="${item.descricao || ""}" placeholder="Descrição do serviço" data-mo-campo="descricao" data-mo-index="${index}" /></td>
      <td><input type="number" min="0" step="0.01" value="${item.valorUnit}" data-mo-campo="valorUnit" data-mo-index="${index}" /></td>
      <td class="col-total-linha">R$ ${formatarMoeda(item.qtd * item.valorUnit)}</td>
      <td><button type="button" class="btn-remover-item" data-mo-remover="${index}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-mo-index]").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = parseInt(input.dataset.moIndex, 10);
      const campo = input.dataset.moCampo;
      const valor = campo === "qtd" || campo === "valorUnit" ? parseFloat(input.value) || 0 : input.value;
      propostaEmEdicao.itensMaoDeObra[idx][campo] = valor;

      // Atualiza só o "Total" daquela linha (sem recriar os inputs,
      // o que faria o campo perder o foco a cada tecla digitada).
      const item = propostaEmEdicao.itensMaoDeObra[idx];
      const linha = input.closest("tr");
      linha.querySelector(".col-total-linha").textContent = `R$ ${formatarMoeda(item.qtd * item.valorUnit)}`;

      atualizarTotaisFormulario();
    });
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
  propostaEmEdicao.itensMaoDeObra.push({ qtd: 1, unid: "un", descricao: "", valorUnit: 0 });
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

  // Marca como "já adicionado" os materiais cujo materialIndex já
  // está presente entre os itens do orçamento.
  const indicesJaAdicionados = new Set(
    propostaEmEdicao.itensMateriais
      .map((item) => item.materialIndex)
      .filter((idx) => idx !== null && idx !== undefined)
  );

  container.innerHTML = "";
  estoque.forEach((material, index) => {
    const linha = document.createElement("label");
    linha.className = "checklist-item-material";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = indicesJaAdicionados.has(index);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        propostaEmEdicao.itensMateriais.push({
          qtd: 1,
          unid: "un",
          nome: material.nome,
          valorUnit: material.valor,
          materialIndex: index,
        });
      } else {
        propostaEmEdicao.itensMateriais = propostaEmEdicao.itensMateriais.filter(
          (item) => item.materialIndex !== index
        );
      }
      renderTabelaMateriais();
      atualizarTotaisFormulario();
    });
    linha.appendChild(checkbox);
    linha.appendChild(document.createTextNode(`${material.nome} — R$ ${formatarMoeda(material.valor)} (${material.setor})`));
    container.appendChild(linha);
  });
}

// Cadastra um material novo direto no estoque (Gestão de Materiais)
// e já adiciona como item no orçamento atual.
function cadastrarMaterialRapido() {
  const campoNome = document.getElementById("rapidoNomeMaterial");
  const campoValor = document.getElementById("rapidoValorMaterial");
  const campoSetor = document.getElementById("rapidoSetorMaterial");

  limparErroCampo(campoNome);
  limparErroCampo(campoValor);
  limparErroCampo(campoSetor);

  const nome = campoNome.value.trim();
  const valor = parseFloat(campoValor.value);
  const setor = campoSetor.value.trim();

  let temErro = false;
  if (!nome) {
    marcarCampoComErro(campoNome, "Informe o nome.");
    temErro = true;
  }
  if (isNaN(valor) || valor < 0) {
    marcarCampoComErro(campoValor, "Informe um valor válido.");
    temErro = true;
  }
  if (!setor) {
    marcarCampoComErro(campoSetor, "Informe o setor.");
    temErro = true;
  }
  if (temErro) return;

  // Garante que o setor exista na lista de setores cadastrados.
  const setores = JSON.parse(localStorage.getItem("materiais_setores")) || [];
  if (!setores.includes(setor)) {
    setores.push(setor);
    localStorage.setItem("materiais_setores", JSON.stringify(setores));
  }

  const estoque = lerMateriaisEstoque();
  estoque.push({ nome, setor, codigo: "", valor, quantidade: 0, observacao: "" });
  salvarMateriaisEstoque(estoque);

  const novoIndex = estoque.length - 1;
  propostaEmEdicao.itensMateriais.push({
    qtd: 1,
    unid: "un",
    nome,
    valorUnit: valor,
    materialIndex: novoIndex,
  });

  campoNome.value = "";
  campoValor.value = "";
  campoSetor.value = "";

  renderChecklistMateriaisEstoque();
  renderTabelaMateriais();
  atualizarTotaisFormulario();
}

// ====================================================
// TABELA: MATERIAIS (vinculados ao estoque)
// ====================================================
function renderTabelaMateriais() {
  const tbody = document.querySelector("#tabelaMateriais tbody");
  tbody.innerHTML = "";

  propostaEmEdicao.itensMateriais.forEach((item, index) => {
    const tr = document.createElement("tr");
    const vinculado = item.materialIndex !== null && item.materialIndex !== undefined;
    const rotuloVinculo = vinculado ? '<span class="tag-vinculado">estoque</span>' : "";

    tr.innerHTML = `
      <td><input type="number" min="0" step="0.01" value="${item.qtd}" data-mat-campo="qtd" data-mat-index="${index}" /></td>
      <td><input type="text" value="${item.unid || ""}" placeholder="un" data-mat-campo="unid" data-mat-index="${index}" /></td>
      <td class="col-descricao">
        ${rotuloVinculo}
        <input type="text" value="${item.nome || ""}" placeholder="Nome do material" data-mat-campo="nome" data-mat-index="${index}" />
      </td>
      <td><input type="number" min="0" step="0.01" value="${item.valorUnit}" data-mat-campo="valorUnit" data-mat-index="${index}" /></td>
      <td class="col-total-linha">R$ ${formatarMoeda(item.qtd * item.valorUnit)}</td>
      <td><button type="button" class="btn-remover-item" data-mat-remover="${index}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });

  // "input" atualiza o estado e o total da linha em tempo real,
  // sem recriar os campos (evita perder o foco a cada tecla).
  tbody.querySelectorAll("[data-mat-index]").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = parseInt(input.dataset.matIndex, 10);
      const campo = input.dataset.matCampo;
      const item = propostaEmEdicao.itensMateriais[idx];
      const valorNovo = campo === "qtd" || campo === "valorUnit" ? parseFloat(input.value) || 0 : input.value;
      item[campo] = valorNovo;

      const linha = input.closest("tr");
      linha.querySelector(".col-total-linha").textContent = `R$ ${formatarMoeda(item.qtd * item.valorUnit)}`;
      atualizarTotaisFormulario();
    });

    // A pergunta de sincronizar com o estoque só dispara quando o
    // usuário termina de editar o campo (blur), não a cada tecla.
    input.addEventListener("blur", async () => {
      const idx = parseInt(input.dataset.matIndex, 10);
      const campo = input.dataset.matCampo;
      const item = propostaEmEdicao.itensMateriais[idx];
      const vinculado = item.materialIndex !== null && item.materialIndex !== undefined;
      if (!vinculado) return;
      if (campo !== "nome" && campo !== "valorUnit" && campo !== "qtd") return;

      const sincronizar = await perguntarSincronizarMaterial(item.nome);
      if (sincronizar) {
        atualizarMaterialNoEstoque(item.materialIndex, item);
      }
    });
  });

  tbody.querySelectorAll("[data-mat-remover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.matRemover, 10);
      propostaEmEdicao.itensMateriais.splice(idx, 1);
      renderChecklistMateriaisEstoque();
      renderTabelaMateriais();
      atualizarTotaisFormulario();
    });
  });
}

function adicionarLinhaMaterial() {
  propostaEmEdicao.itensMateriais.push({ qtd: 1, unid: "un", nome: "", valorUnit: 0, materialIndex: null });
  renderTabelaMateriais();
  atualizarTotaisFormulario();
}

// ====================================================
// TOTAIS DO FORMULÁRIO
// ====================================================
function atualizarTotaisFormulario() {
  document.getElementById("totalMaoDeObraTexto").textContent = `R$ ${formatarMoeda(totalMaoDeObra(propostaEmEdicao))}`;
  document.getElementById("totalMateriaisTexto").textContent = `R$ ${formatarMoeda(totalMateriais(propostaEmEdicao))}`;
  document.getElementById("totalGeralTexto").textContent = `R$ ${formatarMoeda(totalGeral(propostaEmEdicao))}`;
}

// ====================================================
// SALVAR
// ====================================================
function salvarFormularioProposta() {
  const campoCliente = document.getElementById("campoCliente");
  limparErrosDoFormulario(document.getElementById("modalProposta"));

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

  salvarProposta(propostaEmEdicao);
  fecharFormularioProposta();
  if (onSalvarPropostaCallback) onSalvarPropostaCallback();
}