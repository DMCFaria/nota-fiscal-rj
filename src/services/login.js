
BASE_URL=import.meta.env.BASE_URL

// Rota de login
export const login = async (username, password) => {
    try {
        const response = await axios.post("http://localhost:8888/api/auth/login", { username, password });
        console.log("BASE_URL", BASE_URL);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

// Rota para recuperar dados do usuário logado
export const recuperaUsuario = async (token) => {
    try {
        const userResponse = await axios.get(
          "http://localhost:8888/api/auth/me",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        return userResponse.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}