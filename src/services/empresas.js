
import axios from "axios";

// dev - DJANGO EM DESENVOLVIMENTO: http://127.0.0.1:8888/api/hub/todas-empresas
// SERVIDOR DJANGO EM PRODUÇÃO OU NFSE?: https://steeply-outlandish-reese.ngrok-free.dev/api/hub/todas-empresas

export const getEmpresas = async () => {
    try {
        const response = await axios.get("http://127.0.0.1:8000/api/consultas/empresas/todas");
        // console.log("Empresas response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}

export const getEmpresasPorCNPJ = async (cnpj) => {
    try {
        const response = await axios.get(`http://127.0.0.1:8000/api/consultas/empresas/${cnpj}`);
        // console.log("Empresas response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}
