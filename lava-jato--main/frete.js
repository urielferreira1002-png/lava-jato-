/* =========================================================================
   FRETE.JS — CEP, ENDEREÇO, GPS, MAPA E CÁLCULO DE FRETE
   =========================================================================
   Este módulo é INDEPENDENTE do provedor de mapas. Hoje ele usa:

   - ViaCEP        → consulta de endereço a partir do CEP (gratuito)
   - Nominatim     → geocoding (endereço → latitude/longitude) (gratuito,
                      projeto OpenStreetMap)
   - Leaflet.js    → exibição do mapa (gratuito, sem necessidade de chave)
   - Haversine     → cálculo de distância em linha reta entre dois pontos

   QUANDO VOCÊ CONFIGURAR A GOOGLE MAPS API:
   Troque apenas as funções `geocodificarEndereco()` e `criarMapa()` por
   chamadas ao Google Geocoding API e Google Maps JavaScript API. O resto
   do site (frete.html, agendamento, painel admin) não precisa mudar,
   porque todos chamam apenas as funções exportadas aqui.

   IMPORTANTE SOBRE PRECISÃO:
   A distância calculada aqui é em LINHA RETA (não é a distância real de
   rota de carro, que considera ruas, mão de direção etc.). Isso é uma
   aproximação razoável enquanto não há uma API de rotas configurada.
   Quando a Google Maps API (Directions) estiver disponível, a distância
   de rota real e o tempo estimado de chegada poderão ser usados.
   ========================================================================= */

/* ====================== SEDE DA EMPRESA ====================== */
// Valor padrão: Belo Horizonte (Praça Sete, região central).
// Ajuste estas coordenadas para o endereço real da sede quando tiver.
export const SEDE = {
  nome: "Lava Jato Express — Sede",
  endereco: "Praça Sete de Setembro, Belo Horizonte - MG",
  lat: -19.9227,
  lon: -43.9451
};

/* ====================== TABELA DE PREÇOS DOS SERVIÇOS ====================== */
export const TABELA_PRECOS = {
  "Lavagem Simples": 30,
  "Lavagem Completa": 60,
  "Higienização": 120,
  "Polimento": 250
};

/* ====================== REGRA DE FRETE ====================== */
// R$ 5,00 a cada 10 km (ou fração) de distância entre a sede e o cliente.
const VALOR_POR_FAIXA = 5;
const KM_POR_FAIXA = 10;

/**
 * Calcula o valor do frete a partir da distância em km.
 * Regra: R$ 5,00 a cada 10 km, cobrando a fração iniciada.
 * @param {number} distanciaKm
 * @returns {number} valor do frete em reais
 */
export function calcularFrete(distanciaKm) {
  if (!distanciaKm || distanciaKm <= 0) return 0;
  const faixas = Math.ceil(distanciaKm / KM_POR_FAIXA);
  return faixas * VALOR_POR_FAIXA;
}

/**
 * Calcula a distância em km entre dois pontos (fórmula de Haversine).
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distância em quilômetros
 */
export function distanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estima o tempo de chegada com base na distância, assumindo uma
 * velocidade média urbana de 30 km/h (aproximação razoável para
 * deslocamento dentro da cidade). Quando a Google Directions API
 * estiver disponível, troque por tempo de rota real.
 * @param {number} distanciaKm
 * @returns {number} tempo estimado em minutos
 */
export function estimarTempoChegada(distanciaKm) {
  const VELOCIDADE_MEDIA_KMH = 30;
  const horas = distanciaKm / VELOCIDADE_MEDIA_KMH;
  return Math.max(5, Math.round(horas * 60));
}

/* ====================== CEP → ENDEREÇO (ViaCEP) ====================== */

/**
 * Busca dados de endereço a partir de um CEP usando o ViaCEP.
 * @param {string} cep - CEP com ou sem máscara
 * @returns {Promise<{logradouro:string, bairro:string, localidade:string, uf:string}>}
 */
export async function buscarEnderecoPorCep(cep) {
  const cepLimpo = String(cep).replace(/\D/g, "");
  if (cepLimpo.length !== 8) {
    throw new Error("CEP inválido. Digite os 8 números do CEP.");
  }

  const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
  const dados = await resposta.json();

  if (dados.erro) {
    throw new Error("CEP não encontrado. Verifique e tente novamente.");
  }

  return {
    logradouro: dados.logradouro || "",
    bairro: dados.bairro || "",
    localidade: dados.localidade || "",
    uf: dados.uf || ""
  };
}

/* ====================== ENDEREÇO → COORDENADAS (Nominatim) ====================== */

/**
 * Converte um endereço em texto para latitude/longitude usando o
 * Nominatim (OpenStreetMap). Gratuito, mas com limite de uso razoável
 * (1 requisição por segundo) — adequado para um site de pequeno porte.
 *
 * @param {string} enderecoTexto - ex: "Rua X, 123, Bairro, Belo Horizonte, MG"
 * @returns {Promise<{lat:number, lon:number, enderecoFormatado:string}>}
 */
export async function geocodificarEndereco(enderecoTexto) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(
    enderecoTexto
  )}`;

  const resposta = await fetch(url, {
    headers: { "Accept-Language": "pt-BR" }
  });

  if (!resposta.ok) {
    throw new Error("Não foi possível localizar o endereço no mapa.");
  }

  const resultados = await resposta.json();

  if (!resultados || resultados.length === 0) {
    throw new Error(
      "Endereço não encontrado no mapa. Tente um endereço mais específico."
    );
  }

  const primeiro = resultados[0];
  return {
    lat: parseFloat(primeiro.lat),
    lon: parseFloat(primeiro.lon),
    enderecoFormatado: primeiro.display_name
  };
}

/**
 * Tenta capturar a localização atual do usuário via GPS do navegador.
 * @returns {Promise<{lat:number, lon:number}>}
 */
export function capturarLocalizacaoAtual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Seu navegador não suporta geolocalização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        resolve({
          lat: posicao.coords.latitude,
          lon: posicao.coords.longitude
        });
      },
      (erro) => {
        let mensagem = "Não foi possível obter sua localização.";
        if (erro.code === erro.PERMISSION_DENIED) {
          mensagem = "Permissão de localização negada. Digite seu endereço manualmente.";
        }
        reject(new Error(mensagem));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

/**
 * Converte coordenadas (lat/lon) em um endereço legível (geocoding reverso).
 * Útil quando o cliente usa o GPS em vez de digitar o endereço.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>} endereço formatado
 */
export async function obterEnderecoPorCoordenadas(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  const resposta = await fetch(url, {
    headers: { "Accept-Language": "pt-BR" }
  });
  if (!resposta.ok) {
    throw new Error("Não foi possível identificar o endereço da sua localização.");
  }
  const dados = await resposta.json();
  return dados.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/* ====================== MAPA (Leaflet) ====================== */

let mapaInstancia = null;
let marcadorSede = null;
let marcadorCliente = null;
let linhaRota = null;

/**
 * Cria (ou reutiliza) um mapa Leaflet dentro do elemento informado,
 * exibindo a sede e, se fornecido, o ponto do cliente com uma linha
 * de rota entre os dois.
 *
 * @param {string} elementoId - id do <div> que vai conter o mapa
 * @param {{lat:number, lon:number}|null} pontoCliente
 */
export function criarOuAtualizarMapa(elementoId, pontoCliente = null) {
  if (typeof L === "undefined") {
    console.warn("[Mapa] Biblioteca Leaflet não carregada.");
    return;
  }

  if (!mapaInstancia) {
    mapaInstancia = L.map(elementoId).setView([SEDE.lat, SEDE.lon], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19
    }).addTo(mapaInstancia);

    const iconeSede = L.divIcon({
      className: "marcador-sede",
      html: "🏠",
      iconSize: [30, 30]
    });

    marcadorSede = L.marker([SEDE.lat, SEDE.lon], { icon: iconeSede })
      .addTo(mapaInstancia)
      .bindPopup(`<strong>${SEDE.nome}</strong>`);
  }

  if (pontoCliente) {
    const iconeCliente = L.divIcon({
      className: "marcador-cliente",
      html: "🚗",
      iconSize: [30, 30]
    });

    if (marcadorCliente) {
      marcadorCliente.setLatLng([pontoCliente.lat, pontoCliente.lon]);
    } else {
      marcadorCliente = L.marker([pontoCliente.lat, pontoCliente.lon], {
        icon: iconeCliente
      })
        .addTo(mapaInstancia)
        .bindPopup("<strong>Seu endereço</strong>");
    }

    if (linhaRota) {
      mapaInstancia.removeLayer(linhaRota);
    }
    linhaRota = L.polyline(
      [
        [SEDE.lat, SEDE.lon],
        [pontoCliente.lat, pontoCliente.lon]
      ],
      { color: "#C8A97E", weight: 3, dashArray: "6 6" }
    ).addTo(mapaInstancia);

    mapaInstancia.fitBounds(linhaRota.getBounds(), { padding: [40, 40] });
  }
}

/**
 * Monta a URL para abrir a rota da sede até o cliente no Google Maps
 * (não exige API key — é apenas um link de navegação).
 * @param {{lat:number, lon:number}} pontoCliente
 * @returns {string} URL
 */
export function urlRotaGoogleMaps(pontoCliente) {
  return `https://www.google.com/maps/dir/?api=1&origin=${SEDE.lat},${SEDE.lon}&destination=${pontoCliente.lat},${pontoCliente.lon}&travelmode=driving`;
}