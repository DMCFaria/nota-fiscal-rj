import api from './api';


// 1. Preview: Busca dados no Firebird/Ngrok via Django
export const getNfsePreview = async (payload) => {
  const response = await api.post('api/nfse/preview/', payload);
  return response.data;
};

// 2. Iniciar: Envia o lote para emissão
export const iniciarEmissao = async (notas) => {
  const response = await api.post('api/nfse/emissao/', { notas });
  return response.data;
};

// 3. Status: Consulta o progresso do lote
export const consultarStatus = async (protocolo) => {
  const response = await api.get(`api/nfse/emissao/?protocolo=${protocolo}`);
  return response.data;
};

/**
 * Função utilitária de Polling para o componente React
 */
export const startStatusPolling = (fatura, onProgress, onSuccess, onError) => {
  const interval = setInterval(async () => {
    try {
      const result = await consultarStatus(fatura);
      onProgress(result);

      if (result.status_geral === 'concluido') {
        clearInterval(interval);
        onSuccess(result.pdf_url);
      } else if (result.status_geral === 'erro') {
        clearInterval(interval);
        onError(result.message || 'Erro na prefeitura.');
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        clearInterval(interval);
        onError('Erro ao consultar status.');
      }
    }
  }, 3000);

  return () => clearInterval(interval);
};
