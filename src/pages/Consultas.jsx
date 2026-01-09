import { useState, useCallback } from "react";
import { FiSearch, FiChevronRight, FiChevronDown, FiXCircle } from "react-icons/fi";
import { useSnackbar } from "notistack";
import { buscarPorNumeroNota, cancelarNota } from "../services/fatura";
import "../styles/consultas.css";
import { getNotaPorFatura, downloadPdfNota } from "../services/notas";
import "../styles/notaCard.css";
import NotaFaturaCard from "../components/NotaFaturaCard";

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

function LinhaFatura({ fatura, isOpen, onToggle, onBaixarTodas, onBaixarUma, baixandoAll }) {
  const qtd = fatura.notas?.length ?? 0;

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button type="button" className="accordion-toggle" onClick={onToggle}>
            <span className="chev">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
            {fatura.numero}
          </button>
          <span className="fatura-meta">
            {qtd} nota{qtd === 1 ? "" : "s"}
          </span>
        </td>

        <td>{fatura.quando ? new Date(fatura.quando).toLocaleString("pt-BR") : "—"}</td>

        <td className="resultados-compactos">
          {fatura.notas?.slice(0, 3).map((n, i) => (
            <span key={n.id ?? n.protocolo ?? i} className="sist-chip">
              <strong>Nota</strong> — <span className="mono">{n.numero ?? n.id ?? n.protocolo ?? "—"}</span>
            </span>
          ))}
          {qtd > 3 && <span className="sist-chip">+{qtd - 3}…</span>}
        </td>

        <td className="acoes-col">
          <button
            type="button"
            className="btn btn-xs"
            onClick={onBaixarTodas}
            disabled={!qtd || baixandoAll}
            title="Baixar todas as notas dessa fatura"
          >
            {baixandoAll ? "Baixando..." : "Baixar todas"}
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr className="accordion-expansion">
          <td colSpan={4}>
            <div className="expansion-wrapper">
              <div className="notas-box">
                <div className="notas-head">
                  <strong>Notas da fatura {fatura.numero}</strong>
                  <span className="notas-hint">Clique para baixar uma ou use “Baixar todas”.</span>
                </div>

                <table className="tabela notas-tabela">
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>Nº / ID</th>
                      <th>Emissão</th>
                      <th style={{ width: 160, textAlign: "right" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toArray(fatura.notas).map((n, idx) => (
                      <tr key={n.id ?? n.protocolo ?? idx}>
                        <td className="mono">{n.numero ?? n.id ?? n.protocolo ?? "—"}</td>
                        <td>
                          {n.quando || n.data || n.created_at
                            ? new Date(n.quando ?? n.data ?? n.created_at).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                        <td className="acoes-col">
                          <button type="button" className="btn btn-xs secondary" onClick={() => onBaixarUma(n)}>
                            Baixar
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!qtd && (
                      <tr>
                        <td colSpan={3} style={{ padding: 14, color: "var(--text-soft,#525a6a)" }}>
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

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button type="button" className="accordion-toggle" onClick={() => onToggle(item.id)}>
            <span className="chev">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
            {item.faturamento ?? item.fatura ?? "—"}
          </button>
        </td>

        <td>{item.quando ? new Date(item.quando).toLocaleString("pt-BR") : "—"}</td>

        <td className="resultados-compactos">
          {toArray(item.sistemas).map((s) => (
            <span key={s.nome} className="sist-chip">
              <strong>{s.nome}</strong> — <Badge status={s.status} cancelada={s.cancelada} substituida={s.substituida} />
            </span>
          ))}
        </td>

        <td className="acoes-col">
          <button
            type="button"
            className="btn btn-xs danger"
            disabled={!hasElegivel}
            onClick={() => onOpenCancelar(item)}
          >
            <FiXCircle /> Cancelar
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr className="accordion-expansion">
          <td colSpan={4}>
            <div className="expansion-wrapper">
              {toArray(item.sistemas).map((s) => (
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
  const [dados, setDados] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [textoDigitado, setTextoDigitado] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [tipoBusca, setTipoBusca] = useState("fatura");

  const [expanded, setExpanded] = useState(new Set());
  const [expandedFat, setExpandedFat] = useState(new Set());

  const { enqueueSnackbar } = useSnackbar();

  const [modal, setModal] = useState({ open: false, id: null, sistema: "", opcoes: [] });
  const [modalLoading, setModalLoading] = useState(false);

  const [baixandoAll, setBaixandoAll] = useState({});

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
        console.log("NOTA POR FATURA: ", res);
        
        if (res.status === "success" && res.nfse) {
          // Exibir detalhe da nota
          setNotaDetalhe(res.nfse);
          setFaturas([]);
        } else {
          // Manter o comportamento antigo se não for uma nota específica
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
      const ref = nota.id ?? nota.protocolo ?? nota.numero;
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
      for (const n of notas) {
       await onBaixarUmaNota(n);
      }
    } finally {
      setBaixandoAll((p) => ({ ...p, [fatura.id]: false }));
    }
  };

  const onOpenCancelar = (item) => {
    const opcoes = toArray(item.sistemas)
      .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
      .map((s) => s.nome);

    setModal({ open: true, id: item.id, sistema: "", opcoes });
  };

  const onConfirmModal = async () => {
    setModalLoading(true);
    try {
      const res = await cancelarNota({ id: modal.id, sistema: modal.sistema });

      setDados((prev) => prev.map((x) => (x.id === res.item.id ? res.item : x)));

      setModal((m) => ({ ...m, open: false }));
      enqueueSnackbar("Cancelamento solicitado com sucesso!", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e.message || "Erro ao solicitar cancelamento.", { variant: "error" });
    } finally {
      setModalLoading(false);
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
          <NotaFaturaCard nota={notaDetalhe} />
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
                    <th>Data/Hora</th>
                    <th>Resumo</th>
                    <th style={{ width: 160, textAlign: "right" }}>Ações</th>
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
                  <Linha
                    key={item.id}
                    item={item}
                    expanded={expanded}
                    onToggle={toggleRow}
                    onOpenCancelar={onOpenCancelar}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ModalConfirm
        open={modal.open}
        title="Cancelar NFS-e"
        description="Selecione o sistema para cancelar a nota."
        confirmLabel="Confirmar Cancelamento"
        cancelLabel="Voltar"
        variant="danger"
        loading={modalLoading}
        onConfirm={onConfirmModal}
        onClose={() => !modalLoading && setModal({ ...modal, open: false })}
        confirmDisabled={!modal.sistema}
      >
        <select
          className="select modal-sistemas-select"
          value={modal.sistema}
          onChange={(e) => setModal({ ...modal, sistema: e.target.value })}
        >
          <option value="">Selecione um sistema...</option>
          {modal.opcoes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </ModalConfirm>
    </div>
  );
}
