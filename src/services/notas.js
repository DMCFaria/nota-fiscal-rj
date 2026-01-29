import axios from "axios";
import api from "./api";
import n8n from "./n8n";

export const getNotaPorIdOuProtocolo = async (idNota) => {
  try {
    const response = await api.get(`/api/consultas/nfse/${idNota}/`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    throw error;
  }
};

export const getNotaPorFatura = async (numero_fatura) => {
  try {
    const response = await api.get(
      `/api/consultas/nfse/consulta-nota-por-fatura/${numero_fatura}/`
    );
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    throw error;
  }
};

export const getNotaPorID = async (id_tecnospeed) => {
  try {
    const response = await api.get(
      `/api/consultas/nfse/consulta-nota-por-id/${id_tecnospeed}/`
    );
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    throw error;
  }
};

export const getNotaPorIDIntegracao = async (id_integracao) => {
  try {
    const response = await api.get(
      `/api/consultas/nfse/consulta-nota-por-integracao/${id_integracao}/`
    );
    return response.data;
  } catch (error) {
    console.error("ENDPOINT - Erro ao buscar nota:", error);
    throw error;
  }
};

export const sincronizarNotas = async (notasArray) => {
  const payload = Array.isArray(notasArray)
    ? { notas: notasArray }
    : notasArray && typeof notasArray === "object"
      ? notasArray
      : { notas: [] };

  if (!payload.origem) payload.origem = "portal_nacional";

  const response = await n8n.post("webhook/sincronizar-nf/", payload);
  return response.data;
};

export const getHistoricoFatura = async (numero_fatura) => {
  try {
    const response = await api.get(
      `/api/consultas/historico/consulta-por-fatura/${numero_fatura}`
    );
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico da fatura:", error);
    throw error;
  }
};

export const getHistoricoNota = async (notaId) => {
  try {
    const response = await api.get(
      `/api/consultas/historico/consulta-por-id/${notaId}`
    );
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico da nota:", error);
    throw error;
  }
};

export const transmitirNota = async (payload) => {
  try {
    const { data } = await api.post("/api/consultar-faturas/", payload);
    return data;
  } catch (error) {
    console.error("Erro ao transmitir nota:", error);
    throw error;
  }
};


export const downloadPdfNota = async (payload) => {
  try {
    const response = await n8n.post("webhook/baixar-pdf-nfse/", payload, {
      responseType: "blob",
      headers: {
        Accept: "application/pdf, application/zip, application/x-zip-compressed, application/octet-stream",
      },
    });

    return response; 
  } catch (error) {
    console.error("Erro no download:", error);
    throw error;
  }
};

export const cancelarNota = async (notasArray) => {
  const payload = Array.isArray(notasArray)
    ? { notas: notasArray }
    : notasArray && typeof notasArray === "object"
      ? notasArray
      : { notas: [] };

  return await n8n.post("webhook/cancelar-nf", payload);
};

export const reemitirNota = async (payload) => {
  try {
    const response = await n8n.post("webhook/reemitir-nfse", {
      id_integracao: payload?.id_integracao ?? payload?.idIntegracao ?? "",
      id_tecnospeed: payload?.id_tecnospeed ?? payload?.idTecnospeed ?? payload?.id ?? "",
      cep: String(payload?.cep || "").replace(/\D/g, "").slice(0, 8),
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao reemitir nota:", error);
    throw error;
  }
};
