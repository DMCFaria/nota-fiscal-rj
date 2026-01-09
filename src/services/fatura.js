import api from "./api";

const mapearDadosDjango = (item) => ({
  id: item.id,
  faturamento: item.fatura,
  quando: item.data_criacao,
  sistemas: [
    {
      nome: "PlugNotas",
      status: item.status === 'concluido' ? 'sucesso' : 'erro',
      protocolo: item.numero_nfse || item.id_integracao,
      cancelada: item.situacao_prefeitura === 'CANCELADA',
      substituida: false,
      motivo: item.motivo_rejeicao
    }
  ]
});

export const getFaturaPorNumero = async (numeroFatura) => {
  const { data } = await api.get(`/consultas/fatura/${numeroFatura}`);
  const lista = data.results || data;
  return {
    status: "success",
    data: lista.map(mapearDadosDjango)
  };
};

export const buscarPorNumeroNota = async (termo) => {
  const { data } = await api.get(`/consultar-faturas/?search=${termo}`);
  const lista = data.results || data;
  if (lista.length === 0) return { tipo: "nao_encontrado" };
  return {
    tipo: "sucesso",
    dados: lista.map(mapearDadosDjango)
  };
};

export const cancelarNota = async ({ id, sistema }) => {
  const { data } = await api.post(`/consultar-faturas/${id}/cancelar/`, { sistema });
  return { item: mapearDadosDjango(data) };
};