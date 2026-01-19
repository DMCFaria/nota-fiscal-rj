// components/Navbar.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FiUser, 
  FiChevronDown, 
  FiLogOut, 
  FiSettings, 
  FiHelpCircle,
  FiBell,
  FiSearch,
  FiHome,
  FiChevronRight
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import '../styles/navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Mapeamento de rotas para nomes amigáveis
  const routeNames = {
    '/emissao/fatura': 'Fatura',
    '/emissao/rps': 'RPS',
    '/emissao/individual': 'Individual',
    '/consultas': 'Consultas',
    '/historico': 'Histórico',
    '/historico-detalhe': 'Detalhe da Nota',
    '/configuracoes': 'Configurações',
  };

  // Função para gerar o breadcrumb
  const getBreadcrumb = () => {
    const pathSegments = location.pathname.split('/').filter(segment => segment);
    
    let breadcrumbItems = [];
    let currentPath = '';
    
    // Adiciona "Home" como primeiro item
    breadcrumbItems.push({
      label: 'Home',
      icon: <FiHome size={14} />,
      path: '/emissao/fatura'
    });
    
    // Para cada segmento da rota
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Verifica se é um ID (ex: em historico-detalhe/:id)
      if (segment.match(/^[0-9a-fA-F-]+$/) && index > 0) {
        // É um ID, mantém o nome da rota anterior
        const prevSegment = pathSegments[index - 1];
        breadcrumbItems.push({
          label: routeNames[`/${prevSegment}`] || formatSegment(prevSegment),
          path: currentPath
        });
      } else {
        // É uma rota normal
        breadcrumbItems.push({
          label: routeNames[currentPath] || formatSegment(segment),
          path: currentPath
        });
      }
    });
    
    return breadcrumbItems;
  };

  // Formata segmentos de rota para nomes legíveis
  const formatSegment = (segment) => {
    return segment
      .replace(/-/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowUserMenu(false);
  };

  const notifications = [
    { id: 1, text: 'Nova nota emitida com sucesso', time: '5 min atrás', read: false },
    { id: 2, text: '3 notas pendentes de envio', time: '1 hora atrás', read: true },
    { id: 3, text: 'Sistema atualizado para versão 2.1', time: 'Ontem', read: true },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const breadcrumbItems = getBreadcrumb();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          {breadcrumbItems.map((item, index) => (
            <div key={index} className="breadcrumb-item">
              {index > 0 && <FiChevronRight className="breadcrumb-separator" />}
              <button
                className={`breadcrumb-link ${index === breadcrumbItems.length - 1 ? 'active' : ''}`}
                onClick={() => {
                  if (index < breadcrumbItems.length - 1) {
                    navigate(item.path);
                  }
                }}
                disabled={index === breadcrumbItems.length - 1}
              >
                {item.icon && <span className="breadcrumb-icon">{item.icon}</span>}
                <span className="breadcrumb-label">{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="navbar-right">
        {/* Notificações (opcional) */}
        {/* <div className="notifications-container">
          <button 
            className="notifications-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <FiBell />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>
        </div> */}

        {/* Usuário */}
        <div className="user-container">
          <button 
            className="user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {user?.nome?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">
                {user?.nome || user?.username || 'Usuário'}
              </span>
              <span className="user-role">
                {user?.empresa || 'FedCorp'}
              </span>
            </div>
            <FiChevronDown className={`dropdown-arrow ${showUserMenu ? 'rotated' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="dropdown-user-info">
                  <div className="dropdown-avatar">
                    {user?.nome?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="dropdown-name">{user?.nome || user?.username}</p>
                    <p className="dropdown-email">{user?.email || 'usuario@email.com'}</p>
                  </div>
                </div>
              </div>
              
              <div className="dropdown-divider"></div>
              
              {/* <button 
                className="dropdown-item"
                onClick={() => {
                  navigate('/configuracoes');
                  setShowUserMenu(false);
                }}
              >
                <FiSettings /> Configurações
              </button>
              
              <button className="dropdown-item">
                <FiHelpCircle /> Ajuda
              </button> */}
              
              <div className="dropdown-divider"></div>
              
              <button 
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                <FiLogOut /> Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay para fechar menus ao clicar fora */}
      {(showUserMenu || showNotifications) && (
        <div 
          className="menu-overlay"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
          }}
        />
      )}
    </nav>
  );
}

export default Navbar;