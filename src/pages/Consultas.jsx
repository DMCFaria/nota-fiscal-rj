import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  getHistorico,
  substituirNota,
  cancelarNota,
  transmitirNota,
  seedHistoricoSeVazio,
} from "../services/notas";
import {
  FiSearch,
  FiChevronRight,
  FiChevronDown,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import "../styles/consultas.css";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

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

function ModalConfirm({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  variant = "default",
  loading = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        {description && <p className="modal-desc">{description}</p>}

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
            disabled={loading}
          >
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Linha({ item, expanded, onToggle, onAskSubstituir, onAskCancelar }) {
  const isOpen = expanded.has(item.id);
  const toggle = useCallback(() => onToggle(item.id), [item.id, onToggle]);

  return (
    <>
      <tr className={`accordion-row ${isOpen ? "open" : ""}`}>
        <td className="mono">
          <button
            type="button"
            className="accordion-toggle"
            onClick={toggle}
            aria-expanded={isOpen}
            aria-controls={`detalhes-${item.id}`}
          >
            <span className="chev">
              {isOpen ? <FiChevronDown /> : <FiChevronRight />}
            </span>
            {item.faturamento}
          </button>
        </td>
        <td>{new Date(item.quando).toLocaleString("pt-BR")}</td>
        <td className="resultados-compactos">
          {item.sistemas.map((s) => (
            <span key={s.nome} className="sist-chip">
              <strong>{s.nome}</strong> —{" "}
              <Badge
                status={s.status}
                cancelada={s.cancelada}
                substituida={s.substituida}
              />
            </span>
          ))}
        </td>
      </tr>

      {isOpen && (
        <tr id={`detalhes-${item.id}`} className="accordion-expansion">
          <td colSpan={3}>
            <div className="expansion-wrapper">
              {item.sistemas.map((s) => {
                const podeAgir =
                  s.status === "sucesso" && s.protocolo && !s.cancelada;
                return (
                  <div key={s.nome} className="sist-bloco">
                    <div className="sist-header">
                      <div className="sist-title">
                        <strong>{s.nome}</strong>
                        <Badge
                          status={s.status}
                          cancelada={s.cancelada}
                          substituida={s.substituida}
                        />
                      </div>
                      <div className="sist-proto">
                        Protocolo:&nbsp;
                        <span className="mono">{s.protocolo ?? "—"}</span>
                      </div>
                    </div>

                    <div className="sist-acoes">
                      <button
                        type="button"
                        className="btn"
                        disabled={!podeAgir}
                        onClick={() => onAskSubstituir(item.id, s.nome)}
                        title={
                          podeAgir
                            ? "Substituir a NFS-e"
                            : "Ação indisponível para este status"
                        }
                      >
                        <FiRefreshCw /> Substituir nota
                      </button>

                      <button
                        type="button"
                        className="btn danger"
                        disabled={!podeAgir}
                        onClick={() => onAskCancelar(item.id, s.nome)}
                        title={
                          podeAgir
                            ? "Cancelar a NFS-e"
                            : "Ação indisponível para este status"
                        }
                      >
                        <FiXCircle /> Cancelar nota
                      </button>
                    </div>
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
  const [texto, setTexto] = useState(""); // busca livre
  const [sistema, setSistema] = useState("todos"); // todos|carioca|milhao
  const [expanded, setExpanded] = useState(() => new Set());
  const lastMockedRef = useRef("");

  const [modal, setModal] = useState({
    open: false,
    action: null,
    id: null,
    sistema: null,
  });
  const [modalLoading, setModalLoading] = useState(false);

  /* histórico */
  useEffect(() => {
    seedHistoricoSeVazio?.();
    const h = getHistorico();
    if (typeof h?.then === "function") {
      h.then((res) => setDados(res || []));
    } else {
      setDados(h || []);
    }
  }, []);

    useEffect(() => {
    const q = texto.trim();
    if (q.length < 3) return;
    if (dados.length > 0) return;
    if (lastMockedRef.current === q) return;

    (async () => {
      try {
        lastMockedRef.current = q;
        await transmitirNota({
          empresa: "MOCK S/A",
          tipo: "RPS",
          faturamento: q,
          sistemas: ["carioca", "milhao"],
        });
        const h = getHistorico();
        if (typeof h?.then === "function") {
          const res = await h;
          setDados(res || []);
        } else {
          setDados(h || []);
        }
      } catch (e) {
        console.error("Falha ao semear mock via pesquisa:", e);
      }
    })();
  }, [texto, dados.length]);

  /* accordion */
  const toggleRow = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const atualizarItem = useCallback((atualizado) => {
    setDados((prev) => prev.map((x) => (x.id === atualizado.id ? atualizado : x)));
  }, []);

  /* modal */
  const onAskSubstituir = useCallback((id, sistemaNome) => {
    setModal({
      open: true,
      action: "substituir",
      id,
      sistema: sistemaNome,
    });
  }, []);
  const onAskCancelar = useCallback((id, sistemaNome) => {
    setModal({
      open: true,
      action: "cancelar",
      id,
      sistema: sistemaNome,
    });
  }, []);

  /* confirmar do modal */
  const onConfirmModal = useCallback(async () => {
    if (!modal.open || !modal.action) return;
    setModalLoading(true);
    try {
      if (modal.action === "substituir") {
        const res = await substituirNota({ id: modal.id, sistema: modal.sistema });
        if (res?.item) atualizarItem(res.item);
      } else if (modal.action === "cancelar") {
        const res = await cancelarNota({ id: modal.id, sistema: modal.sistema });
        if (res?.item) atualizarItem(res.item);
      }
      setModal((m) => ({ ...m, open: false }));
    } catch (e) {
      console.error(e);
            alert(e.message || "Falha ao processar ação.");
    } finally {
      setModalLoading(false);
    }
  }, [modal, atualizarItem]);

  const onCloseModal = useCallback(() => {
    if (modalLoading) return;
    setModal({ open: false, action: null, id: null, sistema: null });
  }, [modalLoading]);

  /* filtro */
  const resultados = useMemo(() => {
    const t = norm(texto.trim());

    return dados.filter((item) => {
      const matchTexto =
        !t ||
        norm(item.faturamento).includes(t) ||
        item.sistemas.some((s) => {
          const nome = norm(s.nome);
          const proto = norm(s.protocolo ?? "");
          return nome.includes(t) || proto.includes(t);
        });

    const matchSistema =
        sistema === "todos" ||
        (sistema === "carioca" &&
          item.sistemas.some((s) => norm(s.nome).includes("carioca"))) ||
        (sistema === "milhao" &&
          item.sistemas.some((s) => norm(s.nome).includes("milhao")));

      return matchTexto && matchSistema;
    });
  }, [dados, texto, sistema]);

  /* labels do modal conforme ação */
  const modalTitle =
    modal.action === "substituir"
      ? "Confirmar substituição da NFS-e"
      : modal.action === "cancelar"
      ? "Confirmar cancelamento da NFS-e"
      : "";
  const modalDesc =
    modal.action === "substituir"
      ? `Você está prestes a substituir a nota no sistema "${modal.sistema}".`
      : modal.action === "cancelar"
      ? `Você está prestes a cancelar a nota no sistema "${modal.sistema}".`
      : "";
  const modalConfirm =
    modal.action === "substituir" ? "Substituir" : "Cancelar";
  const modalVariant = modal.action === "cancelar" ? "danger" : "default";

  return (
    <div className="consultas">
      <h1>Consultas</h1>
      <p>Busque transmissões por faturamento, protocolo ou sistema.</p>

      <div className="toolbar consultas-toolbar">
        <div className="input-inline consultas-input">
          <FiSearch className="icon" />
          <input
            placeholder="Digite qualquer número para simular..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        <div className="consultas-filtros">
          <select
            className="select"
            value={sistema}
            onChange={(e) => setSistema(e.target.value)}
          >
            <option value="todos">Todos os sistemas</option>
            <option value="carioca">Nota Carioca</option>
            <option value="milhao">Nota do Milhão</option>
          </select>
        </div>
      </div>

      <div className="card">
        {resultados.length === 0 ? (
          <div className="empty">
            <p>Nenhum registro encontrado.</p>
            <button
              className="btn"
              onClick={async () => {
                await transmitirNota({
                  empresa: "MOCK S/A",
                  tipo: "RPS",
                  faturamento: texto.trim() || "2024-000001",
                  sistemas: ["carioca", "milhao"],
                });
                const h = getHistorico();
                if (typeof h?.then === "function") {
                  const res = await h;
                  setDados(res || []);
                } else {
                  setDados(h || []);
                }
              }}
            >
              Gerar dados de teste
            </button>
          </div>
        ) : (
          <table className="tabela tabela-accordion">
            <thead>
              <tr>
                <th>Faturamento</th>
                <th>Data/Hora</th>
                <th>Resultados</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((item) => (
                <Linha
                  key={item.id}
                  item={item}
                  expanded={expanded}
                  onToggle={toggleRow}
                  onAskSubstituir={onAskSubstituir}
                  onAskCancelar={onAskCancelar}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <ModalConfirm
        open={modal.open}
        title={modalTitle}
        description={modalDesc}
        confirmLabel={modalConfirm}
        cancelLabel="Voltar"
        variant={modalVariant}
        loading={modalLoading}
        onConfirm={onConfirmModal}
        onClose={onCloseModal}
      />
    </div>
  );
}
