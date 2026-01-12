import { useMemo, useState, useCallback, useEffect } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import {
  getNfsePreview,
  iniciarEmissao,
} from "../../services/nfseService";
import "../../styles/emissao.css";
import { useSnackbar } from 'notistack';
import { getEmpresas } from "../../services/empresas";
import { fixBrokenLatin } from "../../utils/normalizacao_textual";

export default function EmissaoPorFatura() {
  const [empresa, setEmpresa] = useState("");
  const [fatura, setFatura] = useState("");
  const [observacao, setObservacao] = useState("");
  const [codigoServico, setCodigoServico] = useState("170901");

  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);
  const [empresaData, setEmpresaData] = useState([]);
  const [progresso, setProgresso] = useState(0);
  
  const { enqueueSnackbar } = useSnackbar();

  // Precisa ter empresa, fatura E observação para gerar
  const podeGerar = useMemo(() => {
    return !!empresa && 
           !!fatura.trim() && 
           !!observacao.trim() &&
           fatura.trim().length >= 6; // Valida que tem pelo menos 6 dígitos
  }, [empresa, fatura, observacao]);
  
  const podeEmitir = useMemo(
    () => !!preview && !loadingGerar && !loadingEmitir,
    [preview, loadingGerar, loadingEmitir]
  );

  const pushLog = useCallback((msg, tipo = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const tipoPrefix = tipo === 'erro' ? '❌ ERRO' : 
                      tipo === 'sucesso' ? '✅ SUCESSO' : 
                      tipo === 'alerta' ? '⚠️ ALERTA' : 'ℹ️ INFO';
    
    setLogs((prev) =>
      [...prev, `[${timestamp}] ${tipoPrefix}: ${msg}`].slice(-200)
    );
  }, []);

  const mostrarErro = useCallback((mensagem, detalhes = null) => {
    enqueueSnackbar(mensagem, { 
      variant: 'error',
      autoHideDuration: 5000,
      anchorOrigin: { vertical: 'top', horizontal: 'right' }
    });
    
    pushLog(mensagem, 'erro');
    
    if (detalhes) {
      console.error('Detalhes do erro:', detalhes);
      // Se houver mais detalhes, adiciona como log secundário
      if (typeof detalhes === 'object') {
        pushLog(`Detalhes: ${JSON.stringify(detalhes)}`, 'erro');
      } else {
        pushLog(`Detalhes: ${detalhes}`, 'erro');
      }
    }
  }, [enqueueSnackbar, pushLog]);

  const mostrarSucesso = useCallback((mensagem) => {
    enqueueSnackbar(mensagem, { 
      variant: 'success',
      autoHideDuration: 3000,
      anchorOrigin: { vertical: 'top', horizontal: 'right' }
    });
    pushLog(mensagem, 'sucesso');
  }, [enqueueSnackbar, pushLog]);

  const mostrarInfo = useCallback((mensagem) => {
    enqueueSnackbar(mensagem, { 
      variant: 'info',
      autoHideDuration: 4000,
      anchorOrigin: { vertical: 'top', horizontal: 'right' }
    });
    pushLog(mensagem, 'info');
  }, [enqueueSnackbar, pushLog]);

  const handleGerar = useCallback(
    async (e) => {
      e?.preventDefault();
      
      // Validações detalhadas
      if (!empresa) {
        mostrarErro('Selecione uma empresa para continuar');
        return;
      }
      
      if (!fatura.trim()) {
        mostrarErro('Informe o número da fatura');
        return;
      }
      
      if (fatura.trim().length < 6) {
        mostrarErro('O número da fatura deve ter pelo menos 6 dígitos');
        return;
      }
      
      if (!observacao.trim()) {
        mostrarErro('A observação da nota é obrigatória');
        return;
      }
      
      if (observacao.trim().length < 10) {
        mostrarErro('A observação deve ter pelo menos 10 caracteres');
        return;
      }
      
      if (!empresa.CNPJ || !empresa.CEDENTE) {
        mostrarErro('Dados da empresa incompletos. Selecione novamente.');
        return;
      }

      setLoadingGerar(true);
      setPreview(null);
      setProgresso(0);

      mostrarInfo(`Consultando dados da fatura #${fatura}...`);

      try {
        const payload = {
          protocolo_id: "NFSe_FAT_" + Date.now(),
          fatura_numero: fatura,
          prestador_cnpj: empresa.CNPJ,
          razaoSocial: empresa.CEDENTE,
          observacao: observacao.trim(),
          parcela: 1,
          codigo: codigoServico
        };

        const response = await getNfsePreview(payload);

        console.log("response", response.data)

        if (response.sucesso) {
          setPreview(response.data);
          mostrarSucesso('Dados carregados com sucesso! Verifique abaixo antes de emitir.');
          
          // Adiciona informações detalhadas no log
          pushLog(`Prévia gerada: ${response.data.length} nota(s) fiscal(is) encontrada(s)`, 'sucesso');
          const valorTotal = response.data.reduce(
            (acc, item) => acc + (item?.servico?.[0]?.valor?.servico || 0),
            0
          );
          pushLog(`Valor total: R$ ${valorTotal.toFixed(2)}`, 'sucesso');
          
        } else {
          const erroMsg = response?.erro || "Falha ao obter prévia da nota.";
          
          // Tratamento específico para erros comuns
          if (erroMsg.includes('fatura') && erroMsg.includes('não encontrada')) {
            mostrarErro(`Fatura ${fatura} não encontrada no sistema`);
          } else if (erroMsg.includes('CNPJ') || erroMsg.includes('prestador')) {
            mostrarErro('Problema com os dados do prestador. Verifique a empresa selecionada.');
          } else if (erroMsg.includes('serviço') || erroMsg.includes('código')) {
            mostrarErro('Código de serviço inválido ou não configurado para esta empresa');
          } else {
            mostrarErro('Erro ao gerar prévia', erroMsg);
          }
        }
      } catch (err) {
        let mensagemErro = 'Erro ao conectar com o serviço';
        
        if (err.message?.includes('Network Error') || err.message?.includes('timeout')) {
          mensagemErro = 'Falha na conexão com o servidor. Verifique sua internet e tente novamente.';
        } else if (err.response?.status === 500) {
          mensagemErro = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (err.response?.status === 404) {
          mensagemErro = 'Serviço temporariamente indisponível';
        }
        
        mostrarErro(mensagemErro, err.message);
      } finally {
        setLoadingGerar(false);
      }
    },
    [empresa, fatura, observacao, codigoServico, mostrarErro, mostrarInfo, mostrarSucesso, pushLog]
  );

  const handleEmitir = useCallback(async () => {
    if (!preview) {
      mostrarErro("Gere a prévia antes de emitir.");
      return;
    }

    if (preview.length === 0) {
      mostrarErro("Não há notas para emitir.");
      return;
    }

    setLoadingEmitir(true);
    setProgresso(10);

    mostrarInfo("Iniciando emissão da nota fiscal...");

    try {
      const res = await iniciarEmissao(preview);

      if (res.status === "sucesso") {
        setProgresso(100);
        mostrarSucesso("Lote enviado com sucesso! Acompanhe o status das notas no setor de consultas.");
        pushLog(`Lote enviado: ${preview.length} nota(s) encaminhada(s) para processamento`, 'sucesso');
        pushLog(`ID do lote: ${res.protocolo_id || 'N/A'}`, 'info');
        
        // Limpa o formulário após sucesso
        setTimeout(() => {
          setFatura("");
          setObservacao("");
          setPreview(null);
          setProgresso(0);
        }, 2000);
        
      } else {
        const erroMsg = res?.erro || "Erro desconhecido ao enviar lote.";
        
        // Tratamento específico para erros de emissão
        if (erroMsg.includes('valid')) {
          mostrarErro('Erro de validação nos dados da nota. Verifique a prévia.');
        } else if (erroMsg.includes('conexão') || erroMsg.includes('API')) {
          mostrarErro('Erro na conexão com o serviço de emissão. Tente novamente.');
        } else if (erroMsg.includes('limite') || erroMsg.includes('quota')) {
          mostrarErro('Limite de emissões atingido. Tente novamente mais tarde.');
        } else {
          mostrarErro('Falha ao enviar lote para emissão', erroMsg);
        }
      }
    } catch (err) {
      let mensagemErro = 'Erro ao processar emissão';
      
      if (err.message?.includes('Network Error')) {
        mensagemErro = 'Falha na conexão. Verifique sua internet e tente novamente.';
      } else if (err.response?.status === 429) {
        mensagemErro = 'Muitas requisições. Aguarde um momento antes de tentar novamente.';
      } else if (err.response?.status === 503) {
        mensagemErro = 'Serviço de emissão temporariamente indisponível.';
      }
      
      mostrarErro(mensagemErro, err.message);
    } finally {
      setLoadingEmitir(false);
    }
  }, [preview, mostrarErro, mostrarInfo, mostrarSucesso, pushLog]);

  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const response = await getEmpresas();
        setEmpresaData(response.data || []);
      } catch (error) {
        mostrarErro('Erro ao carregar empresas', error.message);
        console.error("Erro ao carregar empresas:", error);
      }
    };
    carregarEmpresas();
  }, [mostrarErro, mostrarInfo]);

  const isCondomed = empresa?.CEDENTE?.includes("CONDOMED");
  
  // Classes CSS baseadas nas validações
  const gerarBtnClass = useMemo(() => {
    const base = "fc-btn fc-btn--primary fc-btn--full";
    const desabilitado = !podeGerar || loadingGerar || loadingEmitir;
    return desabilitado ? `${base} fc-btn--disabled` : base;
  }, [podeGerar, loadingGerar, loadingEmitir]);

  const emitirBtnClass = useMemo(() => {
    const base = "fc-btn fc-btn--success fc-btn--full";
    const desabilitado = !podeEmitir || loadingEmitir;
    return desabilitado ? `${base} fc-btn--disabled` : base;
  }, [podeEmitir, loadingEmitir]);

  return (
    <div className="fc-page">
      <div className="fc-card">
        <header className="fc-header">
          <h2 className="fc-title">Emissão · Por Fatura</h2>
          <div className="fc-subtitle">
            Preencha todos os campos obrigatórios para gerar a prévia da nota fiscal
          </div>
        </header>

        <section className="fc-section">
          <EmpresaSelect
            value={empresa}
            onChange={setEmpresa}
            empresas={empresaData}
            label="Empresa *"
            required
          />
        </section>

        <form onSubmit={handleGerar} className="fc-form">
          <h3 className="fc-form-title">Dados de Importação</h3>

          <div className="fc-form-content">
            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">
                  Número da Fatura *
                  {fatura && fatura.length < 6 && (
                    <span className="fc-input-error"> (mínimo 6 dígitos)</span>
                  )}
                </label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Ex: 161034"
                  value={fatura}
                  onChange={(e) => setFatura(e.target.value.replace(/[^\d]/g, ""))}
                  maxLength={10}
                />
              </div>

              {isCondomed && (
                <div className="fc-input-group">
                  <label className="fc-input-label">Código de Serviço</label>
                  <select
                    className="fc-input fc-select"
                    value={codigoServico}
                    onChange={(e) => setCodigoServico(e.target.value)}
                  >
                    <option value="170901">Cód. 170901</option>
                    <option value="170902">Cód. 170902</option>
                    <option value="040301">Cód. 040301</option>
                  </select>
                </div>
              )}
            </div>

            <div className="fc-input-group">
              <label className="fc-input-label">
                Observação da Nota *
                {observacao && observacao.length < 10 && (
                  <span className="fc-input-error"> (mínimo 10 caracteres)</span>
                )}
              </label>
              <textarea
                className="fc-input fc-textarea"
                placeholder="Ex: Programa de Gestão de Segurança do Trabalho para empresa XYZ..."
                rows={3}
                value={observacao}
                required
                onChange={(e) => setObservacao(e.target.value)}
                minLength={10}
                maxLength={500}
              />
              <div className="fc-input-help">
                {observacao.length}/500 caracteres
              </div>
            </div>

            <button
              className={gerarBtnClass}
              type="submit"
              disabled={!podeGerar || loadingGerar || loadingEmitir}
              title={!podeGerar ? "Preencha todos os campos obrigatórios" : ""}
            >
              {loadingGerar ? (
                <>
                  <span className="fc-spinner"></span>
                  GERANDO PRÉVIA...
                </>
              ) : "GERAR PRÉVIA"}
            </button>

            {!podeGerar && (
              <div className="fc-validation-hint">
                ⓘ Preencha: Empresa, Fatura (6+ dígitos) e Observação (10+ caracteres)
              </div>
            )}
          </div>
        </form>

        <section className="fc-section">
          <LogEmissao entries={logs} maxHeight={120} />

          {loadingEmitir && (
            <div className="fc-progress-wrapper">
              <div className="fc-progress">
                <div className="fc-progress-bar" style={{ width: `${progresso}%` }} />
              </div>
              <div className="fc-progress-label">{progresso}% processado</div>
            </div>
          )}
        </section>

        <section className="fc-section">
          {preview ? (
            <div className="fc-preview">
              <div className="fc-preview-header">
                <h2 className="fc-preview-title">Conferência de Dados</h2>
                <div className="fc-preview-badge">
                  {preview.length} {preview.length === 1 ? 'NOTA' : 'NOTAS'}
                </div>
              </div>

              <div className="fc-grid">
                <div className="fc-metric">
                  <span className="fc-label">Valor Total:</span>
                  <p className="fc-value">
                    {preview
                      .reduce(
                        (acc, item) => acc + (item?.servico?.[0]?.valor?.servico || 0),
                        0
                      )
                      .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>

                <div className="fc-metric">
                  <span className="fc-label">Código de Serviço</span>
                  <p className="fc-value">{preview[0].servico[0].codigo}</p>
                </div>

                <div className="fc-grid-span" />

                <div className="fc-metric">
                  <span className="fc-label">Nº Notas Fiscais</span>
                  <p className="fc-value">{preview.length}</p>
                </div>

                <div className="fc-block fc-grid-span">
                  <div className="fc-metric">
                    <span className="fc-label">Emissor:</span>
                    <p className="fc-value">
                      {fixBrokenLatin(preview[0]?.prestador?.razaoSocial)
                        .split(" ")
                        .slice(0, 2)
                        .join(" ")}{" "}
                      - {preview[0]?.prestador?.cpfCnpj}
                    </p>
                  </div>

                  <div className="fc-grid-span" />

                  <span className="fc-label">Discriminação do Serviço:</span>
                  <p className="fc-discriminacao">{fixBrokenLatin(preview[0]?.servico[0]?.discriminacao)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="fc-placeholder">
              <div className="fc-placeholder-icon">📋</div>
              <p>Aguardando importação de dados da fatura...</p>
              <small>Preencha os campos acima e clique em "Gerar Prévia"</small>
            </div>
          )}
        </section>
      </div>

      <footer className="fc-footer">
        <button
          className={emitirBtnClass}
          onClick={handleEmitir}
          disabled={!podeEmitir || loadingEmitir}
          title={!podeEmitir ? "Gere a prévia primeiro" : ""}
        >
          {loadingEmitir ? (
            <>
              <span className="fc-spinner"></span>
              PROCESSANDO ({progresso}%)
            </>
          ) : "EMITIR NOTA FISCAL"}
        </button>
      </footer>
    </div>
  );
}