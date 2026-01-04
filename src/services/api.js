// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "https://fedcorp-nfs-e-django-ebh2e.ondigitalocean.app/",
});



// No seu arquivo api.js ou authService.js
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Se o erro for 401 e não for uma tentativa de login ou refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const { access } = await authService.refreshToken();
                localStorage.setItem("accessToken", access);
                
                // Refaz a requisição original com o novo token
                originalRequest.headers.Authorization = `Bearer ${access}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Se o refresh também falhar, desloga (limpa tudo)
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;