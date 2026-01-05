import api from "./index.js";

// Rota para emitir nota fiscal eletrônica de serviço (NFS-e)
export const emitirNota = async (requestData) => {
    try {
        const response = await api.post("/nfse/emitir-json", requestData, {
            // headers: {
            //     Authorization: `Bearer ${token}`,
            // },
        });
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

// Rota para enviar nota fiscal eletrônica de serviço (NFS-e)
export const enviarNota = async (requestData) => {
    try {
        const response = await api.post("/nfse/enviar-nota", requestData, {
            // headers: {
            //     Authorization: `Bearer ${token}`,
            // },
        });
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

// Rota para consultar nota fiscal eletrônica de serviço (NFS-e) por protocolo
export const consultarNotaPorProtocolo = async (protocolo) => {
    try {
        const response = await api.get(`/nfse/consultar-nota-protocolo/${protocolo}`, {
            // headers: {
            //     Authorization: `Bearer ${token}`,
            // },
        });
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

// Rota para consultar nota fiscal eletrônica de serviço (NFS-e) por ID
export const consultarNotaPorID = async (id) => {
    try {
        const response = await api.get(`/nfse/consultar-nota-id/${id}`, {
            // headers: {
            //     Authorization: `Bearer ${token}`,
            // },
        });
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

// Rota para cancelar nota fiscal eletrônica de serviço (NFS-e)
export const cancelarNota = async (requestData) => {
    try {
        const response = await api.post("/nfse/cancelar-nota", requestData, {
            // headers: {
            //     Authorization: `Bearer ${token}`,
            // },
        });
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}