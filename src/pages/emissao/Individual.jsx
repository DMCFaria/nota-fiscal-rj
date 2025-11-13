import { useState, useMemo, useCallback } from "react";
import EmpresaSelect from "../../components/EmpresaSelect";
import LogEmissao from "../../components/LogEmissao";
import StatusBanner from "../../components/StatusBanner";
import { emitirNota, baixarPdf } from "../../services/emissao";
import "../../styles/emissao.css";

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
    uf: "",
  });
  const [servico, setServico] = useState("");
  const [valores, setValores] = useState({
    valorNota: "",
    deducoes: "",
    descontos: "",
    issRetido: "nao",
  });
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const podeEmitir = useMemo(() =>
    empresa &&
    tomador.documento &&
    tomador.nome &&
    servico.trim() &&
    Number(valores.valorNota) > 0, [empresa, tomador, servico, valores]);

  const pushLog = useCallback((msg) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-200));
  }, []);

  const handleChange = (obj, setFn) => (e) =>
    setFn({ ...obj, [e.target.name]: e.target.value });

  const handleEmitir = useCallback(async () => {
    if (!podeEmitir) return;
    setLoading(true);
    setStatus(null);
    pushLog("Iniciando emissão individual…");

    try {
      const preview = {
        empresa,
        tomador,
        servico,
        valores,
        itens: [{ cliente: tomador.nome, valor: Number(valores.valorNota) }],
        valorTotal: Number(valores.valorNota),
      };

      const { ok, protocolo, pdfBlob, erro } = await emitirNota({
        empresa,
        tipo: "INDIVIDUAL",
        numero: tomador.documento,
        preview,
      });

      if (!ok) {
        setStatus({ type: "err", msg: erro || "Falha na emissão." });
        pushLog("Erro ao emitir nota individual.");
        return;
      }

      setStatus({ type: "ok", msg: `Nota emitida com sucesso. Protocolo ${protocolo}.` });
      pushLog(`Emitida nota do tomador ${tomador.nome} — protocolo ${protocolo}.`);
      baixarPdf(`NF_${empresa}_${tomador.nome}_${protocolo}.pdf`, pdfBlob);
    } catch {
      setStatus({ type: "err", msg: "Falha inesperada na emissão." });
      pushLog("Erro inesperado na emissão.");
    } finally {
      setLoading(false);
    }
  }, [empresa, tomador, servico, valores, podeEmitir, pushLog]);

  return (
    <div className="fc-page">
              {status && <StatusBanner type={status.type}>{status.msg}</StatusBanner>}

      <div className="fc-card">
        <header className="fc-header"><h1>Emissão · Individual</h1></header>

        <section className="fc-section">
          <EmpresaSelect value={empresa} onChange={setEmpresa} />
        </section>

        <section className="fc-section">
          <h2 className="fc-subtitle">Tomador de Serviços</h2>
          <div className="fc-grid-3">
            <input name="documento" placeholder="CPF/CNPJ" className="fc-input"
              value={tomador.documento} onChange={handleChange(tomador, setTomador)} />

            <input name="nome" placeholder="Nome / Razão Social" className="fc-input"
              value={tomador.nome} onChange={handleChange(tomador, setTomador)} />

            <input name="cep" placeholder="CEP" className="fc-input"
              value={tomador.cep} onChange={handleChange(tomador, setTomador)} />

            <input name="logradouro" placeholder="Logradouro" className="fc-input"
              value={tomador.logradouro} onChange={handleChange(tomador, setTomador)} />

            <input name="numero" placeholder="Número" className="fc-input"
              value={tomador.numero} onChange={handleChange(tomador, setTomador)} />

            <input name="bairro" placeholder="Bairro" className="fc-input"
              value={tomador.bairro} onChange={handleChange(tomador, setTomador)} />

            <input name="cidade" placeholder="Cidade" className="fc-input"
              value={tomador.cidade} onChange={handleChange(tomador, setTomador)} />
            <input name="uf" placeholder="UF" maxLength={2} className="fc-input"
              value={tomador.uf} onChange={handleChange(tomador, setTomador)} />

          </div>
        </section>

        <section className="fc-section">
          <h2 className="fc-subtitle">Discriminação dos Serviços</h2>

          <div className="fc-textarea-wrap">
            <textarea
              className="fc-textarea"
              rows={5}                
              maxLength={1000}        
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              placeholder="Descreva os serviços prestados…"
              aria-label="Discriminação dos serviços"
            />
          </div>
        </section>

        <section className="fc-section">
          <h2 className="fc-subtitle">Valores da Nota</h2>
          <div className="fc-grid-4">
            <input name="valorNota" placeholder="Valor total da nota (R$)"
              className="fc-input" value={valores.valorNota}
              onChange={handleChange(valores, setValores)} />

            <input name="deducoes" placeholder="Deduções (R$)" className="fc-input"
              value={valores.deducoes} onChange={handleChange(valores, setValores)} />

            <input name="descontos" placeholder="Descontos (R$)" className="fc-input"
              value={valores.descontos} onChange={handleChange(valores, setValores)} />

            <div className="fc-radio-group">
              <span>ISS Retido?</span>

              <label><input type="radio" name="issRetido" value="sim"
                checked={valores.issRetido === "sim"} onChange={handleChange(valores, setValores)} /> Sim</label>

              <label><input type="radio" name="issRetido" value="nao"
                checked={valores.issRetido === "nao"} onChange={handleChange(valores, setValores)} /> Não</label>
            </div>
          </div>
        </section>

        <section className="fc-section">

          <LogEmissao entries={logs} maxHeight={180} emptyText="Sem registros ainda." />
        </section>

        <footer className="fc-actions">
          <button className="fc-btn fc-btn-accent" onClick={handleEmitir}
            disabled={!podeEmitir} aria-busy={loading}>
            {loading ? "Emitindo..." : "EMITIR"}
          </button>
        </footer>
      </div>
    </div>
  );
}
