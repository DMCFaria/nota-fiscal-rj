import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { FiChevronDown, FiFileText, FiSearch, FiClock, FiSettings } from "react-icons/fi";
import "../styles/sidebar.css";

function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const isActive = (path) => (location.pathname === path ? "active" : "");

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="logo-link">
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

        <Link to="/configuracoes" className={isActive("/configuracoes")}>
          <FiSettings className="icon" /> Configurações
        </Link>
      </nav>
    </aside>
  );
}

export default Sidebar;