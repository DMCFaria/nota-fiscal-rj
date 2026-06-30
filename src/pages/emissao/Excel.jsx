import { useState, useCallback, useEffect, useMemo } from "react";
import { useSnackbar } from "notistack";
import { FiUpload, FiX, FiSearch, FiFileText, FiCalendar, FiCheckCircle, FiAlertCircle, FiClock, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import PageTemplate from "../../components/PageTemplate/PageTemplate";
import { importarArquivoExcel, getListaXlsx } from "../../services/excelService";
import "../../styles/excel.css";

const statusMap = {
  pendente: { label: "Pendente", icon: FiClock, className: "status-pendente" },
  processando: { label: "Processando", icon: FiAlertCircle, className: "status-processando" },
  concluido: { label: "Concluído", icon: FiCheckCircle, className: "status-concluido" },
  concluído: { label: "Concluído", icon: FiCheckCircle, className: "status-concluido" },
  erro: { label: "Erro", icon: FiAlertCircle, className: "status-erro" },
};

const normalizarStatus = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ImportacaoExcel() {
  const { enqueueSnackbar } = useSnackbar();

  const [modalOpen, setModalOpen] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [notas, setNotas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const carregarLista = useCallback(async (p = 1) => {
    setCarregando(true);
    try {
      const data = await getListaXlsx(p, pageSize);
      const lista = data?.notas || [];
      setNotas(Array.isArray(lista) ? lista : []);
      setTotal(data?.total_pages ? data.total_pages * pageSize : lista.length);
    } catch (err) {
      enqueueSnackbar("Erro ao carregar lista de notas importadas", { variant: "error", autoHideDuration: 4000, anchorOrigin: { vertical: "top", horizontal: "right" } });
    } finally {
      setCarregando(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    carregarLista(pagina);
  }, [pagina, carregarLista]);

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const handleImportar = useCallback(async () => {
    if (!arquivo) {
      enqueueSnackbar("Selecione um arquivo para importar", { variant: "warning", autoHideDuration: 3000, anchorOrigin: { vertical: "top", horizontal: "right" } });
      return;
    }

    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("file", arquivo);

      await importarArquivoExcel(formData);

      enqueueSnackbar("Arquivo importado com sucesso!", { variant: "success", autoHideDuration: 3000, anchorOrigin: { vertical: "top", horizontal: "right" } });

      setModalOpen(false);
      setArquivo(null);
      setPagina(1);
      carregarLista(1);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Erro ao importar arquivo";
      enqueueSnackbar(msg, { variant: "error", autoHideDuration: 5000, anchorOrigin: { vertical: "top", horizontal: "right" } });
    } finally {
      setImportando(false);
    }
  }, [arquivo, enqueueSnackbar, carregarLista]);

  const notasFiltradas = useMemo(() => {
    let items = [...notas];

    if (filtroTexto.trim()) {
      const termo = filtroTexto.toLowerCase();
      items = items.filter(item =>
        (item.id_integracao || "").toLowerCase().includes(termo) ||
        (item.prestador_razao_social || "").toLowerCase().includes(termo) ||
        (item.tomador_razao_social || "").toLowerCase().includes(termo)
      );
    }

    if (filtroStatus) {
      items = items.filter(item => normalizarStatus(item.status) === filtroStatus);
    }

    return items;
  }, [notas, filtroTexto, filtroStatus]);

  const formatData = (dataStr) => {
    if (!dataStr) return "-";
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dataStr;
    }
  };

  return (
    <PageTemplate
      title="Importação Excel"
      subtitle="Importe planilhas Excel com dados de notas fiscais"
      icon={<FiFileText />}
      actions={
        <button className="excel-btn excel-btn--primary" onClick={() => setModalOpen(true)}>
          <FiUpload size={16} /> IMPORTAR PLANILHA
        </button>
      }
    >
      <div className="excel-page">
        {modalOpen && (
          <div className="excel-modal-overlay" onClick={() => { if (!importando) { setModalOpen(false); setArquivo(null); } }}>
            <div className="excel-modal" onClick={e => e.stopPropagation()}>
              <div className="excel-modal-header">
                <h2>Importar Planilha Excel</h2>
                <button className="excel-modal-close" onClick={() => { setModalOpen(false); setArquivo(null); }} disabled={importando}>
                  <FiX size={20} />
                </button>
              </div>

              <div className="excel-modal-body">
                <div
                  className={`excel-dropzone ${arquivo ? "excel-dropzone--active" : ""}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) setArquivo(file);
                  }}
                >
                  {arquivo ? (
                    <div className="excel-file-selected">
                      <FiFileText size={32} />
                      <div>
                        <strong>{arquivo.name}</strong>
                        <span>{(arquivo.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button className="excel-btn-remove" onClick={() => setArquivo(null)} disabled={importando}>
                        <FiX size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FiUpload size={40} />
                      <p>Arraste o arquivo aqui ou clique para selecionar</p>
                      <span className="excel-dropzone-hint">Formatos aceitos: .xlsx</span>
                      <input
                        type="file"
                        accept=".xlsx"
                        className="excel-file-input"
                        onChange={e => setArquivo(e.target.files?.[0] || null)}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="excel-modal-footer">
                <button className="excel-btn excel-btn--outline" onClick={() => { setModalOpen(false); setArquivo(null); }} disabled={importando}>
                  Cancelar
                </button>
                <button
                  className="excel-btn excel-btn--primary"
                  onClick={handleImportar}
                  disabled={!arquivo || importando}
                >
                  {importando ? (
                    <>
                      <span className="excel-spinner"></span>
                      IMPORTANDO...
                    </>
                  ) : "IMPORTAR"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="excel-card">
          <div className="excel-card-header">
            <h3>Notas Importadas via XLSX</h3>
          </div>

          <div className="excel-filters">
            <div className="excel-search-box">
              <FiSearch className="excel-search-icon" size={16} />
              <input
                type="text"
                className="excel-search-input"
                placeholder="Buscar por arquivo, empresa ou tomador..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
              />
              {filtroTexto && (
                <button className="excel-clear-filter" onClick={() => setFiltroTexto("")}>
                  <FiX size={16} />
                </button>
              )}
            </div>

            <select
              className="excel-select"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(statusMap).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {carregando ? (
            <div className="excel-loading">
              <div className="excel-spinner"></div>
              <p>Carregando...</p>
            </div>
          ) : notasFiltradas.length === 0 ? (
            <div className="excel-empty">
              <FiFileText size={48} />
              <h4>{filtroTexto || filtroStatus ? "Nenhum resultado encontrado" : "Nenhuma nota importada"}</h4>
              <p>{filtroTexto || filtroStatus ? "Tente ajustar os filtros" : "Clique em \"Importar Planilha\" para começar"}</p>
            </div>
          ) : (
            <div className="excel-table-wrapper">
              <table className="excel-table">
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Tomador</th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notasFiltradas.map((item, idx) => {
                    const st = normalizarStatus(item.status);
                    const StatusIcon = (statusMap[item.status] || statusMap[st])?.icon || FiClock;
                    const statusClass = (statusMap[item.status] || statusMap[st])?.className || "status-pendente";
                    const valor = parseFloat(item.valor_servico) || 0;
                    return (
                      <tr key={item.id || idx} className="excel-table-row">
                        <td>
                          <div className="excel-cell-file">
                            <FiFileText size={14} />
                            <span>{item.id_integracao || "-"}</span>
                          </div>
                        </td>
                        <td>{item.tomador_razao_social || "-"}</td>
                        <td className="excel-cell-valor">
                          {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td>
                          <div className="excel-cell-date">
                            <FiCalendar size={14} />
                            {formatData(item.data_criacao)}
                          </div>
                        </td>
                        <td>
                          <span className={`excel-status-badge ${statusClass}`}>
                            <StatusIcon size={12} />
                            {(statusMap[item.status] || statusMap[st])?.label || item.status || "Desconhecido"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="excel-card-footer">
            <span className="excel-count">{total} registro(s)</span>
            {totalPaginas > 1 && (
              <div className="excel-pagination">
                <button
                  className="excel-page-btn"
                  disabled={pagina <= 1}
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                >
                  <FiChevronLeft size={16} />
                </button>
                <span className="excel-page-info">{pagina} / {totalPaginas}</span>
                <button
                  className="excel-page-btn"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina(p => p + 1)}
                >
                  <FiChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
