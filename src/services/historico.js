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

export const exportarDadosNota = async (dados) => {
  try {
    const response = await api.post(`/api/nfse/exportar/`, dados, {
      responseType: 'blob'  // Importante para download de arquivo
    });
    
    // Criar blob e fazer download
    const blob = new Blob([response.data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `exportacao_notas_${new Date().toISOString().slice(0,10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return { sucesso: true };
  } catch (error) {
    console.error("Erro ao exportar dados:", error);
    
    // Se for erro de resposta, tentar extrair mensagem
    if (error.response && error.response.data) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const errorData = JSON.parse(e.target.result);
          throw new Error(errorData.error || "Erro desconhecido");
        } catch {
          throw error;
        }
      };
      
      if (error.response.data instanceof Blob) {
        reader.readAsText(error.response.data);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
};

