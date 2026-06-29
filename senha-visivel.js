// ============================================================
// senha-visivel.js
// Adiciona um ícone de "olho" em qualquer campo de senha da
// página, permitindo mostrar/ocultar o texto digitado. Funciona
// automaticamente em todo <input type="password"> existente,
// sem precisar alterar o HTML de cada formulário.
//
// Requer o boxicons (já carregado na maioria das páginas do site
// via <link href="https://unpkg.com/boxicons...">). Se a página
// não tiver boxicons, o ícone aparece como texto "Mostrar/Ocultar".
// ============================================================

function ativarOlhoSenha() {
  if (!document.getElementById("senha-visivel-style")) {
    const style = document.createElement("style");
    style.id = "senha-visivel-style";
    style.textContent = `
      .pai-com-olho-senha {
        position: relative !important;
      }
      .pai-com-olho-senha input[type="password"],
      .pai-com-olho-senha input[type="text"].campo-senha-revelada {
        padding-right: 38px !important;
        box-sizing: border-box !important;
      }
      .btn-olho-senha {
        position: absolute !important;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        color: #888;
        padding: 0;
        margin: 0;
        line-height: 1;
        display: flex;
        align-items: center;
        z-index: 5;
      }
      .btn-olho-senha:hover {
        color: #555;
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll('input[type="password"]').forEach((campo) => {
    // Evita aplicar duas vezes no mesmo campo.
    if (campo.dataset.olhoAtivado) return;
    campo.dataset.olhoAtivado = "true";

    // Usa o elemento pai direto do input (geralmente um <label> ou
    // <div>) como contexto de posicionamento, em vez de criar um
    // wrapper novo — isso evita conflitos com o CSS já existente
    // da página (largura, display, margens definidas no pai).
    const pai = campo.parentElement;
    pai.classList.add("pai-com-olho-senha");

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn-olho-senha";
    botao.setAttribute("aria-label", "Mostrar senha");
    botao.innerHTML = temBoxicons()
      ? '<i class="bx bx-hide"></i>'
      : "Mostrar";

    let visivel = false;
    botao.addEventListener("click", () => {
      visivel = !visivel;
      campo.type = visivel ? "text" : "password";
      if (visivel) campo.classList.add("campo-senha-revelada");
      else campo.classList.remove("campo-senha-revelada");

      if (temBoxicons()) {
        botao.innerHTML = visivel ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
      } else {
        botao.textContent = visivel ? "Ocultar" : "Mostrar";
      }
      botao.setAttribute("aria-label", visivel ? "Ocultar senha" : "Mostrar senha");
    });

    // Insere o botão logo depois do input, dentro do mesmo pai —
    // o posicionamento absoluto (relativo ao pai) cuida do resto.
    campo.insertAdjacentElement("afterend", botao);
  });
}

function temBoxicons() {
  return [...document.styleSheets].some((sheet) => {
    try {
      return sheet.href && sheet.href.includes("boxicons");
    } catch {
      return false;
    }
  });
}

// Ativa automaticamente quando o DOM estiver pronto. Se algum
// campo de senha for criado dinamicamente depois (ex: um modal
// aberto via JS), basta chamar ativarOlhoSenha() de novo.
document.addEventListener("DOMContentLoaded", ativarOlhoSenha);