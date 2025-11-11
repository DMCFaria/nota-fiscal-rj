import { useState } from "react";
import { transmitirNota } from "../services/notas";
import { FiSend } from "react-icons/fi";

function GerarNota() {
  const [faturamento, setFaturamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await transmitirNota(faturamento);
      setMsg({ type: "ok", text: "Transmissão realizada com sucesso!" });
      setFaturamento("");
         } catch (err) {
      setMsg({ type: "err", text: err.message || "Falha ao transmitir." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gerar-nota">
      <h1>Gerar Nota Fiscal</h1>
      <p>Informe o número do faturamento para transmitir aos sistemas</p>

      <form className="nota-form" onSubmit={onSubmit}>
        <label htmlFor="faturamento">Número do Faturamento</label>
        <input
          id="faturamento"
          placeholder="Ex: 2024001234"
          value={faturamento}
          onChange={(e) => setFaturamento(e.target.value)}
        />
        <small>Digite o número de faturamento gerado no sistema principal</small>

        <div className="sistemas">
          <p><strong>Sistemas de Destino:</strong></p>
          <ul>
            <li>Nota Carioca (Prefeitura do Rio)</li>
            <li>Nota do Milhão (Governo do Estado)</li>
          </ul>
        </div>

        <button type="submit" disabled={loading}>
          <FiSend style={{ verticalAlign: "-2px", marginRight: 8 }} />
          {loading ? "Transmitindo..." : "Transmitir Nota Fiscal"}
        </button>

        {msg && (
          <div className={`alert ${msg.type === "ok" ? "ok" : "err"}`}>
            {msg.text}
          </div>
        )}
      </form>
    </div>
  );
}

export default GerarNota;
