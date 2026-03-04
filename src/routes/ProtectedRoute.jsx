import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth(); // Adicione o loading aqui

  // Enquanto estiver verificando se o user está logado, não redirecione
  if (loading) {
    return <div>Carregando...</div>; // Ou um Spinner/Esqueleto de tela
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}