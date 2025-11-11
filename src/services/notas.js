import { storage } from "./storage";
import { addLog } from "./log";

const K_CONFIG = "config";
const K_HIST = "historico";

const delay = (ms = 600) => new Promise((r) => setTimeout(r, ms));

function _normalizeNomeSistema(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function _getHistMutable() {
  return storage.get(K_HIST, []);
}
function _saveHist(hist) {
  storage.set(K_HIST, hist);
}

/* config */
export function getConfig() {
  return storage.get(K_CONFIG, {
    notaCariocaEndpoint: "",
    notaMilhaoEndpoint: "",
    token: "",
    ambiente: "homolog",
  });
}
export function saveConfig(cfg) {
  storage.set(K_CONFIG, cfg);
}

/* histórico */
export function getHistorico() {
  return storage.get(K_HIST, []);
}
export function clearHistorico() {
  storage.set(K_HIST, []);
}

/**
 * Transmite uma única nota.
 * @param {object} opts
 *  - empresa: string
 *  - tipo: "FATURA"|"RPS"|"INDIVIDUAL"
 *  - faturamento: string
 *  - sistemas: string[] (carioca, milhao)
 */
export async function transmitirNota(opts) {
  const t0 = performance.now();
  const { empresa, tipo, faturamento, sistemas = ["carioca", "milhao"] } = opts;

  if (!empresa) throw new Error("Selecione a empresa.");
  if (!faturamento || String(faturamento).trim().length < 3) {
    throw new Error("Número inválido.");
  }

  const cfg = getConfig();

  await delay(500 + Math.random() * 500);

  const resultados = [];
  if (sistemas.includes("carioca")) {
    resultados.push({
      sistema: "Nota Carioca",
      status: "sucesso",
      protocolo: "NC-" + Date.now(),
    });
  }
  if (sistemas.includes("milhao")) {
    resultados.push({
      sistema: "Nota do Milhão",
      status: "sucesso",
      protocolo: "NM-" + (Date.now() + 1),
    });
  }

  const registro = {
    id: crypto.randomUUID(),
    faturamento: String(faturamento),
    sistemas: resultados.map((r) => ({
      nome: r.sistema,
      status: r.status,
      protocolo: r.protocolo,
      cancelada: false,
      substituida: false,
    })),
    empresa,
    tipo,
    ambiente: cfg.ambiente,
    quando: new Date().toISOString(),
  };

  const hist = getHistorico();
  hist.unshift(registro);
  storage.set(K_HIST, hist);

  addLog({
    empresa,
    tipo,
    statusGeral: "ok",
    mensagem: "Transmissão concluída.",
    duracaoMs: Math.round(performance.now() - t0),
    payload: { faturamento },
    resultados,
  });

  return registro;
}

export async function importarRpsEmLote(file, empresaDefault) {
  const texto = await file.text();
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const resultados = [];
  for (const [idx, linha] of linhas.entries()) {
    const [rps, empresaArquivo] = linha.split(",").map((s) => s?.trim());
    const empresa = empresaArquivo || empresaDefault;
    try {
      const res = await transmitirNota({
        empresa,
        tipo: "RPS",
        faturamento: rps, 
        sistemas: ["carioca", "milhao"],
      });
      resultados.push({ ok: true, linha: idx + 1, rps, res });
    } catch (err) {
      addLog({
        empresa,
        tipo: "RPS",
        statusGeral: "err",
        mensagem: `Falha ao transmitir RPS ${rps}: ${err.message}`,
        duracaoMs: 0,
        payload: { rps },
        resultados: [],
      });
      resultados.push({ ok: false, linha: idx + 1, rps, erro: err.message });
    }
  }
  return resultados;
}

/**
 * Mock de substituição de NFS-e para uma transmissão já registrada.
 * Atualiza o histórico no storage e registra log.
 * @param {{ id: string, sistema: string }} params
 * @returns {Promise<{ ok: boolean, item: any }>}
 */
export async function substituirNota(params) {
  const { id, sistema } = params || {};
  if (!id || !sistema) throw new Error("Parâmetros inválidos.");

  await delay(700);

  const hist = _getHistMutable();
  const idx = hist.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error("Registro não encontrado.");

  const alvo = hist[idx];
  const nomeAlvo = _normalizeNomeSistema(sistema);
  const s = alvo.sistemas.find((si) => _normalizeNomeSistema(si.nome) === nomeAlvo);
  if (!s) throw new Error("Sistema não encontrado no registro.");
  if (s.status !== "sucesso" || !s.protocolo) {
    throw new Error("Não é possível substituir: status inválido/protocolo ausente.");
  }
  if (s.cancelada) {
    throw new Error("Não é possível substituir uma nota já cancelada.");
  }

  const sufixo = Math.floor(Math.random() * 900 + 100);
  s.substituida = true;
  s.cancelada = false;
  s.protocolo = `${s.protocolo}-SUB-${sufixo}`;

  alvo.quando = new Date().toISOString();

  _saveHist(hist);

  addLog({
    empresa: alvo.empresa,
    tipo: alvo.tipo,
    statusGeral: "ok",
    mensagem: `Substituição solicitada em ${s.nome}.`,
    duracaoMs: 0,
    payload: { id, sistema: s.nome, protocolo: s.protocolo },
    resultados: [{ sistema: s.nome, status: "sucesso", protocolo: s.protocolo }],
  });

  return { ok: true, item: JSON.parse(JSON.stringify(alvo)) };
}

/**
 * Mock de cancelamento de NFS-e para uma transmissão já registrada.
 * Atualiza o histórico no storage e registra log.
 * @param {{ id: string, sistema: string }} params
 * @returns {Promise<{ ok: boolean, item: any }>}
 */
export async function cancelarNota(params) {
  const { id, sistema } = params || {};
  if (!id || !sistema) throw new Error("Parâmetros inválidos.");

  await delay(700);

  const hist = _getHistMutable();
  const idx = hist.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error("Registro não encontrado.");

  const alvo = hist[idx];
  const nomeAlvo = _normalizeNomeSistema(sistema);
  const s = alvo.sistemas.find((si) => _normalizeNomeSistema(si.nome) === nomeAlvo);
  if (!s) throw new Error("Sistema não encontrado no registro.");
  if (s.status !== "sucesso" || !s.protocolo) {
    throw new Error("Não é possível cancelar: status inválido/protocolo ausente.");
  }
  if (s.cancelada) {
    throw new Error("Nota já está cancelada.");
  }

  s.cancelada = true;
  s.substituida = false;
  s.protocolo = null;

  alvo.quando = new Date().toISOString();

  _saveHist(hist);

  addLog({
    empresa: alvo.empresa,
    tipo: alvo.tipo,
    statusGeral: "ok",
    mensagem: `Cancelamento solicitado em ${s.nome}.`,
    duracaoMs: 0,
    payload: { id, sistema: s.nome },
    resultados: [{ sistema: s.nome, status: "sucesso", protocolo: null }],
  });

  return { ok: true, item: JSON.parse(JSON.stringify(alvo)) };
}

export function seedHistoricoSeVazio() {
  const hist = storage.get(K_HIST, []);
  if (hist.length) return;

  const agora = Date.now();
  const base = [
    {
      id: crypto.randomUUID(),
      faturamento: "2024-001234",
      sistemas: [
        {
          nome: "Nota Carioca",
          status: "sucesso",
          protocolo: "NC-778899",
          cancelada: false,
          substituida: false,
        },
        {
          nome: "Nota do Milhão",
          status: "erro",
          protocolo: null,
          cancelada: false,
          substituida: false,
        },
      ],
      empresa: "ACME LTDA",
      tipo: "FATURA",
      ambiente: "homolog",
      quando: new Date(agora - 5 * 60_000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      faturamento: "2024-001235",
      sistemas: [
        {
          nome: "Nota Carioca",
          status: "sucesso",
          protocolo: "NC-112233",
          cancelada: false,
          substituida: false,
        },
      ],
      empresa: "ACME LTDA",
      tipo: "RPS",
      ambiente: "homolog",
      quando: new Date(agora - 60 * 60_000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      faturamento: "2024-001236",
      sistemas: [
        {
          nome: "Nota do Milhão",
          status: "sucesso",
          protocolo: "NM-445566",
          cancelada: false,
          substituida: false,
        },
      ],
      empresa: "ACME LTDA",
      tipo: "INDIVIDUAL",
      ambiente: "homolog",
      quando: new Date(agora - 2 * 60 * 60_000).toISOString(),
    },
  ];

  storage.set(K_HIST, base);
}
