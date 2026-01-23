// Historico.jsx
import { useEffect, useMemo, useState } from "react";
import { 
  FiClock, 
  FiSearch, 
  FiUser, 
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiDownload,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiInfo,
  FiPackage,
  FiSend
} from "react-icons/fi";
import "../styles/historico.css";
import { getHistoricoFatura, getHistoricoNota } from "../services/historico";
import { authService } from "../services/authService";

// Mapeamento de cores para tipos
const tipoConfig = {
  "INFO": { cor: "#3B82F6", bg: "#DBEAFE", icon: FiInfo, label: "Info" },
  "ERRO": { cor: "#EF4444", bg: "#FEE2E2", icon: FiXCircle, label: "Erro" },
  "ALERTA": { cor: "#F59E0B", bg: "#FEF3C7", icon: FiAlertTriangle, label: "Alerta" },
  "SUCESSO": { cor: "#10B981", bg: "#D1FAE5", icon: FiCheckCircle, label: "Sucesso" }
};

// Mapeamento de origens para ícones
const origemConfig = {
  "CONSULTA": { icon: FiSearch, cor: "#8B5CF6", label: "Consulta" },
  "EMISSAO": { icon: FiSend, cor: "#059669", label: "Emissão" },
  "PREVIEW": { icon: FiEye, cor: "#0EA5E9", label: "Preview" },
  "RPS": { icon: FiPackage, cor: "#D97706", label: "RPS" },
  "CANCELAMENTO": { icon: FiXCircle, cor: "#DC2626", label: "Cancelamento" }
};

// Badge de Tipo
function BadgeTipo({ tipo }) {
  const config = tipoConfig[tipo] || tipoConfig["INFO"];
  const Icon = config.icon;
  return (
    <span className="badge-tipo" style={{ 
      backgroundColor: config.bg,
      color: config.cor
    }}>
      <Icon size={12} />
      <span>{config.label}</span>
    </span>
  );
}

// Badge de Origem
function BadgeOrigem({ origem }) {
  const config = origemConfig[origem] || { icon: FiSearch, cor: "#6B7280", label: origem };
  const Icon = config.icon;
  return (
    <span className="badge-origem" style={{ color: config.cor }}>
      <Icon size={12} />
      <span>{config.label}</span>
    </span>
  );
}

// Componente para exibir detalhes formatados
function DetalhesFormatados({ detalhes }) {
  if (!detalhes || Object.keys(detalhes).length === 0) {
    return <div className="sem-detalhes">Sem detalhes adicionais</div>;
  }
  
  // Se for o detalhe do preview
  if (detalhes.distribuicao_estado) {
    const { fatura, total_itens, distribuicao_estado } = detalhes;
    
    // Filtra apenas estados com itens
    const estadosComItens = Object.entries(distribuicao_estado).filter(([_, dados]) => dados.total > 0);
    
    return (
      <div className="detalhes-preview">
        <div className="preview-summary">
          <div className="preview-stat">
            <FiPackage size={16} />
            <span><strong>Fatura:</strong> <code className="mono-highlight">{fatura}</code></span>
          </div>
          <div className="preview-stat">
            <span><strong>Itens:</strong> <strong className="valor-destaque">{total_itens}</strong></span>
          </div>
        </div>
        {estadosComItens.length > 0 && (
          <div className="distribuicao-estados">
            <span className="distribuicao-titulo">Estados:</span>
            <div className="estados-grid">
              {estadosComItens.map(([estado, dados]) => (
                <div key={estado} className="estado-item">
                  <span className="estado-sigla">{estado}</span>
                  <span className="estado-qtd">{dados.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Para outros detalhes
  return (
    <div className="detalhes-simples">
      {Object.entries(detalhes).map(([chave, valor]) => {
        // Formata valores especiais
        let valorFormatado = valor;
        
        if (chave === 'fatura' || chave === 'nota_id' || chave === 'protocolo') {
          valorFormatado = <code className="mono-highlight">{valor}</code>;
        } else if (chave === 'total_notas' || chave === 'total_itens') {
          valorFormatado = <strong className="valor-destaque">{valor}</strong>;
        } else if (chave === 'erro' || chave === 'error') {
          valorFormatado = <span className="texto-erro">{valor}</span>;
        } else if (typeof valor === 'object') {
          valorFormatado = JSON.stringify(valor, null, 2);
        }
        
        return (
          <div key={chave} className="detalhe-item">
            <span className="detalhe-chave">{chave.replace('_', ' ')}:</span>
            <span className="detalhe-valor">{valorFormatado}</span>
          </div>
        );
      })}
    </div>
  );
}

function LinhaHistorico({ item }) {
  const [detalhesExpandidos, setDetalhesExpandidos] = useState(false);
  
  const hasDetalhes = item.detalhes && Object.keys(item.detalhes).length > 0;
  const fatura = item.detalhes?.fatura || "";
  const configTipo = tipoConfig[item.tipo] || tipoConfig.INFO;
  
  const IconTipo = configTipo.icon;
  
  // Formata a mensagem da ação
  const formatarAcao = (acao) => {
    if (acao.includes("_")) {
      const partes = acao.split("_");
      if (partes.length > 1) {
        return partes[1].toLowerCase();
      }
    }
    return acao.toLowerCase();
  };
  
  // Formata a mensagem
  const formatarMensagem = (mensagem, fatura) => {
    if (!fatura) return mensagem;
    
    // Remove a fatura se já estiver na mensagem
    if (mensagem.includes(fatura)) {
      return mensagem;
    }
    
    return mensagem;
  };

  return (
    <>
      <tr className="tabela-linha">
        {/* TIPO */}
        <td className="tabela-cell">
          <BadgeTipo tipo={item.tipo} />
        </td>
        
        {/* ORIGEM */}
        <td className="tabela-cell">
          <BadgeOrigem origem={item.origem} />
        </td>
        
        {/* AÇÃO */}
        <td className="tabela-cell">
          <div className="acao-texto">
            {formatarAcao(item.acao)}
          </div>
        </td>
        
        {/* MENSAGEM */}
        <td className="tabela-cell mensagem-cell">
          <div className="mensagem-texto">
            {formatarMensagem(item.mensagem, fatura)}
          </div>
        </td>
        
        {/* USUÁRIO */}
        <td className="tabela-cell">
          <div className="cell-content">
            <FiUser className="icon-inline" />
            <span className="usuario-nome">{item.usuario}</span>
          </div>
        </td>
        
        {/* DATA */}
        <td className="tabela-cell">
          <div className="cell-content">
            <FiClock className="icon-inline" />
            <span className="data-formatada">{item.data}</span>
          </div>
        </td>
        
        {/* DETALHES */}
        <td className="tabela-cell">
          {hasDetalhes && (
            <button 
              className={`btn-detalhes ${detalhesExpandidos ? 'active' : ''}`}
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
                <div className="detalhes-title">
                  <h4>Detalhes</h4>
                  <div className="detalhes-subtitle">
                    <BadgeTipo tipo={item.tipo} />
                    <BadgeOrigem origem={item.origem} />
                  </div>
                </div>
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

// Componente de Resumo Estatístico SIMPLIFICADO
function ResumoEstatistico({ itens, termoBusca, modoBusca, usuario }) {
  if (!itens.length) return null;
  
  const ultimoItem = itens[0];
  const minhasAcoes = itens.filter(item => item.usuario === usuario?.username).length;
  
  return (
    <div className="resumo-card">
      <div className="resumo-titulo">
        <h3>
          {modoBusca === 'fatura' ? 'Fatura:' : 'Nota:'} 
          <span className="resumo-destaque">{termoBusca}</span>
        </h3>
        <p className="resumo-subtitulo">
          {itens.length} ação(ões) • {minhasAcoes} minhas ações
        </p>
      </div>
      
      <div className="resumo-timeline">
        <div className="timeline-item">
          <span className="timeline-label">Última ação:</span>
          <span className="timeline-value">{ultimoItem.data}</span>
        </div>
        <div className="timeline-item">
          <span className="timeline-label">Status:</span>
          <BadgeTipo tipo={ultimoItem.tipo} />
        </div>
      </div>
    </div>
  );
}

export default function Historico() {
  const [itens, setItens] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [modoBusca, setModoBusca] = useState("fatura");
  const [termoBusca, setTermoBusca] = useState("");
  const [erro, setErro] = useState(null);
  const [jaBuscou, setJaBuscou] = useState(false);
  
  useEffect(() => {
    const recuperarUsuario = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (token) {
          const response = await authService.getMe(token);
          setUsuario({
            email: response.email,
            username: response.username,
            nomeCompleto: response.nome_completo || response.username
          });
        }
      } catch (error) {
        console.error("Erro ao localizar usuário:", error);
      }
    };
    recuperarUsuario();
  }, []);
 
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
        dados = await getHistoricoFatura(termo);
      } else {
        dados = await getHistoricoNota(termo);
      }

      // console.log("dados", dados)
      
      if (dados.sucesso) {
        // Ordena por data (mais recente primeiro)
        const logsOrdenados = (dados.logs || []).sort((a, b) => {
          return new Date(b.data) - new Date(a.data);
        });
        
        // FILTRA APENAS AÇÕES DO USUÁRIO LOGADO
        const logsUsuario = logsOrdenados.filter(item => 
          usuario?.username && item.usuario === usuario.username
        );
        
        setItens(logsUsuario);
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
    let resultado = itens;
    
    // Filtro de texto
    const f = filtro.trim().toLowerCase();
    if (f) {
      resultado = resultado.filter(item => {
        const buscaMensagem = item.mensagem?.toLowerCase().includes(f);
        const buscaOrigem = item.origem?.toLowerCase().includes(f);
        const buscaTipo = item.tipo?.toLowerCase().includes(f);
        const buscaAcao = item.acao?.toLowerCase().includes(f);
        
        return buscaMensagem || buscaOrigem || buscaTipo || buscaAcao;
      });
    }
    
    return resultado;
  }, [filtro, itens]);

  const handleSubmit = (e) => {
    e.preventDefault();
    buscarHistorico(modoBusca, termoBusca);
  };

  return (
    <div className="historico-container">
      
      <div className="historico-header">
        <div className="header-content">
          <h1 className="titulo">
            Histórico de Atividades
          </h1>
          <p className="subtitulo">
            Acompanhe suas ações realizadas no sistema
          </p>
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
                  placeholder={modoBusca === "fatura" ? "Ex: 158356" : "Ex: RPS_12345_..."}
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

      {/* Resumo Estatístico */}
      {itens.length > 0 && (
        <ResumoEstatistico 
          itens={itens} 
          termoBusca={termoBusca}
          modoBusca={modoBusca}
          usuario={usuario}
        />
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
              Digite um número de fatura ou ID de nota para consultar seu histórico de atividades
            </p>
          </div>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <FiAlertCircle className="empty-icon" />
            <h3>Nenhum histórico encontrado</h3>
            <p>
              Nenhum registro encontrado para "<strong>{termoBusca}</strong>"
            </p>
            <p className="empty-state-suggestion">
              Verifique se você realizou ações nesta fatura/nota
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
        ) : (
          <>
            {/* Barra de Ferramentas */}
            <div className="toolbar">
              <div className="search-box">
                <FiSearch className="search-icon" />
                <input
                  className="search-input"
                  type="text"
                  placeholder="Filtrar histórico..."
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
                  {filtro && itens.length > filtrados.length && ` (de ${itens.length})`}
                </span>
                
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
                  disabled={loading}
                >
                  <FiDownload /> Exportar
                </button>
              </div>
            </div>

            {/* Tabela */}
            <div className="tabela-wrapper">
              <div className="tabela-scroll">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Tipo</th>
                      <th style={{ width: '100px' }}>Origem</th>
                      <th style={{ width: '100px' }}>Ação</th>
                      <th>Mensagem</th>
                      <th style={{ width: '120px' }}>Usuário</th>
                      <th style={{ width: '140px' }}>Data/Hora</th>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}