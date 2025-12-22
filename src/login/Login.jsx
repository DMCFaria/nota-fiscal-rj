import React, { useState } from "react";
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

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login({ email, password });

      if (result.success) {
        navigate("/emissao/fatura", { replace: true });
      } else {
        setError(result.error || "Falha no login. Verifique suas credenciais.");
      }
    } catch (err) {
      console.error("Erro de login no componente:", err);
      setError("Ocorreu um erro inesperado durante o login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="gradient-bg"></div>

      <div className="login-wrapper">
        <div className="loginContainer">
          <div className="loginBox">
            <img
              src="../../imagens/LOGO.png"
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    className="togglePassword"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label="Mostrar/ocultar senha"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {error && <p className="error-message">{error}</p>}

              <button
                type="submit"
                className="loginButton"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {/* <a href="/esqueci-senha" className="forgot-password">
                Esqueceu sua senha?
              </a> */}
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
