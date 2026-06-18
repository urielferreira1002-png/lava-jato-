// script.js
import { criarAgendamento, escutarGaleria } from "./Db.js";

// Tabelas e Constantes de Negócio
const tabelaPrecos = {
    "Lavagem Simples": 30.00,
    "Lavagem Completa": 60.00,
    "Higienização": 120.00,
    "Polimento": 250.00
};

let taxaFreteCalculada = 0.00;
let precoServicoSelecionado = 0.00;
let mapaLeaflet = null;
let marcadorMapa = null;

// Coordenadas base do centro de Belo Horizonte para cálculo simulado de rota
const COORD_BASE_BH = { lat: -19.9191, lon: -43.9378 };

/* ==================== INICIALIZAÇÃO E EVENTOS ==================== */
window.addEventListener("DOMContentLoaded", () => {
    configurarLoader();
    configurarMenuMobile();
    bloquearDatasPassadas();
    inicializarMapa();
    configurarFormulario();
    carregarGaleriaPublica();
});

function configurarLoader() {
    const loader = document.getElementById("loader");
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = "0";
            setTimeout(() => { loader.style.display = "none"; }, 500);
        }, 1200);
    }
}

function configurarMenuMobile() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('mobileNav');
    const overlay = document.getElementById('mobileOverlay');
    const header = document.querySelector('header');
    
    if (toggle && nav && overlay) {
        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('active');
            overlay.classList.toggle('active', open);
            toggle.textContent = open ? '✕' : '☰';
        });
        
        overlay.addEventListener('click', () => {
            nav.classList.remove('active');
            overlay.classList.remove('active');
            toggle.textContent = '☰';
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                overlay.classList.remove('active');
                toggle.textContent = '☰';
            });
        });
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

function bloquearDatasPassadas() {
    const dataInput = document.getElementById("data");
    if (dataInput) {
        const hoje = new Date().toISOString().split("T")[0];
        dataInput.setAttribute("min", hoje);
    }
}

/* ==================== MAPA LEAFLET & GEOLOCALIZAÇÃO ==================== */
function inicializarMapa() {
    const mapaContainer = document.getElementById("mapaAgendamento");
    if (!mapaContainer) return;

    // Inicializa o mapa focado em BH
    mapaLeaflet = L.map('mapaAgendamento').setView([COORD_BASE_BH.lat, COORD_BASE_BH.lon], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapaLeaflet);

    marcadorMapa = L.marker([COORD_BASE_BH.lat, COORD_BASE_BH.lon]).addTo(mapaLeaflet);
}

function atualizarPosicaoMapa(lat, lon, nomeLocal = "Local de Atendimento") {
    if (mapaLeaflet && marcadorMapa) {
        const novasCoordenadas = [lat, lon];
        mapaLeaflet.setView(novasCoordenadas, 15);
        marcadorMapa.setLatLng(novasCoordenadas).bindPopup(nomeLocal).openPopup();
    }
}

/* ==================== CÁLCULOS FINANCEIROS E LOGÍSTICOS ==================== */
function atualizarTotaisDoFormulario() {
    const totalGeral = precoServicoSelecionado + taxaFreteCalculada;
    
    // Atualização dos elementos do painel de resumo alinhados com o HTML
    document.getElementById("resumoServico").innerText = `R$ ${precoServicoSelecionado.toFixed(2).replace('.', ',')}`;
    document.getElementById("resumoFrete").innerText = `R$ ${taxaFreteCalculada.toFixed(2).replace('.', ',')}`;
    document.getElementById("resumoTotal").innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function processarMetricasLogisticaSimulada(fatorDistancia) {
    const kmCalculado = Math.max(1.5, (fatorDistancia * 0.4)).toFixed(1);
    const tempoEstimado = Math.ceil(kmCalculado * 3) + 5;
    
    taxaFreteCalculada = Math.ceil(kmCalculado / 3) * 4.50 + 5.00; // Algoritmo de frete proporcional fixo + variável
    
    document.getElementById("resumoDistancia").innerText = `${kmCalculado} km`;
    document.getElementById("resumoTempo").innerText = `${tempoEstimado} min`;
    
    atualizarTotaisDoFormulario();
}

/* ==================== CAPTAÇÃO DE LOCALIZAÇÃO E VIA CEP ==================== */
function configurarFormulario() {
    const selectServico = document.getElementById("servico");
    const cepInput = document.getElementById("cep");
    const btnUsarGps = document.getElementById("btnUsarGps");
    const form = document.getElementById("formAgendamento");

    if (selectServico) {
        selectServico.addEventListener("change", (e) => {
            const servico = e.target.value;
            precoServicoSelecionado = tabelaPrecos[servico] || 0.00;
            atualizarTotaisDoFormulario();
        });
    }

    if (cepInput) {
        cepInput.addEventListener("input", function() {
            const cep = this.value.replace(/\D/g, "");
            if (cep.length === 8) {
                buscarDadosEndereco(cep);
            }
        });
    }

    if (btnUsarGps) {
        btnUsarGps.addEventListener("click", () => {
            if (navigator.geolocation) {
                btnUsarGps.innerText = "📡 Buscando...";
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        
                        atualizarPosicaoMapa(lat, lon, "Sua Localização Atual");
                        
                        // Determinação do fator através do delta de coordenadas locais
                        const delta = Math.abs(lat - COORD_BASE_BH.lat) + Math.abs(lon - COORD_BASE_BH.lon);
                        const fator = Math.max(10, Math.floor(delta * 200));
                        
                        processarMetricasLogisticaSimulada(fator);
                        
                        // Tenta obter o endereço reverso de forma limpa via Nominatim (OpenStreetMap)
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                            const data = await res.json();
                            if (data.address) {
                                document.getElementById("rua").value = data.address.road || "";
                                document.getElementById("bairro").value = data.address.suburb || data.address.neighbourhood || "";
                                if (data.address.postcode) {
                                    document.getElementById("cep").value = data.address.postcode.replace(/\D/g, "");
                                }
                            }
                        } catch (err) {
                            console.warn("Não foi possível preencher os inputs de texto pelo GPS.");
                        }
                        
                        btnUsarGps.innerHTML = "✅ Localização Ativada";
                    },
                    () => {
                        alert("Não foi possível obter sua localização automaticamente. Por favor, digite o seu CEP.");
                        btnUsarGps.innerHTML = "📡 Usar minha localização";
                    }
                );
            } else {
                alert("Geolocalização não suportada.");
            }
        });
    }

    if (form) {
        form.addEventListener("submit", processarEnvioAgendamento);
    }
}

async function buscarDadosEndereco(cep) {
    const statusEndereco = document.getElementById("statusEndereco");
    try {
        if(statusEndereco) statusEndereco.innerText = "Buscando CEP...";
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await response.json();
        
        if (!dados.erro) {
            document.getElementById("rua").value = dados.logradouro || "";
            document.getElementById("bairro").value = dados.bairro || "";
            if(statusEndereco) statusEndereco.innerText = "";

            const fatorDistancia = Math.max(5, parseInt(cep.substring(5, 8)) || 25);
            processarMetricasLogisticaSimulada(fatorDistancia);
            
            // Geocodificação simulada aproximada baseada no CEP para mover o mapa em BH
            const pseudoLat = COORD_BASE_BH.lat + (fatorDistancia * 0.0005);
            const pseudoLon = COORD_BASE_BH.lon - (fatorDistancia * 0.0005);
            atualizarPosicaoMapa(pseudoLat, pseudoLon, dados.logradouro);
        } else {
            alert("CEP não encontrado.");
        }
    } catch (error) {
        console.error("Erro ViaCEP:", error);
    }
}

/* ==================== SUBMISSÃO E WHATSAPP ==================== */
async function processarEnvioAgendamento(e) {
    e.preventDefault();
    const form = e.target;

    const nome = document.getElementById("nome").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const veiculo = document.getElementById("veiculo").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const servico = document.getElementById("servico").value;
    const data = document.getElementById("data").value;
    const hora = document.getElementById("hora").value;
    const cep = document.getElementById("cep").value.trim();
    const logradouro = document.getElementById("rua").value.trim();
    const numeroCasa = document.getElementById("numero").value.trim();
    const bairro = document.getElementById("bairro").value.trim();

    if (!nome || !telefone || !veiculo || !servico || !data || !hora) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    const valorFinalCalculado = precoServicoSelecionado + taxaFreteCalculada;
    const enderecoCompleto = `${logradouro}, Nº ${numeroCasa} - Bairro: ${bairro} - CEP: ${cep}`;

    const novoAgendamento = {
        nome,
        telefone,
        veiculo,
        placa,
        servico,
        valor: valorFinalCalculado,
        frete: taxaFreteCalculada,
        data,
        hora,
        endereco: enderecoCompleto,
        status: "Pendente",
        criadoEm: new Date().toISOString()
    };

    try {
        document.getElementById("btnConfirmarAgendamento").disabled = true;
        await criarAgendamento(novoAgendamento);

        const msg = document.getElementById("msgSucesso");
        if (msg) {
            msg.style.display = "block";
            setTimeout(() => { msg.style.display = "none"; }, 5000);
        }

        // Formatação de disparo para WhatsApp
        const formatarData = data.split("-").reverse().join("/");
        const linkMensagemWhatsApp = `🚗 *NOVO AGENDAMENTO — LAVA JATO EXPRESS*\n\n` +
            `👤 *Cliente:* ${nome}\n` +
            `📱 *WhatsApp:* ${telefone}\n` +
            `🚘 *Veículo:* ${veiculo} (Placa: ${placa})\n` +
            `🧽 *Serviço:* ${servico}\n` +
            `📍 *Local:* ${enderecoCompleto}\n` +
            `💵 *Valor Total:* R$ ${valorFinalCalculado.toFixed(2).replace('.', ',')}\n` +
            `📅 *Agendado para:* ${formatarData} às ${hora}\n\n` +
            `_Por favor, confirme este horário de atendimento!_`;

        const numeroDestinatario = "553191486870";
        const urlFinalWa = `https://wa.me/${numeroDestinatario}?text=${encodeURIComponent(linkMensagemWhatsApp)}`;
        
        // Link dinâmico Google Maps para navegação do prestador
        const enderecoDinamicoMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
        document.getElementById("btnAbrirRota").onclick = () => window.open(enderecoDinamicoMaps, "_blank");

        form.reset();
        taxaFreteCalculada = 0;
        precoServicoSelecionado = 0;
        atualizarTotaisDoFormulario();
        
        window.open(urlFinalWa, "_blank");
    } catch (erro) {
        alert("Erro ao registrar o agendamento no servidor.");
    } finally {
        document.getElementById("btnConfirmarAgendamento").disabled = false;
    }
}

/* ==================== SINCRONIZAÇÃO EM TEMPO REAL DA GALERIA ==================== */
function carregarGaleriaPublica() {
    const divPublica = document.getElementById("galeriaPublica");
    if (!divPublica) return;

    escutarGaleria((fotos) => {
        divPublica.innerHTML = "";
        if (fotos.length === 0) {
            divPublica.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888; padding:20px;">Nenhum resultado cadastrado recentemente.</p>`;
            return;
        }
        fotos.forEach((foto, index) => {
            const containerFoto = document.createElement("div");
            containerFoto.className = "card-foto-dinamica";
            containerFoto.style = "background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 15px;";
            containerFoto.innerHTML = `
                <img src="${foto.url}" alt="Serviço Realizado ${index + 1}" style="width:100%; height:280px; object-fit:cover; display:block;">
                <div style="padding:15px;">
                    <h3 style="color:#C8A97E; margin-bottom:5px; font-size:1.1rem;">Resultado Recente ${index + 1}</h3>
                    <p style="color:#aaa; font-size:14px; margin:0;">Serviço executado com padrão profissional.</p>
                </div>
            `;
            divPublica.appendChild(containerFoto);
        });
    });
}