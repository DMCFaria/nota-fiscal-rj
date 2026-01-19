import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNotaPorIDIntegracao } from '../services/notas';
import "../styles/historico_detalhe.css";
import { formatarData } from "../utils/formatar_data";
import { FiArrowLeft, FiFileText, FiCheckCircle, FiXCircle, FiClock, FiAlertCircle } from "react-icons/fi";

const HistoricoDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [nota, setNota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const recuperaNotaPorIdIntegracao = async () => {
      try {
        setLoading(true);
        const response = await getNotaPorIDIntegracao(id);
        if (response?.nfse) {
          setNota(response.nfse);
        } else {
          setError('Nota não encontrada');
        }
      } catch (error) {
        console.error("Falha ao processar Nota POR ID INTEGRAÇÃO", error);
        setError('Erro ao carregar detalhes da nota');
      } finally {
        setLoading(false);
      }
    };
    
    recuperaNotaPorIdIntegracao();
  }, [id]);

  const getStatusIcon = (status) => {
    switch(status) {
      case 'EMITIDA': return <FiCheckCircle style={{ color: '#10B981' }} />;
      case 'CANCELADA': return <FiXCircle style={{ color: '#EF4444' }} />;
      case 'PENDENTE': return <FiClock style={{ color: '#F59E0B' }} />;
      default: return <FiAlertCircle style={{ color: '#6B7280' }} />;
    }
  };

  const formatarValor = (valor) => {
    if (!valor) return 'N/A';
    return `R$ ${parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="historico-detalhe-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Carregando detalhes da nota...</p>
        </div>
      </div>
    );
  }

  if (error || !nota) {
    return (
      <div className="historico-detalhe-container">
        <div className="card">
          <div className="error-state">
            <FiAlertCircle className="error-icon" />
            <h3>Erro ao carregar</h3>
            <p>{error || 'Nota não encontrada'}</p>
            <button 
              className="btn-voltar"
              onClick={() => navigate(-1)}
            >
              <FiArrowLeft /> Voltar ao histórico
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="historico-detalhe-container">
      
      {/* Header */}
      <div className="card">
        <div className="detalhe-header">
          <div className="header-info">
            <h2 className="detalhe-titulo">
              <FiFileText /> Nota Fiscal
            </h2>
            <p className="detalhe-subtitulo">ID de Integração: <strong>{nota.id_integracao}</strong></p>
          </div>
          <div className="status-info">
            <span className="status-badge">
              {getStatusIcon(nota.status)}
              <span>{nota.status}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Informações da Nota */}
      <div className="card">
        <div className="section">
          <h3 className="section-title">Informações da Nota</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Fatura:</span>
              <span className="info-value highlight">{nota.fatura || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Parcela:</span>
              <span className="info-value">{nota.parcela || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Valor do Serviço:</span>
              <span className="info-value valor">{formatarValor(nota.valor_servico)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Data de Criação:</span>
              <span className="info-value">{formatarData(nota.datas?.criacao) || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Emissão Prefeitura:</span>
              <span className="info-value">{formatarData(nota.datas?.emissao_prefeitura) || 'N/A'}</span>
            </div>
            {nota.numero_nota && (
              <div className="info-item">
                <span className="info-label">Número da Nota:</span>
                <span className="info-value highlight">{nota.numero_nota}</span>
              </div>
            )}
            {nota.codigo_verificacao && (
              <div className="info-item">
                <span className="info-label">Código Verificação:</span>
                <span className="info-value code">{nota.codigo_verificacao}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prestador */}
      <div className="card">
        <div className="section">
          <h3 className="section-title">Prestador</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Razão Social:</span>
              <span className="info-value">{nota.prestador?.razao_social || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">CNPJ:</span>
              <span className="info-value code">{nota.prestador?.cnpj || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{nota.prestador?.email || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Telefone:</span>
              <span className="info-value">{nota.prestador?.telefone || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Cidade/UF:</span>
              <span className="info-value">
                {nota.prestador?.cidade || 'N/A'}/{nota.prestador?.estado || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tomador */}
      <div className="card">
        <div className="section">
          <h3 className="section-title">Tomador</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Razão Social:</span>
              <span className="info-value">{nota.tomador?.razao_social || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">CNPJ/CPF:</span>
              <span className="info-value code">{nota.tomador?.cnpj || nota.tomador?.cpf || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{nota.tomador?.email || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Telefone:</span>
              <span className="info-value">{nota.tomador?.telefone || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Endereço:</span>
              <span className="info-value">
                {nota.tomador?.logradouro || 'N/A'}, {nota.tomador?.numero || ''} - {nota.tomador?.cidade || 'N/A'}/{nota.tomador?.estado || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="card">
        <div className="section">
          <h3 className="section-title">Ações</h3>
          <div className="acoes-grid">
            {nota.pdf_url_final && (
              <a 
                href={nota.pdf_url_final}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-acao"
              >
                <FiFileText /> Ver PDF
              </a>
            )}
            <button 
              className="btn-acao btn-secundario"
              onClick={() => navigator.clipboard.writeText(nota.id_integracao)}
            >
              Copiar ID
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default HistoricoDetalhes;