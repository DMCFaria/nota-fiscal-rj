import axios from "axios";
import api from "./api";

// Histórico
export const getHistoricoFatura = async (numero_fatura) => {
  try {
    // const response = await axios.get(`http://localhost:8000/api/consultas/historico/consulta-por-fatura/${numero_fatura}/`);
    const response = await api.get(`/api/consultas/historico/consulta-por-fatura/${numero_fatura}/`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar histórico da fatura:', error);
    throw error;
  }
};

export const getHistoricoNota = async (notaId) => {
  try {
    // const response = await axios.get(`http://localhost:8000/api/consultas/historico/consulta-por-id/${notaId}/`);
    const response = await api.get(`/api/consultas/historico/consulta-por-id/${notaId}/`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar histórico da nota:', error);
    throw error;
  }
};
