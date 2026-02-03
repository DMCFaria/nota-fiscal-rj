import { useState, useCallback, useMemo } from "react";
import {
  FiSearch,
  FiChevronRight,
  FiChevronDown,
  FiRefreshCw,
  FiDownload,
  FiTrash2,
  FiAlertTriangle
} from "react-icons/fi";
import { useSnackbar } from "notistack";
import * as XLSX from "xlsx";
import {
  getNotaPorFatura,
  downloadPdfNota,
  cancelarNota,
  getNotaPorID,
  reemitirNota,
  sincronizarNotas
} from "../services/notas";
import { fixBrokenLatin } from "../utils/normalizacao_textual";
import "../styles/consultas.css";
import "../styles/notaCard.css";
import "../styles/status-badge.css";

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function getIdIntegracao(nota) {
  return nota?.id_integracao || nota?.idIntegracao || null;
}

function getIdTecnospeed(nota) {
  return nota?.id_tecnospeed || nota?.idTecnospeed || nota?.id || null;
}

function getTomadorCpfCnpj(nota) {
  const v =
    nota?.tomador_cpf_cnpj ||
    nota?.tomadorCpfCnpj ||
    nota?.tomador_cnpj ||
    nota?.tomadorCnpj ||
    nota?.tomador?.cpfCnpj ||
    nota?.tomador?.cpf_cnpj ||
    nota?.tomador?.cnpj ||
    nota?.tomador?.cpf ||
    nota?.dados?.tomador_cpf_cnpj ||
    nota?.dados?.tomador?.cpfCnpj ||
    nota?.nfse?.tomador_cpf_cnpj ||
    nota?.nfse?.tomador?.cpfCnpj;

  return String(v ?? "").trim();
}

function getTomadorRazao(nota) {
  return (
    nota?.tomador?.razao_social ||
    nota?.tomador?.razaoSocial ||
    nota?.tomador_razao_social ||
    nota?.tomadorRazaoSocial ||
    nota?.dados?.tomador?.razao_social ||
    nota?.nfse?.tomador?.razao_social ||
    ""
  );
}

/**
 * ✅ Normaliza o shape do tomador no STATE
 * - Se o back mandar `tomador_cpf_cnpj` no root, injeta também em `tomador.cpfCnpj`
 * - Mantém `tomador_cpf_cnpj` no root para o Excel achar por qualquer caminho
 */
function normalizeTomadorForState(nota) {
  const cpfCnpj = getTomadorCpfCnpj(nota);

  const tomadorObj =
    nota?.tomador && typeof nota.tomador === "object" ? nota.tomador : {};

  const mergedTomador = {
    ...tomadorObj,
    cpfCnpj:
      tomadorObj?.cpfCnpj ||
      tomadorObj?.cpf_cnpj ||
      tomadorObj?.cnpj ||
      tomadorObj?.cpf ||
      cpfCnpj ||
      ""
  };

  return {
    ...nota,
    tomador_cpf_cnpj: cpfCnpj || nota?.tomador_cpf_cnpj || "",
    tomador: mergedTomador
  };
}

function normalizeStr(v) {
  return String(v ?? "").trim();
}

function isNotaCancelada(nota) {
  const st = normalizeStr(nota?.status).toLowerCase();
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();
  return st === "cancelada" || sit === "cancelada";
}

function isNotaConcluida(nota) {
  if (!nota) return false;
  if (isNotaCancelada(nota)) return false;

  const st = normalizeStr(nota?.status).toLowerCase();
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();

  const concluidaByStatus = [
    "sucesso",
    "autorizada",
    "concluido",
    "concluída",
    "concluida",
    "emitida",
    "emitido"
  ].includes(st);

  const concluidaBySituacao = [
    "concluido",
    "concluída",
    "concluida",
    "autorizada",
    "emitida",
    "emitido"
  ].includes(sit);

  const concluidaIncludes =
    st.includes("conclu") ||
    st.includes("autoriz") ||
    st.includes("emitid") ||
    sit.includes("conclu") ||
    sit.includes("autoriz") ||
    sit.includes("emitid");

  return concluidaByStatus || concluidaBySituacao || concluidaIncludes;
}

function isNotaBaixavel(nota) {
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();
  const st = normalizeStr(nota?.status).toLowerCase();
  const cancelada = sit === "cancelada" || st === "cancelada";
  return !!getIdIntegracao(nota) && isNotaConcluida(nota) && !cancelada;
}

function isNotaRejeitada(nota) {
  if (isNotaCancelada(nota)) return false;

  const st = normalizeStr(nota?.status).toLowerCase();
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();

  const rejectedByStatus =
    st.includes("rejeit") ||
    st.includes("recus") ||
    st === "erro" ||
    st === "falha" ||
    st.includes("deneg") ||
    st.includes("inval");

  const rejectedBySituacao =
    sit.includes("rejeit") ||
    sit.includes("recus") ||
    sit.includes("deneg") ||
    sit.includes("inval");

  const hasExplicitReason =
    !!nota?.motivo ||
    !!nota?.motivo_rejeicao ||
    !!nota?.motivo_erro ||
    !!nota?.mensagem ||
    !!nota?.erro ||
    !!nota?.error ||
    toArray(nota?.erros).length > 0 ||
    toArray(nota?.logs).length > 0 ||
    toArray(nota?.log).length > 0;

  return (
    rejectedByStatus ||
    rejectedBySituacao ||
    (hasExplicitReason && (st === "erro" || st.includes("erro")))
  );
}

function isNotaPendente(nota) {
  if (isNotaCancelada(nota)) return false;
  if (isNotaRejeitada(nota)) return false;
  return !isNotaConcluida(nota);
}

function isNotaCancelavel(nota) {
  if (isNotaCancelada(nota)) return false;
  if (isNotaRejeitada(nota)) return false;

  const sit = normalizeStr(nota?.situacao_prefeitura).toUpperCase();
  const st = normalizeStr(nota?.status).toUpperCase();

  return sit !== "CONCLUIDO" && st !== "PROCESSANDO";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function deepJsonParse(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const first = safeJsonParse(s);
  if (first !== null) {
    if (typeof first === "string") {
      const second = safeJsonParse(first);
      if (second !== null) return second;
    }
    return first;
  }

  if (s.includes('\\"')) {
    const unescaped = s.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
    const attempt = safeJsonParse(unescaped);
    if (attempt !== null) return attempt;
  }

  try {
    const wrapped = `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const unwrapped = JSON.parse(wrapped);
    const attempt = safeJsonParse(unwrapped);
    if (attempt !== null) return attempt;
  } catch {
    // ignore
  }

  return null;
}

function pickJsonInsideText(text) {
  const s = String(text || "").trim();
  if (!s) return null;

  const direct = deepJsonParse(s);
  if (direct) return direct;

  const firstArr = s.indexOf("[");
  const lastArr = s.lastIndexOf("]");
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    const candidate = s.slice(firstArr, lastArr + 1);
    const parsed = deepJsonParse(candidate);
    if (parsed) return parsed;
  }

  const firstObj = s.indexOf("{");
  const lastObj = s.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    const candidate = s.slice(firstObj, lastObj + 1);
    const parsed = deepJsonParse(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function simplifyDescricao(desc) {
  let s = String(desc || "").trim();
  if (!s) return "—";
  s = s.replace(/\s+/g, " ");

  const lower = s.toLowerCase();
  const key = "não pertence ao município do endereço do tomador";
  if (lower.includes("cep") && lower.includes(key)) {
    return "O CEP não pertence ao município do endereço do tomador.";
  }

  if (lower.includes(" ou ")) {
    const parts = s
      .split(/\s+ou\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    const prefer = parts.find((p) =>
      p.toLowerCase().includes("pertence ao município")
    );
    if (prefer) return simplifyDescricao(prefer);
  }

  const m = s.match(/^.{0,170}?[.!?](\s|$)/);
  const firstSentence = (m?.[0] || s).trim();

  if (firstSentence.length > 120)
    return firstSentence.slice(0, 120).trim() + "…";
  return firstSentence;
}

function formatTecnospeedError(err) {
  if (!err) return "—";

  if (typeof err === "string") {
    const json = pickJsonInsideText(err);
    if (!json) return simplifyDescricao(err);
    return formatTecnospeedError(json);
  }

  if (Array.isArray(err)) {
    const first = err.find(Boolean);
    return first ? formatTecnospeedError(first) : "—";
  }

  if (typeof err === "object") {
    const descricao =
      err?.error?.message ||
      err?.error?.mensagem ||
      err?.message ||
      err?.mensagem ||
      err?.Descricao ||
      err?.descricao ||
      err?.erro;

    if (descricao) return simplifyDescricao(descricao);

    const nested =
      err?.data?.new?.message ||
      err?.data?.new?.mensagem ||
      err?.data?.message ||
      err?.data?.mensagem;

    if (nested) return simplifyDescricao(nested);

    const anyString = Object.values(err).find(
      (v) => typeof v === "string" && v.trim()
    );
    if (anyString) return simplifyDescricao(anyString);

    return "—";
  }

  return simplifyDescricao(String(err));
}

function getFriendlyApiErrorMessage(e) {
  const data = e?.response?.data;
  const status = e?.response?.status;

  const msgFromData =
    data?.error?.message ||
    data?.error?.mensagem ||
    data?.message ||
    data?.mensagem ||
    null;

  const msgFromStringData =
    typeof data === "string" ? formatTecnospeedError(data) : null;
  const msgFromMessage = e?.message ? formatTecnospeedError(e.message) : null;

  const msg = msgFromData || msgFromStringData || msgFromMessage || "Erro inesperado.";

  if (status === 409) {
    if (String(msg).toLowerCase().includes("já existe")) return msg;
    return "Já existe uma NFS-e com os parâmetros informados (conflito 409).";
  }

  return msg;
}

function extractRejectionReason(nota) {
  const candidatesRaw = [
    nota?.motivo_erro,
    nota?.motivo_rejeicao,
    nota?.motivo,
    nota?.mensagem,
    nota?.erro,
    nota?.error,
    nota?.situacao_prefeitura
  ].filter((v) => v !== undefined && v !== null);

  for (const c of candidatesRaw) {
    const formatted = formatTecnospeedError(c);
    if (formatted && formatted !== "—") return formatted;
  }

  const erros = toArray(nota?.erros);
  if (erros.length) {
    const formatted = formatTecnospeedError(erros);
    if (formatted && formatted !== "—") return formatted;
  }

  const logs = toArray(nota?.logs || nota?.log);
  if (logs.length) {
    const last = logs[logs.length - 1];
    const formatted = formatTecnospeedError(
      last?.motivo_erro || last?.mensagem || last?.message || last?.erro || last
    );
    if (formatted && formatted !== "—") return formatted;
  }

  return "—";
}

function normalizeCepDigits(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 8);
}

function formatCep(cepDigits) {
  const d = normalizeCepDigits(cepDigits);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function getEmitenteRazao(nota) {
  return (
    nota?.emitente?.razao_social ||
    nota?.prestador?.razao_social ||
    nota?.prestador?.nome ||
    nota?.dados?.prestador?.razao_social ||
    nota?.nfse?.prestador?.razao_social ||
    ""
  );
}

function isEmitenteCondocorp(nota) {
  const nome = String(getEmitenteRazao(nota) || "").toLowerCase();
  return nome.includes("condocorp");
}

function extractCepFromText(text) {
  const s = String(text || "");
  const m = s.match(/\b(\d{5})-?(\d{3})\b/);
  if (!m) return "";
  return `${m[1]}${m[2]}`;
}

function extractCepFromNotaErrors(nota) {
  const candidates = [
    nota?.motivo_erro,
    nota?.motivo_rejeicao,
    nota?.motivo,
    nota?.mensagem,
    nota?.erro,
    nota?.error,
    nota?.situacao_prefeitura
  ];

  for (const c of candidates) {
    if (!c) continue;
    const cep = extractCepFromText(typeof c === "string" ? c : JSON.stringify(c));
    if (cep) return cep;
  }

  const erros = toArray(nota?.erros);
  for (const e of erros) {
    const cep = extractCepFromText(typeof e === "string" ? e : JSON.stringify(e));
    if (cep) return cep;
  }

  const logs = toArray(nota?.logs || nota?.log);
  for (const l of logs) {
    const cep = extractCepFromText(typeof l === "string" ? l : JSON.stringify(l));
    if (cep) return cep;
  }

  return "";
}

function pickFirstCepFromPaths(nota, paths) {
  for (const getter of paths) {
    try {
      const v = getter(nota);
      const digits = normalizeCepDigits(v);
      if (digits.length === 8) return digits;
    } catch {
      // ignore
    }
  }
  return "";
}

function getCepFromNota(nota) {
  if (!nota) return "";

  const isCondocorp = isEmitenteCondocorp(nota);

  const commonPaths = [
    (n) => n?.tomador?.endereco?.cep,
    (n) => n?.tomador?.endereco?.CEP,
    (n) => n?.tomador?.endereco_tomador?.cep,
    (n) => n?.tomador?.endereco_tomador?.CEP,
    (n) => n?.tomador?.enderecoTomador?.cep,
    (n) => n?.tomador?.enderecoTomador?.CEP,
    (n) => n?.tomador?.endereco_tomador?.Cep,
    (n) => n?.tomador?.endereco?.Cep,
    (n) => n?.tomador?.cep,
    (n) => n?.tomador?.CEP,
    (n) => n?.cep_tomador,
    (n) => n?.tomador_cep,
    (n) => n?.tomadorCep,
    (n) => n?.cep
  ];

  const extraPathsNonCondocorp = [
    (n) => n?.dados?.tomador?.endereco?.cep,
    (n) => n?.dados?.tomador?.endereco?.CEP,
    (n) => n?.dados?.tomador?.endereco_tomador?.cep,
    (n) => n?.dados?.tomador?.enderecoTomador?.cep,
    (n) => n?.dados?.tomador?.cep,
    (n) => n?.nfse?.dados?.tomador?.endereco?.cep,
    (n) => n?.nfse?.dados?.tomador?.enderecoTomador?.cep,
    (n) => n?.nfse?.tomador?.endereco?.cep,
    (n) => n?.nfse?.tomador?.enderecoTomador?.cep,
    (n) => n?.payload?.tomador?.endereco?.cep,
    (n) => n?.payload?.tomador?.enderecoTomador?.cep
  ];

  const candidates = isCondocorp ? commonPaths : [...commonPaths, ...extraPathsNonCondocorp];

  let cep = pickFirstCepFromPaths(nota, candidates);

  if (!cep) {
    const fromError = extractCepFromNotaErrors(nota);
    if (fromError.length === 8) cep = fromError;
  }

  return cep;
}

function getFilenameFromContentDisposition(cd) {
  if (!cd) return null;

  const m1 = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (m1?.[1]) return decodeURIComponent(m1[1].replace(/["']/g, ""));

  const m2 = /filename="?([^"]+)"?/i.exec(cd);
  if (m2?.[1]) return m2[1];

  return null;
}

function extFromContentType(ct) {
  const t = String(ct || "").toLowerCase();
  if (t.includes("pdf")) return "pdf";
  if (t.includes("zip")) return "zip";
  if (t.includes("x-zip-compressed")) return "zip";
  if (t.includes("octet-stream")) return "zip";
  return "";
}

async function tryReadBlobAsText(blob) {
  try {
    return await blob.text();
  } catch {
    return "";
  }
}

async function parseBlobError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data;

  if (data instanceof Blob) {
    const txt = await tryReadBlobAsText(data);
    const json = (() => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    })();

    const msg =
      json?.error?.message ||
      json?.error?.mensagem ||
      json?.message ||
      json?.mensagem ||
      txt ||
      "Erro inesperado.";

    return { status, message: msg };
  }

  return { status, message: getFriendlyApiErrorMessage(e) };
}

function forceDownloadBlob({ blob, filename }) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function ModalConfirm({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  loading,
  onConfirm,
  onClose,
  confirmDisabled,
  children
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
        </div>

        {description && <p className="modal-desc">{description}</p>}

        {children}

        <div className="modal-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`btn ${variant === "danger" ? "danger" : ""}`}
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ status, substituida }) {
  const base = status === "sucesso" ? "badge success" : "badge error";
  return (
    <span className={base}>
      {status === "sucesso" ? "Sucesso" : "Erro"}
      {substituida && <span className="pill">Substituída</span>}
    </span>
  );
}

function formatDataHoraBR(value, options = {}) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options
  });
}

function buildNotasPayloadFromTela({ tipoBusca, faturas, dados }) {
  if (tipoBusca === "fatura" || tipoBusca === "nota") {
    const notas = [];
    for (const fat of toArray(faturas)) {
      for (const n of toArray(fat?.notas)) {
        if (!n) continue;

        notas.push({
          id_tecnospeed: getIdTecnospeed(n),
          id_integracao: getIdIntegracao(n),
          protocolo: n?.protocolo,
          numero: n?.numero_nfse || n?.numero || n?.id,
          fatura: n?.fatura || fat?.numero || fat?.id
        });
      }
    }
    return {
      notas: notas.filter(
        (x) => x.id_tecnospeed || x.id_integracao || x.protocolo || x.numero
      )
    };
  }

  const notas = toArray(dados).map((n) => ({
    id_tecnospeed: getIdTecnospeed(n),
    id_integracao: getIdIntegracao(n),
    protocolo: n?.protocolo,
    numero: n?.numero_nfse || n?.numero || n?.id,
    fatura: n?.fatura || n?.faturamento
  }));

  return {
    notas: notas.filter(
      (x) => x.id_tecnospeed || x.id_integracao || x.protocolo || x.numero
    )
  };
}

function LinhaFatura({
  fatura,
  isOpen,
  onToggle,
  onBaixarTodas,
  onBaixarUma,
  baixandoAll,
  onCancelarTodas,
  onCancelarUma,
  cancelandoAll,
  onTratarErro
}) {
  const notasAll = toArray(fatura.notas);
  const notas = notasAll.filter((n) => !isNotaCancelada(n));

  const qtdNotas = notas.length;
  const qtdBaixaveis = notas.filter(isNotaBaixavel).length;

  const hasCancelavel = notas.some(isNotaCancelavel);
  const qtdRejeitadas = notas.filter(isNotaRejeitada).length;

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button type="button" className="accordion-toggle" onClick={onToggle}>
            <span className="chev">
              {isOpen ? <FiChevronDown /> : <FiChevronRight />}
            </span>
            {fatura.numero}
          </button>
        </td>

        <td className="fatura-resumo">
          <span className="fatura-resumo-text">
            {qtdNotas} nota(s) ativa(s)
            {qtdRejeitadas > 0 && (
              <span
                style={{ marginLeft: 10, fontWeight: 600, color: "#b45309" }}
              >
                • {qtdRejeitadas} rejeitada(s)
              </span>
            )}
          </span>
        </td>

        <td
          className="acoes-col"
          style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}
        >
          <button
            type="button"
            className="btn btn-xs secondary"
            onClick={onBaixarTodas}
            disabled={!qtdBaixaveis || baixandoAll}
            title={
              !qtdBaixaveis
                ? "Nenhuma nota concluída para baixar"
                : "Baixar PDFs/ZIP das notas concluídas"
            }
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <FiDownload />
            {baixandoAll ? "Baixando..." : `Baixar todas (${qtdBaixaveis})`}
          </button>

          <button
            type="button"
            className="btn btn-xs danger"
            onClick={onCancelarTodas}
            disabled={!hasCancelavel || cancelandoAll}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Cancelar todas as notas da fatura"
          >
            <FiTrash2 />
            {cancelandoAll ? "Cancelando..." : "Cancelar todas"}
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr className="accordion-expansion">
          <td colSpan={3} className="expansion-td">
            <div className="expansion-wrapper expansion-wrapper--fat">
              <div className="notas-box notas-box--fat">
                <table className="tabela notas-tabela">
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>Nº DA NOTA</th>
                      <th style={{ width: 4000 }}>TOMADOR</th>
                      <th style={{ width: 180 }} >CNPJ</th>
                      <th style={{ width: 1500, textAlign: "right" }}>VALOR</th>
                      <th style={{ width: 160 }}>STATUS</th>
                      <th style={{ width: 260, textAlign: "right" }}>AÇÕES</th>
                    </tr>
                  </thead>

                  <tbody>
                    {notas.map((n, idx) => {
                      const rejeitada = isNotaRejeitada(n);

                      return (
                        <tr
                          key={n.id ?? idx}
                          style={
                            rejeitada
                              ? { background: "rgba(245, 158, 11, 0.08)" }
                              : undefined
                          }
                        >
                          <td className="mono">{n.id || n.numero || "—"}</td>

                          <td>{fixBrokenLatin(n.tomador?.razao_social) || "—"}</td>

                          <td className="mono">{getTomadorCpfCnpj(n) || "—"}</td>


                          <td style={{ textAlign: "right" }}>
                            {n.valor_servico
                              ? `R$ ${parseFloat(n.valor_servico).toLocaleString(
                                "pt-BR",
                                { minimumFractionDigits: 2 }
                              )}`
                              : "—"}
                          </td>

                          <td>
                            <span
                              className={`status-badge status-${n.status?.toLowerCase() || "unknown"
                                }`}
                            >
                              {n.status || "—"}
                            </span>

                            {rejeitada && (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  color: "#92400e"
                                }}
                              >
                                Motivo: {extractRejectionReason(n)}
                              </div>
                            )}
                          </td>

                          <td className="acoes-col" style={{ textAlign: "right" }}>
                            {rejeitada ? (
                              <button
                                type="button"
                                className="icon-btn warning"
                                onClick={() => onTratarErro(n)}
                                title="Tratar erro da nota"
                              >
                                <FiAlertTriangle />
                              </button>
                            ) : (
                              <div style={{ display: "inline-flex", gap: 10 }}>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => onBaixarUma(n)}
                                  disabled={!isNotaBaixavel(n)}
                                  title="Baixar PDF/ZIP"
                                >
                                  <FiDownload />
                                </button>

                                <button
                                  type="button"
                                  className="icon-btn danger"
                                  onClick={() => onCancelarUma(n)}
                                  disabled={!isNotaCancelavel(n)}
                                  title="Cancelar esta nota"
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {!qtdNotas && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ padding: 14, color: "var(--text-soft,#525a6a)" }}
                        >
                          Nenhuma nota ativa vinculada nessa fatura.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LinhaNota({ item, expanded, onToggle, onOpenCancelar }) {
  const isOpen = expanded.has(item.id);
  const sistemas = toArray(item.sistemas);
  const hasElegivel = sistemas.some(
    (s) => s.status === "sucesso" && s.protocolo && !s.cancelada
  );

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button
            type="button"
            className="accordion-toggle"
            onClick={() => onToggle(item.id)}
          >
            <span className="chev">
              {isOpen ? <FiChevronDown /> : <FiChevronRight />}
            </span>
            {item.faturamento ?? item.fatura ?? item.numero ?? "—"}
          </button>
        </td>

        <td>{item.quando ? new Date(item.quando).toLocaleString("pt-BR") : "—"}</td>

        <td className="resultados-compactos">
          {sistemas.map((s) => (
            <span key={s.nome} className="sist-chip">
              <strong>{s.nome}</strong> — <Badge status={s.status} substituida={s.substituida} />
            </span>
          ))}
        </td>

        <td className="acoes-col">
          <button
            type="button"
            className="icon-btn danger"
            disabled={!hasElegivel}
            onClick={() => onOpenCancelar(item)}
            title="Cancelar nota"
          >
            <FiTrash2 />
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr className="accordion-expansion">
          <td colSpan={4}>
            <div className="expansion-wrapper">
              {sistemas.map((s) => (
                <div key={s.nome} className="sist-bloco">
                  <div className="sist-header">
                    <div className="sist-title">
                      <strong>{s.nome}</strong>
                      <Badge status={s.status} substituida={s.substituida} />
                    </div>
                    <div className="sist-proto">
                      Protocolo: <span className="mono">{s.protocolo ?? "—"}</span>
                    </div>
                  </div>

                  {s.motivo && (
                    <div className="sist-erro-msg">
                      Motivo: {formatTecnospeedError(s.motivo)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function toExcelValue(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? "true" : "false";

  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString();

  if (typeof v === "string") {
    const s = v.trim();
    return fixBrokenLatin(s);
  }

  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function flattenForExcel(input, prefix = "", out = {}) {
  if (input === undefined || input === null) {
    if (prefix) out[prefix] = "";
    return out;
  }

  if (Array.isArray(input)) {
    if (!input.length) {
      if (prefix) out[prefix] = "";
      return out;
    }
    input.forEach((item, idx) => {
      const p = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      flattenForExcel(item, p, out);
    });
    return out;
  }

  if (typeof input === "object") {
    const keys = Object.keys(input);
    if (!keys.length) {
      if (prefix) out[prefix] = "";
      return out;
    }
    for (const k of keys) {
      const val = input[k];
      const p = prefix ? `${prefix}.${k}` : k;
      flattenForExcel(val, p, out);
    }
    return out;
  }

  if (prefix) out[prefix] = toExcelValue(input);
  return out;
}

function normalizeForExcelRow(nota, extras = {}) {
  const base = {
    ...extras,
    tomador_razao_social: String(fixBrokenLatin(getTomadorRazao(nota) || "")),
    tomador_cpf_cnpj: String(getTomadorCpfCnpj(nota) || ""),
    id_integracao: String(getIdIntegracao(nota) || ""),
    id_tecnospeed: String(getIdTecnospeed(nota) || ""),
    protocolo: String(nota?.protocolo || ""),
    numero_nfse: String(nota?.numero_nfse || nota?.numero || nota?.id || ""),
    status: String(nota?.status || ""),
    situacao_prefeitura: String(nota?.situacao_prefeitura || "")
  };

  const flat = flattenForExcel(nota);

  return { ...flat, ...base };
}

export default function Consultas() {
  const [faturas, setFaturas] = useState([]);
  const [dados, setDados] = useState([]);
  const [textoDigitado, setTextoDigitado] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [tipoBusca, setTipoBusca] = useState("fatura");

  const [expanded, setExpanded] = useState(new Set());
  const [expandedFat, setExpandedFat] = useState(new Set());

  const { enqueueSnackbar } = useSnackbar();

  const [modal, setModal] = useState({
    open: false,
    target: "",
    payload: null,
    motivo: "",
    sistema: "",
    opcoes: []
  });

  const [modalLoading, setModalLoading] = useState(false);
  const [baixandoAll, setBaixandoAll] = useState({});
  const [cancelandoAll, setCancelandoAll] = useState({});
  const [baixandoRelatorio, setBaixandoRelatorio] = useState(false);

  const [tratarModal, setTratarModal] = useState({
    open: false,
    nota: null,
    cep: ""
  });
  const [reemitindo, setReemitindo] = useState(false);

  const [sincronizando, setSincronizando] = useState(false);
  const [filtroResumo, setFiltroResumo] = useState("todas");

  const [baixandoExcelNotas, setBaixandoExcelNotas] = useState(false);

  const isModoFatura = tipoBusca === "fatura";
  const isModoFaturaUI = tipoBusca === "fatura" || tipoBusca === "nota";

  const aplicaFiltroNota = useCallback(
    (nota) => {
      if (isNotaCancelada(nota)) return false;

      if (filtroResumo === "todas") return true;
      if (filtroResumo === "concluidas") return isNotaConcluida(nota);
      if (filtroResumo === "rejeitadas") return isNotaRejeitada(nota);
      if (filtroResumo === "pendentes") return isNotaPendente(nota);

      return true;
    },
    [filtroResumo]
  );

  const toggleFiltro = useCallback((novo) => {
    setFiltroResumo((atual) => (atual === novo ? "todas" : novo));
    setExpandedFat(new Set());
  }, []);

  const realizarBusca = useCallback(async () => {
    const termo = textoDigitado.trim();
    if (termo.length < 3) return;

    setLoading(true);

    try {
      if (isModoFatura) {
        const res = await getNotaPorFatura(termo);

        const notasOrdenadas =
          res?.tipo === "multiplas" && Array.isArray(res?.notas)
            ? [...res.notas].sort(
              (a, b) =>
                new Date(b?.datas?.criacao || 0) - new Date(a?.datas?.criacao || 0)
            )
            : [];

        if (res && res.status === "success") {
          if (res.tipo === "multiplas" && Array.isArray(res.notas)) {
            setFaturas([
              {
                id: String(res.fatura || termo),
                numero: String(res.fatura || termo),
                quando: notasOrdenadas[0]?.datas?.criacao || null,
                // ✅ normaliza o tomador para salvar no state
                notas: notasOrdenadas.map((nota) => {
                  const nn = normalizeTomadorForState(nota);

                  return {
                    ...nn,
                    id: nn.id || nn.id_tecnospeed,
                    id_tecnospeed: nn.id_tecnospeed || nn.id || nn.idTecnospeed,
                    id_integracao: nn.id_integracao,
                    fatura: nn.fatura,
                    numero_nfse: nn.numero_nfse,
                    status: nn.status,
                    situacao_prefeitura: nn.situacao_prefeitura,

                    valor_servico: nn.valor_servico,
                    prestador: nn.prestador,
                    tomador: nn.tomador,
                    datas: nn.datas,
                    motivo_erro: nn.motivo_erro,
                    motivo_rejeicao: nn.motivo_rejeicao,
                    erros: nn.erros
                  };
                })
              }
            ]);
          } else if (res.nfse) {
            // ✅ também normaliza o tomador aqui
            const nfseNorm = normalizeTomadorForState(res.nfse);

            setFaturas([
              {
                id: String(nfseNorm.fatura || termo),
                numero: String(nfseNorm.fatura || termo),
                quando: nfseNorm.datas?.criacao || null,
                notas: [nfseNorm]
              }
            ]);
          }
          setDados([]);
        } else {
          setFaturas([]);
          setDados([]);
          enqueueSnackbar(res?.message || "Nenhuma nota encontrada", { variant: "info" });
        }
      } else {
        const res = await getNotaPorID(termo);

        if (res && res.status === "success" && res.nfse) {
          if (isNotaCancelada(res.nfse)) {
            setFaturas([]);
            setDados([]);
            enqueueSnackbar("Nota cancelada (não exibida).", { variant: "info" });
          } else {
            // ✅ normaliza antes de montar o objeto final
            const nfseBase = normalizeTomadorForState(res.nfse);

            const nfse = {
              ...nfseBase,
              id: nfseBase.id || termo,
              id_tecnospeed: nfseBase.id_tecnospeed || nfseBase.id || termo,
              id_integracao: nfseBase.id_integracao,
              numero_nfse: nfseBase.numero_nfse,
              fatura: nfseBase.fatura,
              status: nfseBase.status,
              situacao_prefeitura: nfseBase.situacao_prefeitura,

              valor_servico: nfseBase.valor_servico,
              prestador: nfseBase.prestador,
              tomador: nfseBase.tomador,
              emitente: nfseBase.prestador,

              erros: nfseBase.erros,
              motivo_erro: nfseBase.motivo_erro,
              motivo_rejeicao: nfseBase.motivo_rejeicao,

              datas: nfseBase.datas
            };

            const faturaNumero = String(nfse.fatura || "—");
            const fatId = faturaNumero !== "—" ? faturaNumero : String(nfse.id || termo);

            setFaturas([
              {
                id: fatId,
                numero: faturaNumero !== "—" ? faturaNumero : fatId,
                quando: nfse.datas?.criacao || null,
                notas: [nfse]
              }
            ]);

            setDados([]);
            setExpanded(new Set());
          }
        } else {
          setFaturas([]);
          setDados([]);
          enqueueSnackbar(res?.message || "Nota não encontrada", { variant: "info" });
        }
      }

      setHasSearched(true);
      setFiltroResumo("todas");
      setExpandedFat(new Set());
    } catch (error) {
      console.error("Erro na consulta:", error);
      enqueueSnackbar(getFriendlyApiErrorMessage(error), { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [textoDigitado, isModoFatura, enqueueSnackbar]);

  const handleSincronizar = useCallback(async () => {
    if (loading || sincronizando) return;

    if (!hasSearched) {
      enqueueSnackbar("Faça uma busca antes de sincronizar.", { variant: "info" });
      return;
    }

    setSincronizando(true);

    try {
      const payload = buildNotasPayloadFromTela({ tipoBusca, faturas, dados });

      if (!payload?.notas?.length) {
        enqueueSnackbar("Nenhuma nota encontrada para sincronizar.", { variant: "info" });
        return;
      }

      const res = await sincronizarNotas({
        ...payload,
        origem: "portal_nacional"
      });

      const msg = res?.message || res?.mensagem || "Sincronização solicitada.";
      enqueueSnackbar(msg, { variant: "success" });

      await realizarBusca();
    } catch (e) {
      console.error("Erro ao sincronizar:", e);
      enqueueSnackbar(getFriendlyApiErrorMessage(e), { variant: "error" });
    } finally {
      setSincronizando(false);
    }
  }, [loading, sincronizando, hasSearched, tipoBusca, faturas, dados, enqueueSnackbar, realizarBusca]);

  const rejectedRows = useMemo(() => {
    const rows = [];

    if (tipoBusca === "fatura" || tipoBusca === "nota") {
      for (const fat of toArray(faturas)) {
        const numeroFatura = String(fat?.numero || fat?.id || "");
        const notasVisiveis = toArray(fat?.notas).filter((n) => !isNotaCancelada(n));

        for (const n of notasVisiveis) {
          if (!isNotaRejeitada(n)) continue;

          rows.push({
            fatura: numeroFatura || String(n?.fatura || ""),
            idIntegracao: String(getIdIntegracao(n) || ""),
            numero_nfse: String(n?.numero_nfse || n?.numero || ""),
            tomador: fixBrokenLatin(n?.tomador?.razao_social) || "—",
            tomador_cpf_cnpj: getTomadorCpfCnpj(n) || "",
            valor_servico: n?.valor_servico ?? "",
            status: String(n?.status || ""),
            situacao_prefeitura: String(n?.situacao_prefeitura || ""),
            motivo: extractRejectionReason(n)
          });

        }
      }
      return rows;
    }

    const item = toArray(dados)[0];
    if (!item) return rows;

    const baseNota = item;
    if (!isNotaCancelada(baseNota) && isNotaRejeitada(baseNota)) {
      rows.push({
        fatura: String(baseNota?.fatura || baseNota?.faturamento || ""),
        idIntegracao: String(getIdIntegracao(baseNota) || ""),
        numero_nfse: String(baseNota?.numero || ""),
        tomador: fixBrokenLatin(baseNota?.tomador?.razao_social) || "—",
        tomador_cpf_cnpj: getTomadorCpfCnpj(baseNota) || "",
        valor_servico: baseNota?.valor_servico ?? "",
        status: String(baseNota?.status || ""),
        situacao_prefeitura: String(baseNota?.situacao_prefeitura || ""),
        motivo: extractRejectionReason(baseNota)
      });

    }

    return rows;
  }, [faturas, dados, tipoBusca]);

  const hasRejected = rejectedRows.length > 0;

  const resumoNotas = useMemo(() => {
    const notasVisiveis = [];

    if (tipoBusca === "fatura" || tipoBusca === "nota") {
      for (const fat of toArray(faturas)) {
        for (const n of toArray(fat?.notas)) {
          if (!isNotaCancelada(n)) notasVisiveis.push(n);
        }
      }
    } else {
      for (const n of toArray(dados)) {
        if (!isNotaCancelada(n)) notasVisiveis.push(n);
      }
    }

    const total = notasVisiveis.length;
    const concluidas = notasVisiveis.filter(isNotaConcluida).length;
    const rejeitadas = notasVisiveis.filter(isNotaRejeitada).length;
    const pendentes = notasVisiveis.filter(isNotaPendente).length;

    return { total, concluidas, pendentes, rejeitadas };
  }, [faturas, dados, tipoBusca]);

  const baixarRelatorioRejeitadas = async () => {
    try {
      setBaixandoRelatorio(true);

      if (!rejectedRows.length) {
        enqueueSnackbar("Nenhuma rejeição encontrada para exportar.", { variant: "info" });
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rejectedRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rejeitadas");

      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(
        2,
        "0"
      )}${String(now.getMinutes()).padStart(2, "0")}`;

      const nameBase = tipoBusca === "fatura" ? "relatorio_rejeitadas_fatura" : "relatorio_rejeitadas_nota";
      const fileName = `${nameBase}_${stamp}.xlsx`;

      XLSX.writeFile(wb, fileName);
      enqueueSnackbar("Relatório gerado com sucesso!", { variant: "success" });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(getFriendlyApiErrorMessage(e), { variant: "error" });
    } finally {
      setBaixandoRelatorio(false);
    }
  };

  const baixarExcelNotas = useCallback(async () => {
    if (baixandoExcelNotas || loading) return;

    try {
      setBaixandoExcelNotas(true);

      if (!hasSearched) {
        enqueueSnackbar("Faça uma busca antes de exportar.", { variant: "info" });
        return;
      }

      const rowsNotasRaw = [];
      const faturasAll = toArray(faturas);

      if (faturasAll.length) {
        for (const fat of faturasAll) {
          const faturaNumero = String(fat?.numero || fat?.id || "");
          for (const n of toArray(fat?.notas)) {
            if (!n) continue;
            if (isNotaCancelada(n)) continue;

            rowsNotasRaw.push(
              normalizeForExcelRow(n, {
                fatura_numero: faturaNumero
              })
            );
          }
        }
      } else {
        for (const n of toArray(dados)) {
          if (!n) continue;
          if (isNotaCancelada(n)) continue;

          rowsNotasRaw.push(
            normalizeForExcelRow(n, {
              fatura_numero: String(n?.fatura || n?.faturamento || "")
            })
          );
        }
      }

      if (!rowsNotasRaw.length) {
        enqueueSnackbar("Sem notas para exportar.", { variant: "info" });
        return;
      }

      const allKeysSet = new Set();
      for (const r of rowsNotasRaw) {
        Object.keys(r || {}).forEach((k) => allKeysSet.add(k));
      }

      const preferred = [
        "fatura_numero",
        "id_integracao",
        "id_tecnospeed",
        "protocolo",
        "numero_nfse",
        "tomador_razao_social",
        "tomador_cpf_cnpj",
        "status",
        "situacao_prefeitura"
      ];

      const allKeys = Array.from(allKeysSet);
      const headers = [
        ...preferred.filter((k) => allKeysSet.has(k)),
        ...allKeys.filter((k) => !preferred.includes(k)).sort((a, b) => a.localeCompare(b))
      ];

      const rowsNotas = rowsNotasRaw.map((r) => {
        const row = {};
        for (const h of headers) row[h] = r?.[h] ?? "";
        return row;
      });

      const wb = XLSX.utils.book_new();
      const wsNotas = XLSX.utils.json_to_sheet(rowsNotas, { header: headers });
      XLSX.utils.book_append_sheet(wb, wsNotas, "Notas");

      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(
        2,
        "0"
      )}${String(now.getMinutes()).padStart(2, "0")}`;

      const termo = textoDigitado.trim().replace(/[^\w.-]+/g, "_").slice(0, 40) || "resultado";
      const fileName = `notas_${termo}_${stamp}.xlsx`;

      XLSX.writeFile(wb, fileName);
      enqueueSnackbar("Excel gerado com sucesso!", { variant: "success" });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(getFriendlyApiErrorMessage(e), { variant: "error" });
    } finally {
      setBaixandoExcelNotas(false);
    }
  }, [baixandoExcelNotas, loading, hasSearched, faturas, dados, textoDigitado, enqueueSnackbar]);

  const handleDownload = async (item, tipo) => {
    const isFatura = tipo === "fatura";
    const idFat = isFatura ? String(item?.id || item?.numero || item?.fatura || "") : null;

    if (isFatura && idFat) setBaixandoAll((p) => ({ ...p, [idFat]: true }));

    try {
      if (isFatura) {
        const notas = toArray(item?.notas).filter((n) => !isNotaCancelada(n));
        const baixaveis = notas.filter(isNotaBaixavel);

        if (!baixaveis.length) {
          enqueueSnackbar("Nenhuma nota concluída ativa disponível para download.", { variant: "info" });
          return;
        }

        const faturaNumero = String(item?.numero || item?.fatura || item?.numero_fatura || "");

        const emitenteNome =
          item?.emitente?.razao_social ||
          item?.prestador?.razao_social ||
          baixaveis.find((n) => n?.emitente?.razao_social)?.emitente?.razao_social ||
          baixaveis.find((n) => n?.prestador?.razao_social)?.prestador?.razao_social ||
          "emitente";

        const resp = await downloadPdfNota({
          tipo: "fatura",
          idIntegracao: "",
          fatura: faturaNumero,
          emitente: emitenteNome,
          nfs_emitidas: String(baixaveis.length)
        });

        const ct = resp?.headers?.["content-type"] || resp?.headers?.["Content-Type"];
        const cd = resp?.headers?.["content-disposition"] || resp?.headers?.["Content-Disposition"];

        const fromHeader = getFilenameFromContentDisposition(cd);
        const ext = extFromContentType(ct);

        const safeEmit = String(emitenteNome || "emitente").replace(/[^\w.-]+/g, "_").slice(0, 40);
        const safeFat = String(faturaNumero || "fatura").replace(/[^\w.-]+/g, "_").slice(0, 30);

        const fallbackName =
          ext === "zip"
            ? `fatura_${safeFat}_${safeEmit}.zip`
            : `fatura_${safeFat}_${safeEmit}.pdf`;

        const filename = fromHeader || fallbackName;

        forceDownloadBlob({ blob: resp.data, filename });

        if (ext === "zip" || String(filename).toLowerCase().endsWith(".zip")) {
          enqueueSnackbar(`Download em ZIP iniciado (${baixaveis.length} nota(s)).`, { variant: "warning" });
        } else {
          enqueueSnackbar(`Download da fatura iniciado (${baixaveis.length} nota(s))!`, { variant: "success" });
        }

        return;
      }

      if (isNotaCancelada(item)) {
        enqueueSnackbar("Nota cancelada (não disponível).", { variant: "info" });
        return;
      }

      if (isNotaRejeitada(item)) {
        enqueueSnackbar("Nota rejeitada: use “Tratar erro”.", { variant: "info" });
        return;
      }

      const idIntegracao = String(getIdIntegracao(item) || "");
      if (!idIntegracao) {
        enqueueSnackbar("Esta nota não possui idIntegracao para download.", { variant: "warning" });
        return;
      }

      const emitenteNome = item?.emitente?.razao_social || item?.prestador?.razao_social || "emitente";

      const resp = await downloadPdfNota({
        tipo: "individual",
        idIntegracao,
        fatura: String(item?.fatura || item?.numero_fatura || item?.numero || ""),
        emitente: emitenteNome,
        nfs_emitidas: "1"
      });

      const ct = resp?.headers?.["content-type"] || resp?.headers?.["Content-Type"];
      const cd = resp?.headers?.["content-disposition"] || resp?.headers?.["Content-Disposition"];

      const fromHeader = getFilenameFromContentDisposition(cd);
      const ext = extFromContentType(ct) || "pdf";

      const safeId = String(idIntegracao).replace(/[^\w.-]+/g, "_").slice(0, 40);
      const filename = fromHeader || `nfse_${safeId}.${ext}`;

      forceDownloadBlob({ blob: resp.data, filename });
      enqueueSnackbar("Download iniciado!", { variant: "success" });
    } catch (e) {
      console.error("[download] erro:", e);
      const parsed = await parseBlobError(e);
      enqueueSnackbar(parsed.message, { variant: "error" });
    } finally {
      if (isFatura && idFat) setBaixandoAll((p) => ({ ...p, [idFat]: false }));
    }
  };

  const openModalCancel = (item, tipo) => {
    const nfs =
      tipo === "fatura_all"
        ? toArray(item.notas).filter((n) => !isNotaCancelada(n)).filter(isNotaCancelavel)
        : [item];

    const sists = toArray(nfs[0]?.sistemas || (nfs[0]?.status ? [nfs[0]] : []));
    const opcoes = sists.filter((s) => s.status === "sucesso" && !s.cancelada).map((s) => s.nome);
    const safeOpcoes = opcoes.length ? opcoes : ["prefeitura"];

    const notasPayload = nfs
      .map((n) => getIdTecnospeed(n))
      .filter(Boolean)
      .map((id) => ({ id_tecnospeed: String(id) }));

    setModal({
      open: true,
      target: tipo,
      motivo: "",
      sistema: safeOpcoes.length === 1 ? safeOpcoes[0] : "",
      opcoes: safeOpcoes,
      payload: {
        notas: notasPayload,
        faturaIdInternal: item?.id
      }
    });
  };

  const onConfirmCancel = async () => {
    setModalLoading(true);

    const { faturaIdInternal, notas } = modal.payload || {};

    if (modal.target === "fatura_all" && faturaIdInternal) {
      setCancelandoAll((p) => ({ ...p, [faturaIdInternal]: true }));
    }

    try {
      if (!Array.isArray(notas) || !notas.length) {
        enqueueSnackbar("Nenhuma nota elegível para cancelamento.", { variant: "info" });
        return;
      }

      await cancelarNota({
        sistema: modal.sistema,
        motivo: modal.motivo.trim(),
        notas
      });

      enqueueSnackbar("Solicitação enviada com sucesso!", { variant: "success" });
      setModal((m) => ({ ...m, open: false }));
      await realizarBusca();
    } catch (e) {
      enqueueSnackbar(getFriendlyApiErrorMessage(e), { variant: "error" });
    } finally {
      setModalLoading(false);
      if (modal.target === "fatura_all" && faturaIdInternal) {
        setCancelandoAll((p) => ({ ...p, [faturaIdInternal]: false }));
      }
    }
  };

  const openTratarErro = (nota) => {
    const cepDigits = getCepFromNota(nota);
    const cepFmt = formatCep(cepDigits);

    if (!cepDigits) {
      enqueueSnackbar(
        "Não encontrei o CEP automaticamente para esta nota. Informe manualmente para reemitir.",
        { variant: "warning" }
      );
    }

    setTratarModal({
      open: true,
      nota,
      cep: cepFmt
    });
  };

  const onConfirmReemitir = async () => {
    const nota = tratarModal.nota;
    if (!nota) return;

    const id_tecnospeed = String(getIdTecnospeed(nota) || "");
    const cepDigits = normalizeCepDigits(tratarModal.cep);

    if (!id_tecnospeed) {
      enqueueSnackbar("Não encontrei o id_tecnospeed dessa nota.", { variant: "error" });
      return;
    }

    if (cepDigits.length !== 8) {
      enqueueSnackbar("Informe um CEP válido (8 dígitos).", { variant: "warning" });
      return;
    }

    setReemitindo(true);
    try {
      await reemitirNota({
        id_integracao: getIdIntegracao(nota),
        id_tecnospeed: getIdTecnospeed(nota),
        cep: cepDigits
      });

      enqueueSnackbar("Reemissão solicitada com sucesso!", { variant: "success" });
      setTratarModal({ open: false, nota: null, cep: "" });
      await realizarBusca();
    } catch (e) {
      enqueueSnackbar(getFriendlyApiErrorMessage(e), { variant: "error" });
    } finally {
      setReemitindo(false);
    }
  };

  return (
    <div className="consultas">
      <h1 className="tittle-cons">Consultas</h1>

      <div className="toolbar">
        <div className="input-group">
          <select value={tipoBusca} onChange={(e) => setTipoBusca(e.target.value)} className="select-tipo">
            <option value="fatura">Fatura</option>
            <option value="nota">Nº Nota / Protocolo</option>
          </select>

          <div className="input-inline">
            <FiSearch className="icon" />
            <input
              placeholder="Busque aqui..."
              value={textoDigitado}
              onChange={(e) => setTextoDigitado(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && realizarBusca()}
            />
          </div>

          <button className="btn" onClick={realizarBusca} disabled={loading || !textoDigitado.trim()}>
            {loading ? "..." : "Pesquisar"}
          </button>

          <button
            type="button"
            className="btn btn-sync"
            onClick={handleSincronizar}
            disabled={loading || sincronizando || !hasSearched}
            title="Sincronizar as notas do resultado atual e recarregar"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <FiRefreshCw />
            {sincronizando ? "Sincronizando..." : "Sincronizar"}
          </button>

          <button
            type="button"
            className="btn btn-xs secondary"
            onClick={baixarExcelNotas}
            disabled={loading || baixandoExcelNotas || !hasSearched}
            title={!hasSearched ? "Faça uma pesquisa primeiro" : "Baixar Excel com os dados das notas"}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <FiDownload />
            {baixandoExcelNotas ? "Gerando Excel..." : "Baixar Excel"}
          </button>
        </div>
      </div>

      {hasSearched && (
        <div className="card">
          <div className="consultas-resumo">
            <div className="consultas-resumo__items">
              <div className="tittle">
                <h3>Acompanhamento de emissão</h3>
              </div>

              <div className="corpo-resumo">
                <button
                  type="button"
                  className={`consultas-resumo__item ${filtroResumo === "todas" ? "is-active" : ""}`}
                  onClick={() => toggleFiltro("todas")}
                  title="Mostrar todas"
                >
                  <strong>Total:</strong> {resumoNotas.total}
                </button>

                <button
                  type="button"
                  className={`consultas-resumo__item ${filtroResumo === "concluidas" ? "is-active" : ""}`}
                  onClick={() => toggleFiltro("concluidas")}
                  title="Mostrar somente notas concluídas"
                >
                  <strong>Concluídas:</strong> {resumoNotas.concluidas}
                </button>

                <button
                  type="button"
                  className={`consultas-resumo__item ${filtroResumo === "pendentes" ? "is-active" : ""}`}
                  onClick={() => toggleFiltro("pendentes")}
                  title="Mostrar somente notas pendentes"
                >
                  <strong>Pendentes:</strong> {resumoNotas.pendentes}
                </button>

                {resumoNotas.rejeitadas > 0 && (
                  <button
                    type="button"
                    className={`consultas-resumo__item consultas-resumo__item--rejeitadas ${filtroResumo === "rejeitadas" ? "is-active" : ""
                      }`}
                    onClick={() => toggleFiltro("rejeitadas")}
                    title="Mostrar somente rejeitadas"
                  >
                    <strong>Rejeitadas:</strong> {resumoNotas.rejeitadas}
                  </button>
                )}
              </div>
            </div>
          </div>

          {hasRejected && (
            <div className="consultas-rejeitadas">
              <div className="consultas-rejeitadas__text">
                <strong>Atenção:</strong> encontramos <strong>{rejectedRows.length}</strong> item(ns) rejeitado(s).{" "}
                <span className="consultas-rejeitadas__sub">Baixe o relatório para o time conferir e corrigir.</span>
              </div>

              <button
                type="button"
                className="btn btn-xs secondary"
                onClick={baixarRelatorioRejeitadas}
                disabled={baixandoRelatorio}
                title="Baixar relatório (.xlsx) com as notas rejeitadas e detalhes"
              >
                {baixandoRelatorio ? "Gerando..." : "Baixar relatório"}
              </button>
            </div>
          )}

          <table className="tabela tabela-accordion">
            <thead>
              {isModoFaturaUI ? (
                <tr>
                  <th>Fatura</th>
                  <th>Resumo</th>
                  <th style={{ width: 260, textAlign: "right" }}>Ações</th>
                </tr>
              ) : (
                <tr>
                  <th>Faturamento</th>
                  <th>Data/Hora</th>
                  <th>Resultados</th>
                  <th style={{ width: 140, textAlign: "right" }}>Ações</th>
                </tr>
              )}
            </thead>

            <tbody>
              {isModoFaturaUI ? (
                toArray(faturas)
                  .map((f) => {
                    const notasFiltradas = toArray(f?.notas).filter(aplicaFiltroNota);
                    return { ...f, notas: notasFiltradas };
                  })
                  .filter((f) => toArray(f?.notas).length > 0)
                  .map((f) => (
                    <LinhaFatura
                      key={f.id}
                      fatura={f}
                      isOpen={expandedFat.has(f.id)}
                      onToggle={() =>
                        setExpandedFat((p) => {
                          const n = new Set(p);
                          n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                          return n;
                        })
                      }
                      onBaixarTodas={() => handleDownload(f, "fatura")}
                      onBaixarUma={(n) => handleDownload(n, "individual")}
                      baixandoAll={!!baixandoAll[String(f?.id || f?.numero || f?.fatura || "")]}
                      onCancelarTodas={() => openModalCancel(f, "fatura_all")}
                      onCancelarUma={(n) => openModalCancel(n, "individual")}
                      cancelandoAll={!!cancelandoAll[f.id]}
                      onTratarErro={openTratarErro}
                    />
                  ))
              ) : (
                toArray(dados)
                  .filter(aplicaFiltroNota)
                  .map((item) => (
                    <LinhaNota
                      key={item.id}
                      item={item}
                      expanded={expanded}
                      onToggle={(id) =>
                        setExpanded((p) => {
                          const n = new Set(p);
                          n.has(id) ? n.delete(id) : n.add(id);
                          return n;
                        })
                      }
                      onOpenCancelar={(i) => openModalCancel(i, "individual")}
                    />
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalConfirm
        open={modal.open}
        title="Cancelar NFS-e"
        description="Selecione o sistema e descreva o motivo."
        confirmLabel="Confirmar"
        cancelLabel="Voltar"
        variant="danger"
        loading={modalLoading}
        onConfirm={onConfirmCancel}
        onClose={() => !modalLoading && setModal((m) => ({ ...m, open: false }))}
        confirmDisabled={!modal.sistema || modal.motivo.trim().length < 5}
      >
        <select
          className="select modal-sistemas-select"
          value={modal.sistema}
          onChange={(e) => setModal({ ...modal, sistema: e.target.value })}
          disabled={modal.opcoes?.length === 1}
        >
          <option value="">
            {modal.opcoes?.length === 1 ? "Sistema selecionado" : "Selecione o sistema..."}
          </option>
          {modal.opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <textarea
          className="select"
          style={{ width: "100%", minHeight: 90, marginTop: 12, padding: 10 }}
          placeholder="Motivo (mín. 5 caracteres)..."
          value={modal.motivo}
          onChange={(e) => setModal({ ...modal, motivo: e.target.value })}
        />
      </ModalConfirm>

      <ModalConfirm
        open={tratarModal.open}
        title="Tratar erro da nota"
        description="Ajuste o CEP do tomador e reemita a nota."
        confirmLabel="Reemitir"
        cancelLabel="Voltar"
        variant="primary"
        loading={reemitindo}
        onConfirm={onConfirmReemitir}
        onClose={() => !reemitindo && setTratarModal({ open: false, nota: null, cep: "" })}
        confirmDisabled={normalizeCepDigits(tratarModal.cep).length !== 8}
      >
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            CEP do tomador
          </label>
          <input
            className="select"
            value={tratarModal.cep}
            onChange={(e) =>
              setTratarModal((p) => ({
                ...p,
                cep: formatCep(e.target.value)
              }))
            }
            placeholder="00000-000"
            inputMode="numeric"
          />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            Emitente: <strong>{fixBrokenLatin(getEmitenteRazao(tratarModal.nota)) || "—"}</strong>
          </div>
        </div>
      </ModalConfirm>
    </div>
  );
}
