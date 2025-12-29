import { useMemo, useState, useCallback, useRef } from "react";
import {
  getHistorico,
  cancelarNota,
  transmitirNota,
  seedHistoricoSeVazio,
} from "../services/notas";
import {
  FiSearch,
  FiChevronRight,
  FiChevronDown,
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

function Linha({ item, expanded, onToggle, onAskCancelar }) {
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
                const podeCancelar =
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
                        className="btn danger"
                        disabled={!podeCancelar}
                        onClick={() => onAskCancelar(item.id, s.nome)}
                        title={
                          podeCancelar
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
  const [hasSearched, setHasSearched] = useState(false);

  // digita aqui, mas só aplica quando clicar pesquisar
  const [textoDigitado, setTextoDigitado] = useState("");
  const [texto, setTexto] = useState("");

  const [sistema, setSistema] = useState("todos"); // todos|carioca|milhao
  const [expanded, setExpanded] = useState(() => new Set());
  const lastMockedRef = useRef("");

  const [modal, setModal] = useState({
    open: false,
    action: null, // "cancelar"
    id: null,
    sistema: null,
  });
  const [modalLoading, setModalLoading] = useState(false);

  /* pesquisar: só aqui a tela ganha vida */
  const onPesquisar = useCallback(async () => {
    const q = textoDigitado.trim();
    setTexto(q);
    setHasSearched(true);

    // limpa a lista se pesquisar vazio (tela fica "limpa" de novo)
    if (!q) {
      setDados([]);
      setExpanded(new Set());
      return;
    }

    // semeia histórico apenas quando pesquisar
    seedHistoricoSeVazio?.();

    if (q.length < 3) {
      setDados([]);
      setExpanded(new Set());
      return;
    }

    // evita repetir a mesma simulação (e não fica acumulando lixo)
    if (lastMockedRef.current === q && dados.length > 0) return;

    try {
      lastMockedRef.current = q;

      // simula o retorno gerando uma transmissão
      await transmitirNota({
        empresa: "MOCK S/A",
        tipo: "RPS",
        faturamento: q,
        sistemas: ["carioca", "milhao"],
      });

      // carrega e filtra depois
      const h = getHistorico();
      const res = typeof h?.then === "function" ? await h : h;
      setDados(res || []);
      setExpanded(new Set());
    } catch (e) {
      console.error("Falha ao pesquisar:", e);
      setDados([]);
      setExpanded(new Set());
    }
  }, [textoDigitado, dados.length]);

  /* accordion */
  const toggleRow = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const atualizarItem = useCallback((atualizado) => {
    setDados((prev) =>
      prev.map((x) => (x.id === atualizado.id ? atualizado : x))
    );
  }, []);

  /* modal: cancelar */
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
    if (!modal.open || modal.action !== "cancelar") return;
    setModalLoading(true);

    try {
      const res = await cancelarNota({ id: modal.id, sistema: modal.sistema });
      if (res?.item) atualizarItem(res.item);
      setModal((m) => ({ ...m, open: false }));
    } catch (e) {
      console.error(e);
      alert(e.message || "Falha ao processar cancelamento.");
    } finally {
      setModalLoading(false);
    }
  }, [modal, atualizarItem]);

  const onCloseModal = useCallback(() => {
    if (modalLoading) return;
    setModal({ open: false, action: null, id: null, sistema: null });
  }, [modalLoading]);

  /* filtro (só filtra em cima do que veio) */
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

  /* labels do modal */
  const modalTitle = modal.action === "cancelar" ? "Confirmar cancelamento da NFS-e" : "";
  const modalDesc =
    modal.action === "cancelar"
      ? `Você está prestes a cancelar a nota no sistema "${modal.sistema}".`
      : "";
  const modalConfirm = "Cancelar";
  const modalVariant = "danger";

  return (
    <div className="consultas">
      <h1>Consultas</h1>
      <p>Busque transmissões por faturamento, protocolo ou sistema.</p>

      <div className="toolbar consultas-toolbar">
        <div className="input-inline consultas-input">
          <FiSearch className="icon" />
          <input
            placeholder="Digite número da fatura ou da nota fiscal para realizar a busca..."
            value={textoDigitado}
            onChange={(e) => setTextoDigitado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onPesquisar();
            }}
          />
        </div>

        <button
          type="button"
          className="btn"
          onClick={onPesquisar}
          disabled={!textoDigitado.trim()}
          title="Pesquisar"
        >
          <FiSearch /> Pesquisar
        </button>

        <div className="consultas-filtros">
          <select
            className="select"
            value={sistema}
            onChange={(e) => setSistema(e.target.value)}
            disabled={!hasSearched || resultados.length === 0}
            title={
              !hasSearched
                ? "Faça uma pesquisa para habilitar os filtros"
                : undefined
            }
          >
            <option value="todos">Todos os sistemas</option>
            <option value="carioca">Nota Carioca</option>
            <option value="milhao">Nota do Milhão</option>
          </select>
        </div>
      </div>

      {/* Só mostra card depois de pesquisar */}
      {hasSearched && (
        <div className="card">
          {resultados.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {resultados.map((item) => (
                  <Linha
                    key={item.id}
                    item={item}
                    expanded={expanded}
                    onToggle={toggleRow}
                    onAskCancelar={onAskCancelar}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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
