//import axios from "axios";
//import api from "./api";
//import n8n from "./n8n";
//import { PDFDocument } from "pdf-lib";
//
//export const getNotaPorIdOuProtocolo = async (idNota) => {
//  try {
//    const response = await api.get(`/api/consultas/nfse/${idNota}/`);
//    return response.data;
//  } catch (error) {
//    console.error("Erro ao buscar nota:", error);
//    throw error;
//  }
//};
//
//export const getNotaPorFatura = async (numero_fatura) => {
//  try {
//    const response = await api.get(
//      `/api/consultas/nfse/consulta-nota-por-fatura/${numero_fatura}/`,
//    );
//    return response.data;
//  } catch (error) {
//    console.error("Erro ao buscar nota:", error);
//    throw error;
//  }
//};
//
//export const getNotaPorID = async (id_tecnospeed) => {
//  try {
//    const response = await api.get(
//      `/api/consultas/nfse/consulta-nota-por-id/${id_tecnospeed}/`,
//    );
//    return response.data;
//  } catch (error) {
//    console.error("Erro ao buscar nota:", error);
//    throw error;
//  }
//};
//
//export const getNotaPorIDIntegracao = async (id_integracao) => {
//  try {
//    const response = await api.get(
//      `/api/consultas/nfse/consulta-nota-por-integracao/${id_integracao}/`,
//    );
//    return response.data;
//  } catch (error) {
//    console.error("ENDPOINT - Erro ao buscar nota:", error);
//    throw error;
//  }
//};
//
//export const sincronizarNotas = async (notasArray) => {
//  const payload = Array.isArray(notasArray)
//    ? { notas: notasArray }
//    : notasArray && typeof notasArray === "object"
//      ? notasArray
//      : { notas: [] };
//
//  if (!payload.origem) payload.origem = "portal_nacional";
//
//  const response = await n8n.post("webhook/sincronizar-nf/", payload);
//  return response.data;
//};
//
//export const getHistoricoFatura = async (numero_fatura) => {
//  try {
//    const response = await api.get(
//      `/api/consultas/historico/consulta-por-fatura/${numero_fatura}`,
//    );
//    return response.data;
//  } catch (error) {
//    console.error("Erro ao buscar histórico da fatura:", error);
//    throw error;
//  }
//};
//
//export const getHistoricoNota = async (notaId) => {
//  try {
//    const response = await api.get(
//      `/api/consultas/historico/consulta-por-id/${notaId}`,
//    );
//    return response.data;
//  } catch (error) {
//    console.error("Erro ao buscar histórico da nota:", error);
//    throw error;
//  }
//};
//
//export const transmitirNota = async (payload) => {
//  try {
//    const { data } = await api.post("/api/consultar-faturas/", payload);
//    return data;
//  } catch (error) {
//    console.error("Erro ao transmitir nota:", error);
//    throw error;
//  }
//};
//
//export const downloadPdfNota = async (payload) => {
//  // Payload enviado para o seu endpoint Django
//  // Agora usamos o valor vindo do payload ou o padrão solicitado
//  const requestPayload = { 
//    fatura: payload?.fatura || "164179" 
//  };
//
//  try {
//    // 1. Faz a requisição enviando apenas a fatura
//    // IMPORTANTE: responseType: 'blob' para tratar o retorno binário do PDF
//    const response = await api.post("/api/nfse/download-pdf/nfse/", requestPayload, {
//      responseType: 'blob',
//      timeout: 300000, // Timeout de 5 minutos para casos de 900+ notas
//    });
//
//    // 2. Cria um link temporário para o arquivo recebido
//    const blob = new Blob([response.data], { type: 'application/pdf' });
//    const url = window.URL.createObjectURL(blob);
//    
//    // 3. Simula o clique para download
//    const link = document.createElement('a');
//    link.href = url;
//    link.setAttribute('download', `NFS_FAT${requestPayload.fatura}.pdf`);
//    document.body.appendChild(link);
//    link.click();
//
//    // 4. Limpeza de memória
//    link.remove();
//    window.URL.revokeObjectURL(url);
//
//    return response;
//  } catch (error) {
//    console.error("Erro ao processar o download do PDF:", error);
//    throw error;
//  }
//};
//
//export const cancelarNota = async (notasArray) => {
//  const payload = Array.isArray(notasArray)
//    ? { notas: notasArray }
//    : notasArray && typeof notasArray === "object"
//      ? notasArray
//      : { notas: [] };
//
//  return await n8n.post("webhook/cancelar-nf", payload);
//};
//
//export const reemitirNota = async (payload) => {
//  try {
//    const response = await n8n.post("webhook/reemitir-nfse", {
//      id_integracao: payload?.id_integracao ?? payload?.idIntegracao ?? "",
//      id_tecnospeed:
//        payload?.id_tecnospeed ?? payload?.idTecnospeed ?? payload?.id ?? "",
//      cep: String(payload?.cep || "")
//        .replace(/\D/g, "")
//        .slice(0, 8),
//    });
//
//    return response.data;
//  } catch (error) {
//    console.error("Erro ao reemitir nota:", error);
//    throw error;
//  }
//};
