import { useState, useCallback } from "react";
import { FiSearch, FiChevronRight, FiChevronDown, FiXCircle } from "react-icons/fi";
import { useSnackbar } from "notistack";
import { buscarPorNumeroNota} from "../services/fatura";
import { getNotaPorFatura, downloadPdfNota, cancelarNota  } from "../services/notas";
import { fixBrokenLatin } from "../utils/normalizacao_textual";
import "../styles/consultas.css";
import "../styles/notaCard.css";
import "../styles/status-badge.css";

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// --- COMPONENTES VISUAIS (MANTIDOS IGUAIS) ---
function ModalConfirm({ open, title, description, confirmLabel, cancelLabel, variant, loading, onConfirm, onClose, confirmDisabled, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
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

// --- LÓGICA DE NORMALIZAÇÃO ---
function normalizeFaturasResponse(payload) {
  // Se não houver dado, retorna vazio
  if (!payload) return [];

  // Caso 1: O formato que você enviou (Objeto com chave 'notas')
  if (payload.fatura && Array.isArray(payload.notas)) {
    return [{
      id: String(payload.fatura), // Usamos o número da fatura como ID único do grupo
      numero: String(payload.fatura),
      quando: payload.notas[0]?.created_at || null, // Pega a data da primeira nota
      notas: payload.notas // O array de 2 notas que você mostrou
    }];
  }

  // Caso 2: Se o backend devolver um Array de faturas (várias linhas)
  if (Array.isArray(payload)) {
    return payload.map((f, idx) => ({
      id: String(f.id || f.fatura || idx),
      numero: String(f.fatura || f.numero || "—"),
      quando: f.quando || f.created_at || null,
      notas: toArray(f.notas || [])
    }));
  }

  // Caso 3: Busca individual que retorna apenas uma nota solta
  if (payload.numero_nfse || payload.id_integracao) {
    return [{
      id: String(payload.id_integracao || payload.id),
      numero: String(payload.fatura || "—"),
      quando: payload.created_at || null,
      notas: [payload]
    }];
  } 

  return [];
}

function isNotaCancelavel(nota) {
  const sit = (nota?.situacao_prefeitura || "").toUpperCase();
  const st = (nota?.status || "").toUpperCase();
  return sit !== "CANCELADA" && st !== "PROCESSANDO";
}

// --- LINHAS DA TABELA (ACCORDION) ---
function LinhaFatura({ fatura, isOpen, onToggle, onBaixarTodas, onBaixarUma, baixandoAll, onCancelarTodas, onCancelarUma, cancelandoAll }) {
  const notas = toArray(fatura.notas);
  const qtdNotas = notas.length;
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
          <span className="fatura-resumo-text">{qtdNotas} nota(s) vinculada(s)</span>
        </td>
        <td className="acoes-col" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn btn-xs" onClick={onBaixarTodas} disabled={!qtdNotas || baixandoAll}>
            {baixandoAll ? "Baixando..." : "Baixar todas"}
          </button>
          <button type="button" className="btn btn-xs danger" onClick={onCancelarTodas} disabled={!hasCancelavel || cancelandoAll}>
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
                    {notas.map((n, idx) => (
                      <tr key={n.id ?? idx}>
                        <td className="mono">{n.numero_nfse || n.numero || "—"}</td>
                        <td>{fixBrokenLatin(n.tomador?.razao_social) || "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          {n.valor_servico ? `R$ ${parseFloat(n.valor_servico).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td><span className={`status-badge status-${n.status?.toLowerCase() || "unknown"}`}>{n.status || "—"}</span></td>
                        <td className="acoes-col" style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 10 }}>
                            <button type="button" className="btn btn-xs secondary" onClick={() => onBaixarUma(n)} disabled={!n.pdf_url_final}>Baixar</button>
                            <button type="button" className="btn btn-xs danger" onClick={() => onCancelarUma(n)} disabled={!isNotaCancelavel(n)}><FiXCircle /> Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
                    <div className="sist-title"><strong>{s.nome}</strong><Badge status={s.status} cancelada={s.cancelada} substituida={s.substituida} /></div>
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

// --- COMPONENTE PRINCIPAL ---
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

  // Estados de Controle do n8n
  const [modal, setModal] = useState({ open: false, target: "", payload: null, motivo: "", sistema: "", opcoes: [] });
  const [modalLoading, setModalLoading] = useState(false);
  const [baixandoAll, setBaixandoAll] = useState({});
  const [cancelandoAll, setCancelandoAll] = useState({});

  const isModoFatura = tipoBusca === "fatura";

  const realizarBusca = useCallback(async () => {
    const termo = textoDigitado.trim();
    if (termo.length < 3) return;
    setLoading(true);
    try {
      if (isModoFatura) {
        const res = await getNotaPorFatura(termo);
        const payload = (res.status === "success" && res.nfse) ? res.nfse : res;
        setFaturas(normalizeFaturasResponse(payload));
        setDados([]);
      } else {
        const res = await buscarPorNumeroNota(termo);
        setDados(toArray(res.dados || res.item || res));
        setFaturas([]);
      }
      setHasSearched(true);
    } catch { enqueueSnackbar("Erro na consulta", { variant: "error" }); }
    finally { setLoading(false); }
  }, [textoDigitado, isModoFatura, enqueueSnackbar]);

  // --- INTEGRAÇÃO DOWNLOAD n8n ---
  const handleDownload = async (item, tipo) => {
    const isFatura = tipo === 'fatura';
    const idFat = isFatura ? item.id_integracao : (item.fatura || item.numero_fatura);
    
    if (isFatura) setBaixandoAll(p => ({ ...p, [idFat]: true }));

    try {
      const nfs = isFatura ? toArray(item.notas) : [item];
      const payload = {
        tipo: tipo, // "individual" ou "fatura"
        idIntegracao: isFatura ? "" : item.id_integracao,
        fatura: String(item.numero || item.fatura || ""),
        emitente: nfs[0]?.emitente?.razao_social || "CONDOCORP SERVICOS DE INTERMEDIACAO",
        nfs_emitidas: String(nfs.length)
      };
      await downloadPdfNota(payload);
      enqueueSnackbar("Download iniciado!", { variant: "success" });
    } catch {
      enqueueSnackbar("Erro ao gerar PDF", { variant: "error" });
    } finally {
      if (isFatura) setBaixandoAll(p => ({ ...p, [idFat]: false }));
    }
  };

  // --- INTEGRAÇÃO CANCELAMENTO n8n ---
  const openModalCancel = (item, tipo) => {
    const nfs = tipo === 'fatura_all' ? toArray(item.notas).filter(isNotaCancelavel) : [item];
    const sists = toArray(nfs[0]?.sistemas || (nfs[0]?.status ? [nfs[0]] : []));
    const opcoes = sists.filter(s => s.status === "sucesso" && !s.cancelada).map(s => s.nome);
    const safeOpcoes = opcoes.length ? opcoes : ["prefeitura"];

    setModal({
      open: true,
      target: tipo,
      motivo: "",
      sistema: safeOpcoes.length === 1 ? safeOpcoes[0] : "",
      opcoes: safeOpcoes,
      payload: {
        tipo: tipo === 'fatura_all' ? 'fatura' : 'individual',
        idIntegracao: tipo === 'fatura_all' ? "" : String(getNotaRef(item)),
        fatura: String(item.numero || item.fatura || ""),
        emitente: nfs[0]?.emitente?.razao_social || "CONDOCORP SERVICOS DE INTERMEDIACAO",
        nfs_emitidas: String(nfs.length),
        faturaIdInternal: item.id // para o loading local
      }
    });
  };

  const onConfirmCancel = async () => {
    setModalLoading(true);
    const { faturaIdInternal, ...restPayload } = modal.payload;
    if (modal.target === 'fatura_all') setCancelandoAll(p => ({ ...p, [faturaIdInternal]: true }));

    try {
      await cancelarNota({
        ...restPayload,
        sistema: modal.sistema,
        motivo: modal.motivo.trim()
      });
      enqueueSnackbar("Solicitação enviada com sucesso!", { variant: "success" });
      setModal(m => ({ ...m, open: false }));
      realizarBusca();
    } catch (e) {
      enqueueSnackbar("Erro ao cancelar", { variant: "error" });
    } finally {
      setModalLoading(false);
      setCancelandoAll(p => ({ ...p, [faturaIdInternal]: false }));
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
            <FiSearch className="icon" /><input placeholder="Busque aqui..." value={textoDigitado} onChange={(e) => setTextoDigitado(e.target.value)} onKeyDown={(e) => e.key === "Enter" && realizarBusca()} />
          </div>
          <button className="btn" onClick={realizarBusca} disabled={loading || !textoDigitado.trim()}>{loading ? "..." : "Pesquisar"}</button>
        </div>
      </div>

      {hasSearched && (
        <div className="card">
          <table className="tabela tabela-accordion">
            <thead>
              {isModoFatura ? (
                <tr><th>Fatura</th><th>Resumo</th><th style={{ width: 260, textAlign: "right" }}>Ações</th></tr>
              ) : (
                <tr><th>Faturamento</th><th>Data/Hora</th><th>Resultados</th><th style={{ width: 140, textAlign: "right" }}>Ações</th></tr>
              )}
            </thead>
            <tbody>
              {isModoFatura ? (
                faturas.map(f => (
                  <LinhaFatura 
                    key={f.id} fatura={f} isOpen={expandedFat.has(f.id)} 
                    onToggle={() => setExpandedFat(p => {const n=new Set(p); n.has(f.id)?n.delete(f.id):n.add(f.id); return n;})} 
                    onBaixarTodas={() => handleDownload(f, 'fatura')} 
                    onBaixarUma={(n) => handleDownload(n, 'individual')} 
                    baixandoAll={!!baixandoAll[f.id]}
                    onCancelarTodas={() => openModalCancel(f, 'fatura_all')}
                    onCancelarUma={(n) => openModalCancel(n, 'individual')}
                    cancelandoAll={!!cancelandoAll[f.id]}
                  />
                ))
              ) : (
                dados.map(item => (
                  <LinhaNota 
                    key={item.id} item={item} expanded={expanded} 
                    onToggle={(id) => setExpanded(p => {const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n;})} 
                    onOpenCancelar={(i) => openModalCancel(i, 'individual')} 
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
        onClose={() => !modalLoading && setModal(m => ({ ...m, open: false }))}
        confirmDisabled={!modal.sistema || modal.motivo.trim().length < 5}
      >
        <select className="select modal-sistemas-select" value={modal.sistema} onChange={(e) => setModal({ ...modal, sistema: e.target.value })} disabled={modal.opcoes?.length === 1}>
          <option value="">{modal.opcoes?.length === 1 ? "Sistema selecionado" : "Selecione o sistema..."}</option>
          {modal.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
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