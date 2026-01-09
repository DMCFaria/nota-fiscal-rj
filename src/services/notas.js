import api from "./api";


export const getNotaPorIdOuProtocolo = async (idNota) => {
    try {
        const response = await api.get(`/consultas/nfse/${idNota}/`);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar nota:", error);
    }   
}

export const getNotaPorFatura = async (numero_fatura) => {
    try {
        const response = await api.get(`/consultas/nfse/consulta-nota-por-fatura/${numero_fatura}/`);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar nota:", error);
    }   
}

// Função para buscar o histórico real do Django
export const getHistorico = async () => {
  const { data } = await api.get("/consultar-faturas/");
  return data.results || data;
};

// Se o seu componente chama isso para limpar cache/mock, 
// definimos como uma função vazia para não quebrar o código.
export const clearHistorico = () => {
  console.log("Limpando histórico local...");
  return true;
};

// Outras funções que você pode estar usando
export const transmitirNota = async (payload) => {
  const { data } = await api.post("/consultar-faturas/", payload);
  return data;
};

export const cancelarNota = async ({ id, sistema }) => {
  const { data } = await api.post(`/consultar-faturas/${id}/cancelar/`, { sistema });
  return data;
};

export const downloadPdfNota = async (idNota) => {
  try {
    // Chama o endpoint que você já tem configurado com o token
    const response = await fetch(`/consultas/nfse/${idNota}/pdf/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao baixar PDF: ${response.status}`);
    }

    // Cria o blob e baixa o arquivo
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nota-${idNota}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Erro ao baixar PDF:", error);
    throw error;
  }
};