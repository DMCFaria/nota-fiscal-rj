// src/components/NotaFaturaCard.jsx
import {
  FiFileText,
  FiCalendar,
  FiUser,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiDownload
} from "react-icons/fi";

export default function NotaFaturaCard({
  nota,
  onBaixar,          // ✅ callback
  onCancelar,        // ✅ callback
  baixarDisabled,    // opcional
  cancelarDisabled   // opcional
}) {
  if (!nota) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("pt-BR") +
      " " +
      date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value);
    return isNaN(num)
      ? "R$ 0,00"
      : num.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        });
  };

  const getStatusBadge = (status, situacao) => {
    const isSuccess = status === "CONCLUIDO" || situacao === "AUTORIZADA";
    const isPending = status === "PROCESSANDO" || situacao === "PROCESSANDO";

    if (isSuccess) {
      return (
        <span className="badge badge-success">
          <FiCheckCircle /> {situacao || "Autorizada"}
        </span>
      );
    }

    if (isPending) {
      return <span className="badge badge-warning">Em Processamento</span>;
    }

    return (
      <span className="badge badge-error">
        <FiXCircle /> {situacao || "Erro"}
      </span>
    );
  };

  // ✅ Regras simples de habilitação (sem quebrar nada)
  const temPdf = !!nota.pdf_url_final;
  const podeBaixar = typeof onBaixar === "function" && temPdf && !baixarDisabled;

  const isCancelada =
    String(nota?.situacao_prefeitura || "").toUpperCase().includes("CANCEL") ||
    String(nota?.status || "").toUpperCase().includes("CANCEL");

  const podeCancelar =
    typeof onCancelar === "function" && !isCancelada && !cancelarDisabled;

  return (
    <div className="nota-card">
      <div className="nota-card-header">
        <div className="nota-card-title">
          <FiFileText size={20} />
          <h3>Nota Fiscal #{nota.numero_nfse}</h3>
        </div>
        {getStatusBadge(nota.status, nota.situacao_prefeitura)}
      </div>

      <div className="nota-card-grid">
        <div className="nota-card-item">
          <span className="nota-card-label">
            <FiCalendar /> Data de Emissão
          </span>
          {nota.datas?.emissao_prefeitura ? (
            <span className="nota-card-value">{formatDate(nota.datas?.emissao_prefeitura)}</span>
          ) : (
            <span className="nota-card-value">-</span>
          )}
        </div>

        <div className="nota-card-item">
          <span className="nota-card-label">
            <FiDollarSign /> Valor do Serviço
          </span>
          <span className="nota-card-value">{formatCurrency(nota.valor_servico)}</span>
        </div>

        <div className="nota-card-item">
          <span className="nota-card-label">
            <FiUser /> Prestador
          </span>
          <span className="nota-card-value nota-card-value-sm">
            {nota.prestador?.razao_social || "-"}
          </span>
        </div>

        <div className="nota-card-item">
          <span className="nota-card-label">
            <FiUser /> Tomador
          </span>
          <span className="nota-card-value nota-card-value-sm">
            {nota.tomador?.razao_social || "-"}
          </span>
        </div>
      </div>

      <div className="nota-card-footer">
        <div className="nota-card-meta">
          <span className="meta-label">Fatura:</span>
          <span className="meta-value mono">{nota.fatura}</span>
        </div>

        <div className="nota-card-meta">
          <span className="meta-label">Código Verificação:</span>
          <span className="meta-value mono truncate">{nota.codigo_verificacao || "-"}</span>
        </div>

        <div className="nota-card-meta">
          <span className="meta-label">Parcelas:</span>
          <span className="meta-value">{nota.parcelas || 1}x</span>
        </div>
      </div>

      {/* ✅ ações: manter visual e só adicionar botões */}
      <div className="nota-card-actions">
        {/* Baixar (chama sua função) */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onBaixar}
          disabled={!podeBaixar}
          title={temPdf ? "Baixar PDF" : "PDF não disponível"}
          style={{ marginRight: 10 }}
        >
          <FiDownload /> Baixar PDF
        </button>

        {/* Cancelar (abre modal no pai) */}
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={onCancelar}
          disabled={!podeCancelar}
          title={isCancelada ? "Nota já cancelada" : "Cancelar nota"}
          style={{ marginRight: 10 }}
        >
          <FiXCircle /> Cancelar
        </button>

        {/* Visualizar (se existir url) — mantém como você tinha */}
        {nota.pdf_url_final && (
          <a
            href={nota.pdf_url_final}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            <FiFileText /> Visualizar PDF
          </a>
        )}
      </div>
    </div>
  );
}
