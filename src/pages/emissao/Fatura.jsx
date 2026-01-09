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
  
  const [parcelada, setParcelada] = useState(false);

  const [observacao, setObservacao] = useState("");
  const [codigoServico, setCodigoServico] = useState("170901");

  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);

  const [empresaData, setEmpresaData] = useState([]);
  const [progresso, setProgresso] = useState(0);
  

  const { enqueueSnackbar } = useSnackbar();

  const podeGerar = useMemo(() => !!empresa && !!fatura.trim(), [empresa, fatura]);
  
  const podeEmitir = useMemo(
    () => !!preview && !loadingGerar && !loadingEmitir,
    [preview, loadingGerar, loadingEmitir]
  );

  const pushLog = useCallback((msg) => {
    setLogs((prev) =>
      [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-200)
    );
  }, []);

  const handleGerar = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!podeGerar) {
        enqueueSnackbar('Preencha empresa, fatura e observação para gerar a prévia', { variant: 'error' });
        return;
      }

      setLoadingGerar(true);
      setPreview(null);
      setProgresso(0);

      pushLog(`Consultando dados da fatura #${fatura} no banco local (Firebird)...`);
      enqueueSnackbar('Consultando dados da fatura...', { variant: 'info' });

      // DEBUG
      // console.log("=== DEBUG EMPRESA ===");
      // console.log("Empresa selecionada:", empresa);
      // console.log("CNPJ:", empresa?.CNPJ);
      // console.log("CEDENTE:", empresa?.CEDENTE);
      
      if (!empresa || !empresa.CNPJ || !empresa.CEDENTE) {
        enqueueSnackbar('Dados da empresa incompletos. Selecione novamente.', { variant: 'error' });
        setLoadingGerar(false);
        return;
      }

      try {
        const payload = {
          protocolo_id: "REQ_" + Date.now(),
          fatura_numero: fatura,
          prestador_cnpj: empresa.CNPJ,
          razaoSocial: empresa.CEDENTE,
          observacao: observacao,
          parcela: parcelada,
          codigo: codigoServico
        };

        // console.log("Payload enviado para API:", payload);
        const response = await getNfsePreview(payload);

        if (response.sucesso) {
          setPreview(response.data);
          pushLog("Dados importados com sucesso. Por favor, valide os detalhes abaixo.");
          enqueueSnackbar('Dados carregados. Verifique antes de emitir.', { variant: 'success' });
        } else {
          const msg = response?.erro || "Falha ao obter prévia da nota.";
          enqueueSnackbar('Falha ao gerar dados da nota: ' + msg, { variant: 'error' });
          pushLog(`ERRO: ${msg}`);
        }
      } catch (err) {
        const msg = err?.error || "Erro ao ligar ao serviço de base de dados.";
        enqueueSnackbar('Falha ao gerar dados da nota: ' + msg, { variant: 'error' });
        pushLog(`ERRO: ${msg}`);
      } finally {
        setLoadingGerar(false);
      }
    },
    [empresa, fatura, parcelada, observacao, codigoServico, podeGerar, pushLog, enqueueSnackbar]
  );

  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) {
      enqueueSnackbar("Gere a prévia antes de emitir.", { variant: 'error' });
      return;
    }

    setLoadingEmitir(true);
    setProgresso(10);

    pushLog("A enviar lote para processamento...");
    enqueueSnackbar("Iniciando emissão da nota fiscal...", { variant: 'info' });
    try {
      const res = await iniciarEmissao(preview);

      if (res.status === "sucesso") {
       
        pushLog(`Lote enviado com sucesso. Aguarde a atualização do status das Notas no setor de consultas...`);
        enqueueSnackbar("Lote enviado. Acompanhe o status das notas posteriormente.", { variant: 'success' });
        setLoadingEmitir(false);
      } else {
        pushLog(`ERRO: Falha ao enviar lote para emissão. ${res?.erro || ""}`);
        enqueueSnackbar("Erro ao enviar lote: " + (res?.erro || "Erro desconhecido."), { variant: 'error' });
        setLoadingEmitir(false);
      }
    } catch (err) {
      setLoadingEmitir(false);
    }
  }, [empresa, fatura, podeEmitir, preview, pushLog]);


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
  }, []);

  // console.log("empresaData:", empresaData);

  const isCondomed = empresa?.CEDENTE?.includes("CONDOMED");
  
  const gerarBtnClass = podeGerar
    ? "fc-btn fc-btn--primary fc-btn--full"
    : "fc-btn fc-btn--primary fc-btn--full fc-btn--disabled";
  const emitirBtnClass = podeEmitir
    ? "fc-btn fc-btn--success fc-btn--full"
    : "fc-btn fc-btn--success fc-btn--full fc-btn--disabled";

  return (
    <div className="fc-page">
      <div className="fc-card">
        <header className="fc-header">
          <h2 className="fc-title">Emissão · Por Fatura</h2>
        </header>

        <section className="fc-section">
          <EmpresaSelect
            value={empresa}
            onChange={setEmpresa}
            empresas={empresaData}
          />
        </section>

          <form onSubmit={handleGerar} className="fc-form">
            <h3 className="fc-form-title">Dados de Importação</h3>

            <div className="fc-form-content">
              <div className="fc-row fc-row--flag">
                <label className="fc-flag">
                  <input
                    type="checkbox"
                    className="fc-checkbox"
                    checked={parcelada}
                    onChange={(e) => setParcelada(e.target.checked)}
                  />
                  <span className="fc-flag-text">Fatura Parcelada</span>
                </label>
              </div>

              <div className="fc-row fc-row--inputs">
                <input
                  className="fc-input fc-input--grow"
                  placeholder="Nº da Fatura (Ex: 161034)"
                  value={fatura}
                  onChange={(e) => setFatura(e.target.value.replace(/[^\d]/g, ""))}
                />

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
              </div>

              <textarea
                className="fc-input fc-textarea"
                placeholder="Observação da Nota (ex: Programa de Gestão de Segurança...)"
                rows={2}
                value={observacao}
                required
                onChange={(e) => setObservacao(e.target.value)}
              />

              <button
                className={gerarBtnClass}
                type="submit"
                disabled={!podeGerar || !observacao || loadingGerar || loadingEmitir}
              >
                {loadingGerar ? "GERANDO PRÉVIA..." : "GERAR"}
              </button>
            </div>
          </form>

          <section className="fc-section">
            <LogEmissao entries={logs} maxHeight={120} />

            {loadingEmitir && (
              <div className="fc-progress">
                <div className="fc-progress-bar" style={{ width: `${progresso}%` }} />
              </div>
            )}
          </section>

          <section className="fc-section">
            {preview ? (
              <div className="fc-preview">
                <h2 className="fc-preview-title">Conferência de Dados</h2>

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
              <div className="fc-placeholder">Aguardando importação de dados da fatura...</div>
            )}
          </section>
       
        </div>

        <footer className="fc-footer">
          <button
            className={emitirBtnClass}
            onClick={handleEmitir}
            disabled={!podeEmitir || loadingEmitir}
          >
            {loadingEmitir ? `A PROCESSAR (${progresso}%)` : "EMITIR NOTA FISCAL"}
          </button>
        </footer>
      </div>
    
  );
}
