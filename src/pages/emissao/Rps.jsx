import { useCallback, useMemo, useState } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import StatusBanner from "../../components/StatusBanner";
import JSZip from "jszip";
import { emitirNota, baixarPdf } from "../../services/emissao";
import "../../styles/emissao.css";

export default function EmissaoPorRps() {
  const [empresa, setEmpresa] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [itens, setItens] = useState([]);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);

  // paginação
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;

  const pushLog = useCallback((msg) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-300));
  }, []);

  const resumo = useMemo(() => {
    const qtd = itens.length;
    const total = itens.reduce((acc, it) => acc + (Number(it.valor) || 0), 0);
    return { qtd, total };
  }, [itens]);

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil(itens.length / porPagina)), [itens.length]);
  const visiveis = useMemo(() => {
    const inicio = (pagina - 1) * porPagina;
    return itens.slice(inicio, inicio + porPagina);
  }, [itens, pagina]);

  const podeGerar = useMemo(() => !!empresa && !!arquivo, [empresa, arquivo]);
  const podeEmitir = useMemo(() => itens.length > 0 && !loadingGerar && !loadingEmitir, [itens, loadingGerar, loadingEmitir]);

  function moeda(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function lerArquivo(file) {
    const txt = await file.text();
    return (
      txt
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          // aceita "RPS" OU "RPS,valor"
          const [rps, valor] = l.split(",").map((s) => s?.trim());
          return { rps, valor: valor ? Number(valor.replace(",", ".")) : undefined };
        })
        // remove duplicados por RPS
        .filter((v, i, a) => a.findIndex((x) => x.rps === v.rps) === i)
    );
  }

  const onGerar = useCallback(async (e) => {
    e?.preventDefault();
    if (!podeGerar) return;

    setStatus(null);
    setItens([]);
    setPagina(1);
    setLoadingGerar(true);
    pushLog(`Lendo arquivo para empresa ${empresa}…`);

    try {
      const arr = await lerArquivo(arquivo);
      setItens(arr);
      pushLog(`Arquivo processado: ${arr.length} linha(s) válida(s).`);
      setStatus({
        type: "ok",
        msg: `Prévia pronta: ${arr.length} RPS. Valor total ${moeda(arr.reduce((a, b) => a + (b.valor || 0), 0))}.`,
      });
    } catch (err) {
      setStatus({ type: "err", msg: "Não foi possível ler o arquivo." });
      pushLog("Erro ao ler arquivo.");
    } finally {
      setLoadingGerar(false);
    }
  }, [arquivo, empresa, podeGerar, pushLog]);

  const onEmitir = useCallback(async () => {
    if (!podeEmitir) return;
    setStatus(null);
    setLoadingEmitir(true);

    let ok = 0, erro = 0;

    const zip = new JSZip();
    const nomePasta = `NF_RPS_${empresa}_${new Date().toISOString().slice(0, 10)}`;
    const pasta = zip.folder(nomePasta);

    pushLog(`Iniciando emissão em lote (${itens.length} RPS)…`);

    for (const item of itens) {
      try {
        pushLog(`Emitindo RPS ${item.rps}…`);
        const { ok: deuBom, protocolo, pdfBlob, erro: erroApi } = await emitirNota({
          empresa,
          tipo: "RPS",
          numero: item.rps,
          preview: {
            itens: [{ cliente: `RPS ${item.rps}`, valor: item.valor || 0 }],
            valorTotal: item.valor || 0,
          },
        });

        if (!deuBom) {
          erro++;
          pushLog(`ERRO no RPS ${item.rps}: ${erroApi || "falha."}`);
          continue;
        }

        ok++;
        const nomePdf = `NF_RPS_${empresa}_${item.rps}_${protocolo}.pdf`;
        pasta.file(nomePdf, pdfBlob); 
        pushLog(`OK RPS ${item.rps} — protocolo ${protocolo}. Adicionado ao ZIP.`);
      } catch {
        erro++;
        pushLog(`ERRO inesperado no RPS ${item.rps}.`);
      }
    }

    if (ok === 0) {
      const msgNone = `Nenhuma nota emitida — nada para compactar. (${erro} erro(s))`;
      setStatus({ type: "err", msg: msgNone });
      pushLog(msgNone);
      setLoadingEmitir(false);
      return;
    }

    pushLog("Compactando arquivos em ZIP…");
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const nomeZip = `Lote_RPS_${empresa}_${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}.zip`;
    baixarPdf(nomeZip, zipBlob);
    pushLog(`ZIP gerado e download iniciado: ${nomeZip}`);

    const msg = `Lote finalizado: ${ok} sucesso(s), ${erro} erro(s).`;
    setStatus({ type: erro > 0 ? "err" : "ok", msg });
    pushLog(msg);
    setLoadingEmitir(false);
  }, [empresa, itens, podeEmitir, pushLog]);

  return (
    <div className="fc-page">
        {status && <StatusBanner type={status.type}>{status.msg}</StatusBanner>}
      <div className="fc-card">
        <header className="fc-header"><h1>Emissão · Por RPS</h1></header>

        <section className="fc-section">
          <EmpresaSelect value={empresa} onChange={setEmpresa} />
        </section>

        <form className="fc-form" onSubmit={onGerar}>
          <fieldset className="fc-fieldset">
            <legend>Importar arquivo</legend>
            <div className="fc-col">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                aria-label="Arquivo de RPS"
                className="fc-input-file"
              />
              <div className="fc-row">
                <button
                  className="fc-btn fc-btn-primary"
                  type="submit"
                  disabled={!podeGerar || loadingGerar}
                  aria-busy={loadingGerar}
                >
                  {loadingGerar ? "Processando..." : "GERAR"}
                </button>
              </div>
              <small className="fc-hint">
                Formatos aceitos: <code>RPS</code> ou <code>RPS,valor</code> (um por linha). Duplicados são ignorados.
              </small>
            </div>
          </fieldset>
        </form>

        <section className="fc-section">
          <LogEmissao entries={logs} maxHeight={160} emptyText="Sem registros ainda." />
        </section>

        <section className="fc-section">
          {itens.length > 0 ? (
            <div className="fc-preview">
              <div className="fc-grid">
                <div><h1>Prévia da Nota Fiscal</h1></div>
                <br />
                <div><strong>Empresa:</strong> {empresa}</div>
                <div><strong>RPS:</strong> {resumo.qtd}</div>
                <div className="fc-col-span">
                  <strong>Total:</strong> {moeda(resumo.total)}
                </div>
              </div>

              <div className="fc-table">
                <div className="fc-thead"><div>RPS</div><div>Valor</div></div>
                {visiveis.map((it, i) => (
                  <div className="fc-trow" key={`${pagina}-${i}`}>
                    <div>{it.rps}</div>
                    <div>{moeda(it.valor)}</div>
                  </div>
                ))}
              </div>

              {/* paginação */}
              <div className="fc-pagination">
                <button
                  className="pg-btn"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                >
                  ‹
                </button>

                <span className="pg-info">
                  Página {pagina} de {totalPaginas}
                </span>

                <button
                  className="pg-btn"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                >
                  ›
                </button>
              </div>
            </div>
          ) : (
            <div className="fc-placeholder">A prévia aparecerá aqui após clicar em “GERAR”.</div>
          )}
        </section>

        <footer className="fc-actions">
          <button
            className="fc-btn fc-btn-accent"
            onClick={onEmitir}
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
