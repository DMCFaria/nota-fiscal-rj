import api from "./api";

// 1. Preview: Busca dados no Firebird/Ngrok via Django
export const getNfsePreview = async (payload) => {
  const response = await api.post("nfse/preview/", payload);
  return response.data;
};

// 2. Iniciar: Envia o lote para emissão
export const iniciarEmissao = async (notas) => {
  const response = await api.post("nfse/emissao/", { notas });
  return response.data;
};

