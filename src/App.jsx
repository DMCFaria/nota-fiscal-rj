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
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AppLayout />}> {/* Adicionado /* explicitamente aqui */}
          <Route index element={<Navigate to="/emissao/fatura" replace />} />
          <Route path="home" element={<Navigate to="/emissao/fatura" replace />} />
          <Route path="emissao/fatura" element={<Fatura />} />
          <Route path="emissao/rps" element={<Rps />} />
          <Route path="emissao/individual" element={<Individual />} />
          <Route path="consultas" element={<Consultas />} />
          <Route path="historico" element={<Historico />} />
          {/* Fallback interno para dentro do layout */}
          <Route path="*" element={<Navigate to="/emissao/fatura" replace />} />
        </Route>
      </Route>

      {/* Se o cara não cair em nada (nem logado nem deslogado), login nele */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}