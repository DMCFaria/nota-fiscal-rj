import { useEffect, useState } from "react";
import "../styles/emissao.css";

export default function EmpresaSelect({ value, onChange, options }) {
  const [emp, setEmp] = useState(value || "");

  useEffect(() => { setEmp(value || ""); }, [value]);

  const defaultOptions = [
    { value: "empresaA", label: "Empresa A" },
    { value: "empresaB", label: "Empresa B" },
    { value: "empresaC", label: "Empresa C" },
  ];
  const lista = options?.length ? options : defaultOptions;

  function handleChange(e) {
    setEmp(e.target.value);
    onChange?.(e.target.value);
  }

  return (
    <div className="empresa-inline">
      <label>Empresa</label>
      <select value={emp} onChange={handleChange}>
        <option value="">Selecione...</option>
        {lista.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
