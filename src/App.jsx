import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "./login/Login";

import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";

import Sidebar from "./components/Sidebar";
import Fatura from "./pages/emissao/Fatura";
import Rps from "./pages/emissao/Rps";
import Individual from "./pages/emissao/Individual";
import Historico from "./pages/Historico";
import Configuracoes from "./pages/Configuracoes";

import "./styles/global.css";
import Consultas from "./pages/Consultas";
import Navbar from "./components/Navbar";

// O Layout agora usa o <Outlet /> para renderizar as rotas filhas
function AppLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <Navbar />
      <main className="content">
        <Outlet /> 
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Rotas Protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Redireciona a raiz "/" para a fatura */}
          <Route index element={<Navigate to="/emissao/fatura" replace />} />
          
          <Route path="home" element={<Navigate to="/emissao/fatura" replace />} />
          
          {/* Agrupamento de emissão para clareza, ou rotas diretas */}
          <Route path="emissao/fatura" element={<Fatura />} />
          <Route path="emissao/rps" element={<Rps />} />
          <Route path="emissao/individual" element={<Individual />} />
          
          <Route path="consultas" element={<Consultas />} />
          <Route path="historico" element={<Historico />} />
          {/* <Route path="configuracoes" element={<Configuracoes />} /> */}
        </Route>
      </Route>

      {/* Fallback global: Se não estiver em nenhuma rota acima, volta pro login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}