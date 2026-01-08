import api from "./api"

export const getTodasFaturas = async () => {
    try {
        const response = await api.get(`consultas/fatura/todas`);
        // console.log("Fatura response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar fatura:", error);
    }   
}

export const getFaturaPorNumero = async (numeroFatura) => {
    try {
        const response = await api.get(`consultas/fatura-por-postos-vida/${numeroFatura}`);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar fatura:", error);
    }   
}
