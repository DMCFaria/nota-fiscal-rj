import * as XLSX from "xlsx";

// Leitura travada por POSIÇÃO de coluna (não por cabeçalho):
// Coluna C -> CNPJ | Coluna D -> Serviço (descrição). Coluna B usada só para exibição.
const COLUNA_NOME = 1;    // B
const COLUNA_CNPJ = 2;    // C
const COLUNA_SERVICO = 3; // D

// Mesma regra do backend: completa zeros à esquerda perdidos pelo Excel.
// Aceita de 11 a 14 dígitos (CNPJ com até 3 zeros à esquerda suprimidos, ou CPF).
export const normalizarDocumento = (valor) => {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (digitos.length < 11 || digitos.length > 14) return "";
  return digitos.padStart(14, "0");
};

// Mesma sanitização aplicada pelo backend antes do envio ao Focus.
const limparTexto = (valor) =>
  String(valor ?? "")
    .replace(/"/g, "'")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

export async function lerPlanilhaDescricoes(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("A planilha não possui abas legíveis.");

  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const mapa = {};
  const entries = [];
  const duplicados = [];
  const semServico = [];

  linhas.forEach((linha, idx) => {
    const cnpj = normalizarDocumento(linha?.[COLUNA_CNPJ]);
    if (!cnpj) return; // cabeçalho, linha vazia ou valor não-documento

    const nome = limparTexto(linha?.[COLUNA_NOME]);
    const servico = limparTexto(linha?.[COLUNA_SERVICO]);
    const numeroLinha = idx + 1;

    if (!servico) {
      semServico.push({ linha: numeroLinha, cnpj, nome });
      return;
    }
    if (mapa[cnpj]) {
      duplicados.push({ linha: numeroLinha, cnpj, nome, servico });
      return;
    }

    const entry = { cnpj, nome, servico, linha: numeroLinha };
    mapa[cnpj] = entry;
    entries.push(entry);
  });

  return {
    aba: workbook.SheetNames[0],
    mapa,
    entries,
    duplicados,
    semServico,
    totalLinhas: linhas.length,
  };
}
