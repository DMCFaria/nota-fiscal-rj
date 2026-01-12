import api from "./api";
import n8n from "./n8n";

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
        const response = await api.get(`/api/consultas/nfse/consulta-nota-por-fatura/${numero_fatura}/`);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar nota:", error);
    }   
}

export const getNotaPorID = async (id_tecnospeed) => {
    try {
        const response = await api.get(`/api/consultas/nfse/consulta-nota-por-id/${id_tecnospeed}/`);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar nota:", error);
    }   
}

export const getHistoricoFatura = async (faturaNumero) => {
  try {
    const response = await api.get(`/consultas/historico/consulta-por-fatura/${faturaNumero}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar histórico da fatura:', error);
    throw error;
  }
};

export const getHistoricoNota = async (notaId) => {
  try {
    const response = await api.get(`/consultas/historico/consulta-por-id/${notaId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar histórico da nota:', error);
    throw error;
  }
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

export const downloadPdfNota = async (payload) => {
  try {
    const response = await n8n.post("webhook/baixar-pdf-nfse/", payload, {
      responseType: 'arraybuffer', // Crucial para não corromper os bytes
      headers: {
        'Accept': 'application/pdf'
      }
    });

    // Verificação de segurança: se for JSON (erro), o byteLength será pequeno
    const blob = new Blob([response.data], { type: 'application/pdf' });
    
    // Teste rápido: se o PDF está vindo em branco, tente verificar o tamanho no console
    console.log("Tamanho do Blob gerado:", blob.size);

    if (blob.size < 1000) {
      throw new Error("Arquivo PDF parece estar vazio ou inválido.");
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const fileName = payload.tipo === 'fatura' 
      ? `FATURA_${payload.fatura}.pdf` 
      : `NFSE_${payload.idIntegracao}.pdf`;

    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    
    // Limpeza com delay para garantir o clique
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 200);

  } catch (error) {
    console.error("Erro no download:", error);
    throw error;
  }
};

export const cancelarNota = async (notasArray) => {
  
  return await n8n.post("webhook/cancelar-nf", { notas: notasArray });
};