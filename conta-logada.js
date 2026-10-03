// ============================================================
// conta-logada.js — mostra QUEM está logado (tela inicial).
//
// Um botão redondo com as iniciais, ao lado do sino. Tocando nele,
// abre um quadrinho com: nome, setor, registro, o Gmail conectado ao
// calendário e o botão Sair. No computador o nome aparece ao lado
// das iniciais; no celular só as iniciais (pra caber na barra).
// ============================================================
(function () {
  function iniciais(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    const primeira = partes[0][0];
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
    return (primeira + ultima).toUpperCase();
  }

  function esc(t) { return typeof escaparHtml === "function" ? escaparHtml(t) : String(t || ""); }

  const caixa = document.createElement("div");
  caixa.id = "contaLogada";
  caixa.innerHTML = `
    <button type="button" id="btnContaLogada" aria-label="Minha conta">
      <span class="avatar-conta" id="avatarConta">?</span>
      <span class="nome-conta" id="nomeContaCurto"></span>
    </button>
    <div id="painelConta" hidden>
      <div class="painel-conta-topo">
        <span class="avatar-conta grande" id="avatarContaGrande">?</span>
        <div>
          <div class="painel-conta-nome" id="painelContaNome"></div>
          <div class="painel-conta-setor" id="painelContaSetor"></div>
        </div>
      </div>
      <div class="painel-conta-linha"><span>Registro</span><b id="painelContaRegistro"></b></div>
      <div class="painel-conta-linha"><span>Gmail do calendário</span><b id="painelContaGmail"></b></div>
      <button type="button" class="painel-conta-sair" id="btnContaSair">Sair da conta</button>
    </div>
  `;
  document.body.appendChild(caixa);

  function preencher() {
    const nome = localStorage.getItem("userNome") || "Usuário";
    const setor = localStorage.getItem("userSetor") || "";
    const registro = localStorage.getItem("userId") || "-";
    const primeiroNome = nome.split(/\s+/)[0];
    document.getElementById("avatarConta").textContent = iniciais(nome);
    document.getElementById("avatarContaGrande").textContent = iniciais(nome);
    document.getElementById("nomeContaCurto").textContent = primeiroNome;
    document.getElementById("painelContaNome").textContent = nome;
    document.getElementById("painelContaSetor").textContent = setor;
    document.getElementById("painelContaRegistro").textContent = registro;
    const gmail = typeof getGoogleEmailSalvo === "function" ? getGoogleEmailSalvo() : "";
    document.getElementById("painelContaGmail").innerHTML = gmail
      ? esc(gmail)
      : '<a href="calendario.html">Não conectado — conectar</a>';
  }

  const painel = document.getElementById("painelConta");
  document.getElementById("btnContaLogada").addEventListener("click", (e) => {
    e.stopPropagation();
    preencher();
    painel.hidden = !painel.hidden;
  });
  painel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => { painel.hidden = true; });

  // "Sair da conta" usa a mesma confirmação do item Sair do menu
  document.getElementById("btnContaSair").addEventListener("click", () => {
    painel.hidden = true;
    const linkSair = document.getElementById("logout-link");
    if (linkSair) linkSair.click();
  });

  preencher();
  // O nome é atualizado pela checagem de sessão logo depois que a
  // página abre — atualiza o botão quando isso acontecer.
  setTimeout(preencher, 1500);
  if (typeof onGoogleAuthChange === "function") onGoogleAuthChange(preencher);
})();
