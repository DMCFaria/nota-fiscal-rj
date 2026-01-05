import { useEffect, useState } from "react";
import "../styles/emissao.css";

export default function EmpresaSelect({
  value,
  onChange,
  options,
  label = "Empresa emissora",
  placeholder = "Selecione..."
}) {
  const [emp, setEmp] = useState(value || "");

  useEffect(() => { setEmp(value || ""); }, [value]);

  const defaultOptions = [
    { value: "LIDER DO BRASIL ASSISTENCIA RESID E PESSOAL LTDA", label: "LIDER DO BRASIL ASSISTENCIA RESID E PESSOAL LTDA", CNPJ: " 13.945.339/0001-02"},
    { value: "FEDCORP CORRETORA E AGENCIADORA DE SEGUROS LTDA", label: "FEDCORP CORRETORA E AGENCIADORA DE SEGUROS LTDA", CNPJ: " 10.242.439/0001-84"},
    { value: "PEAGA ADMINISTRAÇÃO E CORR. SEGUROS LTDA", label: "PEAGA ADMINISTRAÇÃO E CORR. SEGUROS LTDA", CNPJ: " 04.574.097/0001-05"},
    { value: "CONDOMED ASSESSORIA E CONSULTORIA LTDAA", label: "CONDOMED ASSESSORIA E CONSULTORIA LTDA", CNPJ: "09.551.400/0001-60"},
    { value: "CONDOCORP SERVIÇOS DE INTERMEDIAÇÃO", label: "CONDOCORP SERVIÇOS DE INTERMEDIAÇÃO", CNPJ: "22.708.714/0001-91"},
    { value: "CONDOMED RIO SEGURANCA E MEDICINA DO TRAB EIRELI", label: "CONDOMED RIO SEGURANCA E MEDICINA DO TRAB EIRELI", CNPJ: "27.892.999/0001-87"},
    { value: "FEDCORP CORRETORA E AGENCIADORA DE SEGUROS EIRELI", label: "FEDCORP CORRETORA E AGENCIADORA DE SEGUROS EIRELI", CNPJ: "10.242.439/0002-65"},
    { value: " FEDCORP ADMINISTRADORA DE BENEFICIOS LTDA", label: " FEDCORP ADMINISTRADORA DE BENEFICIOS LTDA", CNPJ: " 35.315.360/0001-67"},
  ];
  const lista = options?.length ? options : defaultOptions;

  function handleChange(e) {
    setEmp(e.target.value);
    onChange?.(e.target.value);
  }

  return (
    <div className="empresa-grid">
      <label className="empresa-label">{label}</label>

      <div className="select-wrap">
        <select
          className="select-control"
          value={emp}
          onChange={handleChange}
        >
          <option value="">{placeholder}</option>
          {lista.map(o => (
            <option key={o.value} value={o.value}>{o.label} {o.CNPJ}</option>
          ))}
        </select>
        <span className="select-chevron" aria-hidden>▾</span>
      </div>
    </div>
  );
}
