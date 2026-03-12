import { Link, useNavigate } from "react-router-dom";
import "../styles/home.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* <div className="home-header">
        <Link to="/" className="logo-home">
          <img
            src="/imagens/Fedcorp-icone01-50x50.png"
            alt="Logo"
            className="logo-desktop"
          />
        </Link>
      </div> */}
      <div className="cards-container">
        <div className="card" onClick={() => navigate("/emitir")}>
          <div className="card-icon">📄</div>
          <h2>Emitir</h2>
          <p>Emissão de faturas, RPS e documentos individuais</p>
        </div>

        <div className="card" onClick={() => navigate("/consultas")}>
          <div className="card-icon">🔍</div>
          <h2>Consultar</h2>
          <p>Consulta de documentos, faturas e histórico</p>
        </div>
      </div>
    </div>
  );
}