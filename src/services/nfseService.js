import axios from "axios";
import api from "./api";

// 1. Preview: Busca dados no Firebird/Ngrok via Django
export const getNfsePreview = async (payload) => {
  try{
    const response = await api.post("/api/nfse/preview/", payload);
    return response.data
  } catch (err) {
    console.error("Falha ao gerar Preview", err)
  }
  return response.data;
};

// 2. Iniciar: Envia o lote para emissão
export const iniciarEmissao = async (notas) => {
  try{
    const response = await api.post("/api/nfse/emissao/", { notas });
    return response.data
  } catch (error){
     console.error("Falha ao emitir nota", error)
  }
  return response.data;
};

