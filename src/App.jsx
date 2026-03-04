import { Routes, Route, Navigate } from "react-router-dom";
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

function AppLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <Navbar/>
      <main className="content">
        <Routes>
          {/* Redireciona a raiz do layout para a página inicial desejada */}
          <Route index element={<Navigate to="/emissao/fatura" replace />} />
          <Route path="home" element={<Navigate to="/emissao/fatura" replace />} />
          <Route path="emissao/fatura" element={<Fatura />} />
          <Route path="emissao/rps" element={<Rps />} />
          <Route path="emissao/individual" element={<Individual />} />
          <Route path="consultas" element={<Consultas />} />
          <Route path="historico" element={<Historico />} />
          {/* <Route path="configuracoes" element={<Configuracoes />} /> */}
          <Route path="*" element={<Navigate to="/emissao/fatura" replace />} />
        </Routes>
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
        {/* Captura a raiz e todas as sub-rotas protegidas */}
        <Route path="/*" element={<AppLayout />} />
      </Route>

      {/* Fallback global para login caso a rota não exista */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}