import { useState, useCallback, useMemo } from "react";
import { FiSearch, FiChevronRight, FiChevronDown, FiXCircle } from "react-icons/fi";
import { useSnackbar } from "notistack";
import * as XLSX from "xlsx";
import { getNotaPorFatura, downloadPdfNota, cancelarNota, getNotaPorID } from "../services/notas";
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

function getNotaRef(nota) {
  return (
    nota?.id_integracao ||
    nota?.idIntegracao ||
    nota?.id ||
    nota?.protocolo ||
    nota?.numero_nfse ||
    nota?.numero ||
    null
  );
}

function normalizeStr(v) {
  return String(v ?? "").trim();
}

function isNotaCancelada(nota) {
  const st = normalizeStr(nota?.status).toLowerCase();
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();
  return st === "cancelada" || sit === "cancelada";
}

function isNotaCancelavel(nota) {
  if (isNotaCancelada(nota)) return false;

  const sit = normalizeStr(nota?.situacao_prefeitura).toUpperCase();
  const st = normalizeStr(nota?.status).toUpperCase();

  return sit !== "CONCLUIDO" && st !== "PROCESSANDO";
}

function isNotaBaixavel(nota) {
  const st = normalizeStr(nota?.status).toLowerCase();
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();

  const concluida = ["sucesso", "autorizada", "concluido", "concluída", "concluida", "emitida", "emitido"].includes(st);
  const cancelada = sit === "cancelada" || st === "cancelada";

  return !!getIdIntegracao(nota) && concluida && !cancelada;
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
    sit.includes("rejeit") || sit.includes("recus") || sit.includes("deneg") || sit.includes("inval");

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

  return rejectedByStatus || rejectedBySituacao || (hasExplicitReason && (st === "erro" || st.includes("erro")));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickJsonInsideText(text) {
  const s = String(text || "").trim();
  if (!s) return null;

  const firstArr = s.indexOf("[");
  const lastArr = s.lastIndexOf("]");
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    const candidate = s.slice(firstArr, lastArr + 1);
    const parsed = safeJsonParse(candidate);
    if (parsed) return parsed;
  }

  const firstObj = s.indexOf("{");
  const lastObj = s.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    const candidate = s.slice(firstObj, lastObj + 1);
    const parsed = safeJsonParse(candidate);
    if (parsed) return parsed;
  }

  return safeJsonParse(s);
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
    const parts = s.split(/\s+ou\s+/i).map((p) => p.trim()).filter(Boolean);
    const prefer = parts.find((p) => p.toLowerCase().includes("pertence ao município"));
    if (prefer) return simplifyDescricao(prefer);
  }

  const m = s.match(/^.{0,170}?[.!?](\s|$)/);
  const firstSentence = (m?.[0] || s).trim();

  if (firstSentence.length > 120) return firstSentence.slice(0, 120).trim() + "…";
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
    const descricao = err.Descricao || err.descricao || err.message || err.mensagem || err.erro;
    if (descricao) return simplifyDescricao(descricao);

    const anyString = Object.values(err).find((v) => typeof v === "string" && v.trim());
    if (anyString) return simplifyDescricao(anyString);

    return "—";
  }

  return simplifyDescricao(String(err));
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
    const formatted = formatTecnospeedError(last?.motivo_erro || last?.mensagem || last?.message || last?.erro || last);
    if (formatted && formatted !== "—") return formatted;
  }

  return "—";
}

function flattenLogs(nota) {
  const logs = toArray(nota?.logs || nota?.log);
  if (!logs.length) return "—";

  return logs
    .map((l) => {
      if (typeof l === "string") return l;
      const when = l?.quando || l?.data || l?.created_at || l?.timestamp;
      const msg = l?.mensagem || l?.message || l?.erro || l?.descricao || "";
      const st = l?.status || "";
      const parts = [when ? `[${when}]` : "", st ? `(${st})` : "", msg].filter(Boolean);
      return parts.join(" ");
    })
    .filter(Boolean)
    .slice(0, 250)
    .join(" | ");
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
          <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
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

function LinhaFatura({
  fatura,
  isOpen,
  onToggle,
  onBaixarTodas,
  onBaixarUma,
  baixandoAll,
  onCancelarTodas,
  onCancelarUma,
  cancelandoAll
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
            <span className="chev">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
            {fatura.numero}
          </button>
        </td>

        <td className="fatura-resumo">
          <span className="fatura-resumo-text">
            {qtdNotas} nota(s) ativa(s)
            {qtdRejeitadas > 0 && (
              <span style={{ marginLeft: 10, fontWeight: 600, color: "#b45309" }}>• {qtdRejeitadas} rejeitada(s)</span>
            )}
          </span>
        </td>

        <td className="acoes-col" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            className="btn btn-xs"
            onClick={onBaixarTodas}
            disabled={!qtdBaixaveis || baixandoAll}
            title={!qtdBaixaveis ? "Nenhuma nota concluída ativa para baixar" : "Baixar PDFs das notas concluídas"}
          >
            {baixandoAll ? "Baixando..." : `Baixar todas (${qtdBaixaveis})`}
          </button>

          <button
            type="button"
            className="btn btn-xs danger"
            onClick={onCancelarTodas}
            disabled={!hasCancelavel || cancelandoAll}
          >
            <FiXCircle /> {cancelandoAll ? "Cancelando..." : "Cancelar todas"}
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
                      <th>TOMADOR</th>
                      <th style={{ width: 120, textAlign: "right" }}>VALOR</th>
                      <th style={{ width: 160 }}>STATUS</th>
                      <th style={{ width: 260, textAlign: "right" }}>AÇÕES</th>
                    </tr>
                  </thead>

                  <tbody>
                    {notas.map((n, idx) => {
                      const rejeitada = isNotaRejeitada(n);

                      return (
                        <tr key={n.id ?? idx} style={rejeitada ? { background: "rgba(245, 158, 11, 0.08)" } : undefined}>
                          <td className="mono">{n.id || n.numero || "—"}</td>

                          <td>{fixBrokenLatin(n.tomador?.razao_social) || "—"}</td>

                          <td style={{ textAlign: "right" }}>
                            {n.valor_servico
                              ? `R$ ${parseFloat(n.valor_servico).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </td>

                          <td>
                            <span className={`status-badge status-${n.status?.toLowerCase() || "unknown"}`}>
                              {n.status || "—"}
                            </span>

                            {rejeitada && (
                              <div style={{ marginTop: 6, fontSize: 12, color: "#92400e" }}>
                                Motivo: {extractRejectionReason(n)}
                              </div>
                            )}
                          </td>

                          <td className="acoes-col" style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 10 }}>
                              <button
                                type="button"
                                className="btn btn-xs secondary"
                                onClick={() => onBaixarUma(n)}
                                disabled={!isNotaBaixavel(n)}
                                title={
                                  !isNotaBaixavel(n)
                                    ? "PDF indisponível (sem idIntegracao) ou nota não concluída"
                                    : "Baixar PDF"
                                }
                              >
                                Baixar
                              </button>

                              <button
                                type="button"
                                className="btn btn-xs danger"
                                onClick={() => onCancelarUma(n)}
                                disabled={!isNotaCancelavel(n)}
                                title={!isNotaCancelavel(n) ? "Nota não elegível para cancelamento" : "Cancelar esta nota"}
                              >
                                <FiXCircle /> Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!qtdNotas && (
                      <tr>
                        <td colSpan={5} style={{ padding: 14, color: "var(--text-soft,#525a6a)" }}>
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
  const hasElegivel = sistemas.some((s) => s.status === "sucesso" && s.protocolo && !s.cancelada);

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button type="button" className="accordion-toggle" onClick={() => onToggle(item.id)}>
            <span className="chev">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
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
          <button type="button" className="btn btn-xs danger" disabled={!hasElegivel} onClick={() => onOpenCancelar(item)}>
            <FiXCircle /> Cancelar
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

                  {s.motivo && <div className="sist-erro-msg">Motivo: {formatTecnospeedError(s.motivo)}</div>}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
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

  const isModoFatura = tipoBusca === "fatura";
  const isModoFaturaUI = tipoBusca === "fatura" || tipoBusca === "nota";

  const realizarBusca = useCallback(async () => {
    const termo = textoDigitado.trim();
    if (termo.length < 3) return;

    setLoading(true);

    try {
      if (isModoFatura) {
        const res = await getNotaPorFatura(termo);

        if (res && res.status === "success") {
          if (res.tipo === "multiplas" && Array.isArray(res.notas)) {
            setFaturas([
              {
                id: String(res.fatura || termo),
                numero: String(res.fatura || termo),
                quando: res.notas[0]?.datas?.criacao || null,
                notas: res.notas.map((nota) => ({
                  ...nota,
                  id: nota.id || nota.id_tecnospeed,
                  id_tecnospeed: nota.id_tecnospeed || nota.id || nota.idTecnospeed,
                  id_integracao: nota.id_integracao,
                  fatura: nota.fatura,
                  numero_nfse: nota.numero_nfse,
                  status: nota.status,
                  situacao_prefeitura: nota.situacao_prefeitura,
                  pdf_url_final: nota.pdf_url_final,
                  valor_servico: nota.valor_servico,
                  prestador: nota.prestador,
                  tomador: nota.tomador,
                  datas: nota.datas,
                  motivo_erro: nota.motivo_erro,
                  motivo_rejeicao: nota.motivo_rejeicao,
                  motivo: nota.motivo,
                  erros: nota.erros,
                  logs: nota.logs
                }))
              }
            ]);
          } else if (res.nfse) {
            setFaturas([
              {
                id: String(res.nfse.fatura || termo),
                numero: String(res.nfse.fatura || termo),
                quando: res.nfse.datas?.criacao || null,
                notas: [res.nfse]
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
            const nfse = {
              ...res.nfse,
              id: res.nfse.id || termo,
              id_tecnospeed: res.nfse.id_tecnospeed || res.nfse.id || termo,
              id_integracao: res.nfse.id_integracao,
              numero_nfse: res.nfse.numero_nfse,
              fatura: res.nfse.fatura,
              status: res.nfse.status,
              situacao_prefeitura: res.nfse.situacao_prefeitura,
              pdf_url_final: res.nfse.pdf_url_final,
              valor_servico: res.nfse.valor_servico,
              prestador: res.nfse.prestador,
              tomador: res.nfse.tomador,
              emitente: res.nfse.prestador,
              logs: res.nfse.logs,
              erros: res.nfse.erros,
              motivo_erro: res.nfse.motivo_erro,
              motivo_rejeicao: res.nfse.motivo_rejeicao,
              motivo: res.nfse.motivo,
              datas: res.nfse.datas
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
    } catch (error) {
      console.error("Erro na consulta:", error);
      enqueueSnackbar("Erro na conexão com o servidor", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [textoDigitado, isModoFatura, enqueueSnackbar]);

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
            valor_servico: n?.valor_servico ?? "",
            status: String(n?.status || ""),
            situacao_prefeitura: String(n?.situacao_prefeitura || ""),
            motivo: extractRejectionReason(n),
            logs: flattenLogs(n)
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
        valor_servico: baseNota?.valor_servico ?? "",
        status: String(baseNota?.status || ""),
        situacao_prefeitura: String(baseNota?.situacao_prefeitura || ""),
        motivo: extractRejectionReason(baseNota),
        logs: flattenLogs(baseNota)
      });
    }

    return rows;
  }, [faturas, dados, tipoBusca]);

  const hasRejected = rejectedRows.length > 0;

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
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(
        2,
        "0"
      )}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

      const nameBase = tipoBusca === "fatura" ? "relatorio_rejeitadas_fatura" : "relatorio_rejeitadas_nota";
      const fileName = `${nameBase}_${stamp}.xlsx`;

      XLSX.writeFile(wb, fileName);
      enqueueSnackbar("Relatório gerado com sucesso!", { variant: "success" });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(e?.message || "Erro ao gerar relatório", { variant: "error" });
    } finally {
      setBaixandoRelatorio(false);
    }
  };

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
          baixaveis[0]?.emitente?.razao_social ||
          baixaveis[0]?.prestador?.razao_social ||
          "CONDOCORP SERVICOS DE INTERMEDIACAO";

        await downloadPdfNota({
          tipo: "fatura",
          idIntegracao: "",
          fatura: faturaNumero,
          emitente: emitenteNome,
          nfs_emitidas: String(baixaveis.length)
        });

        enqueueSnackbar(`Download da fatura iniciado (${baixaveis.length} nota(s))!`, { variant: "success" });
        return;
      }

      if (isNotaCancelada(item)) {
        enqueueSnackbar("Nota cancelada (não disponível).", { variant: "info" });
        return;
      }

      const idIntegracao = String(getIdIntegracao(item) || "");
      if (!idIntegracao) {
        enqueueSnackbar("Esta nota não possui idIntegracao para download.", { variant: "warning" });
        return;
      }

      const emitenteNome =
        item?.emitente?.razao_social ||
        item?.prestador?.razao_social ||
        "CONDOCORP SERVICOS DE INTERMEDIACAO";

      await downloadPdfNota({
        tipo: "individual",
        idIntegracao,
        fatura: String(item?.fatura || item?.numero_fatura || item?.numero || ""),
        emitente: emitenteNome,
        nfs_emitidas: "1"
      });

      enqueueSnackbar("Download iniciado!", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e?.message || "Erro ao gerar PDF", { variant: "error" });
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
      enqueueSnackbar(e?.message || "Erro ao cancelar", { variant: "error" });
    } finally {
      setModalLoading(false);
      if (modal.target === "fatura_all" && faturaIdInternal) {
        setCancelandoAll((p) => ({ ...p, [faturaIdInternal]: false }));
      }
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
        </div>
      </div>

      {hasSearched && (
        <div className="card">
          {hasRejected && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                marginBottom: 12,
                borderRadius: 12,
                border: "1px solid rgba(245, 158, 11, 0.35)",
                background: "rgba(245, 158, 11, 0.10)"
              }}
            >
              <div style={{ color: "#92400e" }}>
                <strong>Atenção:</strong> encontramos <strong>{rejectedRows.length}</strong> item(ns) rejeitado(s).{" "}
                <span style={{ opacity: 0.9 }}>Baixe o relatório para o time conferir e corrigir.</span>
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
                faturas.map((f) => (
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
                  />
                ))
              ) : (
                dados.map((item) => (
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
          <option value="">{modal.opcoes?.length === 1 ? "Sistema selecionado" : "Selecione o sistema..."}</option>
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
    </div>
  );
}
