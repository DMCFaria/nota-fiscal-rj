import { useState, useCallback } from "react";
import { FiSearch, FiChevronRight, FiChevronDown, FiXCircle } from "react-icons/fi";
import { useSnackbar } from "notistack";
import { buscarPorNumeroNota, cancelarNota } from "../services/fatura";
import "../styles/consultas.css";
import { getNotaPorFatura, downloadPdfNota } from "../services/notas";
import "../styles/notaCard.css";
import NotaFaturaCard from "../components/NotaFaturaCard";
import "../styles/status-badge.css";
import { fixBrokenLatin } from "../utils/normalizacao_textual";

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

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

function normalizeFaturasResponse(payload) {
  const data = payload?.data ?? payload;

  if (Array.isArray(data) && data.length && (data[0]?.notas || data[0]?.numero || data[0]?.fatura)) {
    return data.map((f, idx) => ({
      id: f.id ?? `${f.numero ?? f.fatura ?? "fatura"}-${idx}`,
      numero: f.numero ?? f.fatura ?? f.faturamento ?? "—",
      quando: f.quando ?? f.data ?? f.created_at ?? null,
      notas: toArray(f.notas ?? f.notas_fiscais ?? f.items ?? [])
    }));
  }

  if (data?.notas || data?.numero || data?.fatura) {
    return [
      {
        id: data.id ?? `${data.numero ?? data.fatura ?? "fatura"}-0`,
        numero: data.numero ?? data.fatura ?? data.faturamento ?? "—",
        quando: data.quando ?? data.data ?? data.created_at ?? null,
        notas: toArray(data.notas ?? data.notas_fiscais ?? data.items ?? [])
      }
    ];
  }

  if (Array.isArray(data)) {
    const map = new Map();
    for (const n of data) {
      const key = n.fatura ?? n.faturamento ?? n.numero_fatura ?? "—";
      if (!map.has(key)) {
        map.set(key, {
          id: `fat-${key}`,
          numero: key,
          quando: n.quando ?? n.data ?? n.created_at ?? null,
          notas: []
        });
      }
      map.get(key).notas.push(n);
    }
    return [...map.values()];
  }

  return [];
}

function getParcelasDaFatura(fatura) {
  const notas = toArray(fatura?.notas);

  const maxParcelas = notas.reduce((max, n) => {
    const p = Number(n?.parcelas);
    return Number.isFinite(p) && p > max ? p : max;
  }, 0);

  if (maxParcelas > 0) return maxParcelas;
  return notas.length || 1;
}

function getNotaRef(nota) {
  return nota?.id ?? nota?.protocolo ?? nota?.numero ?? nota?.numero_nfse ?? null;
}

function isNotaCancelavel(nota) {
  const ref = getNotaRef(nota);
  if (!ref) return false;
  if (nota?.cancelada) return false;
  if ((nota?.situacao_prefeitura || "").toUpperCase() === "CANCELADA") return false;
  if ((nota?.status || "").toUpperCase() === "PROCESSANDO") return false;
  return true;
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
  const qtdNotas = fatura.notas?.length ?? 0;
  const parcelas = getParcelasDaFatura(fatura);
  const resumo = `${qtdNotas} nota${qtdNotas === 1 ? "" : "s"} • ${parcelas} parcela${parcelas === 1 ? "" : "s"}`;

  const notas = toArray(fatura.notas);
  const hasCancelavel = notas.some(isNotaCancelavel);

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
          <span className="fatura-resumo-text">{resumo}</span>
        </td>

        <td className="acoes-col" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            className="btn btn-xs"
            onClick={onBaixarTodas}
            disabled={!qtdNotas || baixandoAll}
            title="Baixar todas as notas dessa fatura"
          >
            {baixandoAll ? "Baixando..." : "Baixar todas"}
          </button>

          <button
            type="button"
            className="btn btn-xs danger"
            onClick={onCancelarTodas}
            disabled={!hasCancelavel || cancelandoAll}
            title={hasCancelavel ? "Cancelar todas as notas canceláveis" : "Nenhuma nota elegível para cancelamento"}
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
                <div className="notas-head">
                  <strong>Notas da fatura {fatura.numero}</strong>
                  <span className="notas-hint">Clique para baixar/cancelar uma ou use as ações do topo.</span>
                </div>

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
                      const podeCancelar = isNotaCancelavel(n);

                      return (
                        <tr key={n.id ?? idx}>
                          <td className="mono">{n.numero_nfse || n.numero || n.id || "—"}</td>

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
                          </td>

                          <td className="acoes-col" style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 10 }}>
                              <button
                                type="button"
                                className="btn btn-xs secondary"
                                onClick={() => onBaixarUma(n)}
                                disabled={!n.pdf_url_final}
                                title={n.pdf_url_final ? "Baixar PDF" : "PDF não disponível"}
                              >
                                Baixar
                              </button>

                              {/* ✅ agora abre modal com motivo */}
                              <button
                                type="button"
                                className="btn btn-xs danger"
                                onClick={() => onCancelarUma(n)}
                                disabled={!podeCancelar}
                                title={podeCancelar ? "Cancelar esta nota" : "Nota não elegível para cancelamento"}
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

function Linha({ item, expanded, onToggle, onOpenCancelar }) {
  const isOpen = expanded.has(item.id);
  const hasElegivel = item.sistemas?.some((s) => s.status === "sucesso" && s.protocolo && !s.cancelada);

  const dataItem = item.criacao || item.quando || item.data || item.sistemas?.[0]?.quando || null;

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button type="button" className="accordion-toggle" onClick={() => onToggle(item.id)}>
            <span className="chev">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
            {item.faturamento ?? item.fatura ?? item.numero ?? "—"}
          </button>
        </td>

        <td>{dataItem ? new Date(dataItem).toLocaleString("pt-BR") : "—"}</td>

        <td className="resultados-compactos">
          {toArray(item.sistemas).map((s) => (
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
              {toArray(item.sistemas).map((s) => {
                const dataSistema = s.quando || s.data || s.created_at;
                const dataFormatada = dataSistema ? new Date(dataSistema).toLocaleString("pt-BR") : "—";

                return (
                  <div key={s.nome} className="sist-bloco">
                    <div className="sist-header">
                      <div className="sist-title">
                        <strong>{s.nome}</strong>
                        <Badge status={s.status} cancelada={s.cancelada} substituida={s.substituida} />
                      </div>
                      <div className="sist-proto">
                        Protocolo: <span className="mono">{s.protocolo ?? "—"}</span>
                        {dataFormatada !== "—" && <span className="sist-data"> • {dataFormatada}</span>}
                      </div>
                    </div>

                    {s.motivo && <div className="sist-erro-msg">Motivo: {s.motivo}</div>}

                    {(s.numero || s.numero_nfse) && (
                      <div className="sist-info">
                        Número: <span className="mono">{s.numero || s.numero_nfse}</span>
                      </div>
                    )}

                    {s.valor_servico && (
                      <div className="sist-info">
                        Valor:{" "}
                        <span className="mono">
                          R$ {parseFloat(s.valor_servico).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Consultas() {
  const [dados, setDados] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [textoDigitado, setTextoDigitado] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [tipoBusca, setTipoBusca] = useState("fatura");

  const [expanded, setExpanded] = useState(new Set());
  const [expandedFat, setExpandedFat] = useState(new Set());

  const { enqueueSnackbar } = useSnackbar();

  /**
   * modal:
   * - target: "lista" (antigo), "nota" (card único), "nota_fatura" (linha da tabela), "fatura_all"
   * - motivo: texto obrigatório
   */
  const [modal, setModal] = useState({
    open: false,
    id: null,
    ids: [],
    sistema: "",
    opcoes: [],
    target: "lista",
    motivo: "",
    faturaId: null
  });

  const [modalLoading, setModalLoading] = useState(false);

  const [baixandoAll, setBaixandoAll] = useState({});
  const [cancelandoAll, setCancelandoAll] = useState({});
  const [notaDetalhe, setNotaDetalhe] = useState(null);

  const isModoFatura = tipoBusca === "fatura";

  const realizarBusca = useCallback(async () => {
    const termo = textoDigitado.trim();
    if (termo.length < 3) return;

    setLoading(true);
    setNotaDetalhe(null);

    try {
      if (isModoFatura) {
        const res = await getNotaPorFatura(termo);

        if (res.status === "success" && res.nfse) {
          setNotaDetalhe(res.nfse);
          setFaturas([]);
        } else {
          const norm = normalizeFaturasResponse(res);
          setFaturas(norm);
        }

        setDados([]);
        setExpandedFat(new Set());
      } else {
        const res = await buscarPorNumeroNota(termo);
        setDados(res.dados || []);
        setFaturas([]);
        setExpanded(new Set());
      }

      setHasSearched(true);
    } catch (e) {
      enqueueSnackbar("Erro ao consultar dados", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [textoDigitado, isModoFatura, enqueueSnackbar]);

  const toggleRow = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleFatura = (id) => {
    setExpandedFat((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onBaixarUmaNota = async (nota) => {
    try {
      const ref = getNotaRef(nota);
      if (!ref) {
        enqueueSnackbar("Não foi possível identificar a nota para download.", { variant: "warning" });
        return;
      }
      await downloadPdfNota(ref);
      enqueueSnackbar("Download iniciado.", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Erro ao baixar a nota.", { variant: "error" });
    }
  };

  const onBaixarTodas = async (fatura) => {
    const notas = toArray(fatura.notas);
    if (!notas.length) return;

    setBaixandoAll((p) => ({ ...p, [fatura.id]: true }));
    try {
      for (const n of notas) await onBaixarUmaNota(n);
    } finally {
      setBaixandoAll((p) => ({ ...p, [fatura.id]: false }));
    }
  };

  const onOpenCancelar = (item) => {
    const opcoes = toArray(item.sistemas)
      .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
      .map((s) => s.nome);

    setModal({
      open: true,
      id: item.id,
      ids: [],
      sistema: "",
      opcoes,
      target: "lista",
      motivo: "",
      faturaId: null
    });
  };

  const onOpenCancelarNota = (nota) => {
    const opcoes = toArray(nota?.sistemas)
      .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
      .map((s) => s.nome);

    const idRef = getNotaRef(nota);
    const safeOpcoes = opcoes.length ? opcoes : ["prefeitura"];

    setModal({
      open: true,
      id: idRef,
      ids: [],
      sistema: safeOpcoes.length === 1 ? safeOpcoes[0] : "",
      opcoes: safeOpcoes,
      target: "nota",
      motivo: "",
      faturaId: null
    });
  };

  const onOpenCancelarNotaFatura = (nota) => {
    const opcoes = toArray(nota?.sistemas)
      .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
      .map((s) => s.nome);

    const idRef = getNotaRef(nota);
    const safeOpcoes = opcoes.length ? opcoes : ["prefeitura"];

    setModal({
      open: true,
      id: idRef,
      ids: [],
      sistema: safeOpcoes.length === 1 ? safeOpcoes[0] : "",
      opcoes: safeOpcoes,
      target: "nota_fatura",
      motivo: "",
      faturaId: null
    });
  };

  const onOpenCancelarTodasFatura = (fatura) => {
    const notas = toArray(fatura?.notas).filter(isNotaCancelavel);
    const ids = notas.map(getNotaRef).filter(Boolean);

    const opcoesFromNotas =
      toArray(notas.find((n) => toArray(n?.sistemas).length)?.sistemas)
        .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
        .map((s) => s.nome) || [];

    const safeOpcoes = opcoesFromNotas.length ? opcoesFromNotas : ["prefeitura"];

    setModal({
      open: true,
      id: null,
      ids,
      sistema: safeOpcoes.length === 1 ? safeOpcoes[0] : "",
      opcoes: safeOpcoes,
      target: "fatura_all",
      motivo: "",
      faturaId: fatura?.id ?? null
    });
  };

  const onConfirmModal = async () => {
    setModalLoading(true);
    try {
      const motivo = (modal.motivo || "").trim();

      if (modal.target === "fatura_all") {
        if (!modal.ids?.length) {
          enqueueSnackbar("Nenhuma nota elegível para cancelamento.", { variant: "warning" });
          setModal((m) => ({ ...m, open: false }));
          return;
        }

        if (modal.faturaId) setCancelandoAll((p) => ({ ...p, [modal.faturaId]: true }));

        let ok = 0;
        let fail = 0;

        for (const id of modal.ids) {
          try {
            await cancelarNota({ id, sistema: modal.sistema, motivo });
            ok++;
          } catch {
            fail++;
          }
        }

        enqueueSnackbar(
          fail ? `Cancelamento concluído: ${ok} sucesso • ${fail} falha(s).` : `Cancelamento concluído: ${ok} nota(s).`,
          { variant: fail ? "warning" : "success" }
        );
      } else {
        const res = await cancelarNota({ id: modal.id, sistema: modal.sistema, motivo });

        if (modal.target === "lista") {
          setDados((prev) => prev.map((x) => (x.id === res.item.id ? res.item : x)));
        } else {
          const updated = res?.nfse ?? res?.item ?? null;
          if (updated && modal.target === "nota") setNotaDetalhe(updated);
        }

        enqueueSnackbar("Cancelamento solicitado com sucesso!", { variant: "success" });
      }

      setModal((m) => ({ ...m, open: false }));
    } catch (e) {
      enqueueSnackbar(e.message || "Erro ao solicitar cancelamento.", { variant: "error" });
    } finally {
      if (modal?.faturaId) setCancelandoAll((p) => ({ ...p, [modal.faturaId]: false }));
      setModalLoading(false);
    }
  };

  const motivoObrigatorio = (modal.motivo || "").trim().length >= 5; // regra simples (ajuste se quiser)

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
              placeholder="Digite para buscar..."
              value={textoDigitado}
              onChange={(e) => setTextoDigitado(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && realizarBusca()}
            />
          </div>

          <button className="btn" onClick={realizarBusca} disabled={loading || !textoDigitado.trim()}>
            {loading ? "Buscando..." : "Pesquisar"}
          </button>
        </div>
      </div>

      {hasSearched && notaDetalhe && (
        <div className="card">
          <NotaFaturaCard
            nota={notaDetalhe}
            onBaixar={() => onBaixarUmaNota(notaDetalhe)}
            onCancelar={() => onOpenCancelarNota(notaDetalhe)} // ✅ abre modal com motivo
          />
        </div>
      )}

      {hasSearched && !notaDetalhe && (
        <div className="card">
          {isModoFatura ? (
            faturas.length === 0 ? (
              <div className="empty">
                <p>Nenhuma fatura encontrada.</p>
              </div>
            ) : (
              <table className="tabela tabela-accordion">
                <thead>
                  <tr>
                    <th>Fatura</th>
                    <th>Resumo</th>
                    <th style={{ width: 260, textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => (
                    <LinhaFatura
                      key={f.id}
                      fatura={f}
                      isOpen={expandedFat.has(f.id)}
                      onToggle={() => toggleFatura(f.id)}
                      onBaixarTodas={() => onBaixarTodas(f)}
                      onBaixarUma={onBaixarUmaNota}
                      baixandoAll={!!baixandoAll[f.id]}
                      onCancelarTodas={() => onOpenCancelarTodasFatura(f)} // ✅ modal com motivo
                      onCancelarUma={(nota) => onOpenCancelarNotaFatura(nota)} // ✅ modal com motivo
                      cancelandoAll={!!cancelandoAll[f.id]}
                    />
                  ))}
                </tbody>
              </table>
            )
          ) : dados.length === 0 ? (
            <div className="empty">
              <p>Nenhum registro encontrado.</p>
            </div>
          ) : (
            <table className="tabela tabela-accordion">
              <thead>
                <tr>
                  <th>Faturamento</th>
                  <th>Data/Hora</th>
                  <th>Resultados</th>
                  <th style={{ width: 140, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((item) => (
                  <Linha key={item.id} item={item} expanded={expanded} onToggle={toggleRow} onOpenCancelar={onOpenCancelar} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ModalConfirm
        open={modal.open}
        title={modal.target === "fatura_all" ? "Cancelar todas as NFS-e" : "Cancelar NFS-e"}
        description={
          modal.target === "fatura_all"
            ? `Sistema selecionado, informe o motivo para cancelar ${modal.ids?.length || 0} nota(s).`
            : "Sistema selecionado, informe o motivo do cancelamento."
        }
        confirmLabel={modal.target === "fatura_all" ? "Confirmar Cancelamento (todas)" : "Confirmar Cancelamento"}
        cancelLabel="Voltar"
        variant="danger"
        loading={modalLoading}
        onConfirm={onConfirmModal}
        onClose={() => !modalLoading && setModal({ ...modal, open: false })}
        confirmDisabled={
          !modal.sistema ||
          !motivoObrigatorio ||
          (modal.target === "fatura_all" && !modal.ids?.length)
        }
      >
        <select
          className="select modal-sistemas-select"
          value={modal.sistema}
          onChange={(e) => setModal({ ...modal, sistema: e.target.value })}
          disabled={modal.opcoes?.length === 1}
        >
          <option value="">
            {modal.opcoes?.length === 1 ? "Sistema selecionado" : "Selecione um sistema..."}
          </option>
          {modal.opcoes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>

        {/* ✅ motivo obrigatório */}
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontWeight: 800, fontSize: 13, marginBottom: 6, color: "var(--text,#0d0d0e)" }}>
            Motivo do cancelamento
          </label>
          <textarea
            className="select"
            style={{
              width: "100%",
              minHeight: 96,
              resize: "vertical",
              padding: 12,
              lineHeight: 1.35
            }}
            placeholder="Descreva o motivo (mín. 5 caracteres)..."
            value={modal.motivo}
            onChange={(e) => setModal({ ...modal, motivo: e.target.value })}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: motivoObrigatorio ? "#16a34a" : "#6b7280" }}>
            {motivoObrigatorio ? "Ok." : "Digite pelo menos 5 caracteres."}
          </div>
        </div>
      </ModalConfirm>
    </div>
  );
}
