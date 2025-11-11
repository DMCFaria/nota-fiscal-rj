const K_LOG = "logEmissao";

export function getLogs() {
  try { return JSON.parse(localStorage.getItem(K_LOG) || "[]"); }
  catch { return []; }
}

export function clearLogs() {
  localStorage.removeItem(K_LOG);
}

export function addLog(entry) {
  const base = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    empresa: null,
    tipo: null,            // "FATURA" | "RPS" | "INDIVIDUAL"
    statusGeral: "ok",     // "ok" | "err" | "info"
    mensagem: "",
    duracaoMs: 0,
    payload: null,         // dados relevantes
    resultados: [],        
  };
  const logs = getLogs();
  logs.unshift({ ...base, ...entry });
  localStorage.setItem(K_LOG, JSON.stringify(logs));
  return logs[0];
}
