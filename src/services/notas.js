// src/services/notas.js
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

// Notas
export const getNotaPorFatura = async (numero_fatura) => {
  try {
    const response = await api.get(`/api/consultas/nfse/consulta-nota-por-fatura/${numero_fatura}/`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    throw error;
  }
};

export const getNotaPorID = async (id_tecnospeed) => {
  try {
    const response = await api.get(`/api/consultas/nfse/consulta-nota-por-id/${id_tecnospeed}/`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    throw error;
  }
};

/** Sincronizar */
export const sincronizarNotas = async ({ tipo, termo }) => {
  try {
    const t = String(termo ?? "").trim();
    if (!t) throw new Error("Informe um termo para sincronizar.");
    
    const response = await api.get(`/api/consultas/nfse/sincronizar/${tipo}/${encodeURIComponent(t)}/`);
    return response.data;
  } catch (error) {
    console.error("Erro ao sincronizar notas:", error);
    throw error;
  }
};

// Histórico
export const getHistoricoFatura = async (numero_fatura) => {
  try {
    const response = await api.get(`/api/consultas/historico/consulta-por-fatura/${numero_fatura}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico da fatura:", error);
    throw error;
  }
};

export const getHistoricoNota = async (notaId) => {
  try {
    const response = await api.get(`/api/consultas/historico/consulta-por-id/${notaId}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico da nota:", error);
    throw error;
  }
};

// Outras funções que você pode estar usando
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
      responseType: "arraybuffer",
      headers: {
        Accept: "application/pdf"
      }
    });

    const blob = new Blob([response.data], { type: "application/pdf" });

    console.log("Tamanho do Blob gerado:", blob.size);

    if (blob.size < 1000) {
      throw new Error("Arquivo PDF parece estar vazio ou inválido.");
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const fileName =
      payload.tipo === "fatura" ? `FATURA_${payload.fatura}.pdf` : `NFSE_${payload.idIntegracao}.pdf`;

    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 200);
  } catch (error) {
    console.error("Erro no download:", error);
    throw error;
  }
};

export const cancelarNota = async (notasArray) => {
  const payload =
    Array.isArray(notasArray)
      ? { notas: notasArray }
      : notasArray && typeof notasArray === "object"
      ? notasArray
      : { notas: [] };

  return await n8n.post("webhook/cancelar-nf", payload);
};

// função: reemitir nota (usada no "Tratar erro")
export const reemitirNota = async (payload) => {
  try {
    const response = await n8n.post("webhook/reemitir-nfse", {
      id_integracao: payload?.id_integracao ?? payload?.idIntegracao ?? "",
      id_tecnospeed: payload?.id_tecnospeed ?? payload?.idTecnospeed ?? payload?.id ?? "",
      cep: String(payload?.cep || "").replace(/\D/g, "").slice(0, 8)
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao reemitir nota:", error);
    throw error;
  }
};
