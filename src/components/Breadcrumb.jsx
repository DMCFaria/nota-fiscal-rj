import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FiMenu,
  FiChevronDown, 
  FiLogOut, 
  FiHome,
  FiChevronRight
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import '../styles/breadcrumb.css';

function Breadcrumb({ onMenuClick, sidebarOpen, isMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Mapeamento de rotas para nomes amigáveis
  const routeNames = {
    '/': 'Home',
    '/emitir': 'Opções de Emissão',
    '/emitir/fatura': 'Fatura',
    '/emitir/rps': 'RPS',
    '/emitir/individual': 'Individual',
    '/consultas': 'Consultas',
    '/historico': 'Histórico',
  };

  // Função para gerar o breadcrumb
  const getBreadcrumb = () => {
    const pathSegments = location.pathname.split('/').filter(segment => segment);
    
    let breadcrumbItems = [];
    let currentPath = '';
    
    // Adiciona "Home" como primeiro item se não estiver na raiz
    if (location.pathname !== '/') {
      breadcrumbItems.push({
        label: 'Home',
        icon: <FiHome size={14} />,
        path: '/'
      });
    }
    
    // Para cada segmento da rota
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      breadcrumbItems.push({
        label: routeNames[currentPath] || formatSegment(segment),
        path: currentPath
      });
    });
    
    return breadcrumbItems;
  };

  // Formata segmentos de rota para nomes legíveis
  const formatSegment = (segment) => {
    return segment
      .replace(/-/g, ' ')
      .replace(/^\w/, c => c.toUpperCase());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowUserMenu(false);
  };

  const breadcrumbItems = getBreadcrumb();

  return (
    <nav className="breadcrumb">
      <div className="breadcrumb-left">
        {/* Botão de menu hambúrguer */}
        {isMobile && (
          <button className="menu-button" onClick={onMenuClick} aria-label="Menu">
            <FiMenu size={20} />
          </button>
        )}

        {/* Breadcrumb - aparece em todas as telas, mas com ajustes */}
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

      <div className="breadcrumb-right">
        {/* Usuário */}
        <div className="user-container">
          <button 
            className="user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {user?.nome?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            {!isMobile && (
              <div className="user-info">
                <span className="user-name">
                  {user?.nome || user?.username || 'Usuário'}
                </span>
                <span className="user-role">
                  {user?.empresa || 'FedCorp'}
                </span>
              </div>
            )}
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
      {showUserMenu && (
        <div 
          className="menu-overlay"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </nav>
  );
}

export default Breadcrumb;