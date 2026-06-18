/* =========================================================================
   ADMIN.JS — PAINEL ADMINISTRATIVO (CONECTADO AO FIRESTORE & STORAGE)
   =========================================================================
   Toda a lista de agendamentos e fotos vem do Firebase em tempo real.
   O acesso é estritamente protegido via Firebase Authentication.
   ========================================================================= */

import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  escutarAgendamentos,
  atualizarAgendamento,
  excluirAgendamento,
  fazerUploadFoto,
  escutarGaleria,
  excluirFoto
} from "./Db.js";

/* ==============================
   ESTADO EM MEMÓRIA
============================== */
let agendamentos = [];
let fotosGaleria = [];
let cancelarEscutaAgendamentos = null;
let cancelarEscutaGaleria = null;

/* =========================================================================
   PROTEÇÃO DE ROTAS (FIREBASE AUTH)
   ========================================================================= */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Se não houver uma sessão ativa no Firebase, redireciona imediatamente para o login
    window.location.href = "login.html";
  } else {
    // Usuário autenticado com sucesso -> Inicializa o painel
    inicializarPainel();
  }
});

function inicializarPainel() {
  mostrarDataAtual();
  iniciarEscutasFirebase();
  configurarNavegacao();
  configurarFiltros();
  configurarGaleria();
  configurarFormularioEdicao();
}

/* ==============================
   ESCUTAS EM TEMPO REAL (FIRESTORE)
============================== */
function iniciarEscutasFirebase() {
  // Escuta ativa de agendamentos
  cancelarEscutaAgendamentos = escutarAgendamentos((lista) => {
    agendamentos = lista;
    calcularStats();
    renderAgenda();
    renderAgendamentos();
    renderFidelidade();
  });

  // Escuta ativa da galeria de fotos
  cancelarEscutaGaleria = escutarGaleria((lista) => {
    fotosGaleria = lista;
    carregarGaleria();
  });
}

// Cancela os listeners ao sair da página para evitar vazamento de memória
window.addEventListener("beforeunload", () => {
  if (cancelarEscutaAgendamentos) cancelarEscutaAgendamentos();
  if (cancelarEscutaGaleria) cancelarEscutaGaleria();
});

/* ==============================
   DATA ATUAL NA TOPBAR
============================== */
function mostrarDataAtual() {
  const hoje = new Date();
  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const elemento = document.getElementById("dataAtual");
  if (elemento) {
    elemento.textContent = `${diasSemana[hoje.getDay()]}, ${hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;
  }
}

/* ==============================
   ESTATÍSTICAS & KPIS
============================== */
function calcularStats() {
  // Total de clientes únicos baseado no telefone
  const totalClientes = [...new Set(agendamentos.map(a => a.telefone ? a.telefone.replace(/\D/g, "") : ""))].filter(Boolean).length;
  const fat = agendamentos.reduce((s, a) => s + Number(a.valor || 0), 0);
  const ticket = agendamentos.length > 0 ? fat / agendamentos.length : 0;

  setTexto("totalClientes", totalClientes);
  setTexto("totalAgendamentos", agendamentos.length);
  setTexto("faturamentoTotal", `R$ ${fat.toFixed(2).replace('.', ',')}`);
  setTexto("ticketMedio", `R$ ${ticket.toFixed(2).replace('.', ',')}`);
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

/* ==============================
   NAVEGAÇÃO ENTRE ABAS
============================== */
const titulos = { 
  agenda: "📅 Agenda do Dia", 
  agendamentos: "📋 Agendamentos", 
  fidelidade: "🏆 Fidelidade", 
  galeria: "📸 Galeria" 
};

function configurarNavegacao() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.dataset.tab;
      if (id) abrirTab(id, item);
    });
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("aberto");
    document.getElementById("overlay")?.classList.toggle("visivel");
  });

  document.getElementById("overlay")?.addEventListener("click", fecharMenu);
  
  // Logout seguro via Firebase Auth
  document.getElementById("btnLogout")?.addEventListener("click", () => {
    signOut(auth).then(() => {
      window.location.href = "login.html";
    });
  });
}

function abrirTab(id, itemClicado) {
  document.querySelectorAll(".secao").forEach(s => s.classList.remove("ativa"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("ativo"));
  
  document.getElementById("tab-" + id)?.classList.add("ativa");
  itemClicado?.classList.add("ativo");
  
  const t = document.getElementById("topbarTitulo");
  if (t) t.textContent = titulos[id] || "";
  fecharMenu();
}

function fecharMenu() {
  document.getElementById("sidebar")?.classList.remove("aberto");
  document.getElementById("overlay")?.classList.remove("visivel");
}

/* ==============================
   FILTROS DE BUSCA
============================== */
function configurarFiltros() {
  document.getElementById("filtroNome")?.addEventListener("input", renderAgendamentos);
  document.getElementById("filtroServico")?.addEventListener("change", renderAgendamentos);
}

/* ==============================
   AGENDA DO DIA
============================== */
function renderAgenda() {
  const hojeStr = new Date().toISOString().split("T")[0];
  const doHoje = agendamentos.filter(a => a.data === hojeStr);
  const div = document.getElementById("agendaHoje");
  const count = document.getElementById("agendaCount");
  if (!div) return;

  if (doHoje.length === 0) {
    if (count) count.textContent = "";
    div.innerHTML = `<div class="agenda-vazia"><p>Nenhum agendamento para hoje.</p></div>`;
    return;
  }

  if (count) count.textContent = `${doHoje.length} agendamento${doHoje.length > 1 ? "s" : ""}`;
  div.innerHTML = doHoje.map(item => `
    <div class="agenda-card">
      <div class="agenda-hora">${item.hora}</div>
      <div class="agenda-detalhe">
        <h3>${escapeHtml(item.nome)}</h3>
        <p>${escapeHtml(item.servico)} — 🚗 ${escapeHtml(item.veiculo)} (${escapeHtml(item.placa)})</p>
      </div>
    </div>
  `).join("");
}

/* ==============================
   RENDERIZAÇÃO DOS AGENDAMENTOS
============================== */
function renderAgendamentos() {
  const busca = (document.getElementById("filtroNome")?.value || "").toLowerCase();
  const servico = document.getElementById("filtroServico")?.value || "";

  const filtrados = agendamentos.filter(a => {
    const matchBusca = !busca || a.nome.toLowerCase().includes(busca) || (a.placa || "").toLowerCase().includes(busca);
    const matchServico = !servico || a.servico === servico;
    return matchBusca && matchServico;
  });

  // Mapeia o ID correto do container da lista ou tbody do projeto
  const lista = document.getElementById("listaAgendamentos") || document.getElementById("corpoTabelaAgendamentos");
  if (!lista) return;

  const isTbody = lista.tagName.toLowerCase() === "tbody";

  if (filtrados.length === 0) {
    lista.innerHTML = isTbody 
      ? `<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhum agendamento encontrado.</td></tr>`
      : `<div class="empty">Nenhum agendamento encontrado.</div>`;
    return;
  }

  if (isTbody) {
    lista.innerHTML = filtrados.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.nome)}</strong></td>
        <td>${escapeHtml(item.veiculo)} (${escapeHtml(item.placa)})</td>
        <td>${escapeHtml(item.servico)}</td>
        <td>${item.data.split("-").reverse().join("/")} às ${item.hora}</td>
        <td>R$ ${Number(item.valor || 0).toFixed(2).replace('.', ',')}</td>
        <td>
          <button class="btn btn-editar" data-id="${item.id}" style="background:#FFC107; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">✏️</button>
          <button class="btn btn-excluir" data-id="${item.id}" style="background:#DC3545; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">🗑</button>
          <button class="btn btn-pdf" data-id="${item.id}" style="background:#4285F4; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">📄</button>
        </td>
      </tr>
    `).join("");
  } else {
    lista.innerHTML = filtrados.map(item => `
      <div class="card-agendamento" style="background:#111; padding:15px; margin-bottom:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3>${escapeHtml(item.nome)} — <span style="color:#C8A97E">${escapeHtml(item.servico)}</span></h3>
          <p>🚗 ${escapeHtml(item.veiculo)} | 🔖 Placa: ${escapeHtml(item.placa)} | 📱 ${escapeHtml(item.telefone)}</p>
          <p>📅 ${item.data.split("-").reverse().join("/")} às ${item.hora} — <strong>R$ ${Number(item.valor||0).toFixed(2).replace('.', ',')}</strong></p>
        </div>
        <div style="display:flex; gap:5px;">
          <button class="btn btn-pdf" data-id="${item.id}" style="background:#4285F4; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">PDF</button>
          <button class="btn btn-editar" data-id="${item.id}" style="background:#FFC107; color:black; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">Editar</button>
          <button class="btn btn-excluir" data-id="${item.id}" style="background:#DC3545; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">Excluir</button>
        </div>
      </div>
    `).join("");
  }

  // Atribuição dinâmica de eventos para os botões gerados
  lista.querySelectorAll(".btn-pdf").forEach(b => b.addEventListener("click", () => gerarRecibo(b.dataset.id)));
  lista.querySelectorAll(".btn-editar").forEach(b => b.addEventListener("click", () => abrirModalEdicao(filtrados.find(x => x.id === b.dataset.id))));
  lista.querySelectorAll(".btn-excluir").forEach(b => b.addEventListener("click", () => excluir(b.dataset.id)));
}

async function excluir(id) {
  if (confirm("Deseja realmente excluir este agendamento do Firestore?")) {
    try {
      await excluirAgendamento(id);
    } catch (err) {
      alert("Erro ao remover agendamento.");
    }
  }
}

/* =========================================================================
   SISTEMA DE EDIÇÃO DINÂMICA (MODAL)
========================================================================= */
function abrirModalEdicao(item) {
  if (!item) return;
  const modal = document.getElementById("modalEdicao");
  if (!modal) return;

  document.getElementById("editId").value = item.id;
  document.getElementById("editNome").value = item.nome;
  document.getElementById("editVeiculo").value = item.veiculo;
  document.getElementById("editServico").value = item.servico;
  document.getElementById("editData").value = item.data;
  document.getElementById("editHora").value = item.hora;
  
  modal.style.display = "flex";
}

function configurarFormularioEdicao() {
  document.getElementById("formEditarAgendamento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    const tabelaPrecos = { "Lavagem Simples": 30, "Lavagem Completa": 60, "Higienização": 120, "Polimento": 250 };
    const servico = document.getElementById("editServico").value;

    const dados = {
      nome: document.getElementById("editNome").value,
      veiculo: document.getElementById("editVeiculo").value,
      servico: servico,
      data: document.getElementById("editData").value,
      hora: document.getElementById("editHora").value,
      valor: tabelaPrecos[servico] || 30
    };

    try {
      await atualizarAgendamento(id, dados);
      document.getElementById("modalEdicao").style.display = "none";
    } catch (err) {
      alert("Não foi possível atualizar o agendamento.");
    }
  });
  
  document.getElementById("btnFecharModal")?.addEventListener("click", () => {
    document.getElementById("modalEdicao").style.display = "none";
  });
}

/* ==============================
   SISTEMA DE FIDELIDADE
============================== */
function renderFidelidade() {
  const ranking = {};
  agendamentos.forEach(a => {
    if (!a.telefone) return;
    const tel = a.telefone.replace(/\D/g, "");
    if (!ranking[tel]) ranking[tel] = { nome: a.nome, telefone: a.telefone, pontos: 0, gasto: 0 };
    ranking[tel].pontos++;
    ranking[tel].gasto += Number(a.valor || 0);
  });

  const sorted = Object.values(ranking).sort((a, b) => b.pontos - a.pontos);
  const div = document.getElementById("rankingClientes");
  if (!div) return;

  div.innerHTML = sorted.map((c, i) => `
    <div class="ranking-card" style="background:#111; padding:12px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid #222;">
      <div>
        <strong>#${i+1} ${escapeHtml(c.nome)}</strong><br>
        <small style="color:#aaa;">${escapeHtml(c.telefone)}</small>
      </div>
      <div style="text-align:right;">
        <strong style="color:#C8A97E;">${c.pontos} Lavagens</strong><br>
        <small style="color:#25D366;">R$ ${c.gasto.toFixed(2).replace('.', ',')}</small>
      </div>
    </div>
  `).join("");
}

/* ==============================
   GALERIA DE FOTOS (STORAGE & FIRESTORE)
============================== */
function configurarGaleria() {
  const inputFoto = document.getElementById("fotoUpload");
  if (inputFoto) {
    inputFoto.addEventListener("change", async (e) => {
      if (e.target.files.length > 0) {
        try {
          await fazerUploadFoto(e.target.files[0]);
          alert("Imagem enviada com sucesso!");
        } catch (err) {
          alert("Falha ao enviar a imagem.");
        }
      }
    });
  }
}

function carregarGaleria() {
  const div = document.getElementById("galeriaAdmin");
  if (!div) return;

  div.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:12px;">
    ${fotosGaleria.map(f => `
      <div style="position:relative; background:#151515; padding:6px; border-radius:6px; border:1px solid #222;">
        <img src="${f.url}" style="width:100%; height:100px; object-fit:cover; border-radius:4px; display:block;">
        <button class="btn-del-foto" data-id="${f.id}" data-path="${f.path}" style="position:absolute; top:8px; right:8px; background:rgba(220,53,69,0.9); color:white; border:none; border-radius:4px; padding:3px 6px; cursor:pointer; font-weight:bold;">✕</button>
      </div>
    `).join("")}
  </div>`;

  div.querySelectorAll(".btn-del-foto").forEach(b => b.addEventListener("click", async () => {
    if (confirm("Excluir permanentemente esta imagem do Storage?")) {
      try {
        await excluirFoto(b.dataset.id, b.dataset.path);
      } catch (err) {
        alert("Erro ao remover imagem.");
      }
    }
  }));
}

/* ==============================
   GERAR RECIBO PDF
============================== */
function gerarRecibo(id) {
  const c = agendamentos.find(a => a.id === id);
  if (!c) return;
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  
  pdf.setFillColor(15, 15, 15); 
  pdf.rect(0, 0, 210, 297, "F");
  
  pdf.setFontSize(22); 
  pdf.setTextColor(200, 169, 126); 
  pdf.text("LAVA JATO EXPRESS", 20, 30);
  
  pdf.setFontSize(10);
  pdf.setTextColor(140, 140, 140);
  pdf.text("COMPROVANTE DE AGENDAMENTO", 20, 38);
  
  pdf.setFontSize(12); 
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Cliente: ${c.nome}`, 20, 55);
  pdf.text(`Telefone: ${c.telefone}`, 20, 65);
  pdf.text(`Veículo: ${c.veiculo} (${c.placa})`, 20, 75);
  pdf.text(`Serviço: ${c.servico}`, 20, 85);
  pdf.text(`Data/Hora: ${c.data.split("-").reverse().join("/")} às ${c.hora}`, 20, 95);
  pdf.text(`Valor Total: R$ ${Number(c.valor || 0).toFixed(2).replace('.', ',')}`, 20, 105);
  
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`ID do Documento: ${c.id}`, 20, 280);
  
  pdf.save(`recibo-${c.nome.replace(/\s+/g, "-")}.pdf`);
}

/* ==============================
   UTILITÁRIO: ESCAPE HTML
============================== */
function escapeHtml(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}