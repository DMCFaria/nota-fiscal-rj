import { useMemo, useState, useCallback, useEffect } from "react";
import { FiSearch, FiChevronRight, FiChevronDown, FiXCircle } from "react-icons/fi";
import { useSnackbar } from "notistack";
import { getFaturaPorNumero, buscarPorNumeroNota, cancelarNota } from "../services/fatura";
import "../styles/consultas.css";
import { downloadPdfNota, getNotaPorIdOuProtocolo } from "../services/notas";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

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

function ModalConfirm({ open, title, description, confirmLabel, cancelLabel, variant, loading, onConfirm, onClose, confirmDisabled, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog">
      <div className="modal">
        <div className="modal-header"><h3>{title}</h3></div>
        {description && <p className="modal-desc">{description}</p>}
        {children}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>{cancelLabel}</button>
          <button type="button" className={`btn ${variant === "danger" ? "danger" : ""}`} onClick={onConfirm} disabled={loading || confirmDisabled}>
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Linha({ item, expanded, onToggle, onOpenCancelar }) {
  const isOpen = expanded.has(item.id);
  const hasElegivel = item.sistemas.some((s) => s.status === "sucesso" && s.protocolo && !s.cancelada);

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button type="button" className="accordion-toggle" onClick={() => onToggle(item.id)}>
            <span className="chev">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
            {item.faturamento}
          </button>
        </td>
        <td>{new Date(item.quando).toLocaleString("pt-BR")}</td>
        <td className="resultados-compactos">
          {item.sistemas.map((s) => (
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
              {item.sistemas.map((s) => (
                <div key={s.nome} className="sist-bloco">
                  <div className="sist-header">
                    <div className="sist-title"><strong>{s.nome}</strong><Badge status={s.status} cancelada={s.cancelada} /></div>
                    <div className="sist-proto">Protocolo: <span className="mono">{s.protocolo ?? "—"}</span></div>
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
  const [textoDigitado, setTextoDigitado] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [tipoBusca, setTipoBusca] = useState("fatura");
  const [sistema, setSistema] = useState("todos");
  const [expanded, setExpanded] = useState(new Set());
  const { enqueueSnackbar } = useSnackbar();

  const [modal, setModal] = useState({ open: false, id: null, sistema: "", opcoes: [] });
  const [modalLoading, setModalLoading] = useState(false);

  // Busca principal
  const realizarBusca = useCallback(async () => {
    const termo = textoDigitado.trim();
    if (termo.length < 3) return;

    setLoading(true);
    try {
      let res;
      if (tipoBusca === "fatura") {
        res = await getNotaPorIdOuProtocolo(termo);
        setDados(res.data);
      } else {
        res = await buscarPorNumeroNota(termo);
        setDados(res.dados || []);
      }
      setHasSearched(true);
      setExpanded(new Set());
    } catch (e) {
      enqueueSnackbar("Erro ao consultar dados", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [textoDigitado, tipoBusca, enqueueSnackbar]);

  const toggleRow = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onOpenCancelar = (item) => {
    const opcoes = item.sistemas
      .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
      .map((s) => s.nome);
    setModal({ open: true, id: item.id, sistema: "", opcoes });
  };

  const onConfirmModal = async () => {
    setModalLoading(true);
    try {
      const res = await cancelarNota({ id: modal.id, sistema: modal.sistema });
      setDados(prev => prev.map(x => x.id === res.item.id ? res.item : x));
      setModal(m => ({ ...m, open: false }));
      enqueueSnackbar("Cancelamento solicitado com sucesso!", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e.message, { variant: "error" });
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="consultas">
      <h1>Consultas</h1>
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

      {hasSearched && (
        <div className="card">
          {dados.length === 0 ? (
            <div className="empty"><p>Nenhum registro encontrado.</p></div>
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
          {modal.opcoes.map(nome => <option key={nome} value={nome}>{nome}</option>)}
        </select>
      </ModalConfirm>
    </div>
  );
}