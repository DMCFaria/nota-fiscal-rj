// Historico.jsx
import { useEffect, useMemo, useState } from "react";
import { getHistoricoFatura, getHistoricoNota } from "../services/notas";
import { FiClock, FiFilter, FiSearch, FiFileText, FiUser } from "react-icons/fi";
import "../styles/historico.css";

function BadgeTipo({ tipo }) {
  const tipos = {
    "INFO": { label: "Info", classe: "badge-info" },
    "SUCESSO": { label: "Sucesso", classe: "badge-success" },
    "ERRO": { label: "Erro", classe: "badge-error" },
    "ALERTA": { label: "Alerta", classe: "badge-warning" }
  };
  
  const config = tipos[tipo] || { label: tipo, classe: "badge-default" };
  
  return <span className={`badge ${config.classe}`}>{config.label}</span>;
}

function BadgeOrigem({ origem }) {
  const origens = {
    "EMISSAO": { label: "Emissão", classe: "badge-emissao" },
    "PRE_EMISSAO": { label: "Pré-Emissão", classe: "badge-pre-emissao" },
    "CONSULTA": { label: "Consulta", classe: "badge-consulta" },
    "DOWNLOAD": { label: "Download", classe: "badge-download" },
    "CANCELAMENTO": { label: "Cancelamento", classe: "badge-cancelamento" }
  };
  
  const config = origens[origem] || { label: origem, classe: "badge-default" };
  
  return <span className={`badge ${config.classe}`}>{config.label}</span>;
}

function LinhaHistorico({ item }) {
  const [detalhesExpandidos, setDetalhesExpandidos] = useState(false);
  
  // Verifica se há detalhes para expandir
  const hasDetalhes = item.detalhes && 
    (Object.keys(item.detalhes).length > 1 || 
     (Object.keys(item.detalhes).length === 1 && 
      Object.keys(item.detalhes)[0] !== "texto"));
  
  return (
    <tr className="tabela-linha">
      <td className="tabela-cell">
        <div className="cell-content">
          <span className="mono">{item.fatura || item.nota_id || "—"}</span>
        </div>
      </td>
      <td className="tabela-cell">
        <div className="cell-content">
          <FiClock className="icon-inline" />
          <span>{item.data}</span>
        </div>
      </td>
      <td className="tabela-cell">
        <BadgeTipo tipo={item.tipo} />
      </td>
      <td className="tabela-cell">
        <BadgeOrigem origem={item.origem} />
      </td>
      <td className="tabela-cell">
        <div className="cell-content">
          <FiUser className="icon-inline" />
          <span>{item.usuario}</span>
        </div>
      </td>
      <td className="tabela-cell">
        <div className="mensagem-cell">
          <span className="mensagem-texto">{item.mensagem}</span>
          {hasDetalhes && (
            <button 
              className="btn-detalhes"
              onClick={() => setDetalhesExpandidos(!detalhesExpandidos)}
            >
              <FiFileText /> {detalhesExpandidos ? "Ocultar" : "Detalhes"}
            </button>
          )}
        </div>
        {detalhesExpandidos && hasDetalhes && (
          <div className="detalhes-expandidos">
            <pre>{JSON.stringify(item.detalhes, null, 2)}</pre>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Historico() {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false); // Inicia como false, não true
  const [modoBusca, setModoBusca] = useState("fatura");
  const [termoBusca, setTermoBusca] = useState("");
  const [estatisticas, setEstatisticas] = useState(null);
  const [erro, setErro] = useState(null);
  const [jaBuscou, setJaBuscou] = useState(false); // Nova flag para controlar se já fez uma busca

  const buscarHistorico = async (tipo, termo) => {
    if (!termo.trim()) {
      setErro("Digite um termo para buscar");
      return;
    }
    
    setLoading(true);
    setErro(null);
    setJaBuscou(true); // Marca que já fez uma busca
    
    try {
      let dados;
      
      if (tipo === "fatura") {
        dados = await getHistoricoFatura(termo);
      } else {
        dados = await getHistoricoNota(termo);
      }
      
      if (dados.sucesso) {
        setItens(dados.logs || []);
        setEstatisticas(dados.estatisticas || null);
      } else {
        setErro(dados.erro || "Erro ao buscar histórico");
        setItens([]);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      setErro("Erro na conexão com o servidor");
      setItens([]);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    
    return itens.filter(item =>
      (item.fatura || "").toLowerCase().includes(f) ||
      (item.mensagem || "").toLowerCase().includes(f) ||
      (item.usuario || "").toLowerCase().includes(f) ||
      (item.origem || "").toLowerCase().includes(f) ||
      (item.tipo || "").toLowerCase().includes(f) ||
      (item.nota_id || "").toLowerCase().includes(f)
    );
  }, [filtro, itens]);

  const handleSubmit = (e) => {
    e.preventDefault();
    buscarHistorico(modoBusca, termoBusca);
  };

  // Estatísticas calculadas localmente
  const estatisticasLocais = useMemo(() => {
    if (!itens.length) return null;
    
    const total = itens.length;
    const sucessos = itens.filter(i => i.tipo === "SUCESSO").length;
    const erros = itens.filter(i => i.tipo === "ERRO").length;
    const alertas = itens.filter(i => i.tipo === "ALERTA").length;
    const infos = itens.filter(i => i.tipo === "INFO").length;
    
    return {
      total,
      sucessos,
      erros,
      alertas,
      infos,
      percentualSucesso: total > 0 ? Math.round((sucessos / total) * 100) : 0
    };
  }, [itens]);

  return (
    <div className="historico-container">
      <div className="historico-header">
        <div className="header-content">
          <h1 className="titulo">Histórico de Transações</h1>
          <p className="subtitulo">Consulte o histórico de emissões, consultas e ações do sistema</p>
        </div>
      </div>

      <div className="card busca-card">
        <form onSubmit={handleSubmit} className="form-busca-historico">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="modoBusca">Buscar por:</label>
              <select 
                id="modoBusca"
                value={modoBusca}
                onChange={(e) => setModoBusca(e.target.value)}
                className="select-busca"
                disabled={loading}
              >
                <option value="fatura">Número da Fatura</option>
                <option value="nota">ID da Nota</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="termoBusca">
                {modoBusca === "fatura" ? "Número da Fatura:" : "ID/Integração:"}
              </label>
              <div className="input-with-button">
                <input
                  id="termoBusca"
                  type="text"
                  placeholder={modoBusca === "fatura" ? "Ex: 162028" : "Ex: NFSE_162028_1"}
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="input-busca"
                  disabled={loading}
                  required
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading || !termoBusca.trim()}
                >
                  {loading ? (
                    <>
                      <span className="spinner-mini"></span> Buscando...
                    </>
                  ) : (
                    "Buscar"
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {erro && (
            <div className="alert alert-error">
              <strong>Erro:</strong> {erro}
            </div>
          )}
        </form>
      </div>

      {estatisticasLocais && (
        <div className="card estatisticas-card">
          <h3>Estatísticas da Busca</h3>
          <div className="estatisticas-grid">
            <div className="estatistica-item">
              <div className="estatistica-valor">{estatisticasLocais.total}</div>
              <div className="estatistica-label">Total de Logs</div>
            </div>
            <div className="estatistica-item">
              <div className="estatistica-valor">{estatisticasLocais.sucessos}</div>
              <div className="estatistica-label">Sucessos</div>
            </div>
            <div className="estatistica-item">
              <div className="estatistica-valor">{estatisticasLocais.erros}</div>
              <div className="estatistica-label">Erros</div>
            </div>
            <div className="estatistica-item">
              <div className="estatistica-valor">{estatisticasLocais.percentualSucesso}%</div>
              <div className="estatistica-label">Taxa de Sucesso</div>
            </div>
          </div>
        </div>
      )}

      {itens.length > 0 && (
        <div className="toolbar">
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input
              className="search-input"
              type="text"
              placeholder="Filtrar resultados..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar histórico"
              disabled={loading}
            />
          </div>
          <div className="results-count">
            {filtrados.length} {filtrados.length === 1 ? "registro" : "registros"}
            {filtro && itens.length > filtrados.length && 
              ` (filtrado de ${itens.length})`
            }
          </div>
        </div>
      )}

      <div className="card tabela-card">
        {/* Estado: Carregando */}
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Buscando histórico...</p>
            <p className="empty-state-sub">Isso pode levar alguns instantes</p>
          </div>
        ) : /* Estado: Nenhuma busca realizada ainda */
        !jaBuscou ? (
          <div className="empty-state empty-state-initial">
            <FiSearch className="empty-icon" />
            <h3>Faça uma busca</h3>
            <p>
              Digite um número de fatura ou ID de nota para consultar o histórico
            </p>
            <p className="empty-state-example">
              Exemplos: <code>162028</code> ou <code>NFSE_162028_1</code>
            </p>
          </div>
        ) : /* Estado: Busca realizada mas sem resultados */
        itens.length === 0 ? (
          <div className="empty-state">
            <FiClock className="empty-icon" />
            <h3>Nenhum histórico encontrado</h3>
            <p>
              Nenhum registro encontrado para "<strong>{termoBusca}</strong>"
            </p>
            <p className="empty-state-suggestion">
              Verifique se o termo está correto ou tente buscar de outra forma
            </p>
          </div>
        ) : /* Estado: Busca com resultados mas filtro não encontrou nada */
        filtrados.length === 0 ? (
          <div className="empty-state">
            <FiFilter className="empty-icon" />
            <h3>Nenhum resultado encontrado</h3>
            <p>
              O filtro "<strong>{filtro}</strong>" não corresponde a nenhum registro
            </p>
            <button 
              className="btn btn-secondary"
              onClick={() => setFiltro("")}
            >
              Limpar filtro
            </button>
          </div>
        ) : /* Estado: Resultados encontrados */
        (
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Fatura/Nota</th>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Origem</th>
                  <th>Usuário</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item, index) => (
                  <LinhaHistorico key={item.id || index} item={item} />
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <div className="sem-resultados">
                Nenhum registro corresponde ao filtro
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}