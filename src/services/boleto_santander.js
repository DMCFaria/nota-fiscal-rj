import api from "./api"

// Consultar nota por protocolo
export const processarBoletoSantander = async (numero_fatura) => {
    try {
        const response = await api.get(
            `/api/nfse/consultar-nota-protocolo/${numero_fatura}`
        );
        return response.data;
    } catch (error) {
        console.error("Erro ao consultar nota por protocolo:", error);
        throw error;
    }
};