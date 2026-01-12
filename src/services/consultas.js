import api from "./api"

// Consultar nota por protocolo
export const consultarNotaPorProtocolo = async (protocolo) => {
    try {
        const response = await api.get(
            `/api/nfse/consultar-nota-protocolo/${protocolo}`
        );
        return response.data;
    } catch (error) {
        console.error("Erro ao consultar nota por protocolo:", error);
        throw error;
    }
};

// Consultar nota por ID
export const consultarNotaPorId = async (id) => {
    try {
        const response = await api.get(
            `/api/nfse/consultar-nota-id/${id}`
        );
        return response.data;
    } catch (error) {
        console.error("Erro ao consultar nota por ID:", error);
        throw error;
    }
};

// Nova função: buscar por número da nota (que pode ser protocolo ou ID)
export const buscarPorNumeroNota = async (numero) => {
    try {
        // Primeiro tenta como protocolo
        const porProtocolo = await consultarNotaPorProtocolo(numero);
        return {
            tipo: "protocolo",
            dados: porProtocolo
        };
    } catch (error) {
        if (error.response?.status === 404) {
            // Se não encontrou por protocolo, tenta como ID
            try {
                const porId = await consultarNotaPorId(numero);
                return {
                    tipo: "id",
                    dados: porId
                };
            } catch (error2) {
                if (error2.response?.status === 404) {
                    return {
                        tipo: "nao_encontrado",
                        dados: null
                    };
                }
                throw error2;
            }
        }
        throw error;
    }
};