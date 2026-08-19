// ============================================================
// login.js — autentica via Worker (server-side). Depende de
// auth-worker.js estar carregado antes deste arquivo.
// ============================================================

window.onload = function () {
    var registroSalvo = localStorage.getItem("registroSalvo");
    if (registroSalvo) {
        document.getElementById("registro").value = registroSalvo;
        document.getElementById("lembrar").checked = true;
    }
};

async function logar() {
    var registro = document.getElementById("registro").value.trim();
    var senha = document.getElementById("senha").value;
    var lembrar = document.getElementById("lembrar").checked;

    var mensagemErro = document.getElementById("mensagemErroLogin");
    if (mensagemErro) mensagemErro.style.display = "none";

    var botao = document.querySelector("button.login");
    var textoOriginal = botao ? botao.textContent : "";
    if (botao) { botao.disabled = true; botao.textContent = "Entrando..."; }

    try {
        var resposta = await apiLogin(registro, senha);

        if (!resposta.ok) {
            if (mensagemErro) {
                mensagemErro.textContent = resposta.erro || "Registro ou senha incorretos. Tente novamente.";
                mensagemErro.style.display = "block";
            }
            return;
        }

        if (lembrar) {
            localStorage.setItem("registroSalvo", registro);
        } else {
            localStorage.removeItem("registroSalvo");
        }

        localStorage.setItem("sessionToken", resposta.token);
        localStorage.setItem("userType", resposta.tipo || "");
        localStorage.setItem("userId", resposta.registro || "");
        localStorage.setItem("userNome", resposta.nome || "");
        localStorage.setItem("userSetor", resposta.setor || "");

        window.location.href = "home.html";
    } catch (e) {
        if (mensagemErro) {
            mensagemErro.textContent = "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
            mensagemErro.style.display = "block";
        }
    } finally {
        if (botao) { botao.disabled = false; botao.textContent = textoOriginal; }
    }
}
