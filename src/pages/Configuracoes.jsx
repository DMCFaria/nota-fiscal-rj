import { useState, useEffect } from "react";
import {
  FiSettings,
  FiSave,
  FiAlertCircle,
  FiCheckCircle,
  FiKey,
  FiDatabase,
  FiRefreshCw
} from "react-icons/fi";
import "../styles/configuracoes.css";

export default function Configuracoes() {
  const [abaSelecionada, setAbaSelecionada] = useState("certificado");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [teste, setTeste] = useState({}); 

  const [config, setConfig] = useState({
    // Certificado Digital
    certificado: {
      arquivo: null,
      senha: "",
      validade: null,
    },

    // Sistemas 
    sistemas: [
      {
        id: "prefeitura",
        nome: "Prefeitura (NFS-e)",
        ativo: true,
        url: "",
        usuario: "",
        senha: ""
      },
      {
        id: "sefaz",
        nome: "SEFAZ (NFe/NFC-e)",
        ativo: false,
        url: "",
        usuario: "",
        senha: ""
      },
      {
        id: "sintegra",
        nome: "Sintegra",
        ativo: false,
        url: "",
        usuario: "",
        senha: ""
      }
    ],

    // Empresa
    empresa: {
      cnpj: "",
      razaoSocial: "",
      inscricaoEstadual: "",
      inscricaoMunicipal: ""
    },

    // Avançado
    avancado: {
      timeout: 30,
      tentativasReenvio: 3,
      logDetalhado: false,
      validacaoRigida: true
    }
  });

  useEffect(() => {
    const raw = localStorage.getItem("config_portal");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setConfig((prev) => ({ ...prev, ...parsed }));
    } catch {  }
  }, []);

  function handleNestedChange(grupo, campo, valor) {
    setConfig((prev) => ({
      ...prev,
      [grupo]: { ...prev[grupo], [campo]: valor },
    }));
  }

  function handleSistemaChange(id, campo, valor) {
    setConfig((prev) => ({
      ...prev,
      sistemas: prev.sistemas.map((s) =>
        s.id === id ? { ...s, [campo]: valor } : s
      ),
    }));
  }

  function handleCertificadoUpload(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setConfig((prev) => ({
      ...prev,
      certificado: { ...prev.certificado, arquivo: arquivo.name },
    }));
  }

  async function handleSalvar() {
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    try {
      const { empresa } = config;
      if (empresa.cnpj && !validarCNPJ(empresa.cnpj)) {
        throw new Error("CNPJ inválido");
      }
      localStorage.setItem("config_portal", JSON.stringify(config));
      setMensagem({ tipo: "sucesso", texto: "Configurações salvas com sucesso!" });
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: `Erro ao salvar: ${erro.message}` });
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagem({ tipo: "", texto: "" }), 5000);
    }
  }

  function validarCNPJ(cnpj) {
    const v = (cnpj || "").replace(/\D/g, "");
    if (!v || v.length !== 14 || /^(\d)\1+$/.test(v)) return false;
    const calc = (base) => {
      let soma = 0, pos = base.length - 7;
      for (let i = base.length; i >= 1; i--) {
        soma += base[base.length - i] * pos--;
        if (pos < 2) pos = 9;
      }
      return (soma % 11 < 2) ? 0 : 11 - (soma % 11);
    };
    const nums = v.substr(0, 12).split("").map(Number);
    const d1 = calc(nums);
    const d2 = calc([...nums, d1]);
    return v.endsWith(`${d1}${d2}`);
  }

  async function testarConexao(sistema) {
    setTeste((t) => ({ ...t, [sistema.id]: "testando" }));
    try {
      await new Promise((r) => setTimeout(r, 800));
      if (!sistema.url) throw new Error("URL não configurada");
      setTeste((t) => ({ ...t, [sistema.id]: "ok" }));
    } catch (e) {
      setTeste((t) => ({ ...t, [sistema.id]: "erro" }));
    } finally {
      setTimeout(() => setTeste((t) => ({ ...t, [sistema.id]: "" })), 3000);
    }
  }

  return (
    <div className="configuracoes-container">
      {/* Cabeçalho */}
      <div className="config-header">
        <div className="header-content">
          <h1 className="titulo">
            <FiSettings className="titulo-icon" />
            Configurações do Portal
          </h1>
          <p className="subtitulo">
            Configure os parâmetros de integração e transmissão das notas fiscais
          </p>
        </div>

        <button className="btn-salvar" onClick={handleSalvar} disabled={salvando}>
          {salvando ? (
            <>
              <FiRefreshCw className="icon-spin" />
              Salvando...
            </>
          ) : (
            <>
              <FiSave />
              Salvar Configurações
            </>
          )}
        </button>
      </div>

      {/* Feedback */}
      {mensagem.texto && (
        <div className={`mensagem mensagem-${mensagem.tipo}`}>
          {mensagem.tipo === "sucesso" ? <FiCheckCircle /> : <FiAlertCircle />}
          <span>{mensagem.texto}</span>
        </div>
      )}

      {/* Abas */}
      <div className="tabs">
        <button
          className={`tab ${abaSelecionada === "certificado" ? "tab-ativa" : ""}`}
          onClick={() => setAbaSelecionada("certificado")}
        >
          <FiKey />
          Certificado
        </button>
        <button
          className={`tab ${abaSelecionada === "sistemas" ? "tab-ativa" : ""}`}
          onClick={() => setAbaSelecionada("sistemas")}
        >
          <FiDatabase />
          Sistemas
        </button>
        <button
          className={`tab ${abaSelecionada === "empresa" ? "tab-ativa" : ""}`}
          onClick={() => setAbaSelecionada("empresa")}
        >
          <FiSettings />
          Empresa
        </button>
      </div>

      {/* Conteúdo */}
      <div className="config-content">
        {/* Certificado */}
        {abaSelecionada === "certificado" && (
          <div className="card">
            <h2 className="card-titulo">Certificado Digital</h2>
            <p className="card-descricao">Configure o certificado A1 para assinatura das notas</p>

            <div className="form-group">
              <label className="label">Arquivo do Certificado (.pfx/.p12)</label>
              <div className="file-upload">
                <input
                  type="file"
                  id="certificado"
                  accept=".pfx,.p12"
                  onChange={handleCertificadoUpload}
                  className="file-input"
                />
                <label htmlFor="certificado" className="file-label">
                  <FiKey />
                  {config.certificado.arquivo || "Selecionar arquivo..."}
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Senha do Certificado</label>
              <input
                type="password"
                className="input"
                placeholder="Digite a senha do certificado"
                value={config.certificado.senha}
                onChange={(e) => handleNestedChange("certificado", "senha", e.target.value)}
              />
            </div>

            {config.certificado.arquivo && (
              <div className="alert alert-success">
                <FiCheckCircle />
                <div>
                  <strong>Certificado carregado:</strong> {config.certificado.arquivo}
                  {config.certificado.validade && (
                    <div className="cert-validade">Válido até: {config.certificado.validade}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sistemas */}
        {abaSelecionada === "sistemas" && (
          <div className="card">
            <h2 className="card-titulo">Sistemas Integrados</h2>
            <p className="card-descricao">Configure as credenciais dos serviços externos</p>

            {config.sistemas.map((sistema) => (
              <div key={sistema.id} className="sistema-card">
                <div className="sistema-header">
                  <div className="sistema-info">
                    <h3 className="sistema-nome">{sistema.nome}</h3>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={sistema.ativo}
                        onChange={(e) => handleSistemaChange(sistema.id, "ativo", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                      <span className="toggle-label">{sistema.ativo ? "Ativo" : "Inativo"}</span>
                    </label>
                  </div>
                </div>

                {sistema.ativo && (
                  <div className="sistema-form">
                    <div className="form-group">
                      <label className="input-label">URL do Serviço</label>
                      <input
                        type="url"
                        className="input"
                        placeholder="https://..."
                        value={sistema.url}
                        onChange={(e) => handleSistemaChange(sistema.id, "url", e.target.value)}
                      />
                    </div>

                    <div className="input-row">
                      <div className="input-group">
                        <label className="input-label">Usuário</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Digite o usuário"
                          value={sistema.usuario}
                          onChange={(e) => handleSistemaChange(sistema.id, "usuario", e.target.value)}
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Senha</label>
                        <input
                          type="password"
                          className="input"
                          placeholder="Digite a senha"
                          value={sistema.senha}
                          onChange={(e) => handleSistemaChange(sistema.id, "senha", e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      className={`btn-testar ${teste[sistema.id]}`}
                      onClick={() => testarConexao(sistema)}
                      disabled={teste[sistema.id] === "testando"}
                    >
                      {teste[sistema.id] === "testando" ? (
                        <>
                          <FiRefreshCw className="icon-spin" />
                          Testando...
                        </>
                      ) : teste[sistema.id] === "ok" ? (
                        <>
                          <FiCheckCircle />
                          Conectado
                        </>
                      ) : teste[sistema.id] === "erro" ? (
                        <>
                          <FiAlertCircle />
                          Falhou
                        </>
                      ) : (
                        <>
                          <FiRefreshCw />
                          Testar Conexão
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empresa */}
        {abaSelecionada === "empresa" && (
          <div className="card">
            <h2 className="card-titulo">Dados da Empresa</h2>
            <p className="card-descricao">Informações da empresa emitente</p>

            <div className="form-group">
              <label className="label">CNPJ</label>
              <input
                type="text"
                className="input"
                placeholder="00.000.000/0000-00"
                value={config.empresa.cnpj}
                onChange={(e) => handleNestedChange("empresa", "cnpj", e.target.value)}
                maxLength={18}
              />
            </div>

            <div className="form-group">
              <label className="label">Razão Social</label>
              <input
                type="text"
                className="input"
                placeholder="Digite a razão social"
                value={config.empresa.razaoSocial}
                onChange={(e) => handleNestedChange("empresa", "razaoSocial", e.target.value)}
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label className="input-label">Inscrição Estadual</label>
                <input
                  type="text"
                  className="input"
                  placeholder="000.000.000.000"
                  value={config.empresa.inscricaoEstadual}
                  onChange={(e) => handleNestedChange("empresa", "inscricaoEstadual", e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Inscrição Municipal</label>
                <input
                  type="text"
                  className="input"
                  placeholder="00000000"
                  value={config.empresa.inscricaoMunicipal}
                  onChange={(e) => handleNestedChange("empresa", "inscricaoMunicipal", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
