import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import CompanySelector from "./components/EmpresaSelect";
import LogEmissao from "./components/LogEmissao";

import Fatura from "./pages/emissao/Fatura";
import Rps from "./pages/emissao/Rps";
import Individual from "./pages/emissao/Individual";

import Consultas from "./pages/Consultas";
import Historico from "./pages/Historico";
import Configuracoes from "./pages/Configuracoes";
import "./styles/global.css";

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="content">
          
          <Routes>
            <Route path="/" element={<Navigate to="/emissao/fatura" replace />} />
            <Route path="/emissao/fatura" element={<Fatura />} />
            <Route path="/emissao/rps" element={<Rps />} />
            <Route path="/emissao/individual" element={<Individual />} />
            <Route path="/consultas" element={<Consultas />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<div>Página não encontrada.</div>} />
          </Routes>
          
        </main>
      </div>
    </Router>
  );
}
