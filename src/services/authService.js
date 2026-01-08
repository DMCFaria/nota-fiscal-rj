import api from './api';

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export const authService = {
    async login(credentials) {
        // Rota: /api/auth/token/
        const response = await api.post('users/login/', credentials);
        return response.data; // Espera-se { access: '...', refresh: '...' }
    },

    async refreshToken() {
        const refresh = localStorage.getItem(REFRESH_KEY);
        if (!refresh) throw new Error("No refresh token available");
        
        // Rota: /api/auth/token/refresh/
        const response = await api.post('auth/token/refresh/', { refresh });
        return response.data; // Retorna novo { access: '...' }
    },

    async verifyToken(token) {
        // Rota: /api/auth/token/verify/
        const response = await api.post('auth/token/verify/', { token });
        return response.status === 200;
    },

    async getMe() {
        const response = await api.get('users/me/');
        return response.data;
    }

    
};