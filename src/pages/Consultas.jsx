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

function isNotaCancelavel(nota) {
  const sit = normalizeStr(nota?.situacao_prefeitura).toUpperCase();
  const st = normalizeStr(nota?.status).toUpperCase();
  return sit !== "CANCELADA" && st !== "PROCESSANDO";
}

function isNotaBaixavel(nota) {
  const st = normalizeStr(nota?.status).toLowerCase();
  const sit = normalizeStr(nota?.situacao_prefeitura).toLowerCase();

  const concluida = [
    "sucesso",
    "autorizada",
    "concluido",
    "concluída",
    "concluida",
    "emitida",
    "emitido"
  ].includes(st);

  const cancelada = sit === "cancelada" || st === "cancelada";

  return !!getIdIntegracao(nota) && concluida && !cancelada;
}

function isNotaRejeitada(nota) {
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
    !!nota?.mensagem ||
    !!nota?.erro ||
    !!nota?.error ||
    toArray(nota?.erros).length > 0 ||
    toArray(nota?.logs).length > 0 ||
    toArray(nota?.log).length > 0;

  return rejectedByStatus || rejectedBySituacao || (hasExplicitReason && (st === "erro" || st.includes("erro")));
}

function extractRejectionReason(nota) {
  const candidates = [
    nota?.motivo_rejeicao,
    nota?.motivo_erro,
    nota?.motivo,
    nota?.mensagem,
    nota?.erro,
    nota?.error,
    nota?.situacao_prefeitura
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (candidates.length) return candidates[0];

  const erros = toArray(nota?.erros);
  if (erros.length) {
    const first = erros[0];
    if (typeof first === "string") return first;
    if (first?.mensagem) return String(first.mensagem);
    if (first?.message) return String(first.message);
    return JSON.stringify(first);
  }

  const logs = toArray(nota?.logs || nota?.log);
  if (logs.length) {
    const last = logs[logs.length - 1];
    if (typeof last === "string") return last;
    if (last?.mensagem) return String(last.mensagem);
    if (last?.message) return String(last.message);
    if (last?.erro) return String(last.erro);
    return JSON.stringify(last);
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

function Badge({ status, cancelada, substituida }) {
  const base = status === "sucesso" ? "badge success" : "badge error";
  return (
    <span className={base}>
      {status === "sucesso" ? "Sucesso" : "Erro"}
      {substituida && <span className="pill">Substituída</span>}
      {cancelada && <span className="pill danger">Cancelada</span>}
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
  const notas = toArray(fatura.notas);
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
            {qtdNotas} nota(s) vinculada(s)
            {qtdRejeitadas > 0 && (
              <span style={{ marginLeft: 10, fontWeight: 600, color: "#b45309" }}>
                • {qtdRejeitadas} rejeitada(s)
              </span>
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
                              ? `R$ ${parseFloat(n.valor_servico).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2
                                })}`
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
                          Nenhuma nota vinculada nessa fatura.
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
              <strong>{s.nome}</strong> — <Badge status={s.status} cancelada={s.cancelada} substituida={s.substituida} />
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
                      <Badge status={s.status} cancelada={s.cancelada} substituida={s.substituida} />
                    </div>
                    <div className="sist-proto">
                      Protocolo: <span className="mono">{s.protocolo ?? "—"}</span>
                    </div>
                  </div>

                  {s.motivo && <div className="sist-erro-msg">Motivo: {s.motivo}</div>}
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

  const realizarBusca = useCallback(async () => {
    const termo = textoDigitado.trim();
    if (termo.length < 3) return;

    setLoading(true);

    try {
      if (isModoFatura) {
        const res = await getNotaPorFatura(termo);
        console.log("Resposta da API por fatura:", res);

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
                  id_integracao: nota.id_integracao,
                  fatura: nota.fatura,
                  numero_nfse: nota.numero_nfse,
                  status: nota.status,
                  situacao_prefeitura: nota.situacao_prefeitura,
                  pdf_url_final: nota.pdf_url_final,
                  valor_servico: nota.valor_servico,
                  prestador: nota.prestador,
                  tomador: nota.tomador,
                  datas: nota.datas
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
        console.log("Resposta da API por ID:", res);

        if (res && res.status === "success" && res.nfse) {
          setDados([
            {
              id: res.nfse.id || termo,
              faturamento: res.nfse.fatura || "—",
              quando: res.nfse.datas?.criacao || null,
              sistemas: [
                {
                  nome: "Prefeitura",
                  status: res.nfse.status === "CONCLUIDO" ? "sucesso" : "erro",
                  protocolo: res.nfse.codigo_verificacao,
                  motivo: res.nfse.situacao_prefeitura
                }
              ],
              id_integracao: res.nfse.id_integracao,
              numero: res.nfse.numero_nfse,
              fatura: res.nfse.fatura,
              status: res.nfse.status,
              situacao_prefeitura: res.nfse.situacao_prefeitura,
              pdf_url_final: res.nfse.pdf_url_final,
              valor_servico: res.nfse.valor_servico,
              prestador: res.nfse.prestador,
              tomador: res.nfse.tomador,
              emitente: res.nfse.prestador,
              // logs/erros se vierem também serão aproveitados no relatório
              logs: res.nfse.logs,
              erros: res.nfse.erros
            }
          ]);
        } else {
          setDados([]);
          enqueueSnackbar(res?.message || "Nota não encontrada", { variant: "info" });
        }

        setFaturas([]);
        setExpanded(new Set());
      }

      setHasSearched(true);
    } catch (error) {
      console.error("Erro na consulta:", error);
      enqueueSnackbar("Erro na conexão com o servidor", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [textoDigitado, isModoFatura, enqueueSnackbar]);

  /**
   * ✅ DOWNLOAD:
   * - tipo "fatura": baixa TODAS as notas baixáveis (ativas + concluídas) como downloads INDIVIDUAIS
   * - tipo "individual": baixa UMA nota
   *
   * ✅ Payload sempre no formato esperado pelo backend:
   * {
   *   tipo: "individual",
   *   idIntegracao: "...",
   *   fatura: "...",
   *   emitente: "...",
   *   nfs_emitidas: "1"
   * }
   */
  const handleDownload = async (item, tipo) => {
    const isFatura = tipo === "fatura";
    const idFat = isFatura ? String(item?.id || item?.numero || item?.fatura || "") : null;

    if (isFatura && idFat) setBaixandoAll((p) => ({ ...p, [idFat]: true }));

    try {
      if (isFatura) {
        const notas = toArray(item?.notas);
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

        const results = await Promise.allSettled(
          baixaveis.map((n) =>
            downloadPdfNota({
              tipo: "individual",
              idIntegracao: String(getIdIntegracao(n) || ""),
              fatura: faturaNumero,
              emitente: emitenteNome,
              nfs_emitidas: "1"
            })
          )
        );

        const ok = results.filter((r) => r.status === "fulfilled").length;
        const fail = results.length - ok;

        if (ok && !fail) {
          enqueueSnackbar(`Download iniciado para ${ok} nota(s)!`, { variant: "success" });
        } else if (ok && fail) {
          enqueueSnackbar(`Downloads iniciados: ${ok}. Falharam: ${fail}.`, { variant: "warning" });
        } else {
          enqueueSnackbar("Erro ao gerar PDF das notas concluídas.", { variant: "error" });
        }

        return;
      }

      // Individual
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
    const nfs = tipo === "fatura_all" ? toArray(item.notas).filter(isNotaCancelavel) : [item];

    const sists = toArray(nfs[0]?.sistemas || (nfs[0]?.status ? [nfs[0]] : []));
    const opcoes = sists
      .filter((s) => s.status === "sucesso" && !s.cancelada)
      .map((s) => s.nome);

    const safeOpcoes = opcoes.length ? opcoes : ["prefeitura"];

    setModal({
      open: true,
      target: tipo,
      motivo: "",
      sistema: safeOpcoes.length === 1 ? safeOpcoes[0] : "",
      opcoes: safeOpcoes,
      payload: {
        tipo: tipo === "fatura_all" ? "fatura" : "individual",
        idIntegracao: tipo === "fatura_all" ? "" : String(getIdIntegracao(item) || ""),
        fatura: String(item?.numero || item?.fatura || item?.numero_fatura || ""),
        emitente: nfs[0]?.emitente?.razao_social || "CONDOCORP SERVICOS DE INTERMEDIACAO",
        nfs_emitidas: String(nfs.length),
        faturaIdInternal: item?.id
      }
    });
  };

  const onConfirmCancel = async () => {
    setModalLoading(true);

    const { faturaIdInternal, ...restPayload } = modal.payload || {};

    if (modal.target === "fatura_all" && faturaIdInternal) {
      setCancelandoAll((p) => ({ ...p, [faturaIdInternal]: true }));
    }

    try {
      await cancelarNota({
        ...restPayload,
        sistema: modal.sistema,
        motivo: modal.motivo.trim()
      });

      enqueueSnackbar("Solicitação enviada com sucesso!", { variant: "success" });
      setModal((m) => ({ ...m, open: false }));
      await realizarBusca();
    } catch {
      enqueueSnackbar("Erro ao cancelar", { variant: "error" });
    } finally {
      setModalLoading(false);
      if (modal.target === "fatura_all" && faturaIdInternal) {
        setCancelandoAll((p) => ({ ...p, [faturaIdInternal]: false }));
      }
    }
  };

  /**
   * ✅ Monta linhas do relatório a partir das notas carregadas (faturas ou nota individual).
   * A ideia é: se está rejeitada, a gente exporta “o que tiver”.
   */
  const rejectedRows = useMemo(() => {
    const rows = [];

    // modo fatura: varre todas as notas
    if (tipoBusca === "fatura") {
      for (const fat of toArray(faturas)) {
        const numeroFatura = String(fat?.numero || fat?.id || "");
        const notas = toArray(fat?.notas);

        for (const n of notas) {
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

    // modo nota: usa o primeiro item em dados (se existir) como nota base
    const item = toArray(dados)[0];
    if (!item) return rows;

    // o "item" do modo nota é uma versão “formatada”; mas ele também carrega campos da nfse
    const baseNota = item;
    if (isNotaRejeitada(baseNota)) {
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
          {/* ✅ AVISO DE REJEIÇÃO + BOTÃO BAIXAR RELATÓRIO */}
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
              {isModoFatura ? (
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
              {isModoFatura ? (
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
