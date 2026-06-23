let materiais = [];
let tipos = [];
let indexExclusao = null;
let tipoExclusao = "";

/* ======= SETORES ======= */
function adicionarTipo() {
    const input = document.getElementById("novoTipo");
    const nome = input.value.trim();
    if (!nome) return;
    tipos.push(nome);
    input.value = "";
    renderTipos();
    atualizarSelects();
}

function renderTipos() {
    const tbody = document.querySelector("#tabelaTipos tbody");
    tbody.innerHTML = "";
    tipos.forEach((t, i) => {
        tbody.innerHTML += `<tr>
            <td>${i+1}</td>
            <td>${t}</td>
            <td>
                <button class="btn btn-edit" onclick="abrirModalEditarTipo(${i})">Editar</button>
                <button class="btn btn-delete" onclick="abrirConfirExclusao(${i}, 'setor')">Excluir</button>
            </td>
        </tr>`;
    });
}

function atualizarSelects() {
    const ids = ["setorMaterial", "editSetor"];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '<option value="">Selecione um setor...</option>';
            tipos.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t; opt.textContent = t;
                sel.appendChild(opt);
            });
        }
    });
}

/* ======= MATERIAIS ======= */
function adicionarMaterial() {
    const nome = document.getElementById("nomeMaterial").value.trim();
    const valor = parseFloat(document.getElementById("valorMaterial").value) || 0;
    const setor = document.getElementById("setorMaterial").value;
    const codigo = document.getElementById("codigoMaterial").value;
    const quantidade = document.getElementById("quantidadeMaterial").value || 0;
    const obs = document.getElementById("obsMaterial").value;

    if (!nome || !setor || !codigo) {
        alert("Preencha os campos obrigatórios!");
        return;
    }

    materiais.push({ nome, valor, setor, codigo, quantidade, observacao: obs });
    limparCampos();
    renderMateriais();
}

function renderMateriais() {
    const filtro = document.getElementById("pesquisa").value.toLowerCase();
    const tbody = document.querySelector("#tabelaMateriais tbody");
    tbody.innerHTML = "";
    materiais.forEach((m, i) => {
        if (m.nome.toLowerCase().includes(filtro) || m.setor.toLowerCase().includes(filtro)) {
            tbody.innerHTML += `<tr>
                <td>${i+1}</td>
                <td>${m.nome}</td>
                <td>R$ ${m.valor.toFixed(2)}</td>
                <td>${m.setor}</td>
                <td>${m.codigo}</td>
                <td>${m.quantidade}</td>
                <td>${m.observacao}</td>
                <td>
                    <button class="btn btn-edit" onclick="abrirModalEditarMaterial(${i})">Editar</button>
                    <button class="btn btn-delete" onclick="abrirConfirExclusao(${i}, 'material')">Excluir</button>
                </td>
            </tr>`;
        }
    });
}

/* ======= EDIÇÕES ======= */
function abrirModalEditarMaterial(i) {
    const m = materiais[i];
    document.getElementById("editIndex").value = i;
    document.getElementById("editNome").value = m.nome;
    document.getElementById("editValor").value = m.valor;
    document.getElementById("editSetor").value = m.setor;
    document.getElementById("editCodigo").value = m.codigo;
    document.getElementById("editQuantidade").value = m.quantidade;
    document.getElementById("editObs").value = m.observacao;
    abrirModal("modalEditarMaterial");
}

function salvarEdicaoMaterial() {
    const i = document.getElementById("editIndex").value;
    materiais[i] = {
        nome: document.getElementById("editNome").value,
        valor: parseFloat(document.getElementById("editValor").value) || 0,
        setor: document.getElementById("editSetor").value,
        codigo: document.getElementById("editCodigo").value,
        quantidade: document.getElementById("editQuantidade").value,
        observacao: document.getElementById("editObs").value
    };
    fecharModal("modalEditarMaterial");
    renderMateriais();
}

function abrirModalEditarTipo(i) {
    document.getElementById("editTipoIndex").value = i;
    document.getElementById("editTipoNome").value = tipos[i];
    abrirModal("modalEditarTipo");
}

function salvarEdicaoTipo() {
    const i = document.getElementById("editTipoIndex").value;
    const antigoNome = tipos[i];
    const novoNome = document.getElementById("editTipoNome").value.trim();
    if (novoNome) {
        tipos[i] = novoNome;
        materiais.forEach(m => { if(m.setor === antigoNome) m.setor = novoNome; });
        fecharModal("modalEditarTipo");
        renderTipos();
        renderMateriais();
        atualizarSelects();
    }
}

/* ======= EXCLUSÃO PERSONALIZADA ======= */
function abrirConfirExclusao(index, tipo) {
    indexExclusao = index;
    tipoExclusao = tipo;
    document.getElementById("confirMensagem").innerText = `Deseja realmente excluir este ${tipo}?`;
    document.getElementById("btnConfirmarSim").onclick = confirmarExclusao;
    abrirModal("modalConfirmacao");
}

function confirmarExclusao() {
    if (tipoExclusao === "material") materiais.splice(indexExclusao, 1);
    else tipos.splice(indexExclusao, 1);
    
    renderMateriais();
    renderTipos();
    atualizarSelects();
    fecharModal("modalConfirmacao");
}

/* ======= UTILITÁRIOS ======= */
function abrirModal(id) { document.getElementById(id).style.display = "flex"; }
function fecharModal(id) { document.getElementById(id).style.display = "none"; }
function limparCampos() {
    ["nomeMaterial", "valorMaterial", "codigoMaterial", "quantidadeMaterial", "obsMaterial"].forEach(id => {
        document.getElementById(id).value = "";
    });
}