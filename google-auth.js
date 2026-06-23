// ============================================================
// google-auth.js
// Autenticação centralizada com o Google Calendar.
// Usado tanto em home.html quanto em calendario.html, para que
// o login feito em uma página valha também para a outra.
// ============================================================

const GOOGLE_CLIENT_ID = "866300043173-9f6gpjb65lb1np1hi3sf1n7531uohqhb.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyC4oQY27c_q2RVx5o4xEX3IyVlAAJP91eM";
const GOOGLE_DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar openid email profile";

let googleTokenClient;
let googleTokenExpiresAt = 0;
let googleApiReady = false;
let googleApiIniciando = false; // evita inicializar o gapi mais de uma vez

// Lista de funções que querem ser avisadas quando o login terminar
// (cada página registra a sua própria função de "callback")
const onGoogleAuthReadyCallbacks = [];
// Funções que querem ser avisadas SEMPRE que o estado de autenticação
// mudar (inclusive depois da primeira vez, ex: token atrasado chegando
// depois do timeout de fallback, ou logout).
const onGoogleAuthChangeCallbacks = [];

function onGoogleAuthReady(callback) {
  if (googleApiReady) {
    callback();
  } else {
    onGoogleAuthReadyCallbacks.push(callback);
  }
}

// Use isso (em vez de onGoogleAuthReady) quando a página precisa
// atualizar a tela toda vez que o login mudar, não só na primeira vez.
function onGoogleAuthChange(callback) {
  onGoogleAuthChangeCallbacks.push(callback);
  onGoogleAuthReady(callback);
}

function notifyGoogleAuthReady() {
  const jaEstavaPronto = googleApiReady;
  googleApiReady = true;
  console.log("[google-auth] Pronto. Token atual:", gapi.client && gapi.client.getToken());

  if (!jaEstavaPronto) {
    onGoogleAuthReadyCallbacks.forEach((cb) => {
      try { cb(); } catch (err) { console.error("Erro num callback de auth:", err); }
    });
    onGoogleAuthReadyCallbacks.length = 0;
  } else {
    // Já tinha avisado antes (provavelmente via timeout de fallback);
    // isso é uma atualização tardia — avisa quem pediu para ser
    // avisado de mudanças, para a tela poder se corrigir.
    console.log("[google-auth] Atualização tardia de autenticação — atualizando tela.");
    onGoogleAuthChangeCallbacks.forEach((cb) => {
      try { cb(); } catch (err) { console.error("Erro num callback de auth:", err); }
    });
  }
}

// Guarda no localStorage que o usuário já autorizou o app antes,
// e qual e-mail foi usado — assim a renovação silenciosa sabe
// exatamente qual conta usar, sem precisar mostrar a tela de
// "Escolha uma conta" quando há várias contas Google no navegador.
function googleLoginLocal(email) {
  localStorage.setItem("googleLogado", "true");
  if (email) localStorage.setItem("googleEmail", email);
}
function googleLogoutLocal() {
  localStorage.removeItem("googleLogado");
  localStorage.removeItem("googleEmail");
}
function isGoogleLoggedLocal() {
  return localStorage.getItem("googleLogado") === "true";
}
function getGoogleEmailSalvo() {
  return localStorage.getItem("googleEmail") || "";
}

// Descobre o e-mail da conta a partir do token (via endpoint do Google)
async function descobrirEmailDoToken(accessToken) {
  try {
    const resp = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    const info = await resp.json();
    return info.email || "";
  } catch (err) {
    console.warn("[google-auth] Não foi possível obter o e-mail da conta:", err);
    return "";
  }
}

// Chamado pelo onload do <script src="https://apis.google.com/js/api.js">
function initGoogleAPI() {
  if (googleApiIniciando || googleApiReady) {
    console.warn("[google-auth] initGoogleAPI() chamado de novo — ignorando (já iniciando/pronto).");
    return;
  }
  googleApiIniciando = true;
  console.log("[google-auth] initGoogleAPI() iniciado");

  gapi.load("client", () => {
    gapi.client
      .init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: GOOGLE_DISCOVERY_DOCS,
      })
      .then(() => {
        googleTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPES,
          callback: (tokenResponse) => {
            console.log("[google-auth] callback recebido:", tokenResponse);
            if (tokenResponse.error) {
              console.warn("[google-auth] Falha ao obter token do Google:", tokenResponse.error, tokenResponse);
              googleLogoutLocal();
              notifyGoogleAuthReady();
              return;
            }
            gapi.client.setToken(tokenResponse);
            googleTokenExpiresAt = Date.now() + tokenResponse.expires_in * 1000;
            console.log("[google-auth] Token obtido com sucesso, expira em", tokenResponse.expires_in, "segundos");

            // Descobre e guarda o e-mail da conta, para usar como
            // hint nas próximas renovações silenciosas.
            descobrirEmailDoToken(tokenResponse.access_token).then((email) => {
              googleLoginLocal(email);
            });

            notifyGoogleAuthReady();
          },
        });

        // Se o usuário já autorizou antes, tenta renovar sem mostrar popup.
        // Isso é o que faz a sessão "continuar logada" entre acessos.
        if (isGoogleLoggedLocal()) {
          const emailSalvo = getGoogleEmailSalvo();
          console.log("[google-auth] Tentando renovação silenciosa (prompt vazio), hint:", emailSalvo || "(nenhum)");
          googleTokenClient.requestAccessToken({
            prompt: "",
            hint: emailSalvo || undefined,
          });

          // Fallback: se o callback do Google não responder em 8 segundos
          // (ex: bloqueado por cookies de terceiros), libera a tela mesmo
          // assim, mostrando o botão de login em vez de travar esperando.
          // Se o callback chegar depois disso, a tela é atualizada de
          // novo via onGoogleAuthChange.
          setTimeout(() => {
            if (!googleApiReady) {
              console.warn("[google-auth] Renovação silenciosa não respondeu a tempo. Liberando tela sem token.");
              notifyGoogleAuthReady();
            }
          }, 8000);
        } else {
          // Ainda não autorizou nenhuma vez: marca como pronto,
          // mas sem token. As páginas devem mostrar o botão de login.
          notifyGoogleAuthReady();
        }
      });
  });
}

// Login interativo (abre popup) — chamar a partir de um clique de botão
function googleLoginInterativo(onDone) {
  if (!googleTokenClient) return;
  googleTokenClient.callback = (tokenResponse) => {
    if (tokenResponse.error) {
      console.log("Falha no login interativo:", tokenResponse.error);
      return;
    }
    gapi.client.setToken(tokenResponse);
    googleTokenExpiresAt = Date.now() + tokenResponse.expires_in * 1000;
    descobrirEmailDoToken(tokenResponse.access_token).then((email) => {
      googleLoginLocal(email);
    });
    if (onDone) onDone();
  };
  googleTokenClient.requestAccessToken();
}

function googleLogout(onDone) {
  googleLogoutLocal();
  gapi.client.setToken(null);
  if (onDone) onDone();
}

function isGoogleAuthenticated() {
  return !!(gapi.client && gapi.client.getToken());
}

// Renova o token automaticamente antes de expirar (a cada 5 min, verifica)
function renovarGoogleTokenSeNecessario() {
  if (!googleTokenClient || !isGoogleLoggedLocal()) return;
  const agora = Date.now();
  if (googleTokenExpiresAt - agora < 5 * 60 * 1000) {
    googleTokenClient.requestAccessToken({ prompt: "" });
  }
}
setInterval(renovarGoogleTokenSeNecessario, 5 * 60 * 1000);