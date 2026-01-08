import { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
import { getFaturaPorNumero } from "../services/fatura";
import { useSnackbar } from "notistack";

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
  confirmDisabled = false,
  children,
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
            title={
              confirmDisabled ? "Selecione um sistema para prosseguir" : undefined
            }
          >
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Linha({ item, expanded, onToggle, onOpenCancelar }) {
  const isOpen = expanded.has(item.id);
  const toggle = useCallback(() => onToggle(item.id), [item.id, onToggle]);

  const hasElegivel = item.sistemas.some(
    (s) => s.status === "sucesso" && s.protocolo && !s.cancelada
  );

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

        <td className="acoes-col">
          <button
            type="button"
            className="btn btn-xs danger"
            disabled={!hasElegivel}
            onClick={() => onOpenCancelar(item)}
            title={
              hasElegivel
                ? "Cancelar uma nota deste faturamento"
                : "Não há nota elegível para cancelamento"
            }
          >
            <FiXCircle /> Cancelar
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr id={`detalhes-${item.id}`} className="accordion-expansion">
          <td colSpan={4}>
            <div className="expansion-wrapper">
              {item.sistemas.map((s) => (
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
  const [faturaData, setFaturaData] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [notaData, setNotaData] = useState(null); // Novo estado para dados da nota
  const [tipoBusca, setTipoBusca] = useState("fatura"); // 'fatura' ou 'nota'

  const [textoDigitado, setTextoDigitado] = useState("");
  const [texto, setTexto] = useState("");

  const [sistema, setSistema] = useState("todos");
  const [expanded, setExpanded] = useState(() => new Set());
  const lastMockedRef = useRef("");

  const { enqueueSnackbar } = useSnackbar();

  // console.log("Texto digitado:", textoDigitado);
  // console.log("Fatura:", faturaData);

  useEffect(() => {
      const buscarDados = async () => {
        const termo = textoDigitado.trim();
        
        if (termo.length >= 3) {
          setLoading(true);
          
          try {
            if (tipoBusca === "fatura") {
              const numero = parseInt(termo);
              if (!isNaN(numero)) {
                const response = await getFaturaPorNumero(numero);
                console.log("Resposta da fatura:", response);
                
                if (response && response.status === "success") {
                  setFaturaData(response.data || []);
                  setNotaData(null);
                  if (response.data && response.data.length > 0) {
                    enqueueSnackbar(`Fatura ${numero} encontrada com ${response.data.length} registros`, { variant: 'success' });
                  } else {
                    enqueueSnackbar(`Fatura ${numero} não encontrada`, { variant: 'warning' });
                  }
                }
              }
            } else if (tipoBusca === "nota") {
              // Busca por número da nota (protocolo ou ID)
              const resultado = await buscarPorNumeroNota(termo);
              
              if (resultado.tipo === "nao_encontrado") {
                setNotaData(null);
                enqueueSnackbar(`Nota ${termo} não encontrada`, { variant: 'warning' });
              } else {
                setNotaData(resultado.dados);
                setFaturaData([]);
                enqueueSnackbar(`Nota encontrada (${resultado.tipo})`, { variant: 'success' });
              }
            }
          } catch (error) {
            console.error("Erro ao buscar:", error);
            enqueueSnackbar('Erro ao buscar dados', { variant: 'error' });
            setFaturaData([]);
            setNotaData(null);
          } finally {
            setLoading(false);
          }
        } else {
          setFaturaData([]);
          setNotaData(null);
        }
      };
      
      // Debounce
      const timeoutId = setTimeout(() => {
        if (textoDigitado.trim()) {
          buscarDados();
        } else {
          setFaturaData([]);
          setNotaData(null);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }, [textoDigitado, tipoBusca, enqueueSnackbar]);

  const [modal, setModal] = useState({
    open: false,
    id: null,
    sistema: "", // AGORA começa vazio
    opcoes: [],
  });
  const [modalLoading, setModalLoading] = useState(false);

  const onPesquisar = useCallback(async () => {
    const q = textoDigitado.trim();
    setTexto(q);
    setHasSearched(true);

    if (!q) {
      setDados([]);
      setExpanded(new Set());
      return;
    }

    seedHistoricoSeVazio?.();

    if (q.length < 3) {
      setDados([]);
      setExpanded(new Set());
      return;
    }

    if (lastMockedRef.current === q && dados.length > 0) return;

    try {
      lastMockedRef.current = q;

      await transmitirNota({
        empresa: "MOCK S/A",
        tipo: "RPS",
        faturamento: q,
        sistemas: ["carioca", "milhao"],
      });

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

  const onOpenCancelar = useCallback((item) => {
    const opcoes = (item.sistemas || [])
      .filter((s) => s.status === "sucesso" && s.protocolo && !s.cancelada)
      .map((s) => s.nome)
      .sort((a, b) => {
        // só pra ordem ficar bonita, mas usuário escolhe no modal
        const A = norm(a);
        const B = norm(b);
        const aIsMilhao = A.includes("milhao");
        const bIsMilhao = B.includes("milhao");
        if (aIsMilhao && !bIsMilhao) return -1;
        if (!aIsMilhao && bIsMilhao) return 1;
        return a.localeCompare(b);
      });

    setModal({
      open: true,
      id: item.id,
      sistema: "", // 👈 placeholder por padrão
      opcoes,
    });
  }, []);

  const onCloseModal = useCallback(() => {
    if (modalLoading) return;
    setModal({ open: false, id: null, sistema: "", opcoes: [] });
  }, [modalLoading]);

  const onConfirmModal = useCallback(async () => {
    if (!modal.open || !modal.id || !modal.sistema) return;
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

  const modalTitle = "Confirmar cancelamento da NFS-e";
  const modalDesc = "Selecione qual nota deseja cancelar para prosseguir.";

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
            title={!hasSearched ? "Faça uma pesquisa para habilitar os filtros" : undefined}
          >
            <option value="todos">Todos os sistemas</option>
            <option value="carioca">Nota Carioca</option>
            <option value="milhao">Nota do Milhão</option>
          </select>
        </div>
      </div>

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
                  <th style={{ width: 140, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((item) => (
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
        title={modalTitle}
        description={modalDesc}
        confirmLabel="Cancelar"
        cancelLabel="Voltar"
        variant="danger"
        loading={modalLoading}
        onConfirm={onConfirmModal}
        onClose={onCloseModal}
        confirmDisabled={!modal.sistema}
      >
        <div className={`modal-sistemas ${!modal.sistema ? "is-required" : ""}`}>
          <div className="modal-sistemas-header">
            <span className="label-sist">Sistema</span>
            {!modal.sistema && (
              <span className="modal-sistemas-hint">
                Selecione uma opção para prosseguir
              </span>
            )}
          </div>

          <select
            className="select modal-sistemas-select"
            value={modal.sistema}
            onChange={(e) =>
              setModal((m) => ({ ...m, sistema: e.target.value }))
            }
            disabled={modalLoading || modal.opcoes.length === 0}
          >
            <option value="" disabled>
              Selecione uma opção para prosseguir
            </option>

            {modal.opcoes.length === 0 ? (
              <option value="" disabled>
                Sem opções disponíveis
              </option>
            ) : (
              modal.opcoes.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))
            )}
          </select>
        </div>
      </ModalConfirm>
    </div>
  );
}
