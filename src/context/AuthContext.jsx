import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
} from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
    return ctx;
};

// Chave única pra evitar confusão com tokens reais no futuro
const DEV_TOKEN_KEY = "accessToken";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const login = useCallback(async (credentials) => {
        setLoading(true);
        try {
            // ✅ LOGIN FAKE: aceita qualquer credencial
            const fakeToken = "dev-token";

            localStorage.setItem(DEV_TOKEN_KEY, fakeToken);

            setUser({
                email: credentials?.email || "dev@local",
                name: "Usuário DEV",
            });

            setIsAuthenticated(true);

            return { success: true };
        } catch (error) {
            console.error("Fake login failed:", error);
            localStorage.removeItem(DEV_TOKEN_KEY);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: "Falha no login fake." };
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(DEV_TOKEN_KEY);
        setUser(null);
        setIsAuthenticated(false);
        navigate("/login", { replace: true });
    }, [navigate]);

    useEffect(() => {
        // ✅ CHECK FAKE: se tem token, está autenticado
        const token = localStorage.getItem(DEV_TOKEN_KEY);

        if (token) {
            setIsAuthenticated(true);
            setUser((prev) => prev ?? { email: "dev@local", name: "Usuário DEV" });
        } else {
            setIsAuthenticated(false);
            setUser(null);

            if (window.location.pathname !== "/login") {
                navigate("/login", { replace: true });
            }
        }

        setLoading(false);
    }, [navigate]);

    const authContextValue = useMemo(
        () => ({
            user,
            isAuthenticated,
            loading,
            login,
            logout,
        }),
        [user, isAuthenticated, loading, login, logout]
    );

    return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
};

export default AuthContext;
