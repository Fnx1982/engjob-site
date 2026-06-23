window.onload = function () {
    var registroSalvo = localStorage.getItem("registroSalvo");
    if (registroSalvo) {
        document.getElementById("registro").value = registroSalvo;
        document.getElementById("lembrar").checked = true;
    }
};

function logar() {
    var registro = document.getElementById("registro").value.trim();
    var senha = document.getElementById("senha").value;
    var lembrar = document.getElementById("lembrar").checked;

    // LOG DE DEPURAÇÃO: abra o Console (F12) para comparar
    // o que foi digitado com o que está salvo em "usuarios"
    console.log("Tentativa de login -> registro:", JSON.stringify(registro), "senha:", JSON.stringify(senha));

    // Defina aqui os admins fixos
    var admins = [
        { registro: "172616320", senha: "123" },

    ];

    // Verifica se é admin
    var isAdmin = admins.some(admin => admin.registro === registro && admin.senha === senha);

    if (isAdmin) {
        if (lembrar) {
            localStorage.setItem("registroSalvo", registro);
        } else {
            localStorage.removeItem("registroSalvo");
        }
        localStorage.setItem("userType", "admin");
        localStorage.setItem("userId", registro);
        window.location.href = "home.html";
        return;
    }

    // Recupera usuários do localStorage
    var usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    console.log("Usuários cadastrados no localStorage:", usuarios);

    // Procura usuário com registro e senha correspondentes
    var usuarioValido = usuarios.find(function (user) {
        return String(user.registro).trim() === registro && user.senha === senha;
    });

    if (usuarioValido) {
        if (lembrar) {
            localStorage.setItem("registroSalvo", registro);
        } else {
            localStorage.removeItem("registroSalvo");
        }
        localStorage.setItem("userType", "normal");
        localStorage.setItem("userId", registro);
        window.location.href = "home.html";
    } else {
        console.warn("Nenhum usuário encontrado com esse registro/senha.");
        alert("Registro ou senha incorretos. Tente novamente.");
    }
}