
import axios from "axios";

export const getTodasFaturas = async () => {
    try {
        const response = await axios.get(`http://127.0.0.1:8000/api/consultas/fatura/todas`);
        // console.log("Fatura response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar fatura:", error);
    }   
}

export const getFaturaPorNumero = async (numeroFatura) => {
    try {
        const response = await axios.get(`http://127.0.0.1:8000/api/consultas/fatura-por-postos-vida/${numeroFatura}`);
        // console.log("Fatura response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar fatura:", error);
    }   
}
