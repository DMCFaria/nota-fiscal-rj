// src/components/Loading/Loading.jsx
import { useState, useEffect } from 'react';
import '../../styles/loading.css';
import LOGO from './LOGO.png';

const Loading = ({ 
  fullScreen = false, 
  message = 'Carregando...'
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const radius = 90; // Aumentado de 48 para 90
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Estilos inline com tamanhos maiores
  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '32px', // Aumentado gap
      padding: '32px',
    },
    logoWrapper: {
      position: 'relative',
      width: '200px', // Aumentado de 100px para 200px
      height: '200px', // Aumentado de 100px para 200px
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: '160px', // Aumentado de 70px para 160px
      height: '160px', // Aumentado de 70px para 160px
      objectFit: 'contain',
      zIndex: 2,
    },
    svg: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      transform: 'rotate(-90deg)',
    },
    message: {
      textAlign: 'center',
    },
    text: {
      color: '#1e293b',
      fontSize: '16px', // Aumentado de 14px
      fontWeight: 500,
      margin: 0,
      marginBottom: '8px', // Aumentado
    },
    percentage: {
      color: '#2463eb',
      fontSize: '20px', // Aumentado de 16px
      fontWeight: 600,
      margin: 0,
    },
  };

  const LoadingContent = () => (
    <div style={styles.container}>
      <div style={styles.logoWrapper}>
        <img 
          src={LOGO}
          alt="Logo" 
          style={styles.logo}
          onError={(e) => {
            console.error('Erro ao carregar logo:', LOGO);
            e.target.style.display = 'none';
          }}
        />
        
        <svg style={styles.svg} width="200" height="200" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="4" // Aumentado de 3 para 4
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#2463eb"
            strokeWidth="4" // Aumentado de 3 para 4
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.2s linear' }}
          />
        </svg>
      </div>
      
      {message && (
        <div style={styles.message}>
          <p style={styles.text}>{message}</p>
          {/* <p style={styles.percentage}>{Math.round(progress)}%</p> */}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div style={styles.overlay}>
        <LoadingContent />
      </div>
    );
  }

  return <LoadingContent />;
};

export default Loading;