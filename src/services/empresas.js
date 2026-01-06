
import axios from "axios";

export const getEmpresas = async () => {
    try {
        const response = await axios.get("http://localhost:8090/api/empresas/todas-empresas", {
            // headers: {
            //     Authorization: `Bearer ${token}`,
            // },
        });
        // console.log("Empresas response:", response);
        return response.data;
    }
    catch (error) {
        console.error("Erro ao buscar empresas:", error);
    }   
}
