import "../styles/emissao.css";
import { fixBrokenLatin } from "../utils/normalizacao_textual";

export default function EmpresaSelect({ value, onChange, empresas = [] }) {

  function handleChange(e) {
    const cnpjSelecionado = e.target.value;
    const empresaSelecionada = empresas.find(emp => emp.CNPJ === cnpjSelecionado);
    onChange(empresaSelecionada);
  }

  return (
    <select
      className="fc-input fc-select"
      value={value?.CNPJ || ""} 
      onChange={handleChange}
      disabled={empresas.length === 0}
    >
      <option value="">
        {empresas.length === 0
          ? "Carregando empresas..."
          : "Selecione uma empresa"}
      </option>

      {empresas.map((empresa, index) => (
        <option
          key={`${empresa.CNPJ}-${index}`}
          value={empresa.CNPJ}             
        >
          {fixBrokenLatin(empresa.CEDENTE)} - {empresa.CNPJ}
        </option>
      ))}
    </select>
  );
}