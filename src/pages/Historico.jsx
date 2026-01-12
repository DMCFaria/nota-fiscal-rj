// Historico.jsx
import { useMemo, useState } from "react";
import { 
  FiClock, 
  FiFilter, 
  FiSearch, 
  FiFileText, 
  FiUser, 
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiEye,
  FiEyeOff,
  FiDownload,
  FiSend
} from "react-icons/fi";
import "../styles/historico.css";
import { getHistoricoFatura, getHistoricoNota } from "../services/historico";

// Componente de badge melhorado
function BadgeTipo({ tipo }) {
  const config = {
    "INFO": { label: "Info", classe: "badge-info", icon: <FiInfo /> },
    "SUCESSO": { label: "Sucesso", classe: "badge-success", icon: <FiCheckCircle /> },
    "ERRO": { label: "Erro", classe: "badge-error", icon: <FiAlertCircle /> },
    "ALERTA": { label: "Alerta", classe: "badge-warning", icon: <FiAlertCircle /> }
  }[tipo] || { label: tipo, classe: "badge-default", icon: null };
  
  return (
    <span className={`badge ${config.classe}`}>
      {config.icon} {config.label}
    </span>
  );
}

function BadgeOrigem({ origem }) {
  const config = {
    "EMISSAO": { label: "Emissão", classe: "badge-emissao", icon: <FiSend /> },
    "PRE_EMISSAO": { label: "Pré-Emissão", classe: "badge-pre-emissao", icon: <FiFileText /> },
    "CONSULTA": { label: "Consulta", classe: "badge-consulta", icon: <FiSearch /> },
    "DOWNLOAD": { label: "Download", classe: "badge-download", icon: <FiDownload /> },
    "CANCELAMENTO": { label: "Cancelamento", classe: "badge-cancelamento", icon: <FiAlertCircle /> },
    "CONSULTA_NOTA": { label: "Consulta NFSe", classe: "badge-consulta", icon: <FiSearch /> }
  }[origem] || { label: origem, classe: "badge-default", icon: null };
  
  return (
    <span className={`badge ${config.classe}`}>
      {config.icon} {config.label}
    </span>
  );
}

// Componente para exibir detalhes formatados
function DetalhesFormatados({ detalhes }) {
  if (!detalhes || Object.keys(detalhes).length === 0) {
    return <div className="sem-detalhes">Sem detalhes adicionais</div>;
  }
  
  // Se for o detalhe grande do preview, mostra de forma especial
  if (detalhes.distribuicao_estado) {
    const { fatura, total_itens, distribuicao_estado } = detalhes;
    return (
      <div className="detalhes-preview">
        <h4>Pré-visualização de Emissão</h4>
        <div className="preview-summary">
          <p><strong>Fatura:</strong> {fatura}</p>
          <p><strong>Total de Itens:</strong> {total_itens}</p>
        </div>
        {distribuicao_estado && (
          <div className="distribuicao-estados">
            <h5>Distribuição por Estado:</h5>
            {Object.entries(distribuicao_estado).map(([estado, dados]) => (
              dados.total > 0 && (
                <div key={estado} className="estado-item">
                  <span className="estado-sigla">{estado}</span>
                  <span className="estado-qtd">{dados.total} item(s)</span>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Para outros tipos de detalhes
  return (
    <div className="detalhes-simples">
      {Object.entries(detalhes).map(([chave, valor]) => {
        // Formata valores especiais
        let valorFormatado = valor;
        if (chave === 'fatura' && typeof valor === 'string') {
          valorFormatado = <span className="mono">{valor}</span>;
        } else if (chave === 'ip') {
          valorFormatado = <code>{valor}</code>;
        } else if (chave === 'total_notas' || chave === 'total_itens') {
          valorFormatado = <strong>{valor}</strong>;
        }
        
        return (
          <div key={chave} className="detalhe-item">
            <span className="detalhe-chave">{chave}:</span>
            <span className="detalhe-valor">{valorFormatado}</span>
          </div>
        );
      })}
    </div>
  );
}

function LinhaHistorico({ item }) {
  const [detalhesExpandidos, setDetalhesExpandidos] = useState(false);
  
  // Detecta se há detalhes para expandir
  const hasDetalhes = item.detalhes && Object.keys(item.detalhes).length > 0;
  
  // Extrai a fatura dos detalhes se disponível
  const fatura = item.detalhes?.fatura || "";
  
  return (
    <>
      <tr className="tabela-linha">
        
        {/* FATURA */}
        <td className="tabela-cell">
          <div className="cell-content">
            {fatura ? (
              <a 
                href={`/consultas?fatura=${fatura}`}
                className="link-fatura mono"
                title={`Ver detalhes da fatura ${fatura}`}
              >
                {fatura}
              </a>
            ) : (
              <span className="mono">{item.fatura || item.nota_id || "—"}</span>
            )}
          </div>
        </td>
        
        {/* DATA */}
        <td className="tabela-cell">
          <div className="cell-content">
            <FiClock className="icon-inline" />
            <span className="data-formatada">{item.data}</span>
          </div>
        </td>
        
        {/* TIPO */}
        {/* <td className="tabela-cell">
          <BadgeTipo tipo={item.tipo} />
        </td> */}
        
        {/* ORIGEM */}
        {/* <td className="tabela-cell">
          <BadgeOrigem origem={item.origem} />
        </td> */}
        
        {/* USUARIO */}
        <td className="tabela-cell">
          <div className="cell-content">
            <FiUser className="icon-inline" />
            <span className="usuario-nome">{item.usuario}</span>
          </div>
        </td>
        
        {/* MENSAGEM */}
        {/* <td className="tabela-cell mensagem-cell">
          <div className="mensagem-texto" title={item.mensagem}>
            {item.mensagem}
          </div>
        </td> */}
        
        {/* DETALHES */}
        <td className="tabela-cell">
          {hasDetalhes && (
            <button 
              className="btn-detalhes"
              onClick={() => setDetalhesExpandidos(!detalhesExpandidos)}
              title={detalhesExpandidos ? "Ocultar detalhes" : "Ver detalhes"}
            >
              {detalhesExpandidos ? <FiEyeOff /> : <FiEye />}
            </button>
          )}
        </td>

      </tr>
      
      {detalhesExpandidos && hasDetalhes && (
        <tr className="detalhes-row">
          <td colSpan="7">
            <div className="detalhes-expandidos">
              <div className="detalhes-header">
                <h4>Detalhes do Evento</h4>
                <button 
                  className="btn-fechar-detalhes"
                  onClick={() => setDetalhesExpandidos(false)}
                >
                  ×
                </button>
              </div>
              <DetalhesFormatados detalhes={item.detalhes} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Historico() {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [modoBusca, setModoBusca] = useState("fatura");
  const [termoBusca, setTermoBusca] = useState("");
  const [erro, setErro] = useState(null);
  const [jaBuscou, setJaBuscou] = useState(false);

  const buscarHistorico = async (tipo, termo) => {
    if (!termo.trim()) {
      setErro("Digite um termo para buscar");
      return;
    }
    
    setLoading(true);
    setErro(null);
    setJaBuscou(true);
    
    try {
      let dados;
      
      if (tipo === "fatura") {
        let numero_fatura = termo
        dados = await getHistoricoFatura(numero_fatura);
        console.log("HISTORICO POR FATURA: ", dados)
      } else {
        let notaId = termo
        dados = await getHistoricoNota(notaId);
        console.log("HISTORICO POR NOTA - DADOS CRUS:", dados)
        console.log("HISTORICO POR NOTA - logs:", dados?.logs)
        console.log("HISTORICO POR NOTA - sucesso:", dados?.sucesso)
        console.log("HISTORICO POR NOTA - total:", dados?.total)
      }
      
      if (dados.sucesso) {
        console.log("DADOS SETADOS NO STATE:", dados.logs)
        setItens(dados.logs || []);
      } else {
        setErro(dados.erro || "Erro ao buscar histórico");
        setItens([]);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      console.error("Detalhes do erro:", error.response?.data || error.message);
      setErro("Erro na conexão com o servidor: " + (error.message || "Erro desconhecido"));
      setItens([]);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    
    return itens.filter(item => {
      const buscaMensagem = item.mensagem?.toLowerCase().includes(f);
      const buscaUsuario = item.usuario?.toLowerCase().includes(f);
      const buscaOrigem = item.origem?.toLowerCase().includes(f);
      const buscaTipo = item.tipo?.toLowerCase().includes(f);
      const buscaFatura = item.detalhes?.fatura?.toLowerCase().includes(f);
      
      return buscaMensagem || buscaUsuario || buscaOrigem || buscaTipo || buscaFatura;
    });
  }, [filtro, itens]);

  const estatisticas = useMemo(() => {
    if (!itens.length) return null;
    
    const total = itens.length;
    const sucessos = itens.filter(i => i.tipo === "SUCESSO").length;
    const erros = itens.filter(i => i.tipo === "ERRO").length;
    const alertas = itens.filter(i => i.tipo === "ALERTA").length;
    const infos = itens.filter(i => i.tipo === "INFO").length;
    
    // Agrupa por origem
    const porOrigem = {};
    itens.forEach(item => {
      if (!porOrigem[item.origem]) porOrigem[item.origem] = 0;
      porOrigem[item.origem]++;
    });
    
    return {
      total,
      sucessos,
      erros,
      alertas,
      infos,
      porOrigem,
      percentualSucesso: total > 0 ? Math.round((sucessos / total) * 100) : 0,
      percentualErro: total > 0 ? Math.round((erros / total) * 100) : 0
    };
  }, [itens]);

  const handleSubmit = (e) => {
    e.preventDefault();
    buscarHistorico(modoBusca, termoBusca);
  };

  // Extrai faturas únicas dos logs
  const faturasUnicas = useMemo(() => {
    const faturas = new Set();
    itens.forEach(item => {
      if (item.detalhes?.fatura) {
        faturas.add(item.detalhes.fatura);
      }
    });
    return Array.from(faturas);
  }, [itens]);

  return (
    <div className="historico-container">
      
      <div className="historico-header">
        <div className="header-content">
          <h1 className="titulo">Histórico de Transações</h1>
          <p className="subtitulo">Acompanhe todas as atividades do sistema por fatura ou nota</p>
        </div>
      </div>

      {/* Painel de Busca */}
      <div className="card busca-card">
        <form onSubmit={handleSubmit} className="form-busca-historico">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="modoBusca">
                <FiSearch /> Buscar por:
              </label>
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
                  placeholder={modoBusca === "fatura" ? "Ex: 162028" : "Ex: 695c0f7b3c4938a3ad10411a"}
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
                    <>
                      <FiSearch /> Buscar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {erro && (
            <div className="alert alert-error">
              <FiAlertCircle /> <strong>Erro:</strong> {erro}
            </div>
          )}
        </form>
      </div>

      {/* Painel de Estatísticas */}
      {estatisticas && (
        <div className="card estatisticas-card">
          <h3>
            <FiInfo /> Estatísticas da Busca
            {faturasUnicas.length > 0 && (
              <span className="faturas-badge">
                {faturasUnicas.length} {faturasUnicas.length === 1 ? 'fatura' : 'faturas'}
              </span>
            )}
          </h3>
          
          <div className="estatisticas-grid">
            <div className="estatistica-item estatistica-total">
              <div className="estatistica-valor">{estatisticas.total}</div>
              <div className="estatistica-label">Total de Eventos</div>
            </div>
            
            <div className="estatistica-item estatistica-sucesso">
              <div className="estatistica-valor">{estatisticas.sucessos}</div>
              <div className="estatistica-label">Sucessos</div>
              <div className="estatistica-percentual">{estatisticas.percentualSucesso}%</div>
            </div>
            
            <div className="estatistica-item estatistica-erro">
              <div className="estatistica-valor">{estatisticas.erros}</div>
              <div className="estatistica-label">Erros</div>
              <div className="estatistica-percentual">{estatisticas.percentualErro}%</div>
            </div>
            
            <div className="estatistica-item estatistica-info">
              <div className="estatistica-valor">{estatisticas.infos}</div>
              <div className="estatistica-label">Informações</div>
            </div>
          </div>
          
          {/* Distribuição por Origem */}
          {estatisticas.porOrigem && Object.keys(estatisticas.porOrigem).length > 0 && (
            <div className="distribuicao-origens">
              <h4>Distribuição por Origem:</h4>
              <div className="origens-list">
                {Object.entries(estatisticas.porOrigem).map(([origem, quantidade]) => (
                  <div key={origem} className="origem-item">
                    <BadgeOrigem origem={origem} />
                    <span className="origem-qtd">{quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Faturas Encontradas */}
          {faturasUnicas.length > 0 && (
            <div className="faturas-encontradas">
              <h4>Faturas Relacionadas:</h4>
              <div className="faturas-list">
                {faturasUnicas.map(fatura => (
                  <a 
                    key={fatura}
                    href={`/consultas?fatura=${fatura}`}
                    className="fatura-link"
                    title={`Ver consulta da fatura ${fatura}`}
                  >
                    {fatura}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra de Ferramentas */}
      {itens.length > 0 && (
        <div className="toolbar">
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input
              className="search-input"
              type="text"
              placeholder="Filtrar por mensagem, usuário ou origem..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar histórico"
              disabled={loading}
            />
            {filtro && (
              <button 
                className="btn-limpar-filtro"
                onClick={() => setFiltro("")}
                title="Limpar filtro"
              >
                ×
              </button>
            )}
          </div>
          
          <div className="toolbar-stats">
            <span className="results-count">
              {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
              {filtro && itens.length > filtrados.length && ` (filtrado de ${itens.length})`}
            </span>
            
            {filtro && filtrados.length < itens.length && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setFiltro("")}
              >
                <FiFilter /> Limpar Filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabela de Resultados */}
      <div className="card tabela-card">
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Buscando histórico...</p>
            <p className="empty-state-sub">Consultando registros do sistema</p>
          </div>
        ) : !jaBuscou ? (
          <div className="empty-state empty-state-initial">
            <FiSearch className="empty-icon" />
            <h3>Faça uma busca</h3>
            <p>
              Digite um número de fatura ou ID de nota para consultar o histórico de atividades
            </p>
            <div className="empty-state-examples">
              <div className="example-group">
                <strong>Exemplos de Fatura:</strong>
                <code>162028</code>
                <code>162029</code>
                <code>162030</code>
              </div>
              <div className="example-group">
                <strong>Exemplos de ID:</strong>
                <code>695c0f7b3c4938a3ad10411a</code>
                <code>NFSE_162028_1</code>
              </div>
            </div>
          </div>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <FiAlertCircle className="empty-icon" />
            <h3>Nenhum histórico encontrado</h3>
            <p>
              Nenhum registro encontrado para "<strong>{termoBusca}</strong>"
            </p>
            <p className="empty-state-suggestion">
              Verifique se o termo está correto ou tente buscar de outra forma
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setTermoBusca("");
                setJaBuscou(false);
              }}
            >
              Nova Busca
            </button>
          </div>
        ) : filtrados.length === 0 ? (
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
              <FiFilter /> Limpar Filtro
            </button>
          </div>
        ) : (
          <div className="tabela-wrapper">
            <div className="tabela-scroll">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Fatura</th>
                    <th>Data/Hora</th>
                    {/* <th>Tipo</th>
                    <th>Origem</th> */}
                    <th>Usuário</th>
                    {/* <th>Mensagem</th> */}
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((item, index) => (
                    <LinhaHistorico key={`${item.id}-${index}`} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="tabela-footer">
              <div className="pagination-info">
                Mostrando {filtrados.length} de {itens.length} registros
              </div>
              <div className="export-options">
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    const dataStr = JSON.stringify(itens, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `historico-${termoBusca}-${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                  }}
                >
                  <FiDownload /> Exportar JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}