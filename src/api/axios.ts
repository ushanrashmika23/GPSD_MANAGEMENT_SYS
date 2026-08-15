import axios from "axios";

const api = axios.create({
    // VITE_API_URL=/api routes dev requests through the Vite proxy
    // (same-origin — no CORS involved). Falls back to a direct URL otherwise.
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
    timeout: 60000,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            console.log("Unauthorized");
            // Session is no longer valid — clear it and go back to the login page.
            // Skip the reload when the failing call is auto-login itself (App handles that).
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if (!error.config?.url?.includes("/auth/auto-login")) {
                window.location.reload();
            }
        }
        return Promise.reject(error);
    }
);

export default api;