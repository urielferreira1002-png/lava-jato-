function login() {
    const usuario = document.getElementById("usuario").value.trim();
    const senha   = document.getElementById("senha").value;
    const erroDiv = document.getElementById("erro");

    erroDiv.innerText = "";

    if (!usuario || !senha) {
        erroDiv.innerText = "Preencha usuário e senha.";
        return;
    }

    // Credenciais — em produção, use autenticação no backend
    if (usuario === "uriel" && senha === "ferreira2009@") {
        localStorage.setItem("logado", "sim");
        window.location.href = "admin.html";
    } else {
        erroDiv.innerText = "Usuário ou senha incorretos.";
        document.getElementById("senha").value = "";
        document.getElementById("senha").focus();
    }
}
