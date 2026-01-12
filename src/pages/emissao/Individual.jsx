import { useState, useMemo, useCallback, useEffect } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import "../../styles/emissaoIndividual.css";
import { getEmpresas } from "../../services/empresas";
import { useSnackbar } from "notistack";
import { fixBrokenLatin } from "../../utils/normalizacao_textual";
import { iniciarEmissao } from "../../services/nfseService";

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
  const [observacao, setObservacao] = useState("");

  // Estados para seguir o padrão da Emissão por Fatura
  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);
  const [progresso, setProgresso] = useState(0);


  const { enqueueSnackbar } = useSnackbar();

    // Helpers moeda
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
  }, [empresa, tomador, servico, valores]);

  const podeEmitir = useMemo(
    () => !!preview && !loadingGerar && !loadingEmitir,
    [preview, loadingGerar, loadingEmitir]
  );

  const pushLog = useCallback((msg) => {
    setLogs((prev) =>
      [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-200)
    );
  }, []);



  const formatBRLInput = useCallback(
    (raw) => {
      const n = parseBRL(raw);
      return (Number(n) || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },
    [parseBRL]
  );

  const handleChange = (obj, setFn) => (e) =>
    setFn({ ...obj, [e.target.name]: e.target.value });

  const handleMoneyChange = useCallback(
    (name) => (e) => {
      const raw = e.target.value;
      setValores((prev) => ({ ...prev, [name]: raw }));
    },
    []
  );

  const handleMoneyBlur = useCallback(
    (name) => () => {
      setValores((prev) => ({ ...prev, [name]: formatBRLInput(prev[name]) }));
    },
    [formatBRLInput]
  );

  const handleMoneyFocus = useCallback((e) => {
    requestAnimationFrame(() => {
      const el = e.target;
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch { }
    });
  }, []);

  // 1. GERAR PREVIEW (igual à Emissão por Fatura)
 const handleGerar = useCallback(async (e) => {
    e?.preventDefault();
    if (!podeGerar) {
      enqueueSnackbar('Preencha os campos obrigatórios para gerar a prévia', { variant: 'error' });
      return;
    }

    setLoadingGerar(true);
    setPreview(null);
    setProgresso(0);

    pushLog(`Gerando prévia da nota individual...`);
    enqueueSnackbar('Gerando prévia da nota...', { variant: 'info' });

    if (!empresa || !empresa.CNPJ || !empresa.CEDENTE) {
      enqueueSnackbar('Dados da empresa incompletos. Selecione novamente.', { variant: 'error' });
      setLoadingGerar(false);
      return;
    }

    try {
      const valorNotaNum = parseBRL(valores.valorNota);
      
      // Montar preview no MESMO formato da Emissão por Fatura
      const notaPreview = {
        idIntegracao: `NFSe_IND_${tomador.documento}_${Date.now()}`,
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
              exigibilidade: 1
            },
            valor: {
              servico: valorNotaNum,
              deducoes: parseBRL(valores.deducoes) || 0,
              descontos: parseBRL(valores.descontos) || 0,
              descontoCondicionado: 0,
              descontoIncondicionado: 0,
              parcelada: 0,
              parcelas: 1
            },
            issRetido: valores.issRetido === "sim"
          }
        ]
      };

      console.log("Preview gerado:", notaPreview);
      setPreview([notaPreview]);
      
      pushLog("Prévia gerada com sucesso. Por favor, valide os detalhes abaixo.");
      enqueueSnackbar('Prévia gerada. Verifique antes de emitir.', { variant: 'success' });

    } catch (err) {
      const msg = err?.error || "Erro ao gerar prévia da nota.";
      enqueueSnackbar('Falha ao gerar prévia: ' + msg, { variant: 'error' });
      pushLog(`ERRO: ${msg}`);
    } finally {
      setLoadingGerar(false);
    }
  }, [
    empresa, 
    tomador, 
    servico, 
    valores, 
    codigoServico,
    podeGerar, 
    pushLog, 
    parseBRL,
    enqueueSnackbar
  ]);

  // 2. EMITIR (igual à Emissão por Fatura)
  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) {
      enqueueSnackbar("Gere a prévia antes de emitir.", { variant: 'error' });
      return;
    }

    setLoadingEmitir(true);
    setProgresso(10);

    pushLog("A enviar nota para processamento...");
    enqueueSnackbar("Iniciando emissão da nota fiscal...", { variant: 'info' });
    
    try {
      const res = await iniciarEmissao(preview);

      if (res.status === "sucesso") {
        pushLog(`Nota enviada com sucesso. Protocolo: ${res.protocolo}`);
        enqueueSnackbar("Nota enviada para processamento. Acompanhe o status nas consultas.", { variant: 'success' });
        setLoadingEmitir(false);
        
        // Limpar formulário após sucesso
        setPreview(null);
        setServico("");
        setValores({
          valorNota: "",
          deducoes: "",
          descontos: "",
          issRetido: "nao"
        });
      } else {
        pushLog(`ERRO: Falha ao enviar nota para emissão. ${res?.erro || ""}`);
        enqueueSnackbar("Erro ao enviar nota: " + (res?.erro || "Erro desconhecido."), { variant: 'error' });
        setLoadingEmitir(false);
      }
    } catch (err) {
      const msg = err?.message || "Erro ao conectar com o serviço de emissão.";
      enqueueSnackbar("Erro: " + msg, { variant: 'error' });
      pushLog(`ERRO: ${msg}`);
      setLoadingEmitir(false);
    }
  }, [podeEmitir, preview, pushLog, enqueueSnackbar]);

  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const response = await getEmpresas();
        setEmpresaData(response.data || []);
      } catch (error) {
        enqueueSnackbar('Erro ao carregar empresas', { variant: 'error' });
        console.error("Erro ao carregar empresas:", error);
      }
    };
    carregarEmpresas();
  }, [enqueueSnackbar]);

  const gerarBtnClass = podeGerar
    ? "ind-btn ind-btn--primary ind-btn--full"
    : "ind-btn ind-btn--primary ind-btn--full ind-btn--disabled";
  
  const emitirBtnClass = podeEmitir
    ? "ind-btn ind-btn--success ind-btn--full"
    : "ind-btn ind-btn--success ind-btn--full ind-btn--disabled";

  const isCondomed = empresa?.CEDENTE?.includes("CONDOMED");

  return (
    <div className="ind-page">
      <div className="ind-card">
        <header className="ind-header">
          <div className="ind-header__title">
            <h1 className="ind-title">Emissão · Individual</h1>
            <p className="ind-subtitle">Preencha os dados do tomador e do serviço para emitir a nota.</p>
          </div>
        </header>

        <div className="ind-body">
          <section className="fc-section">
            <EmpresaSelect
              value={empresa}
              onChange={setEmpresa}
              empresas={empresaData}
            />
          </section>

          <form onSubmit={handleGerar} className="ind-form">
            <div className="ind-section">
              <div className="ind-section__header">
                <h2 className="ind-section__title">Tomador de serviços</h2>
                <p className="ind-section__hint">Campos mínimos: CPF/CNPJ, Nome e Discriminação.</p>
              </div>

              <div className="ind-section__content">
                <div className="ind-grid ind-grid--3">
                  <div className="ind-field">
                    <label className="ind-label">CPF/CNPJ</label>
                    <input
                      name="documento"
                      placeholder="CPF/CNPJ"
                      className="ind-input"
                      value={tomador.documento}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Nome / Razão Social</label>
                    <input
                      name="nome"
                      placeholder="Nome / Razão Social"
                      className="ind-input"
                      value={tomador.nome}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">E-mail</label>
                    <input
                      name="email"
                      placeholder="email@exemplo.com"
                      className="ind-input"
                      value={tomador.email}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">CEP</label>
                    <input
                      name="cep"
                      placeholder="CEP"
                      className="ind-input"
                      value={tomador.cep}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Logradouro</label>
                    <input
                      name="logradouro"
                      placeholder="Logradouro"
                      className="ind-input"
                      value={tomador.logradouro}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Número</label>
                    <input
                      name="numero"
                      placeholder="Número"
                      className="ind-input"
                      value={tomador.numero}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Bairro</label>
                    <input
                      name="bairro"
                      placeholder="Bairro"
                      className="ind-input"
                      value={tomador.bairro}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Cidade</label>
                    <input
                      name="cidade"
                      placeholder="Cidade"
                      className="ind-input"
                      value={tomador.cidade}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>

                  <div className="ind-field ind-field--uf">
                    <label className="ind-label">UF</label>
                    <input
                      name="uf"
                      placeholder="UF"
                      maxLength={2}
                      className="ind-input"
                      value={tomador.uf}
                      onChange={handleChange(tomador, setTomador)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <section className="ind-section">
              <div className="ind-section__header">
                <h2 className="ind-section__title">Discriminação dos serviços</h2>
                <p className="ind-section__hint">Descreva o serviço (até 1000 caracteres).</p>
              </div>

              <div className="ind-section__content">
                <textarea
                  className="ind-textarea"
                  rows={6}
                  maxLength={1000}
                  value={servico}
                  onChange={(e) => setServico(e.target.value)}
                  placeholder="Descreva os serviços prestados…"
                  aria-label="Discriminação dos serviços"
                  required
                />
                <div className="ind-helper">
                  <span className="ind-helper__muted">Dica:</span> evite abreviações; isso aparece na nota.
                </div>
              </div>
            </section>

            <section className="ind-section">
              <div className="ind-section__header">
                <h2 className="ind-section__title">Valores da nota</h2>
                <p className="ind-section__hint">O valor total precisa ser maior que zero.</p>
              </div>

              <div className="ind-section__content">
                <div className="ind-grid ind-grid--4">
                  <div className="ind-field">
                    <label className="ind-label">Valor total (R$)</label>
                    <input
                      name="valorNota"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="ind-input ind-money"
                      value={valores.valorNota}
                      onChange={handleMoneyChange("valorNota")}
                      onBlur={handleMoneyBlur("valorNota")}
                      onFocus={handleMoneyFocus}
                      required
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Deduções (R$)</label>
                    <input
                      name="deducoes"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="ind-input ind-money"
                      value={valores.deducoes}
                      onChange={handleMoneyChange("deducoes")}
                      onBlur={handleMoneyBlur("deducoes")}
                      onFocus={handleMoneyFocus}
                    />
                  </div>

                  <div className="ind-field">
                    <label className="ind-label">Descontos (R$)</label>
                    <input
                      name="descontos"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="ind-input ind-money"
                      value={valores.descontos}
                      onChange={handleMoneyChange("descontos")}
                      onBlur={handleMoneyBlur("descontos")}
                      onFocus={handleMoneyFocus}
                    />
                  </div>

                {isCondomed && (
                  <select
                    className="fc-input fc-select"
                    value={codigoServico}
                    onChange={(e) => setCodigoServico(e.target.value)}
                  >
                    <option value="170901">Cód. 170901</option>
                    <option value="170902">Cód. 170902</option>
                    <option value="040301">Cód. 040301</option>
                  </select>
                )}

                  <div className="ind-field">
                    <label className="ind-label">ISS Retido?</label>
                    <div className="ind-radio">
                      <label className="ind-radio__item">
                        <input
                          type="radio"
                          name="issRetido"
                          value="sim"
                          checked={valores.issRetido === "sim"}
                          onChange={handleChange(valores, setValores)}
                        />
                        Sim
                      </label>

                      <label className="ind-radio__item">
                        <input
                          type="radio"
                          name="issRetido"
                          value="nao"
                          checked={valores.issRetido === "nao"}
                          onChange={handleChange(valores, setValores)}
                        />
                        Não
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <button
              className={gerarBtnClass}
              type="submit"
              disabled={!podeGerar || loadingGerar || loadingEmitir}
            >
              {loadingGerar ? "GERANDO PRÉVIA..." : "GERAR PRÉVIA"}
            </button>
          </form>

          <section className="ind-section">
            <LogEmissao entries={logs} maxHeight={120} />

            {loadingEmitir && (
              <div className="ind-progress">
                <div className="ind-progress-bar" style={{ width: `${progresso}%` }} />
              </div>
            )}
          </section>

          {/* PREVIEW (igual à Emissão por Fatura) */}
          <section className="ind-section">
            {preview ? (
              <div className="ind-preview">
                <h2 className="ind-preview-title">Conferência de Dados</h2>

                <div className="ind-grid">
                  <div className="ind-metric">
                    <span className="ind-label">Valor Total:</span>
                    <p className="ind-value">
                      {preview
                        .reduce(
                          (acc, item) => acc + (item?.servico?.[0]?.valor?.servico || 0),
                          0
                        )
                        .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>

                  <div className="ind-metric">
                    <span className="ind-label">Código de Serviço</span>
                    <p className="ind-value">{preview[0].servico[0].codigo}</p>
                  </div>

                  <div className="ind-metric">
                    <span className="ind-label">Nº Notas Fiscais</span>
                    <p className="ind-value">{preview.length}</p>
                  </div>

                  <div className="ind-block ind-grid-span">
                    <div className="ind-metric">
                      <span className="ind-label">Emissor:</span>
                      <p className="ind-value">
                        {fixBrokenLatin(preview[0]?.prestador?.razaoSocial)}
                        {" "}- {preview[0]?.prestador?.cpfCnpj}
                      </p>
                    </div>

                    <div className="ind-metric">
                      <span className="ind-label">Tomador:</span>
                      <p className="ind-value">
                        {fixBrokenLatin(preview[0]?.tomador?.razaoSocial)}
                        {" "}- {preview[0]?.tomador?.cpfCnpj}
                      </p>
                    </div>

                    <span className="ind-label">Discriminação do Serviço:</span>
                    <p className="ind-discriminacao">{fixBrokenLatin(preview[0]?.servico[0]?.discriminacao)}</p>
                  </div>
                </div>

                <button
                  className={emitirBtnClass}
                  onClick={handleEmitir}
                  disabled={!podeEmitir || loadingEmitir}
                >
                  {loadingEmitir ? `A PROCESSAR (${progresso}%)` : "EMITIR NOTA FISCAL"}
                </button>
              </div>
            ) : (
              <div className="ind-placeholder">Preencha os dados e clique em "GERAR PRÉVIA" para visualizar.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}