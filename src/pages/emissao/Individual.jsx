import { useMemo, useState, useCallback, useEffect } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import { getNfsePreview, iniciarEmissao } from "../../services/nfseService";
import "../../styles/emissao.css";
import { useSnackbar } from 'notistack';
import { getEmpresas } from "../../services/empresas";
import { fixBrokenLatin } from "../../utils/normalizacao_textual";

export default function EmissaoIndividual() {
  const [empresa, setEmpresa] = useState("");
  const [empresaData, setEmpresaData] = useState([]);
  const [tomador, setTomador] = useState({
    documento: "",
    nome: "",
    email: "",
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: ""
  });
  const [servico, setServico] = useState("");
  const [valores, setValores] = useState({
    valorNota: "0,00",
    deducoes: "0,00",
    descontos: "0,00",
    issRetido: "nao"
  });
  const [codigoServico, setCodigoServico] = useState("170901");
  
  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);
  const [progresso, setProgresso] = useState(0);
  
  const { enqueueSnackbar } = useSnackbar();

  // Helper moeda
  const parseBRL = useCallback((v) => {
    if (v == null) return 0;
    const s = String(v)
      .replace(/[^\d.,-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "");
    const normalized = s.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }, []);
  
  const podeGerar = useMemo(() => {
    const valorNotaNum = parseBRL(valores.valorNota);
    return (
      !!empresa &&
      !!tomador.documento &&
      !!tomador.nome &&
      !!servico.trim() &&
      valorNotaNum > 0
    );
  }, [empresa, tomador, servico, valores, parseBRL]);
  
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

  const handleChange = useCallback((field) => (e) => {
    setTomador(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const handleMoneyChange = useCallback(
    (name) => (e) => {
      const raw = e.target.value;
      setValores((prev) => ({ ...prev, [name]: raw }));
    },
    []
  );

  const handleMoneyBlur = useCallback(
    (name) => () => {
      const n = parseBRL(valores[name]);
      const formatted = (Number(n) || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setValores((prev) => ({ ...prev, [name]: formatted }));
    },
    [parseBRL, valores]
  );

  const handleMoneyFocus = useCallback((e) => {
    requestAnimationFrame(() => {
      const el = e.target;
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch { }
    });
  }, []);


  const handleGerar = useCallback(
    async (e) => {
      e?.preventDefault();
      
      // Validações detalhadas
      if (!empresa) {
        mostrarErro('Selecione uma empresa para continuar');
        return;
      }
      
      if (!tomador.documento) {
        mostrarErro('Informe o CPF/CNPJ do tomador');
        return;
      }
      
      if (!tomador.nome) {
        mostrarErro('Informe o nome do tomador');
        return;
      }
      
      if (!servico.trim()) {
        mostrarErro('Informe a descrição do serviço');
        return;
      }
      
      const valorNotaNum = parseBRL(valores.valorNota);
      if (valorNotaNum <= 0) {
        mostrarErro('O valor da nota deve ser maior que zero');
        return;
      }
      
      if (!empresa.CNPJ || !empresa.CEDENTE) {
        mostrarErro('Dados da empresa incompletos. Selecione novamente.');
        return;
      }
      
      setLoadingGerar(true);
      setPreview(null);
      setProgresso(0);

      mostrarInfo('Gerando prévia da nota fiscal...');

      try {
        const payload = {
          protocolo_id: `NFSe_IND_${Date.now()}`,
          prestador_cnpj: empresa.CNPJ,
          razaoSocial: empresa.CEDENTE,
          observacao: servico.trim(),
          dados_individual: {
            tomador: {
              documento: tomador.documento,
              nome: tomador.nome,
              email: tomador.email || "",
              endereco: {
                logradouro: tomador.logradouro || "",
                numero: tomador.numero || "",
                bairro: tomador.bairro || "",
                cep: tomador.cep || "",
                descricaoCidade: tomador.cidade || "",
                estado: tomador.uf || "",
                tipoLogradouro: "Rua",
                tipoBairro: "Bairro",
                complemento: ""
              }
            },
            servico: {
              valor_servico: parseBRL(valores.valorNota),
              deducoes: parseBRL(valores.deducoes) || 0,
              descontos: parseBRL(valores.descontos) || 0,
              iss_retido: valores.issRetido === "sim",
              codigo: codigoServico
            }
          }
        };

        const response = await getNfsePreview(payload);

        // console.log("response", response)

        if (response.sucesso) {
          setPreview(response.data);
          mostrarSucesso('Prévia gerada com sucesso! Verifique abaixo antes de emitir.');
          pushLog('Prévia gerada para nota individual', 'sucesso');
          
        } else {
          mostrarErro('Erro ao gerar prévia', response?.erro);
        }
      } catch (err) {
        const valorNotaNum = parseBRL(valores.valorNota);
        
        // Cálculo de retenção (copiado do service)
        const pcc_retido = valorNotaNum > 215.05;
        const irrf_retido = valorNotaNum >= 666.67 && !tomador.nome?.toUpperCase().includes("COND");
        
        const calcularTruncado = (valor, percentual) => Math.floor(valor * percentual * 100) / 100;
        
        const valor_pis = pcc_retido ? calcularTruncado(valorNotaNum, 0.0065) : 0;
        const valor_cofins = pcc_retido ? calcularTruncado(valorNotaNum, 0.03) : 0;
        const valor_csll = pcc_retido ? calcularTruncado(valorNotaNum, 0.01) : 0;
        const valor_irrf = irrf_retido ? calcularTruncado(valorNotaNum, 0.015) : 0;
        
        const valor_liquido = valorNotaNum - (valor_pis + valor_cofins + valor_csll + valor_irrf);

        const notaPreview = {
          idIntegracao: `NFSe_IND_${Date.now()}`,
          prestador: {
            cpfCnpj: empresa.CNPJ,
            razaoSocial: empresa.CEDENTE,
            inscricaoMunicipal: empresa.INSCRICAO_MUNICIPAL || ""
          },
          tomador: {
            cpfCnpj: tomador.documento,
            razaoSocial: tomador.nome,
            email: tomador.email || "",
            endereco: {
              logradouro: tomador.logradouro || "",
              numero: tomador.numero || "",
              complemento: "",
              bairro: tomador.bairro || "",
              cep: tomador.cep || "",
              descricaoCidade: tomador.cidade || "",
              estado: tomador.uf || "",
              tipoLogradouro: "Rua",
              tipoBairro: "Bairro"
            }
          },
          servico: [
            {
              codigo: codigoServico,
              codigoTributacao: "003",
              discriminacao: servico,
              iss: {
                tipoTributacao: 7,
                exigibilidade: pcc_retido ? 1 : 2
              },
              retencao: {
                pis: { aliquota: pcc_retido ? 0.65 : 0 },
                cofins: { aliquota: pcc_retido ? 3 : 0 },
                csll: { aliquota: pcc_retido ? 1 : 0 },
                irrf: { aliquota: irrf_retido ? 1.5 : 0 }
              },
              valor: {
                servico: valorNotaNum,
                liquido: pcc_retido ? valor_liquido : valorNotaNum,
                deducoes: parseBRL(valores.deducoes) || 0,
                descontos: parseBRL(valores.descontos) || 0,
                descontoCondicionado: 0,
                descontoIncondicionado: 0,
                parcelada: false,
                parcelas: 1
              },
              issRetido: valores.issRetido === "sim"
            }
          ]
        };

        setPreview([notaPreview]);
        mostrarSucesso('Prévia gerada (modo local)!');
        pushLog(`Valor: R$ ${valorNotaNum.toFixed(2)}`, 'sucesso');
      } finally {
        setLoadingGerar(false);
      }
    },
    [empresa, tomador, servico, valores, codigoServico, parseBRL, mostrarErro, mostrarInfo, mostrarSucesso, pushLog]
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

      // console.log("res", res)

      if (res.status === "sucesso") {
        setProgresso(100);
        mostrarSucesso("Nota enviada com sucesso! Acompanhe o status no setor de consultas.");
        pushLog(`Nota enviada para processamento`, 'sucesso');
        pushLog(`Protocolo: ${res.protocolo || 'N/A'}`, 'info');
        
        // Limpa o formulário após sucesso
        setTimeout(() => {
          setTomador({
            documento: "",
            nome: "",
            email: "",
            cep: "",
            logradouro: "",
            numero: "",
            bairro: "",
            cidade: "",
            uf: ""
          });
          setServico("");
          setValores({
            valorNota: "0,00",
            deducoes: "0,00",
            descontos: "0,00",
            issRetido: "nao"
          });
          setPreview(null);
          setProgresso(0);
        }, 2000);
        
      } else {
        const erroMsg = res?.erro || "Erro desconhecido ao enviar nota.";
        
        if (erroMsg.includes('valid')) {
          mostrarErro('Erro de validação nos dados da nota. Verifique a prévia.');
        } else if (erroMsg.includes('conexão') || erroMsg.includes('API')) {
          mostrarErro('Erro na conexão com o serviço de emissão. Tente novamente.');
        } else if (erroMsg.includes('limite') || erroMsg.includes('quota')) {
          mostrarErro('Limite de emissões atingido. Tente novamente mais tarde.');
        } else {
          mostrarErro('Falha ao enviar nota para emissão', erroMsg);
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
          <h2 className="fc-title">Emissão · Individual</h2>
          <div className="fc-subtitle">
            Preencha os dados do tomador e do serviço para emitir a nota fiscal
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
          <h3 className="fc-form-title">Dados do Tomador</h3>

          <div className="fc-form-content">
            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">CPF/CNPJ *</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Ex: 123.456.789-00 ou 12.345.678/0001-90"
                  value={tomador.documento}
                  onChange={handleChange('documento')}
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Nome/Razão Social *</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Nome completo ou Razão Social"
                  value={tomador.nome}
                  onChange={handleChange('nome')}
                />
              </div>
            </div>

            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">E-mail</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="email@exemplo.com"
                  value={tomador.email}
                  onChange={handleChange('email')}
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">CEP</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="00000-000"
                  value={tomador.cep}
                  onChange={handleChange('cep')}
                />
              </div>
            </div>

            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">Logradouro</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Rua, Avenida, etc."
                  value={tomador.logradouro}
                  onChange={handleChange('logradouro')}
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Número</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Nº"
                  value={tomador.numero}
                  onChange={handleChange('numero')}
                />
              </div>
            </div>

            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">Bairro</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Bairro"
                  value={tomador.bairro}
                  onChange={handleChange('bairro')}
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Cidade</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Cidade"
                  value={tomador.cidade}
                  onChange={handleChange('cidade')}
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">UF</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="UF"
                  maxLength={2}
                  value={tomador.uf}
                  onChange={handleChange('uf')}
                />
              </div>
            </div>

            <h3 className="fc-form-title" style={{ marginTop: '2rem' }}>Discriminação do Serviço</h3>
            
            <div className="fc-input-group">
              <label className="fc-input-label">
                Descrição do Serviço *
                {servico && servico.length < 10 && (
                  <span className="fc-input-error"> (mínimo 10 caracteres)</span>
                )}
              </label>
              <textarea
                className="fc-input fc-textarea"
                placeholder="Descreva detalhadamente os serviços prestados..."
                rows={4}
                value={servico}
                required
                onChange={(e) => setServico(e.target.value)}
                minLength={10}
                maxLength={1000}
              />
              <div className="fc-input-help">
                {servico.length}/1000 caracteres
              </div>
            </div>

            {/* <h3 className="fc-form-title" style={{ marginTop: '2rem' }}>Valores da Nota</h3>
            
            <div className="fc-row fc-row--inputs">
              <div className="fc-input-group">
                <label className="fc-input-label">Valor Total (R$) *</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="0,00"
                  value={valores.valorNota}
                  onChange={handleMoneyChange("valorNota")}
                  onBlur={handleMoneyBlur("valorNota")}
                  onFocus={handleMoneyFocus}
                  required
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Deduções (R$)</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="0,00"
                  value={valores.deducoes}
                  onChange={handleMoneyChange("deducoes")}
                  onBlur={handleMoneyBlur("deducoes")}
                  onFocus={handleMoneyFocus}
                />
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Descontos (R$)</label>
                <input
                  className="fc-input fc-input--grow"
                  placeholder="0,00"
                  value={valores.descontos}
                  onChange={handleMoneyChange("descontos")}
                  onBlur={handleMoneyBlur("descontos")}
                  onFocus={handleMoneyFocus}
                />
              </div>
            </div> */}

            <div className="fc-row fc-row--inputs">
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

              <div className="fc-input-group">
                <label className="fc-input-label">ISS Retido?</label>
                <div className="fc-radio-group">
                  <label className="fc-radio">
                    <input
                      type="radio"
                      name="issRetido"
                      value="sim"
                      checked={valores.issRetido === "sim"}
                      onChange={(e) => setValores(prev => ({ ...prev, issRetido: e.target.value }))}
                    />
                    <span>Sim</span>
                  </label>
                  <label className="fc-radio">
                    <input
                      type="radio"
                      name="issRetido"
                      value="nao"
                      checked={valores.issRetido === "nao"}
                      onChange={(e) => setValores(prev => ({ ...prev, issRetido: e.target.value }))}
                    />
                    <span>Não</span>
                  </label>
                </div>
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
                ⓘ Preencha: Empresa, CPF/CNPJ, Nome, Descrição do Serviço e Valor Total
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
                    <span className="fc-label">Tomador:</span>
                    <p className="fc-value">
                      {fixBrokenLatin(preview[0]?.tomador?.razaoSocial || "")}
                      {" "}- {preview[0]?.tomador?.cpfCnpj || ""}
                    </p>
                  </div>

                  <div className="fc-grid-span" />

                  <span className="fc-label">Discriminação do Serviço:</span>
                  <p className="fc-discriminacao">{fixBrokenLatin(preview[0]?.servico?.[0]?.discriminacao || "")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="fc-placeholder">
              <p>Aguardando dados da nota...</p>
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