import React, { useState, useEffect } from "react"; // Adicionado useEffect
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import { useAuth } from "../context/AuthContext";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, isAuthenticated } = useAuth(); // Importado isAuthenticated
  const navigate = useNavigate();

  // 1. Redireciona se já estiver logado
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/emissao/fatura", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      // O seu login no Context já deve lidar com o localStorage e o setUser
      const result = await login({ email, password });

      if (result.success) {
        navigate("/emissao/fatura", { replace: true });
      } else {
        setError(result.error || "E-mail ou senha incorretos.");
      }
    } catch (err) {
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Limpa o erro quando o usuário volta a digitar
  const handleInputChange = (setter) => (e) => {
    if (error) setError("");
    setter(e.target.value);
  };

  return (
    <>
      <div className="gradient-bg"></div>

      <div className="login-wrapper">
        <div className="loginContainer">
          <div className="loginBox">
            {/* Ajuste o caminho conforme onde sua imagem está guardada */}
            <img
              src="/imagens/LOGO.png" 
              alt="Fedcorp Logo"
              className="logoImg"
            />

            <h2 className="titlePortal">Notas FedCorp</h2>
            <p className="pPortal">
              Insira seus dados para acessar a plataforma.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="inputGroup">
                <label htmlFor="email">E-mail:</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={handleInputChange(setEmail)} // Uso da função de limpeza
                  required
                  autoComplete="email"
                />
              </div>

              <div className="inputGroup senhaGroup">
                <label htmlFor="senha">Senha:</label>
                <div className="senhaWrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="senha"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={handleInputChange(setPassword)} // Uso da função de limpeza
                    required
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    className="togglePassword"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Melhoria visual do erro */}
              <div className="error-container" style={{ minHeight: '20px' }}>
                {error && <p className="error-message">{error}</p>}
              </div>

              <button
                type="submit"
                className={`loginButton ${loading ? "btn-loading" : ""}`}
                disabled={loading}
              >
                {loading ? "Processando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;