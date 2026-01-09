import api from "./api";

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