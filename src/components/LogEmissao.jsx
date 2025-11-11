import { useEffect, useState } from "react";
import "../styles/log.css";

export default function LogEmissao() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("logEmissao") || "[]");
    setLogs(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("logEmissao", JSON.stringify(logs));
  }, [logs]);

  function adicionarLog(msg, tipo = "info") {
    setLogs((prev) => [
      { id: Date.now(), msg, tipo, hora: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  }

  useEffect(() => {
    adicionarLog("Sistema de log iniciado", "info");
  }, []);

  return (
    <div className="log-card">
      <h3>Log de Acompanhamento</h3>
      
    </div>
  );
}
