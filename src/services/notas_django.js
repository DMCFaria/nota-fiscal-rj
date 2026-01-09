
import api from "./api";

export const getNotaPorIdOuProtocolo = async (idNota) => {
    try {
        const response = await api.get(`/api/consultas/nfse/${idNota}/`);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar nota:", error);
    }   
}

export const downloadPdfNota = async (idNota) => {
  try {
    // Chama o endpoint que você já tem configurado com o token
    const response = await fetch(`/api/consultas/nfse/${idNota}/pdf/`, {
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