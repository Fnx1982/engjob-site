// ==========================
// MODAL DE LOGOUT
// ==========================
const logoutLink = document.getElementById("logout-link");
const modal = document.getElementById("logout-modal");
const btnYes = document.getElementById("btn-yes");
const btnNo = document.getElementById("btn-no");

function logout() {
  try {
    // Limpa apenas os dados de SESSÃO do usuário logado.
    // IMPORTANTE: NÃO remover "usuarios" aqui — essa chave guarda a base
    // de cadastros (todos os usuários do sistema), não é dado de sessão.
    // Removê-la no logout apagava todos os cadastros sempre que alguém saía.
    localStorage.removeItem("userId");
    localStorage.removeItem("userType");

    // Se quiser que "Montante" e "Mês" também sejam só da sessão atual,
    // mantenha as duas linhas abaixo. Se quiser que esses valores
    // continuem aparecendo após logar de novo, remova-as também.
    localStorage.removeItem("montante");
    localStorage.removeItem("observacao");

    // redireciona para tela de login
    window.location.href = "login.html";
  } catch (err) {
    console.error("Erro ao deslogar:", err);
    alert("Não foi possível sair. Tente novamente.");
  }
}


if (logoutLink && modal) {
  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    modal.classList.add("active");
  });

  btnYes.addEventListener("click", () => {
    logout(); // chama função do api.js
    modal.classList.remove("active");
  });

  btnNo.addEventListener("click", () => modal.classList.remove("active"));

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      modal.classList.remove("active");
    }
  });
}

// ==========================
// SUBMENU
// ==========================
function setupSubmenuToggle(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const toggle = menu.querySelector(".submenu-toggle");
  const submenu = menu.querySelector(".submenu");
  const arrow = menu.querySelector(".submenu-arrow");

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (!submenu) return;
    if (submenu.style.display === "block") {
      submenu.style.display = "none";
      if (arrow) arrow.style.transform = "rotate(0deg)";
    } else {
      submenu.style.display = "block";
      if (arrow) arrow.style.transform = "rotate(180deg)";
    }
  });

  menu.addEventListener("mouseleave", () => {
    if (submenu) submenu.style.display = "none";
    if (arrow) arrow.style.transform = "rotate(0deg)";
  });
}

[
  "financeiro-menu",
  "boletos-menu",
  "notas-menu",
  "propostas-menu",
  "midias-menu",
  "pontos-menu",
  "extrato-menu" 
].forEach(setupSubmenuToggle);

// ==========================
// MENU POR USUÁRIO
// ==========================
function updateMenuVisibility() {
  const userId = localStorage.getItem("userId");
  let userType = localStorage.getItem("userType") || "";

  if (userId) {
    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    const found = usuarios.find((u) => String(u.registro) === String(userId));
    if (found && found.tipo) {
      userType = found.tipo;
      localStorage.setItem("userType", userType);
    }
  }

  userType = (userType || "normal").toLowerCase();

  const adminOnlyIds = [
    "gerenciarcontas-menu",
    "armazenamento-menu",
    "financeiro-menu",
    "boletos-menu",
    "notas-menu",
    "propostas-menu",
  ];

  adminOnlyIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = userType === "admin" ? "" : "none";
  });

  const pontosConfirmacaoLink = document.getElementById("pontos-confirmacao-link");
  if (pontosConfirmacaoLink) {
    const uid = userId || localStorage.getItem("userId") || "defaultUser";
    pontosConfirmacaoLink.href = `confirmacao.html?user=${encodeURIComponent(uid)}`;
  }
}

window.addEventListener("DOMContentLoaded", updateMenuVisibility);
window.addEventListener("storage", updateMenuVisibility);

// ==========================
// MONTANTE E OBSERVAÇÃO
// ==========================
const inputMontante = document.getElementById("montante");
const inputObs = document.getElementById("observacao");

function formatarMoeda(valor) {
  if (!valor && valor !== 0) return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

if (inputMontante) {
  inputMontante.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");
    e.target.value = value ? formatarMoeda(parseFloat(value) / 100) : "";
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if (inputMontante) {
    const montanteSalvo = localStorage.getItem("montante");
    if (montanteSalvo) inputMontante.value = formatarMoeda(parseFloat(montanteSalvo));
  }
  if (inputObs) {
    const observacaoSalva = localStorage.getItem("observacao");
    if (observacaoSalva) inputObs.value = observacaoSalva;
  }
});

function salvarMontante() {
  if (!inputMontante) return;
  const valor = inputMontante.value.replace(/\D/g, "");
  if (valor) localStorage.setItem("montante", parseFloat(valor) / 100);
}

function salvarObservacao() {
  if (!inputObs) return;
  localStorage.setItem("observacao", inputObs.value);
}

// ==========================
// EVENTOS DO DIA
// ==========================
const eventsList = document.getElementById("events-list");

async function fetchTodayEvents() {
  if (!eventsList) return;

  if (!isGoogleAuthenticated()) {
    eventsList.innerHTML = "<li>Conecte sua conta Google no Calendário para ver os eventos de hoje.</li>";
    return;
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const data = response.result.items || [];
    eventsList.innerHTML = "";

    if (data.length > 0) {
      data.forEach((event) => {
        const li = document.createElement("li");
        const eventTime = new Date(event.start.dateTime || event.start.date);
        li.textContent = `${eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${event.summary}`;
        eventsList.appendChild(li);
      });
    } else {
      eventsList.innerHTML = "<li>Nenhum evento hoje.</li>";
    }
  } catch (err) {
    console.error("Erro ao buscar eventos:", err);
    eventsList.innerHTML = "<li>Erro ao carregar eventos.</li>";
  }
}

// ==========================
// CHAMADA INICIAL
// ==========================
// home.js está no final do <body> (sem defer), então o DOM já existe
// quando este código roda. Registra o callback assim que possível,
// para não perder a notificação caso initGoogleAPI() (chamado no
// window.onload) seja rápido.
onGoogleAuthChange(fetchTodayEvents);