import { useMemo, useState, useCallback } from "react";
import LogEmissao from "../../components/LogEmissao/LogEmissao";
import { getNfsePreview, iniciarEmissao2 } from "../../services/nfseService";
import "../../styles/emissao.css";
import "../../styles/emissao-planilha.css";
import { useSnackbar } from "notistack";
import { fixBrokenLatin } from "../../utils/normalizacao_textual";
import { lerPlanilhaDescricoes, normalizarDocumento } from "../../utils/planilha_descricoes";
import PageTemplate from "../../components/PageTemplate/PageTemplate";
import { FaFileInvoiceDollar } from "react-icons/fa";
import {
  FiUpload,
  FiX,
  FiFileText,
  FiSearch,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";

const formatarDoc = (doc) => {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc || "—";
};

const formatarBRL = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EmissaoFaturaPlanilha() {
  const [fatura, setFatura] = useState("");
  const [tipoFatura, setTipoFatura] = useState("normal");
  const [observacao, setObservacao] = useState("");
  const [codigoServico, setCodigoServico] = useState("170901");

  const [arquivo, setArquivo] = useState(null);
  const [planilha, setPlanilha] = useState(null);

  const [preview, setPreview] = useState(null);
  // Observação usada na prévia (congelada no momento do "Gerar Prévia")
  const [obsPrevia, setObsPrevia] = useState("");
  const [emissor, setEmissor] = useState(null);
  const [nfseEmitidas, setNfseEmitidas] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingEmitir, setLoadingEmitir] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [soPendencias, setSoPendencias] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const pushLog = useCallback((msg, tipo = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const tipoPrefix =
      tipo === "erro" ? "❌ ERRO" :
        tipo === "sucesso" ? "✅ SUCESSO" :
          tipo === "alerta" ? "⚠️ ALERTA" : "ℹ️ INFO";
    setLogs((prev) => [...prev, `[${timestamp}] ${tipoPrefix}: ${msg}`].slice(-200));
  }, []);

  const mostrarErro = useCallback((mensagem, detalhes = null) => {
    enqueueSnackbar(mensagem, {
      variant: "error",
      autoHideDuration: 5000,
      anchorOrigin: { vertical: "top", horizontal: "right" },
    });
    pushLog(mensagem, "erro");
    if (detalhes) {
      console.error("Detalhes do erro:", detalhes);
      pushLog(`Detalhes: ${typeof detalhes === "object" ? JSON.stringify(detalhes) : detalhes}`, "erro");
    }
  }, [enqueueSnackbar, pushLog]);

  const mostrarSucesso = useCallback((mensagem) => {
    enqueueSnackbar(mensagem, {
      variant: "success",
      autoHideDuration: 3000,
      anchorOrigin: { vertical: "top", horizontal: "right" },
    });
    pushLog(mensagem, "sucesso");
  }, [enqueueSnackbar, pushLog]);

  const mostrarInfo = useCallback((mensagem) => {
    enqueueSnackbar(mensagem, {
      variant: "info",
      autoHideDuration: 4000,
      anchorOrigin: { vertical: "top", horizontal: "right" },
    });
    pushLog(mensagem, "info");
  }, [enqueueSnackbar, pushLog]);

  const mostrarAlerta = useCallback((mensagem) => {
    enqueueSnackbar(mensagem, {
      variant: "warning",
      autoHideDuration: 6000,
      anchorOrigin: { vertical: "top", horizontal: "right" },
    });
    pushLog(mensagem, "alerta");
  }, [enqueueSnackbar, pushLog]);

  const handleArquivo = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      mostrarErro("Formato inválido. Envie um arquivo .xlsx");
      return;
    }
    try {
      const resultado = await lerPlanilhaDescricoes(file);
      if (resultado.entries.length === 0) {
        mostrarErro("Nenhum CNPJ com serviço encontrado na planilha (coluna C = CNPJ, coluna D = serviço).");
        setArquivo(null);
        setPlanilha(null);
        return;
      }
      setArquivo(file);
      setPlanilha(resultado);
      pushLog(`Planilha "${file.name}" (aba ${resultado.aba}): ${resultado.entries.length} CNPJ(s) com descrição de serviço`, "sucesso");
      if (resultado.duplicados.length > 0) {
        mostrarAlerta(`${resultado.duplicados.length} CNPJ(s) duplicado(s) na planilha — mantida a primeira ocorrência.`);
      }
      if (resultado.semServico.length > 0) {
        mostrarAlerta(`${resultado.semServico.length} linha(s) com CNPJ mas sem serviço preenchido foram ignoradas.`);
      }
    } catch (err) {
      mostrarErro("Não foi possível ler a planilha.", err.message);
      setArquivo(null);
      setPlanilha(null);
    }
  }, [mostrarErro, mostrarAlerta, pushLog]);

  const removerArquivo = useCallback(() => {
    setArquivo(null);
    setPlanilha(null);
  }, []);

  const podeGerar = useMemo(
    () => !!fatura.trim() && fatura.trim().length >= 6 && !!planilha,
    [fatura, planilha]
  );

  const podeEmitir = useMemo(
    () => !!preview && !loadingGerar && !loadingEmitir,
    [preview, loadingGerar, loadingEmitir]
  );

  // Cruzamento fatura x planilha. A referência é sempre a FATURA:
  // toda nota da prévia aparece; quem não tem par na planilha fica marcado.
  const linhas = useMemo(() => {
    if (!preview) return [];
    return preview.map((nota) => {
      const docOriginal = String(nota?.tomador?.cpfCnpj || "").replace(/\D/g, "");
      const chave = normalizarDocumento(docOriginal);
      const itemPlanilha = (chave && planilha?.mapa?.[chave]) || null;
      const descricaoFinal = itemPlanilha
        ? [obsPrevia, itemPlanilha.servico].filter(Boolean).join(" ").trim()
        : (nota?.servico?.[0]?.discriminacao || "");
      return {
        nota,
        chave,
        doc: docOriginal,
        nome: fixBrokenLatin(nota?.tomador?.razaoSocial || ""),
        valor: nota?.servico?.[0]?.valor?.servico || 0,
        temDescricao: !!itemPlanilha,
        descricaoFinal,
      };
    });
  }, [preview, planilha, obsPrevia]);

  const totalSemDescricao = useMemo(
    () => linhas.filter((l) => !l.temDescricao).length,
    [linhas]
  );

  const valorTotal = useMemo(
    () => linhas.reduce((acc, l) => acc + l.valor, 0),
    [linhas]
  );

  // Quem está na planilha mas não na fatura: ignorado na emissão, só alerta.
  const sobrasPlanilha = useMemo(() => {
    if (!preview || !planilha) return [];
    const docsFatura = new Set(linhas.map((l) => l.chave).filter(Boolean));
    return planilha.entries.filter((e) => !docsFatura.has(e.cnpj));
  }, [preview, planilha, linhas]);

  const linhasVisiveis = useMemo(() => {
    let items = linhas;
    if (soPendencias) items = items.filter((l) => !l.temDescricao);
    if (filtroTexto.trim()) {
      const termo = filtroTexto.trim().toLowerCase();
      const termoDigitos = termo.replace(/\D/g, "");
      items = items.filter((l) =>
        l.nome.toLowerCase().includes(termo) ||
        (termoDigitos && l.doc.includes(termoDigitos))
      );
    }
    return items;
  }, [linhas, soPendencias, filtroTexto]);

  const handleGerar = useCallback(async (e) => {
    e?.preventDefault();

    if (!fatura.trim() || fatura.trim().length < 6) {
      mostrarErro("Informe o número da fatura (mínimo 6 dígitos)");
      return;
    }
    if (!planilha) {
      mostrarErro("Importe a planilha de descrições antes de gerar a prévia");
      return;
    }

    setLoadingGerar(true);
    setPreview(null);
    setNfseEmitidas(null);
    setProgresso(0);
    setFiltroTexto("");
    setSoPendencias(false);

    mostrarInfo(`Consultando dados da fatura #${fatura}...`);

    try {
      const isParcelada = tipoFatura === "parcelada";
      const obs = observacao.trim();

      // Mesma prévia padrão da emissão por fatura: o backend valida tomador,
      // CEP, documento e resolve o emissor pelo cedente da fatura.
      const payload = {
        protocolo_id: "NFSe_FATPLAN_" + Date.now(),
        fatura_numero: fatura,
        observacao: obs,
        parcela: 1,
        codigo: codigoServico,
        parcelada: isParcelada,
        vr: false,
        tipo_fatura: tipoFatura,
      };

      const response = await getNfsePreview(payload);

      if (response.sucesso) {
        setPreview(response.data);
        setObsPrevia(obs);

        const prestador = response.metadata?.prestador || response.data[0]?.prestador || null;
        setEmissor(prestador);
        if (prestador?.razaoSocial) {
          pushLog(`Emissor identificado pela fatura: ${fixBrokenLatin(prestador.razaoSocial)} - ${prestador.cpfCnpj}`, "info");
        }

        const codigoRetornado = response.data[0]?.servico?.[0]?.codigo;
        if (codigoRetornado) setCodigoServico(String(codigoRetornado));

        const emitidas = response.metadata?.nfse_emitidas || null;
        setNfseEmitidas(emitidas);
        if (emitidas?.ja_emitida) {
          mostrarAlerta(`Atenção: esta fatura já possui ${emitidas.total_autorizadas} NFS-e emitida(s). Confira antes de emitir novamente.`);
        } else if (emitidas?.total_registros > 0) {
          mostrarAlerta(`Esta fatura já possui ${emitidas.total_registros} registro(s) de emissão em andamento ou com erro.`);
        }

        // Resumo do cruzamento com a planilha
        const docsFatura = response.data.map((n) =>
          normalizarDocumento(String(n?.tomador?.cpfCnpj || ""))
        );
        const comMatch = docsFatura.filter((d) => d && planilha.mapa[d]).length;
        const semMatch = response.data.length - comMatch;
        const sobras = planilha.entries.filter((e) => !docsFatura.includes(e.cnpj)).length;

        pushLog(`Prévia gerada: ${response.data.length} nota(s) na fatura`, "sucesso");
        pushLog(`Match de CNPJ: ${comMatch} com descrição da planilha, ${semMatch} sem correspondência`, semMatch > 0 ? "alerta" : "sucesso");
        if (sobras > 0) {
          pushLog(`${sobras} CNPJ(s) da planilha não estão na fatura e serão ignorados`, "alerta");
        }

        if (semMatch > 0) {
          mostrarAlerta(`${semMatch} nota(s) da fatura sem descrição na planilha — marcadas em vermelho na conferência.`);
        } else {
          mostrarSucesso("Todas as notas da fatura têm descrição na planilha!");
        }
      } else {
        const erroMsg = response?.erro || "Falha ao obter prévia da nota.";
        if (erroMsg.includes("fatura") && erroMsg.includes("não encontrada")) {
          mostrarErro(`Fatura ${fatura} não encontrada no sistema`);
        } else {
          mostrarErro("Erro ao gerar prévia", erroMsg);
        }
      }
    } catch (err) {
      let mensagemErro = "Erro ao conectar com o serviço";
      if (err.response?.status === 422 && err.response?.data?.error) {
        mensagemErro = err.response.data.error;
      } else if (err.message?.includes("Network Error") || err.message?.includes("timeout")) {
        mensagemErro = "Falha na conexão com o servidor. Verifique sua internet e tente novamente.";
      } else if (err.response?.status === 500) {
        mensagemErro = "Erro interno do servidor. Tente novamente mais tarde.";
      } else if (err.response?.status === 404) {
        mensagemErro = "Serviço temporariamente indisponível";
      }
      mostrarErro(mensagemErro, err.message);
    } finally {
      setLoadingGerar(false);
    }
  }, [fatura, observacao, codigoServico, tipoFatura, planilha, mostrarErro, mostrarInfo, mostrarSucesso, mostrarAlerta, pushLog]);

  const handleEmitir = useCallback(async () => {
    if (!preview || preview.length === 0) {
      mostrarErro("Gere a prévia antes de emitir.");
      return;
    }

    if (totalSemDescricao > 0) {
      mostrarAlerta(`${totalSemDescricao} nota(s) sem descrição da planilha serão emitidas com a discriminação padrão.`);
    }

    setLoadingEmitir(true);
    setProgresso(10);
    mostrarInfo("Iniciando emissão das notas fiscais...");

    // Cada nota sai com a SUA descrição: quem casou com a planilha recebe a
    // discriminação individual; quem não casou mantém a discriminação padrão da prévia.
    const notaFinal = linhas.map(({ nota, temDescricao, descricaoFinal }) => ({
      ...nota,
      fatura_numero: fatura,
      tipo_nfe: "comum",
      codigo: codigoServico,
      servico: temDescricao && nota.servico?.length
        ? [{ ...nota.servico[0], discriminacao: descricaoFinal }, ...nota.servico.slice(1)]
        : nota.servico,
    }));

    try {
      const res = await iniciarEmissao2(notaFinal);

      if (res.status === "sucesso") {
        setProgresso(100);
        mostrarSucesso("Lote enviado com sucesso! Acompanhe o status das notas no setor de consultas.");
        pushLog(`Lote enviado: ${notaFinal.length} nota(s) encaminhada(s) para processamento`, "sucesso");
        pushLog(`ID do lote: ${res.protocolo_id || "N/A"}`, "info");

        setTimeout(() => {
          setFatura("");
          setTipoFatura("normal");
          setObservacao("");
          setObsPrevia("");
          setPreview(null);
          setEmissor(null);
          setNfseEmitidas(null);
          setArquivo(null);
          setPlanilha(null);
          setCodigoServico("170901");
          setProgresso(0);
          setFiltroTexto("");
          setSoPendencias(false);
        }, 2000);
      } else {
        const erroMsg = res?.erro || res?.error || "Erro desconhecido ao enviar lote.";
        mostrarErro("Falha ao enviar lote para emissão", erroMsg);
      }
    } catch (err) {
      let mensagemErro = "Erro ao processar emissão";
      if (err.message?.includes("Network Error")) {
        mensagemErro = "Falha na conexão. Verifique sua internet e tente novamente.";
      } else if (err.response?.status === 429) {
        mensagemErro = "Muitas requisições. Aguarde um momento antes de tentar novamente.";
      } else if (err.response?.status === 503) {
        mensagemErro = "Serviço de emissão temporariamente indisponível.";
      }
      mostrarErro(mensagemErro, err.message);
    } finally {
      setLoadingEmitir(false);
    }
  }, [preview, linhas, totalSemDescricao, fatura, codigoServico, mostrarErro, mostrarInfo, mostrarSucesso, mostrarAlerta, pushLog]);

  const gerarBtnClass = useMemo(() => {
    const base = "fc-btn fc-btn--primary fc-btn--full";
    return !podeGerar || loadingGerar || loadingEmitir ? `${base} fc-btn--disabled` : base;
  }, [podeGerar, loadingGerar, loadingEmitir]);

  const emitirBtnClass = useMemo(() => {
    const base = "fc-btn fc-btn--success fc-btn--full";
    return !podeEmitir || loadingEmitir ? `${base} fc-btn--disabled` : base;
  }, [podeEmitir, loadingEmitir]);

  return (
    <PageTemplate
      title="Emissão · Fatura + Descrição"
      subtitle="Emita notas de uma fatura com descrições individuais por condômino, importadas de planilha"
      icon={<FaFileInvoiceDollar />}
      className="consulta-comercial-page"
    >
      <div className="fc-page">
        <div className="fc-card">
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
                    placeholder="Ex: 176468"
                    value={fatura}
                    onChange={(e) => setFatura(e.target.value.replace(/[^\d]/g, ""))}
                    maxLength={10}
                  />
                </div>

                <div className="fc-input-group fc-input-group--narrow">
                  <label className="fc-input-label">Tipo de Fatura</label>
                  <select
                    className="fc-input fc-select"
                    value={tipoFatura}
                    onChange={(e) => setTipoFatura(e.target.value)}
                    disabled={loadingGerar || loadingEmitir}
                  >
                    <option value="normal">Fatura normal</option>
                    <option value="parcelada">Fatura parcelada</option>
                  </select>
                </div>
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Planilha de Descrições (.xlsx) *</label>
                <div
                  className={`fpl-dropzone ${arquivo ? "fpl-dropzone--active" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleArquivo(e.dataTransfer.files?.[0]);
                  }}
                >
                  {arquivo ? (
                    <div className="fpl-file-selected">
                      <FiFileText size={26} />
                      <div className="fpl-file-info">
                        <strong>{arquivo.name}</strong>
                        <span>
                          {(arquivo.size / 1024).toFixed(1)} KB · {planilha?.entries?.length || 0} CNPJ(s) com serviço
                        </span>
                      </div>
                      <button
                        type="button"
                        className="fpl-btn-remove"
                        onClick={removerArquivo}
                        disabled={loadingGerar || loadingEmitir}
                        title="Remover arquivo"
                      >
                        <FiX size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FiUpload size={28} />
                      <p>Arraste a planilha aqui ou clique para selecionar</p>
                      <span className="fpl-dropzone-hint">
                        Coluna C = CNPJ · Coluna D = Serviço (descrição da nota)
                      </span>
                      <input
                        type="file"
                        accept=".xlsx"
                        className="fpl-file-input"
                        onChange={(e) => {
                          handleArquivo(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="fc-input-group">
                <label className="fc-input-label">Observação (prefixo opcional da descrição)</label>
                <textarea
                  className="fc-input fc-textarea"
                  placeholder="Ex: SERVIÇOS REGULATÓRIOS — texto exibido antes do serviço da planilha em cada nota"
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  maxLength={500}
                />
                <div className="fc-input-help">{observacao.length}/500 caracteres</div>
              </div>

              <button
                className={gerarBtnClass}
                type="submit"
                disabled={!podeGerar || loadingGerar || loadingEmitir}
                title={!podeGerar ? "Informe a fatura e importe a planilha" : ""}
              >
                {loadingGerar ? (
                  <>
                    <span className="fc-spinner"></span>
                    GERANDO PRÉVIA...
                  </>
                ) : "GERAR PRÉVIA"}
              </button>
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
                </div>

                {nfseEmitidas?.total_registros > 0 && (
                  <div className="fc-alert fc-alert--warning">
                    <strong>
                      {nfseEmitidas.ja_emitida
                        ? `⚠️ Esta fatura já possui ${nfseEmitidas.total_autorizadas} NFS-e emitida(s)!`
                        : `ℹ️ Esta fatura já possui ${nfseEmitidas.total_registros} registro(s) de emissão (pendente/erro).`}
                    </strong>
                    <ul className="fc-alert-list">
                      {nfseEmitidas.notas.slice(0, 5).map((n, i) => (
                        <li key={i}>
                          {n.numero_nfse ? `NFS-e nº ${n.numero_nfse}` : "Sem número"}
                          {" · "}{(n.situacao_prefeitura || n.status || "—").toUpperCase()}
                          {n.data_emissao_prefeitura || n.data_criacao
                            ? ` · ${new Date(n.data_emissao_prefeitura || n.data_criacao).toLocaleDateString("pt-BR")}`
                            : ""}
                          {n.tomador ? ` · ${fixBrokenLatin(n.tomador)}` : ""}
                        </li>
                      ))}
                      {nfseEmitidas.notas.length > 5 && (
                        <li>… e mais {nfseEmitidas.notas.length - 5} registro(s)</li>
                      )}
                    </ul>
                  </div>
                )}

                {sobrasPlanilha.length > 0 && (
                  <div className="fc-alert fc-alert--warning">
                    <strong>
                      ⚠️ {sobrasPlanilha.length} CNPJ(s) da planilha não estão na fatura e serão ignorados:
                    </strong>
                    <ul className="fc-alert-list">
                      {sobrasPlanilha.slice(0, 8).map((s, i) => (
                        <li key={i}>
                          {formatarDoc(s.cnpj)}{s.nome ? ` · ${s.nome}` : ""} (linha {s.linha})
                        </li>
                      ))}
                      {sobrasPlanilha.length > 8 && (
                        <li>… e mais {sobrasPlanilha.length - 8} registro(s)</li>
                      )}
                    </ul>
                  </div>
                )}

                {totalSemDescricao > 0 && (
                  <div className="fc-alert fc-alert--warning">
                    <strong>
                      ⚠️ {totalSemDescricao} nota(s) da fatura sem descrição na planilha (marcadas em vermelho).
                    </strong>{" "}
                    Se emitidas assim, sairão com a discriminação padrão
                    {obsPrevia ? ` ("${obsPrevia}")` : ` ("Serviços - Fatura: ${fatura}")`}.
                  </div>
                )}

                <div className="fpl-metrics">
                  <div className="fc-metric">
                    <span className="fc-label">Valor Total</span>
                    <p className="fc-value">{formatarBRL(valorTotal)}</p>
                  </div>
                  <div className="fc-metric">
                    <span className="fc-label">Nº Notas Fiscais</span>
                    <p className="fc-value">{linhas.length}</p>
                  </div>
                  <div className="fc-metric">
                    <span className="fc-label">Com descrição</span>
                    <p className="fc-value fpl-value--ok">{linhas.length - totalSemDescricao}</p>
                  </div>
                  <div className="fc-metric">
                    <span className="fc-label">Sem descrição</span>
                    <p className={`fc-value ${totalSemDescricao > 0 ? "fpl-value--erro" : "fpl-value--ok"}`}>
                      {totalSemDescricao}
                    </p>
                  </div>
                  <div className="fc-metric">
                    <span className="fc-label">Emissor</span>
                    <p className="fc-value">
                      {fixBrokenLatin(emissor?.razaoSocial || "").split(" ").slice(0, 2).join(" ")}
                      {emissor?.cpfCnpj ? ` - ${emissor.cpfCnpj}` : ""}
                    </p>
                  </div>
                </div>

                <div className="fpl-filtros">
                  <div className="fpl-search-box">
                    <FiSearch size={16} className="fpl-search-icon" />
                    <input
                      type="text"
                      className="fpl-search-input"
                      placeholder="Filtrar por condômino ou CNPJ..."
                      value={filtroTexto}
                      onChange={(e) => setFiltroTexto(e.target.value)}
                    />
                    {filtroTexto && (
                      <button className="fpl-clear-filter" onClick={() => setFiltroTexto("")}>
                        <FiX size={16} />
                      </button>
                    )}
                  </div>
                  <label className="fpl-toggle">
                    <input
                      type="checkbox"
                      checked={soPendencias}
                      onChange={(e) => setSoPendencias(e.target.checked)}
                    />
                    Mostrar só pendências ({totalSemDescricao})
                  </label>
                </div>

                <div className="fpl-table-wrapper">
                  <table className="fpl-table">
                    <thead>
                      <tr>
                        <th>Condômino</th>
                        <th>CNPJ</th>
                        <th>Serviço (Discriminação)</th>
                        <th className="fpl-th-valor">Valor</th>
                        <th>Planilha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasVisiveis.map((l, idx) => (
                        <tr
                          key={l.nota?.idIntegracao || idx}
                          className={l.temDescricao ? "" : "fpl-row--erro"}
                        >
                          <td className="fpl-cell-nome">{l.nome || "—"}</td>
                          <td className="fpl-cell-doc">{formatarDoc(l.doc)}</td>
                          <td className="fpl-cell-servico">
                            {l.temDescricao
                              ? l.descricaoFinal
                              : (l.descricaoFinal || "Sem descrição na planilha")}
                          </td>
                          <td className="fpl-cell-valor">{formatarBRL(l.valor)}</td>
                          <td>
                            {l.temDescricao ? (
                              <span className="fpl-badge fpl-badge--ok">
                                <FiCheckCircle size={12} /> OK
                              </span>
                            ) : (
                              <span className="fpl-badge fpl-badge--erro">
                                <FiAlertCircle size={12} /> SEM DESCRIÇÃO
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {linhasVisiveis.length === 0 && (
                        <tr>
                          <td colSpan={5} className="fpl-empty">
                            Nenhum registro para o filtro atual.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="fc-placeholder">
                <p>Aguardando importação de dados da fatura...</p>
                <small>Informe a fatura, importe a planilha e clique em "Gerar Prévia"</small>
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
            ) : "EMITIR NOTAS FISCAIS"}
          </button>
        </footer>
      </div>
    </PageTemplate>
  );
}
