import '../styles/pageTemplate.css';

const PageTemplate = ({ 
  children, 
  title, 
  subtitle,
  icon,
  actions,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "Nenhum dado encontrado",
  className = "",
  ...props 
}) => {
  
  // Renderiza estado de loading
  if (loading) {
    return (
      <div className="page-template page-template-loading">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  // Renderiza estado de erro
  if (error) {
    return (
      <div className="page-template page-template-error">
        <i className="bi bi-exclamation-triangle"></i>
        <h3>Ops! Algo deu errado</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Renderiza estado vazio
  if (empty) {
    return (
      <div className="page-template page-template-empty">
        <i className="bi bi-inbox"></i>
        <h3>{emptyMessage}</h3>
      </div>
    );
  }

  return (
    <div className={`page-template ${className}`} {...props}>
      {/* Cabeçalho da página */}
      {(title || subtitle || actions) && (
        <header className="page-template-header">
          <div className="page-template-wrapper">
            {icon && <div className="page-template-icon">{icon}</div>}
            <div className="page-template-titles">
              {title && <h1 className="page-template-title">{title}</h1>}
              {subtitle && <p className="page-template-subtitle">{subtitle}</p>}
            </div>
          </div>
          
          {actions && (
            <div className="page-template-actions">
              {actions}
            </div>
          )}
        </header>
      )}

      {/* Conteúdo principal */}
      <div className="page-template-content">
        {children}
      </div>
    </div>
  );
};

export default PageTemplate;