import { useEffect, useMemo, useState } from "react";
import { getHistorico, clearHistorico } from "../services/notas";
import { FiClock, FiTrash2, FiFilter, FiSearch } from "react-icons/fi";
import "../styles/historico.css";

function Badge({ status }) {
  const cls = status === "sucesso" ? "badge badge-success" : "badge badge-error";
  const label = status === "sucesso" ? "Sucesso" : "Erro";
  return <span className={cls}>{label}</span>;
}

function Linha({ item }) {
  return (
    <tr className="tabela-linha">
      <td className="tabela-cell">
        <div className="cell-content">
          <span className="mono faturamento">{item.faturamento}</span>
        </div>
      </td>
      <td className="tabela-cell">
        <div className="cell-content">
          <FiClock className="icon-inline" />
          <span>{new Date(item.quando).toLocaleString("pt-BR")}</span>
        </div>
      </td>
      <td className="tabela-cell">
        <div className="sistemas-list">
          {item.sistemas.map(s => (
            <div key={s.nome} className="sistema-item">
              <span className="sistema-nome">{s.nome}</span>
              <Badge status={s.status} />
              <span className="mono protocolo">{s.protocolo}</span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

export default function Historico() {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const hist = getHistorico();
      setItens(hist);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter(i =>
      i.faturamento.toLowerCase().includes(f) ||
      i.sistemas.some(s => s.nome.toLowerCase().includes(f))
    );
  }, [filtro, itens]);

  function onClear() {
    if (window.confirm("Tem certeza que deseja apagar todo o histórico? Esta ação não pode ser desfeita.")) {
      clearHistorico();
      setItens([]);
    }
  }

  console.log("filtrados", filtrados)

  return (
    <div className="historico-container">
      <div className="historico-header">
        <div className="header-content">
          <h1 className="titulo">Histórico de Transmissões</h1>
          <p className="subtitulo">Acompanhe todas as notas fiscais transmitidas</p>
        </div>
       
      </div>

      {itens.length > 0 && (
        <div className="toolbar">
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por faturamento ou sistema..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar histórico"
            />
           
          </div>
          <div className="results-count">
            {filtrados.length} {filtrados.length === 1 ? "resultado" : "resultados"}
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Carregando histórico...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            {itens.length === 0 ? (
              <>
                <FiClock className="empty-icon" />
                <h3>Nenhuma transmissão ainda</h3>
                <p>Quando você transmitir uma nota fiscal, ela aparecerá aqui.</p>
              </>
            ) : (
              <>
                <FiFilter className="empty-icon" />
                <h3>Nenhum resultado encontrado</h3>
                <p>Tente ajustar os termos da sua busca.</p>
              </>
            )}
          </div>
        ) : (
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Faturamento</th>
                  <th>Data/Hora</th>
                  <th>Resultados</th>
                </tr>
              </thead>
              {/* <tbody>
                {filtrados.map(item => <Linha key={item.id} item={item} />)}
              </tbody> */}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}