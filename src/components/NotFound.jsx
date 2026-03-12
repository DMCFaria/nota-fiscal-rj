import { Link } from 'react-router-dom';
import '../styles/notFound.css';

const NotFound = () => {
  return (
    <div className="not-found-wrapper">
      <div className="not-found-content">
        <img 
          src="/imagens/LOGO.png" 
          alt="Logo" 
          className="not-found-logo"
        />
        
        <h1 className="not-found-title">404</h1>
        <h2 className="not-found-subtitle">Página não encontrada</h2>
        
        <p className="not-found-text">
          A página que você está procurando não existe ou foi movida.
        </p>
        
        <Link to="/" className="not-found-button">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;