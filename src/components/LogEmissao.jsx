import "../styles/log.css";

export default function LogEmissao({
  title = "Log de Acompanhamento",
  entries = [],
  maxHeight = 180,
  emptyText = "Sem registros ainda.",
}) {
  const normalizedHeight =
    typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;

  return (
    <div className="log-card">
      <div className="log-header">
        <h3 className="log-title">{title}</h3>
      </div>

      <div className="log-body" style={{ maxHeight: normalizedHeight }}>
        {entries.length === 0 ? (
          <div className="log-empty">{emptyText}</div>
        ) : (
          <ul className="log-list">
            {entries.map((line, idx) => (
              <li key={idx} className="log-item">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
