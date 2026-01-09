// src/components/ParcelasCard.jsx

export default function ParcelasCard({
  parcelas,
  setParcelas,
  valorTotal
}) {
  const valorParcela =
    parcelas > 1 ? valorTotal / parcelas : valorTotal;

  return (
    <div className="fc-card fc-card--soft">
      <h4 className="fc-card-title">Parcelamento</h4>

      <div className="fc-row">
        <label className="fc-label">Número de parcelas</label>
        <input
          type="number"
          min={2}
          max={24}
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
          className="fc-input fc-input--small"
        />
      </div>

      <div className="fc-metric">
        <span className="fc-label">Valor por parcela</span>
        <p className="fc-value">
          {valorParcela.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </p>
      </div>
    </div>
  );
}
