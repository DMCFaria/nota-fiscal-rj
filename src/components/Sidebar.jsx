import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FiChevronDown, FiFileText, FiSearch, FiClock, FiSettings } from "react-icons/fi";
import "../styles/sidebar.css";
import { BiDoorOpen } from "react-icons/bi";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const { logout } = useAuth();

  const isActive = (path) => (location.pathname === path ? "active" : "");

  const handleLogout = () => {
    logout(); // limpa token e estado (no seu AuthContext fake já navega pra /login)
    navigate("/login", { replace: true }); // reforço pra garantir
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/emissao/fatura" className="logo-link">
          {/* Logo desktop */}
          <img
            src="https://i.postimg.cc/dtb0y31C/logo2.png"
            alt="Logo"
            className="logo-desktop"
          />
          {/* Ícone mobile */}
          <img
            src="/imagens/Fedcorp-icone01-50x50.png"
            alt="Ícone Fedcorp"
            className="logo-mobile"
          />
        </Link>

        <h2 className="sidebar-title">Nota Fiscal</h2>
        <p className="subtitle">Sistema de Transmissão Grupo Fedcorp</p>
      </div>

      <nav className="sidebar-nav">
        <div className="menu-group">
          <button className="menu-toggle" onClick={() => setOpen((p) => !p)}>
            <FiFileText className="icon" />
            <span>Emissão</span>
            <FiChevronDown className={`arrow ${open ? "rotated" : ""}`} size={16} />
          </button>

          {open && (
            <div className="submenu">
              <Link to="/emissao/fatura" className={isActive("/emissao/fatura")}>
                Fatura
              </Link>
              <Link to="/emissao/rps" className={isActive("/emissao/rps")}>
                RPS
              </Link>
              <Link to="/emissao/individual" className={isActive("/emissao/individual")}>
                Individual
              </Link>
            </div>
          )}
        </div>

        <Link to="/consultas" className={isActive("/consultas")}>
          <FiSearch className="icon" /> Consultar
        </Link>
        
        <Link to="/historico" className={isActive("/historico")}>
          <FiClock className="icon" /> Histórico
        </Link>

        {/* <Link to="/configuracoes" className={isActive("/configuracoes")}>
          <FiSettings className="icon" /> Configurações
        </Link> */}

        <div className="login">
         
          <button type="button" className="logout-btn" onClick={handleLogout}>
            <BiDoorOpen className="icon-login" /> Sair
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
