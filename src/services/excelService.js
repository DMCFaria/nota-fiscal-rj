import api from "./api";

export const importarArquivoExcel = async (formData) => {
  try {
    const response = await api.post('/api/nfse/import/xlsx/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao importar arquivo Excel:', error);
    throw error;
  }
};

export const getListaXlsx = async (page = 1, pageSize = 50) => {
  try {
    const response = await api.get('/api/nfse/list/xlsx/', {
      params: { page, page_size: pageSize },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar notas importadas via XLSX:', error);
    throw error;
  }
};
