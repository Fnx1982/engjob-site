// ============================================================
// confirm-modal.js
// Modal de confirmação reutilizável, no estilo visual do site,
// para substituir o confirm() nativo do navegador.
//
// Uso:
//   confirmarAcao("Excluir usuário?", "Essa ação não pode ser desfeita.")
//     .then((confirmado) => {
//       if (confirmado) { ...faz a exclusão... }
//     });
//
// Funciona como uma Promise: resolve com true (confirmou) ou
// false (cancelou / fechou o modal).
// ============================================================

function _criarEstruturaModalConfirmacao() {
  if (document.getElementById("modal-confirmacao-global")) return;

  const overlay = document.createElement("div");
  overlay.id = "modal-confirmacao-global";
  overlay.className = "confirm-modal-overlay";
  overlay.innerHTML = `
    <div class="confirm-modal-content">
      <p class="confirm-modal-titulo" id="confirm-modal-titulo"></p>
      <p class="confirm-modal-texto" id="confirm-modal-texto"></p>
      <div class="confirm-modal-botoes">
        <button type="button" class="confirm-modal-cancelar" id="confirm-modal-cancelar">Cancelar</button>
        <button type="button" class="confirm-modal-confirmar" id="confirm-modal-confirmar">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Injeta o CSS necessário uma única vez, mesmo se a página
  // não tiver carregado um confirm-modal.css separado.
  if (!document.getElementById("confirm-modal-style")) {
    const style = document.createElement("style");
    style.id = "confirm-modal-style";
    style.textContent = `
      .confirm-modal-overlay {
        display: none;
        position: fixed;
        z-index: 2000;
        left: 0; top: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.55);
        justify-content: center;
        align-items: center;
      }
      .confirm-modal-overlay.active {
        display: flex;
      }
      .confirm-modal-content {
        background: white;
        border-radius: 10px;
        padding: 24px;
        width: 90%;
        max-width: 380px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      }
      .confirm-modal-titulo {
        font-size: 18px;
        font-weight: bold;
        color: #333;
        margin: 0 0 8px;
      }
      .confirm-modal-texto {
        font-size: 14px;
        color: #666;
        margin: 0 0 20px;
      }
      .confirm-modal-botoes {
        display: flex;
        gap: 10px;
        justify-content: center;
      }
      .confirm-modal-botoes button {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
        transition: 0.2s;
        font-family: inherit;
      }
      .confirm-modal-cancelar {
        background: rgb(225, 225, 225);
        color: #333;
      }
      .confirm-modal-cancelar:hover {
        background: rgb(208, 208, 208);
      }
      .confirm-modal-confirmar {
        background: crimson;
        color: white;
      }
      .confirm-modal-confirmar:hover {
        background: #a30000;
      }
    `;
    document.head.appendChild(style);
  }
}

function confirmarAcao(titulo, texto) {
  _criarEstruturaModalConfirmacao();

  const overlay = document.getElementById("modal-confirmacao-global");
  const tituloEl = document.getElementById("confirm-modal-titulo");
  const textoEl = document.getElementById("confirm-modal-texto");
  const btnCancelar = document.getElementById("confirm-modal-cancelar");
  const btnConfirmar = document.getElementById("confirm-modal-confirmar");

  tituloEl.textContent = titulo || "Tem certeza?";
  textoEl.textContent = texto || "";
  textoEl.style.display = texto ? "block" : "none";

  overlay.classList.add("active");

  return new Promise((resolve) => {
    function limpar(resultado) {
      overlay.classList.remove("active");
      btnCancelar.removeEventListener("click", onCancelar);
      btnConfirmar.removeEventListener("click", onConfirmar);
      overlay.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(resultado);
    }
    function onCancelar() { limpar(false); }
    function onConfirmar() { limpar(true); }
    function onOverlayClick(e) {
      if (e.target === overlay) limpar(false);
    }
    function onKeydown(e) {
      if (e.key === "Escape") limpar(false);
      if (e.key === "Enter") limpar(true);
    }

    btnCancelar.addEventListener("click", onCancelar);
    btnConfirmar.addEventListener("click", onConfirmar);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeydown);
  });
}