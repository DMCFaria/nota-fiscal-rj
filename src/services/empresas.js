
import axios from "axios";

export const getEmpresas = async () => {
    try {
        const response = await axios.get("http://localhost:8888/api/consultas/empresas/todas-empresas", {
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
