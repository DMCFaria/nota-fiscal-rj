import api from "./api";

// 1. Preview: Busca dados no Firebird/Ngrok via Django
export const getNfsePreview = async (payload) => {
  const response = await api.post("api/nfse/preview/", payload);
  return response.data;
};

// 2. Iniciar: Envia o lote para emissão
export const iniciarEmissao = async (notas) => {
  const response = await api.post("api/nfse/emissao/", { notas });
  return response.data;
};

// 3. Status: Consulta o progresso do lote
export const consultarStatus = async (protocolo) => {
  const response = await api.get(`api/nfse/emissao/?protocolo=${protocolo}`, {
    responseType: "blob",
  });

  const contentType = response.headers["content-type"];

  // Se for PDF, retorna o Blob diretamente
  if (contentType && contentType.includes("application/pdf")) {
    return { tipo: "pdf", data: response.data };
  } 
  
  // Se for JSON (progresso), converte o Blob para objeto JS
  const text = await response.data.text();
  return { tipo: "json", data: JSON.parse(text) };
};

/**
 * Função utilitária de Polling para o componente React
 */
export const startStatusPolling = (protocolo, onProgress, onSuccess, onError) => {
  const interval = setInterval(async () => {
    try {
      const result = await consultarStatus(protocolo);

      if (result.tipo === "json") {
        // AINDA ESTÁ PROCESSANDO (JSON)
        const info = result.data;
        onProgress(info);

        if (info.status_geral === "erro" || info.status_geral === "erro_pdf") {
          clearInterval(interval);
          onError(info.message || "Erro no processamento.");
        }
      } 
      else if (result.tipo === "pdf") {
        // FINALIZOU! (BINÁRIO)
        clearInterval(interval);
        onSuccess({ message: "PDF gerado com sucesso!" });

        try {
          const url = window.URL.createObjectURL(result.data);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `nfse_${protocolo}.pdf`);
          document.body.appendChild(link);
          link.click();
          
          link.parentNode.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (downloadError) {
          console.error("Erro ao processar download do PDF:", downloadError);
        }
      }
    } catch (error) {
      // Se o erro for um Blob, talvez queira ler a mensagem de erro dentro dele
      console.error("Erro no polling:", error);
      clearInterval(interval);
      onError("Falha na comunicação com o servidor.");
    }
  }, 15000);

  return () => clearInterval(interval);
};
