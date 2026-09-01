// Consulta de CEP no ViaCEP direto do navegador (mesma fonte usada pelo backend).
// Usado para corrigir em massa códigos IBGE não resolvidos na prévia de emissão.

const VIACEP_URL = "https://viacep.com.br/ws";

export async function buscarCepViaCep(cep, { timeoutMs = 10000 } = {}) {
  const digitos = String(cep || "").replace(/\D/g, "");
  if (digitos.length !== 8 || /^0+$/.test(digitos)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${VIACEP_URL}/${digitos}/json/`, { signal: controller.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.erro || !data?.ibge) return null;
    return {
      cep: digitos,
      ibge: String(data.ibge),
      cidade: data.localidade || "",
      uf: data.uf || "",
      bairro: data.bairro || "",
      logradouro: data.logradouro || "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Resolve vários CEPs com concorrência limitada. Retorna { cep: resultado|null }.
export async function resolverCepsEmLote(ceps, { concorrencia = 6, onProgress } = {}) {
  const fila = [...new Set(ceps.map((c) => String(c || "").replace(/\D/g, "")).filter(Boolean))];
  const total = fila.length;
  const resultados = {};
  let concluidos = 0;

  const worker = async () => {
    while (fila.length) {
      const cep = fila.shift();
      resultados[cep] = await buscarCepViaCep(cep);
      concluidos += 1;
      onProgress?.(concluidos, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concorrencia, total)) }, worker)
  );
  return resultados;
}
