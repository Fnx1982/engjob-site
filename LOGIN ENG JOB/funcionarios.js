const form = document.getElementById("form-funcionario");
const tabela = document.getElementById("tabela").querySelector("tbody");
const totalDiv = document.getElementById("total");
const filtroMes = document.getElementById("filtroMes");
const filtroObra = document.getElementById("filtroObra");
const filtroNome = document.getElementById("filtroNome");
const popup = document.getElementById("popup-comprovante");
const popupBody = document.getElementById("popup-body");
const fecharPopup = document.getElementById("fecharPopup");
const btnFecharPopup = document.getElementById("btn-fechar-popup");

let funcionarios = JSON.parse(localStorage.getItem("financeiro")) || [];

// Atualiza filtro de obras
function atualizarFiltroObras() {
  const obrasUnicas = [...new Set(funcionarios.map(f => f.obra))];
  filtroObra.innerHTML = `<option value="todas">Todas as Obras</option>`;
  obrasUnicas.forEach(obra => {
    const option = document.createElement("option");
    option.value = obra;
    option.textContent = obra;
    filtroObra.appendChild(option);
  });
}

// Atualiza tabela
function atualizarTabela() {
  tabela.innerHTML = "";
  let total = 0;

  const mesSel = filtroMes.value;
  const obraSel = filtroObra.value;
  const nomeSel = filtroNome.value.trim().toLowerCase();

  funcionarios.forEach((f, i) => {
    const mesOK = mesSel === "todos" || f.mes === mesSel;
    const obraOK = obraSel === "todas" || f.obra === obraSel;
    const nomeOK = nomeSel === "" || f.nome.toLowerCase().includes(nomeSel);

    if (mesOK && obraOK && nomeOK) {
      total += parseFloat(f.valor);
      const row = document.createElement("tr");
      const botaoVer = f.comprovante
        ? `<button class="btn-view" data-index="${i}">Ver</button>`
        : "-";
      row.innerHTML = `
        <td>${f.nome}</td>
        <td>${f.obra}</td>
        <td>${f.mes}</td>
        <td>R$ ${parseFloat(f.valor).toFixed(2)}</td>
        <td>${botaoVer}</td>
        <td>
          <button class="btn-edit" onclick="editar(${i})">Editar</button>
          <button class="btn-delete" onclick="excluir(${i})">Excluir</button>
        </td>`;
      tabela.appendChild(row);
    }
  });

  // Eventos "Ver"
  document.querySelectorAll(".btn-view").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const index = e.target.dataset.index;
      abrirPopup(funcionarios[index].comprovante);
    });
  });

  totalDiv.textContent = `Total: R$ ${total.toFixed(2)}`;
  localStorage.setItem("financeiro", JSON.stringify(funcionarios));
  atualizarFiltroObras();
}

// Cadastrar funcionário
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome").value;
  const obra = document.getElementById("obra").value;
  const mes = document.getElementById("mes").value;
  const valor = document.getElementById("valor").value;
  const file = document.getElementById("comprovante").files[0];

  let comprovante = null;
  if (file) comprovante = URL.createObjectURL(file);

  funcionarios.push({ nome, obra, mes, valor, comprovante });
  form.reset();
  atualizarTabela();
});

// Editar registro
function editar(index) {
  const f = funcionarios[index];
  document.getElementById("nome").value = f.nome;
  document.getElementById("obra").value = f.obra;
  document.getElementById("mes").value = f.mes;
  document.getElementById("valor").value = f.valor;
  funcionarios.splice(index, 1);
  atualizarTabela();
}

// Excluir registro
function excluir(index) {
  if (confirm("Deseja realmente excluir este registro?")) {
    funcionarios.splice(index, 1);
    atualizarTabela();
  }
}

// === POPUP ===
function abrirPopup(url) {
  popup.style.display = "flex";
  popupBody.innerHTML = "";

  if (!url) {
    popupBody.innerHTML = "<p>Nenhum comprovante disponível.</p>";
    return;
  }

  if (url.endsWith(".pdf")) {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.border = "none";
    popupBody.appendChild(iframe);
  } else {
    const img = document.createElement("img");
    img.src = url;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "80vh";
    img.style.borderRadius = "10px";
    popupBody.appendChild(img);
  }
}

// Fechar popup
function fecharModal() {
  popup.style.display = "none";
  popupBody.innerHTML = "";
}

fecharPopup.addEventListener("click", fecharModal);
btnFecharPopup.addEventListener("click", fecharModal);
popup.addEventListener("click", (e) => {
  if (e.target === popup) fecharModal();
});

// Filtros
[filtroMes, filtroObra, filtroNome].forEach(f => f.addEventListener("input", atualizarTabela));

// Inicializa
atualizarTabela();
