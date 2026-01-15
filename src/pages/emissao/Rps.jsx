import { useMemo, useState, useCallback, useEffect } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import { processarArquivoRPSNfse, iniciarEmissao } from "../../services/nfseService";
import "../../styles/emissao.css";
import { useSnackbar } from 'notistack';
import { getEmpresas } from "../../services/empresas";
import { fixBrokenLatin } from "../../utils/normalizacao_textual";

export default function EmissaoPorRps() {
  const [empresa, setEmpresa] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [codigoServico, setCodigoServico] = useState("170901");

  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);
  const [empresaData, setEmpresaData] = useState([]);
  const [progresso, setProgresso] = useState(0);
  
  const { enqueueSnackbar } = useSnackbar();

  // Precisa ter empresa e arquivo para gerar
  const podeGerar = useMemo(() => {
    return !!empresa && !!arquivo;
  }, [empresa, arquivo]);
  
  const podeEmitir = useMemo(
    () => !!preview && preview.length > 0 && !loadingGerar && !loadingEmitir,
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
      
      if (!arquivo) {
        mostrarErro('Selecione um arquivo para importar');
        return;
      }
      
      if (!empresa.CNPJ || !empresa.CEDENTE) {
        mostrarErro('Dados da empresa incompletos. Selecione novamente.');
        return;
      }

      setLoadingGerar(true);
      setPreview(null);
      setProgresso(0);

      mostrarInfo(`Processando arquivo ${arquivo.name}...`);

      try {
        const formData = new FormData();
        formData.append('arquivo', arquivo);
        formData.append('empresa', JSON.stringify({
          CNPJ: empresa.CNPJ,
          CEDENTE: empresa.CEDENTE,
          INSCRICAO_MUNICIPAL: empresa.INSCRICAO_MUNICIPAL || ""
        }));

        const response = await processarArquivoRPSNfse(formData);

        if (response.data.sucesso) {
          setPreview(response.data.data);
          mostrarSucesso('Arquivo processado com sucesso! Verifique abaixo antes de emitir.');
          
          pushLog(`Prévia gerada: ${response.data.data.length} nota(s) fiscal(is) encontrada(s)`, 'sucesso');
          const valorTotal = response.data.data.reduce(
            (acc, item) => acc + (item?.servico?.[0]?.valor?.servico || 0),
            0
          );
          pushLog(`Valor total: R$ ${valorTotal.toFixed(2)}`, 'sucesso');
          
        } else {
          const erroMsg = response.data?.error || "Falha ao processar o arquivo.";
          
          if (erroMsg.includes('Nenhuma linha válida')) {
            mostrarErro('Arquivo vazio ou sem linhas válidas');
          } else if (erroMsg.includes('formato') || erroMsg.includes('CSV')) {
            mostrarErro('Formato de arquivo inválido');
          } else {
            mostrarErro('Erro ao processar arquivo', erroMsg);
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
    [empresa, arquivo, mostrarErro, mostrarInfo, mostrarSucesso, pushLog]
  );

  const handleEmitir = useCallback(async () => {
    if (!preview) {
      mostrarErro("Processe o arquivo antes de emitir.");
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
        pushLog(`ID do lote: ${res.protocolo || 'N/A'}`, 'info');
        
        // Limpa o formulário após sucesso
        setTimeout(() => {
          setArquivo(null);
          setObservacao("");
          setPreview(null);
          setProgresso(0);
        }, 2000);
        
      } else {
        const erroMsg = res?.erro || "Erro desconhecido ao enviar lote.";
        
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
          <h2 className="fc-title">Emissão · Por Arquivo</h2>
          <div className="fc-subtitle">
            Importe um arquivo CSV/TXT com os dados das notas fiscais
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
          <h3 className="fc-form-title">Importação de Arquivo</h3>

          <div className="fc-form-content">
            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">
                  Arquivo CSV/TXT *
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="fc-input fc-input--grow"
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                />
                {/* <div className="fc-input-help">
                  Formato: CNPJ,Nome,Email,Valor,Descrição,Código,Cep,Logradouro,Número,Bairro,Cidade,UF
                </div> */}
              </div>

              {isCondomed && (
                <div className="fc-input-group">
                  <label className="fc-input-label">Código de Serviço Padrão</label>
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

            {/* <div className="fc-input-group">
              <label className="fc-input-label">
                Observação
              </label>
              <textarea
                className="fc-input fc-textarea"
                placeholder="Observação que será aplicada a todas as notas..."
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={500}
              />
              <div className="fc-input-help">
                {observacao.length}/500 caracteres
              </div>
            </div> */}

            <button
              className={gerarBtnClass}
              type="submit"
              disabled={!podeGerar || loadingGerar || loadingEmitir}
              title={!podeGerar ? "Selecione uma empresa e um arquivo" : ""}
            >
              {loadingGerar ? (
                <>
                  <span className="fc-spinner"></span>
                  PROCESSANDO ARQUIVO...
                </>
              ) : "PROCESSAR ARQUIVO"}
            </button>

            {!podeGerar && (
              <div className="fc-validation-hint">
                ⓘ Selecione: Empresa e Arquivo CSV/TXT
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
                  <p className="fc-value">{preview[0]?.servico?.[0]?.codigo || "170901"}</p>
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
                      {fixBrokenLatin(preview[0]?.prestador?.razaoSocial || "")
                        .split(" ")
                        .slice(0, 2)
                        .join(" ")}{" "}
                      - {preview[0]?.prestador?.cpfCnpj || ""}
                    </p>
                  </div>

                  <div className="fc-metric">
                    <span className="fc-label">Tomador Exemplo:</span>
                    <p className="fc-value">
                      {fixBrokenLatin(preview[0]?.tomador?.razaoSocial || "")}
                      {" "}- {preview[0]?.tomador?.cpfCnpj || ""}
                    </p>
                  </div>

                  <div className="fc-grid-span" />

                  <span className="fc-label">Discriminação do Serviço:</span>
                  <p className="fc-discriminacao">{fixBrokenLatin(preview[0]?.servico?.[0]?.discriminacao || "Serviço prestado conforme arquivo")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="fc-placeholder">
              <p>Aguardando importação de arquivo...</p>
              <small>Selecione um arquivo CSV/TXT e clique em "Processar Arquivo"</small>
            </div>
          )}
        </section>
      </div>

      <footer className="fc-footer">
        <button
          className={emitirBtnClass}
          onClick={handleEmitir}
          disabled={!podeEmitir || loadingEmitir}
          title={!podeEmitir ? "Processe o arquivo primeiro" : ""}
        >
          {loadingEmitir ? (
            <>
              <span className="fc-spinner"></span>
              PROCESSANDO ({progresso}%)
            </>
          ) : "EMITIR NOTAS FISCAIS"}
        </button>
      </footer>
    </div>
  );
}