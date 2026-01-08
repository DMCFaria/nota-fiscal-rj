import api from "./api"

export const getEmpresas = async () => {
    try {
        const response = await api.get("consultas/empresas/todas");
        // console.log("Empresas response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

export const getEmpresasPorCNPJ = async (cnpj) => {
    try {
        const response = await api.get(`consultas/empresas/${cnpj}`);
        // console.log("Empresas response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}
