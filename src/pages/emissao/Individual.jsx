import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import { emitirNota, baixarPdf } from "../../services/emissao";
import "../../styles/emissaoIndividual.css";

export default function EmissaoIndividual() {
  const [empresa, setEmpresa] = useState("");
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
    valorNota: "",
    deducoes: "",
    descontos: "",
    issRetido: "nao"
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null); // { type: "ok" | "err" | "info", msg: string }
  const [toastState, setToastState] = useState("idle"); // idle | in | out
  const toastTimerRef = useRef(null);

  const showToast = useCallback((type, msg, ms = 3800) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToast({ type, msg });
    setToastState("in");

    toastTimerRef.current = setTimeout(() => {
      setToastState("out");
      // dá tempo da animação de saída
      setTimeout(() => {
        setToast(null);
        setToastState("idle");
      }, 220);
    }, ms);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState("out");
    setTimeout(() => {
      setToast(null);
      setToastState("idle");
    }, 220);
  }, []);

  // Helpers moeda
  const parseBRL = useCallback((v) => {
    // aceita "1.234,56" / "1234,56" / "1234.56" / "R$ 1.234,56"
    if (v == null) return 0;
    const s = String(v)
      .replace(/[^\d.,-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, ""); // remove pontos de milhar
    const normalized = s.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }, []);

  const formatBRL = useCallback((n) => {
    return (Number(n) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }, []);

  const formatBRLInput = useCallback(
    (raw) => {
      const n = parseBRL(raw);
      // aqui eu devolvo sem "R$" pra ficar mais “input-friendly”
      return (Number(n) || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },
    [parseBRL]
  );

  const podeEmitir = useMemo(() => {
    const valorNotaNum = parseBRL(valores.valorNota);
    return (
      !!empresa &&
      !!tomador.documento &&
      !!tomador.nome &&
      !!servico.trim() &&
      valorNotaNum > 0
    );
  }, [empresa, tomador, servico, valores, parseBRL]);

  const pushLog = useCallback((msg) => {
    setLogs((prev) =>
      [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-200)
    );
  }, []);

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
    // deixa o cursor no fim (para facilitar digitação)
    requestAnimationFrame(() => {
      const el = e.target;
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch { }
    });
  }, []);

  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) {
      showToast("err", "Preencha os campos obrigatórios e informe um valor maior que zero.");
      return;
    }

    setLoading(true);
    pushLog("Iniciando emissão individual…");
    showToast("info", "Emitindo nota…");

    try {
      const valorNotaNum = parseBRL(valores.valorNota);

      const preview = {
        empresa,
        tomador,
        servico,
        valores: {
          ...valores,
          // opcional: manter string e também numérico, mas deixo só como veio
        },
        itens: [{ cliente: tomador.nome, valor: valorNotaNum }],
        valorTotal: valorNotaNum
      };

      const { ok, protocolo, pdfBlob, erro } = await emitirNota({
        empresa,
        tipo: "INDIVIDUAL",
        numero: tomador.documento,
        preview
      });

      if (!ok) {
        showToast("err", erro || "Falha na emissão.");
        pushLog("Erro ao emitir nota individual.");
        return;
      }

      showToast("ok", `Nota emitida com sucesso. Protocolo ${protocolo}.`);
      pushLog(`Emitida nota do tomador ${tomador.nome} — protocolo ${protocolo}.`);
      baixarPdf(`NF_${empresa}_${tomador.nome}_${protocolo}.pdf`, pdfBlob);
    } catch {
      showToast("err", "Falha inesperada na emissão.");
      pushLog("Erro inesperado na emissão.");
    } finally {
      setLoading(false);
    }
  }, [empresa, tomador, servico, valores, podeEmitir, pushLog, showToast, parseBRL]);

  return (
    <div className="ind-page">
      {/* Toast */}
      {toast && (
        <div className={`ind-toast-wrap ${toastState === "in" ? "is-in" : ""} ${toastState === "out" ? "is-out" : ""}`}>
          <div className={`ind-toast ind-toast--${toast.type}`}>
            <div className="ind-toast__msg">{toast.msg}</div>
            <button className="ind-toast__close" onClick={closeToast} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="ind-card">
        <header className="ind-header">
          <div className="ind-header__title">
            <h1 className="ind-title">Emissão · Individual</h1>
            <p className="ind-subtitle">Preencha os dados do tomador e do serviço para emitir a nota.</p>
          </div>
        </header>

        <div className="ind-body">
          <section className="ind-section">
            <div className="ind-section__content">
              <EmpresaSelect
                value={empresa}
                onChange={(v) => {
                  setEmpresa(v);
                }}
              />
            </div>
          </section>

          <section className="ind-section">
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
          </section>

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

          <section className="ind-section">
            <div className="ind-section__header">
              <h2 className="ind-section__title">Logs</h2>
              <p className="ind-section__hint">Acompanhe a emissão e possíveis retornos.</p>
            </div>

            <div className="ind-section__content">
              <LogEmissao entries={logs} maxHeight={180} emptyText="Sem registros ainda." />
            </div>
          </section>
        </div>

        <footer className="ind-footer">
          <button
            className="ind-btn ind-btn--accent"
            onClick={handleEmitir}
            disabled={!podeEmitir || loading}
            aria-busy={loading}
            title={!podeEmitir ? "Preencha os campos obrigatórios" : "Emitir nota"}
          >
            {loading ? "Emitindo..." : "EMITIR"}
          </button>
        </footer>
      </div>
    </div>
  );
}
