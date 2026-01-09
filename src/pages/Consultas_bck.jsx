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
  FiFileText,
} from "react-icons/fi";
import "../styles/consultas.css";
import { getFaturaPorNumero } from "../services/fatura";
import { useSnackbar } from "notistack";
import { downloadPdfNota, getNotaPorIdOuProtocolo } from "../services/notas_django";

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

// Novo componente para exibir os detalhes da nota
function NotaDetalhes({ nota }) {
  const [baixando, setBaixando] = useState(false);

  if (!nota) return null;

  const handleDownload = async () => {
    if (!nota.nfse?.id) return;
    
    setBaixando(true);
    try {
      await downloadPdfNota(nota.nfse.id);
    } catch (error) {
      alert("Erro ao baixar PDF: " + error.message);
    } finally {
      setBaixando(false);
    }
  };

  // Formatações simplificadas
  const formatDate = (date) => date ? new Date(date).toLocaleString('pt-BR') : "—";
  const formatMoney = (val) => val || val === 0 ? 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : "—";

  return (
    <div className="card">
      <div className="nota-header">
        <h3><FiFileText /> Nota Fiscal</h3>
        <div className="nota-status">
          <span className="badge success">{nota.nfse?.status || "—"}</span>
        </div>
      </div>

      <div className="nota-grid">
        {/* Dados básicos - mantém o mesmo */}
        <div className="nota-section">
          <h4>Informações</h4>
          <div className="info-row">
            <span>Número:</span>
            <span className="mono">{nota.nfse?.numeroNfse || "—"}</span>
          </div>
          <div className="info-row">
            <span>Protocolo:</span>
            <span className="mono">{nota.nfse?.protocol || "—"}</span>
          </div>
          <div className="info-row">
            <span>Emissão:</span>
            <span>{formatDate(nota.nfse?.rps?.dataEmissao)}</span>
          </div>
        </div>

        {/* Prestador */}
        <div className="nota-section">
          <h4>Prestador</h4>
          <div className="info-row">
            <span>CNPJ:</span>
            <span className="mono">{nota.nfse?.prestador?.cpfCnpj || "—"}</span>
          </div>
          <div className="info-row">
            <span>Razão Social:</span>
            <span>{nota.nfse?.prestador?.razaoSocial || "—"}</span>
          </div>
        </div>

        {/* Tomador */}
        <div className="nota-section">
          <h4>Tomador</h4>
          <div className="info-row">
            <span>CNPJ:</span>
            <span className="mono">{nota.nfse?.tomador?.cpfCnpj || "—"}</span>
          </div>
          <div className="info-row">
            <span>Razão Social:</span>
            <span>{nota.nfse?.tomador?.razaoSocial || "—"}</span>
          </div>
        </div>

        {/* Serviço */}
        <div className="nota-section full-width">
          <h4>Serviço</h4>
          {nota.nfse?.servico?.map((serv, i) => (
            <div key={i} className="servico-item">
              <div className="info-row">
                <span>Descrição:</span>
                <span>{serv.discriminacao || "—"}</span>
              </div>
              <div className="info-row">
                <span>Valor:</span>
                <span>{formatMoney(serv.valor?.servico)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Botão de download SIMPLIFICADO */}
        <div className="nota-section full-width">
          <h4>Documentos</h4>
          <div className="documentos-actions">
            <button
              onClick={handleDownload}
              disabled={baixando}
              className="btn"
            >
              <FiFileText /> 
              {baixando ? "Baixando..." : "Baixar PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function Consultas() {
  const [dados, setDados] = useState([]);
  const [faturaData, setFaturaData] = useState([]);
  const [notaData, setNotaData] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const [textoDigitado, setTextoDigitado] = useState("");
  const [texto, setTexto] = useState("");

  const [sistema, setSistema] = useState("todos");
  const [expanded, setExpanded] = useState(() => new Set());
  const lastMockedRef = useRef("");

  const { enqueueSnackbar } = useSnackbar();

  // Função para buscar por número da nota
  const buscarPorNumeroNota = useCallback(async (termo) => {
    try {
      const resultado = await getNotaPorIdOuProtocolo(termo);
      console.log("getNotaPorIdOuProtocolo", resultado)
      
      if (resultado?.status === "success") {
        return {
          tipo: resultado.nfse?.protocol ? "protocolo" : "id",
          dados: resultado
        };
      }
      return { tipo: "nao_encontrado", dados: null };
    } catch (error) {
      console.error("Erro ao buscar nota:", error);
      return { tipo: "erro", dados: null };
    }
  }, []);

  // Efeito para busca automática com debounce
  useEffect(() => {
    const buscarDados = async () => {
      const termo = textoDigitado.trim();
      
      if (termo.length >= 3) {
        setLoading(true);
        setHasSearched(true);
        
        try {
          // Primeiro tenta buscar como nota (protocolo ou ID)
          const resultadoNota = await buscarPorNumeroNota(termo);
          
          if (resultadoNota.tipo !== "nao_encontrado" && resultadoNota.dados) {
            setNotaData(resultadoNota.dados);
            setFaturaData([]);
            setDados([]);
            enqueueSnackbar(`Nota encontrada (${resultadoNota.tipo})`, { variant: 'success' });
          } else {
            // Se não encontrou como nota, tenta buscar como fatura
            setNotaData(null);
            const numero = parseInt(termo);
            if (!isNaN(numero)) {
              const response = await getFaturaPorNumero(numero);
              
              if (response && response.status === "success") {
                setFaturaData(response.data || []);
                if (response.data && response.data.length > 0) {
                  enqueueSnackbar(`Fatura ${numero} encontrada com ${response.data.length} registros`, { variant: 'success' });
                } else {
                  enqueueSnackbar(`Fatura ${numero} não encontrada`, { variant: 'warning' });
                }
              }
            } else {
              setFaturaData([]);
              enqueueSnackbar('Digite um número válido para busca', { variant: 'warning' });
            }
          }
        } catch (error) {
          console.error("Erro ao buscar:", error);
          enqueueSnackbar('Erro ao buscar dados', { variant: 'error' });
          setFaturaData([]);
          setNotaData(null);
          setDados([]);
        } finally {
          setLoading(false);
        }
      } else {
        setFaturaData([]);
        setNotaData(null);
        setDados([]);
        if (hasSearched) {
          setHasSearched(false);
        }
      }
    };
    
    // Debounce
    const timeoutId = setTimeout(() => {
      if (textoDigitado.trim()) {
        buscarDados();
      } else {
        setFaturaData([]);
        setNotaData(null);
        setDados([]);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [textoDigitado, buscarPorNumeroNota, enqueueSnackbar, hasSearched]);

  const [modal, setModal] = useState({
    open: false,
    id: null,
    sistema: "",
    opcoes: [],
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Função de pesquisa manual (para o botão)
  const onPesquisar = useCallback(async () => {
    const q = textoDigitado.trim();
    setTexto(q);
    setHasSearched(true);

    if (!q) {
      setDados([]);
      setExpanded(new Set());
      setFaturaData([]);
      setNotaData(null);
      return;
    }

    // Busca mock data apenas se não houver resultados reais
    if (!faturaData.length && !notaData) {
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
    }
  }, [textoDigitado, dados.length, faturaData, notaData]);

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
      sistema: "",
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
            placeholder="Digite número da fatura, protocolo ou ID da nota fiscal..."
            value={textoDigitado}
            onChange={(e) => setTextoDigitado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onPesquisar();
            }}
            disabled={loading}
          />
          {loading && <span className="loading-spinner"></span>}
        </div>

        <button
          type="button"
          className="btn"
          onClick={onPesquisar}
          disabled={!textoDigitado.trim() || loading}
          title="Pesquisar"
        >
          <FiSearch /> {loading ? "Buscando..." : "Pesquisar"}
        </button>

        <div className="consultas-filtros">
          {/* <select
            className="select"
            value={sistema}
            onChange={(e) => setSistema(e.target.value)}
            disabled={!hasSearched || resultados.length === 0}
            title={!hasSearched ? "Faça uma pesquisa para habilitar os filtros" : undefined}
          >
            <option value="todos">Todos os sistemas</option>
            <option value="carioca">Nota Carioca</option>
            <option value="milhao">Nota do Milhão</option>
          </select> */}
        </div>
      </div>

      {/* Exibir resultados da nota */}
      {notaData && (
        <NotaDetalhes nota={notaData} />
      )}

      {/* Exibir resultados da fatura */}
      {faturaData.length > 0 && (
        <div className="card">
          <h3>Fatura {textoDigitado.trim()}</h3>
          <div className="fatura-info">
            <p>{faturaData.length} registros encontrados</p>
            {/* Aqui você pode adicionar mais detalhes da fatura se necessário */}
          </div>
        </div>
      )}

      {/* Exibir histórico mock quando não há resultados reais */}
      {hasSearched && !notaData && faturaData.length === 0 && (
        <div className="card">
          {resultados.length === 0 ? (
            <div className="empty">
              <p>Nenhum registro encontrado para "{textoDigitado}".</p>
            </div>
          ) : (
            <>
              <h3>Histórico de Transmissões</h3>
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
            </>
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