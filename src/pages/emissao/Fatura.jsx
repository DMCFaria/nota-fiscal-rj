import React, { useMemo, useState, useCallback } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import StatusBanner from "../../components/StatusBanner";
import {
  getNfsePreview,
  iniciarEmissao,
  startStatusPolling
} from "../../services/nfseService";
import "../../styles/emissao.css";

/**
 * COMPONENTE PRINCIPAL: EmissaoPorFatura
 * Integração com Firebird (via Django/Ngrok) e Polling de Status
 */
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
  const [status, setStatus] = useState(null);
  const [progresso, setProgresso] = useState(0);

  // Lógica para detecção da Condomed para habilitar campo de código de serviço
  const isCondomed = useMemo(() => {
    const nome = typeof empresa === 'string' ? empresa : empresa?.nome;
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

  /**
   * Busca a prévia dos dados no Firebird através da View do Django
   */
  const handleGerar = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!podeGerar) return;

      setStatus(null);
      setLoadingGerar(true);
      setPreview(null);
      setProgresso(0);

      pushLog(`Consultando dados da fatura #${fatura} no banco local (Firebird)...`);

      try {
        const payload = {
          protocolo_id: "REQ_" + Date.now(),
          fatura_numero: fatura,
          prestador_cnpj: typeof empresa === 'object' ? empresa.cnpj : "22.708.714/0001-91",
          codigo_serviço: codigoServico,
          observacao: observacao,
          parcela: parcelada
        };

        const response = await getNfsePreview(payload);

        if (response.sucesso) {
          setPreview(response.data);
          pushLog("Dados importados com sucesso. Por favor, valide os detalhes abaixo.");
          setStatus({ type: "ok", msg: "Dados carregados. Verifique antes de emitir." });
        }
      } catch (err) {
        const msg = err.error || "Erro ao ligar ao serviço de base de dados.";
        setStatus({ type: "err", msg });
        pushLog(`ERRO: ${msg}`);
      } finally {
        setLoadingGerar(false);
      }
    },
    [empresa, fatura, parcelada, observacao, codigoServico, podeGerar, pushLog]
  );

  /**
   * Inicia o processo de emissão e monitoriza o status via Polling
   */
  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) return;
    setStatus(null);
    setLoadingEmitir(true);
    setProgresso(10);

    pushLog("A enviar lote para processamento...");

    try {
      const res = await iniciarEmissao(preview);

      if (res.status === "sucesso") {
        console.log(`Lote aceite. Protocolo Local: ${res.protocolo_lote}. A aguardar prefeitura...`);

        let fatura = res.protocolo_lote.split('_')
        
        startStatusPolling(
          fatura[1],
          (prog) => {
            setProgresso(prog.progresso);
            if (prog.message) pushLog(`Status: ${prog.message}`);
          },
          (pdfUrl) => {
            setLoadingEmitir(false);
            setStatus({ type: "ok", msg: "Nota Autorizada! A abrir PDF..." });
            pushLog("Sucesso! PDF gerado.");
            if (pdfUrl) window.open(pdfUrl, "_blank");
          },
          (erroMsg) => {
            setLoadingEmitir(false);
            setStatus({ type: "err", msg: erroMsg });
            pushLog(`REJEIÇÃO: ${erroMsg}`);
          }
        );
      }
    } catch (err) {
      setLoadingEmitir(false);
      const msg = err.error || "Falha ao iniciar processo de emissão.";
      setStatus({ type: "err", msg });
      pushLog(`ERRO: ${msg}`);
    }
  }, [podeEmitir, preview, pushLog]);

  return (
    <div className="fc-page p-4 bg-gray-100 min-h-screen font-sans">
      {status && <StatusBanner type={status.type}>{status.msg}</StatusBanner>}

      <div className="fc-card max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <header className="fc-header bg-blue-600 p-6 text-white">
          <h1 className="text-2xl font-bold">Emissão · Por Fatura</h1>
          <p className="text-blue-100 text-sm">Integração directa com Banco Firebird</p>
        </header>

        <div className="p-6 space-y-6">
          <section className="fc-section">
            <EmpresaSelect value={empresa} onChange={(val) => {
              setEmpresa(val);
              setPreview(null);
            }} />
          </section>

          <form onSubmit={handleGerar} className="fc-form bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Dados de Importação</h3>

            <div className="space-y-4">
              <div className="fc-row fc-row--flag">
                <label className="fc-flag flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600"
                    checked={parcelada}
                    onChange={(e) => setParcelada(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">Fatura Parcelada</span>
                </label>
              </div>

              <div className="fc-row flex flex-col md:flex-row gap-3">
                <input
                  className="fc-input flex-grow p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nº da Fatura (Ex: 161034)"
                  value={fatura}
                  onChange={(e) => setFatura(e.target.value.replace(/[^\d]/g, ""))}
                />

                {isCondomed && (
                  <select
                    className="fc-input p-2 border rounded bg-white min-w-[150px]"
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
                className="fc-input w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Observação da Nota (ex: Programa de Gestão de Segurança...)"
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />

              <button
                className={`fc-btn fc-btn-primary w-full py-2 rounded-md font-bold text-white transition-colors ${!podeGerar || loadingGerar ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                type="submit"
                disabled={!podeGerar || loadingGerar || loadingEmitir}
              >
                {loadingGerar ? "GERANDO PRÉVIA..." : "GERAR"}
              </button>
            </div>
          </form>

          <section className="fc-section">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Logs de Operação</h3>
            <LogEmissao entries={logs} maxHeight={120} />
            {loadingEmitir && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            )}
          </section>

          <section className="fc-section">
            {preview ? (
              <div className="fc-preview border-2 border-dashed border-blue-200 rounded-lg p-4 bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2">Conferência de Dados</h2>
                <div className="fc-grid grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                    <span className="text-gray-500">Valor Total:</span>
                    <p className="font-semibold text-green-700 text-lg">
                      {preview
                        .reduce((acc, item) => acc + (item?.servico?.[0]?.valor?.servico || 0), 0)
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div><span className="text-gray-500">Código de Serviço</span> <p className="font-semibold text-green-700 text-lg">{preview[0].servico[0].codigo}</p></div>
                  <div className="fc-col-span md:col-span-2"></div>
                  <div><span className="text-gray-500">Nº Notas Fiscais</span> <p className="font-semibold text-green-700 text-lg">{preview.length}</p></div>
                  <div className="fc-col-span md:col-span-2">
                  <div><span className="text-gray-500">Emissor:</span> <p className="font-semibold text-green-700 text-lg">{preview[0]?.prestador?.razaoSocial.split(' ').slice(0, 2).join(' ')} - {preview[0]?.prestador?.cpfCnpj}</p></div>
                  <div className="fc-col-span md:col-span-2"></div>
                    <span className="text-gray-500">Discriminação do Serviço:</span>
                    <p className="bg-white p-2 mt-1 rounded border border-blue-100 text-xs text-gray-600 whitespace-pre-wrap">
                      {preview[0]?.servico[0]?.discriminacao}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fc-placeholder text-center py-10 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
                Aguardando importação de dados da fatura...
              </div>
            )}
          </section>
        </div>

        <footer className="fc-actions p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            className={`fc-btn fc-btn-accent px-8 py-3 rounded-md font-bold text-white shadow-lg transition-transform active:scale-95 ${!podeEmitir || loadingEmitir ? 'bg-gray-400' : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
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