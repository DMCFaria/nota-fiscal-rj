import React, { useMemo, useState, useCallback, useEffect } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import {
  getNfsePreview,
  iniciarEmissao,
  startStatusPolling
} from "../../services/nfseService";
import "../../styles/emissao.css";

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
  const [progresso, setProgresso] = useState(0);

  // Toast
  const [toast, setToast] = useState(null); // { type: "ok" | "err" | "info", msg: string }
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((type, msg, duration = 3500) => {
    setToast({ type, msg });
    setToastVisible(true);

    window.clearTimeout(showToast._t1);
    window.clearTimeout(showToast._t2);

    // inicia o "fade out" um pouco antes de sumir
    showToast._t1 = window.setTimeout(() => setToastVisible(false), Math.max(800, duration - 300));
    showToast._t2 = window.setTimeout(() => setToast(null), duration);
  }, []);
  // guarda timeouts na função
  showToast._t1 = showToast._t1 || null;
  showToast._t2 = showToast._t2 || null;

  useEffect(() => {
    return () => {
      window.clearTimeout(showToast._t1);
      window.clearTimeout(showToast._t2);
    };
  }, [showToast]);

  // Lógica para Condomed habilitar campo de código de serviço
  const isCondomed = useMemo(() => {
    const nome = typeof empresa === "string" ? empresa : empresa?.nome;
    return nome?.toLowerCase().includes("condomed");
  }, [empresa]);

  const podeGerar = useMemo(
    () => !!empresa && !!fatura.trim() && !!observacao.trim(),
    [empresa, fatura, observacao]
  );

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
        showToast("err", "Preencha empresa, fatura e observação para gerar a prévia.");
        return;
      }

      setLoadingGerar(true);
      setPreview(null);
      setProgresso(0);

      pushLog(`Consultando dados da fatura #${fatura} no banco local (Firebird)...`);
      showToast("info", "Consultando dados da fatura...");

      try {
        const payload = {
          protocolo_id: "REQ_" + Date.now(),
          fatura_numero: fatura,
          prestador_cnpj:
            typeof empresa === "object" ? empresa.cnpj : "22.708.714/0001-91",
          "codigo_serviço": codigoServico,
          observacao: observacao,
          parcela: parcelada
        };

        const response = await getNfsePreview(payload);

        if (response.sucesso) {
          setPreview(response.data);
          pushLog("Dados importados com sucesso. Por favor, valide os detalhes abaixo.");
          showToast("ok", "Dados carregados. Verifique antes de emitir.");
        } else {
          const msg = response?.erro || "Falha ao obter prévia da nota.";
          showToast("err", msg);
          pushLog(`ERRO: ${msg}`);
        }
      } catch (err) {
        const msg = err?.error || "Erro ao ligar ao serviço de base de dados.";
        showToast("err", msg);
        pushLog(`ERRO: ${msg}`);
      } finally {
        setLoadingGerar(false);
      }
    },
    [empresa, fatura, parcelada, observacao, codigoServico, podeGerar, pushLog, showToast]
  );

  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) {
      showToast("err", "Gere a prévia antes de emitir.");
      return;
    }

    setLoadingEmitir(true);
    setProgresso(10);

    pushLog("A enviar lote para processamento...");
    showToast("info", "Enviando lote para processamento...");

    try {
      const res = await iniciarEmissao(preview);

      if (res.status === "sucesso") {
        console.log(
          `Lote aceite. Protocolo Local: ${res.protocolo_lote}. A aguardar prefeitura...`
        );

        const faturaParts = res.protocolo_lote.split("_");
        showToast("info", "Lote aceito. Aguardando prefeitura...", 4000);

        startStatusPolling(
          faturaParts[1],
          (prog) => {
            setProgresso(prog.progresso);
            if (prog.message) pushLog(`Status: ${prog.message}`);
          },
          (pdfUrl) => {
            setLoadingEmitir(false);
            showToast("ok", "Nota autorizada! Abrindo PDF...", 4500);
            pushLog("Sucesso! PDF gerado.");
            if (pdfUrl) window.open(pdfUrl, "_blank");
          },
          (erroMsg) => {
            setLoadingEmitir(false);
            showToast("err", erroMsg || "Rejeição no processamento.");
            pushLog(`REJEIÇÃO: ${erroMsg}`);
          }
        );
      } else {
        setLoadingEmitir(false);
        const msg = res?.erro || "Falha ao iniciar emissão.";
        showToast("err", msg);
        pushLog(`ERRO: ${msg}`);
      }
    } catch (err) {
      setLoadingEmitir(false);
      const msg = err?.error || "Falha ao iniciar processo de emissão.";
      showToast("err", msg);
      pushLog(`ERRO: ${msg}`);
    }
  }, [podeEmitir, preview, pushLog, showToast]);

  const gerarBtnClass =
    "fc-btn fc-btn-primary w-full " +
    (!podeGerar || loadingGerar ? "is-disabled" : "is-enabled");

  const emitirBtnClass =
    "fc-btn fc-btn-accent " +
    (!podeEmitir || loadingEmitir ? "is-disabled" : "is-enabled");

  return (
    <div className="fc-page">
      {/* Toast */}
      {toast && (
        <div
          className={`fc-toast-wrap ${toastVisible ? "is-in" : "is-out"}`}
          role="status"
          aria-live="polite"
        >
          <div className={`fc-toast fc-toast--${toast.type}`}>
            <div className="fc-toast__msg">{toast.msg}</div>
            <button
              type="button"
              className="fc-toast__close"
              onClick={() => {
                setToastVisible(false);
                window.setTimeout(() => setToast(null), 250);
              }}
              aria-label="Fechar"
              title="Fechar"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="fc-card">
        <header className="fc-header">
          <h2 className="fc-title">Emissão · Por Fatura</h2>
        </header>

        <div className="fc-body">
          <section className="fc-section fc-section-empresa">
            <div className="fc-empresa-content">
              <EmpresaSelect
                value={empresa}
                onChange={(val) => {
                  setEmpresa(val);
                  setPreview(null);
                  showToast("info", "Empresa selecionada.");
                }}
              />
            </div>
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
                onChange={(e) => setObservacao(e.target.value)}
              />

              <button
                className={gerarBtnClass}
                type="submit"
                disabled={!podeGerar || loadingGerar || loadingEmitir}
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
                        {preview[0]?.prestador?.razaoSocial
                          .split(" ")
                          .slice(0, 2)
                          .join(" ")}{" "}
                        - {preview[0]?.prestador?.cpfCnpj}
                      </p>
                    </div>

                    <div className="fc-grid-span" />

                    <span className="fc-label">Discriminação do Serviço:</span>
                    <p className="fc-discriminacao">{preview[0]?.servico[0]?.discriminacao}</p>
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
    </div>
  );
}
