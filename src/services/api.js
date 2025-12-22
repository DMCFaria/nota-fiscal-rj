// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "https://back-fedconnect-y46st.ondigitalocean.app/",
});

/**
 * Feature flag: enquanto não existir backend de autenticação real,
 * deixe true para NÃO forçar logout/redirect em 401.
 *
 * Quando o back estiver pronto, mude para false.
 */
const AUTH_ENFORCED = false;

// Intercepta todas as requisições Axios
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");

    // Se o token existir, adicione-o ao cabeçalho Authorization
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // Se auth não está sendo aplicada ainda, não faça redirect por 401
    if (!AUTH_ENFORCED) {
      return Promise.reject(error);
    }

    // Com auth aplicada (futuro): se der 401 fora do /login, derruba o token e manda pro login
    if (status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
