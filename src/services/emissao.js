import { jsPDF } from "jspdf";
import { addLog } from "./log"; 

function gerarPdfNota({ empresa, tipo, numero, itens = [], total }) {
  const doc = new jsPDF();
  const now = new Date();

  doc.setFontSize(16);
  doc.text("Nota Fiscal - " + tipo, 14, 18);
  doc.setFontSize(11);
  doc.text(`Empresa: ${empresa}`, 14, 28);
  doc.text(`Número: ${numero}`, 14, 34);
  doc.text(
    `Data: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    14,
    40
  );

  let y = 52;
  doc.setFontSize(12);
  doc.text("Itens:", 14, y);
  y += 6;

  doc.setFontSize(10);
  if (itens.length === 0) {
    doc.text("- Sem itens detalhados -", 14, y);
    y += 6;
  } else {
    itens.forEach((it) => {
      doc.text(`${it.cliente}`, 14, y);
      doc.text(
        (it.valor ?? 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        180,
        y,
        { align: "right" }
      );
      y += 6;
    });
  }

  doc.setLineWidth(0.2);
  doc.line(14, y + 2, 196, y + 2);
  y += 10;

  doc.setFontSize(12);
  doc.text(
    `Total: ${(total ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}`,
    14,
    y
  );

  return doc.output("blob"); 
}

export async function emitirNota({ empresa, tipo, numero, preview }) {
  const t0 = performance.now();

  // validações simples
  if (!empresa) throw new Error("Selecione a empresa.");
  if (!numero) throw new Error("Informe o número.");

  // Simula chamada à API
  await new Promise((r) => setTimeout(r, 900));

  // Simula sucesso/erro
  const sucesso = Math.random() < 0.9;
  if (!sucesso) {
    addLog?.({
      empresa,
      tipo,
      statusGeral: "err",
      mensagem: `Falha na emissão da ${tipo} ${numero}.`,
      duracaoMs: Math.round(performance.now() - t0),
      payload: { numero },
      resultados: [],
    });
    return { ok: false, erro: "Falha ao comunicar com o serviço da prefeitura." };
  }

  const protocolo = `${tipo === "FATURA" ? "FT" : tipo === "RPS" ? "RPS" : "IND"}-${Date.now()}`;

  // Gera PDF localmente usando itens/total
  const pdfBlob = gerarPdfNota({
    empresa,
    tipo,
    numero,
    itens: preview?.itens ?? [],
    total: preview?.valorTotal ?? 0,
  });

  addLog?.({
    empresa,
    tipo,
    statusGeral: "ok",
    mensagem: `Emissão concluída (${numero}). Protocolo ${protocolo}.`,
    duracaoMs: Math.round(performance.now() - t0),
    payload: { numero },
    resultados: [{ sistema: "Prefeitura", status: "sucesso", protocolo }],
  });

  return { ok: true, protocolo, pdfBlob };
}

/** Dispara download do Blob como arquivo .pdf */
export function baixarPdf(nomeArquivo, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
