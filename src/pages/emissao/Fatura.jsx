import { useMemo, useState, useCallback } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import StatusBanner from "../../components/StatusBanner";
import { emitirNota, baixarPdf } from "../../services/emissao";
import "../../styles/emissao.css";

export default function EmissaoPorFatura() {
  const [empresa, setEmpresa] = useState("");
  const [fatura, setFatura] = useState("");
  const [parcelada, setParcelada] = useState(false);

  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState(null);

  const podeGerar = useMemo(
    () => !!empresa && !!fatura.trim(),
    [empresa, fatura]
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
      if (!podeGerar) return;

      setErro("");
      setStatus(null);
      setLoadingGerar(true);
      setPreview(null);

      pushLog(
        `Gerando prévia da fatura #${fatura} (${empresa})${
          parcelada ? " [PARCELADA]" : ""
        }...`
      );

      try {
        await new Promise((r) => setTimeout(r, 500));

        const resumoFake = {
          empresa,
          fatura,
          parcelada, 
          quantidadeNFs: 12,
          valorTotal: 15876.5,
          observacao: parcelada
            ? "Fatura parcelada — emitir conforme parcelas/competência"
            : "Serviços de corretagem — competência atual",
          itens: [
            { cliente: "ACME Ltda", valor: 4500.0 },
            { cliente: "Globex S.A.", valor: 3200.0 },
            { cliente: "Initech", valor: 2100.0 },
          ],
        };

        setPreview(resumoFake);
        pushLog("Prévia gerada com sucesso.");
        setStatus({ type: "ok", msg: "Prévia pronta. Revise e clique em EMITIR." });
      } catch {
        setErro("Falha ao gerar a prévia.");
        setStatus({ type: "err", msg: "Erro ao gerar a prévia." });
        pushLog("Erro ao gerar prévia.");
      } finally {
        setLoadingGerar(false);
      }
    },
    [empresa, fatura, parcelada, podeGerar, pushLog]
  );

  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) return;
    setErro("");
    setStatus(null);
    setLoadingEmitir(true);

    pushLog(`Iniciando emissão…${parcelada ? " [PARCELADA]" : ""}`);

    try {
      const { ok, protocolo, pdfBlob, erro: erroApi } = await emitirNota({
        empresa,
        tipo: "FATURA",
        numero: fatura,
        parcelada, 
        preview,
      });

      if (!ok) {
        setStatus({ type: "err", msg: erroApi || "Falha na emissão." });
        pushLog("Erro na emissão.");
        return;
      }

      setStatus({
        type: "ok",
        msg: `Emitida com sucesso. Protocolo ${protocolo}. Baixando PDF…`,
      });
      pushLog(`Emissão concluída. Protocolo ${protocolo}.`);

      baixarPdf(`NF_${empresa}_${fatura}_${protocolo}.pdf`, pdfBlob);
    } catch {
      setStatus({ type: "err", msg: "Falha inesperada na emissão." });
      pushLog("Erro na emissão.");
    } finally {
      setLoadingEmitir(false);
    }
  }, [empresa, fatura, parcelada, podeEmitir, preview, pushLog]);

  return (
    <div className="fc-page">
      {status && <StatusBanner type={status.type}>{status.msg}</StatusBanner>}

      <div className="fc-card">
        <header className="fc-header">
          <h1>Emissão · Por Fatura</h1>
        </header>

        <section className="fc-section">
          <EmpresaSelect value={empresa} onChange={setEmpresa} />
        </section>

        <form className="fc-form" onSubmit={handleGerar}>
          <fieldset className="fc-fieldset">
            <legend>Digite o nº da fatura</legend>

            <div className="fc-row fc-row--flag">
              <label className="fc-flag">
                <input
                  type="checkbox"
                  checked={parcelada}
                  onChange={(e) => {
                    setParcelada(e.target.checked);
                    
                    setPreview(null);
                    setStatus(null);
                  }}
                />
                <span>Fatura Parcelada</span>
              </label>
            </div>

            <div className="fc-row">
              <input
                className="fc-input"
                placeholder="Ex.: 158765"
                inputMode="numeric"
                value={fatura}
                onChange={(e) => setFatura(e.target.value.replace(/[^\d]/g, ""))}
                aria-label="Número da fatura"
              />
              <button
                className="fc-btn fc-btn-primary"
                type="submit"
                disabled={!podeGerar || loadingGerar}
                aria-busy={loadingGerar}
              >
                {loadingGerar ? "Gerando..." : "GERAR"}
              </button>
            </div>
          </fieldset>
        </form>

        <section className="fc-section">
          <LogEmissao entries={logs} maxHeight={180} emptyText="Sem registros ainda." />
        </section>

        <section className="fc-section">
          {preview ? (
            <div className="fc-preview">
              <div className="fc-grid">
                <header className="fc-header">
                  <h1>Prévia da Nota Fiscal</h1>
                </header>

                <br />

                <div><strong>Empresa:</strong> {preview.empresa}</div>
                <div><strong>Fatura:</strong> #{preview.fatura}</div>

                <div>
                  <strong>Parcelada:</strong> {preview.parcelada ? "Sim" : "Não"}
                </div>

                <div><strong>NF(s):</strong> {preview.quantidadeNFs}</div>
                <div>
                  <strong>Total Bruto:</strong>{" "}
                  {preview.valorTotal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
                <div className="fc-col-span">
                  <strong>Obs.:</strong> {preview.observacao}
                </div>
              </div>
            </div>
          ) : (
            <div className="fc-placeholder">A prévia aparecerá aqui após clicar em “GERAR”.</div>
          )}
        </section>

        {erro && <div className="fc-erro">{erro}</div>}

        <footer className="fc-actions">
          <button
            className="fc-btn fc-btn-accent"
            onClick={handleEmitir}
            disabled={!podeEmitir}
            aria-busy={loadingEmitir}
          >
            {loadingEmitir ? "Emitindo..." : "EMITIR"}
          </button>
        </footer>
      </div>
    </div>
  );
}
