// ============================================================
// auth-guard.js — protege páginas internas contra acesso sem
// login. Inclua este script (depois de auth-worker.js) em toda
// página que não seja login.html, registro.html ou usuario.html.
//
// O Workers KV tem propagação global "eventual" (não instantânea) —
// uma sessão criada no login pode, por alguns segundos, ainda não
// estar visível para leitura em todo lugar. Sem tolerância a isso,
// um usuário que loga e navega rápido pra outra página podia ser
// expulso de volta pro login mesmo com a sessão válida. Por isso
// tentamos de novo algumas vezes, com um pequeno intervalo, antes de
// desistir e redirecionar.
// ============================================================

(function () {
  const token = localStorage.getItem("sessionToken");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const TENTATIVAS = 3;
  const INTERVALO_MS = 600;

  function dormir(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function verificarSessao() {
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      try {
        const r = await fetch("https://engjob-storage.engjobmanut.workers.dev?action=auth-session-check", {
          headers: { Authorization: "Bearer " + token },
        });
        if (r.ok) {
          const data = await r.json();
          if (data.ok) return data; // sessão confirmada
        }
      } catch (e) {
        // falha de rede — tenta de novo (não desiste na primeira)
      }
      if (tentativa < TENTATIVAS) await dormir(INTERVALO_MS);
    }
    return null; // esgotou as tentativas — sessão realmente inválida/expirada
  }

  verificarSessao().then((data) => {
    if (!data) {
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("userType");
      localStorage.removeItem("userId");
      localStorage.removeItem("userNome");
      window.location.href = "login.html";
      return;
    }
    // Mantém os dados de sessão sincronizados
    localStorage.setItem("userType", data.tipo || "");
    localStorage.setItem("userId", data.registro || "");
    localStorage.setItem("userNome", data.nome || "");
    localStorage.setItem("userSetor", data.setor || "");
  });
})();