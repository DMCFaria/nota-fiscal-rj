// components/Loading.jsx
import '../styles/loading.css';

const Loading = ({ 
  fullScreen = false, 
  message = 'Carregando...',
  size = 'medium'
}) => {
  const LoadingSpinner = () => (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner"></div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-container">
          <LoadingSpinner />
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-inline">
      <LoadingSpinner />
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default Loading;