import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FiUser,
  FiMail,
  FiLock,
  FiSave,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle
} from "react-icons/fi";
import "../styles/configuracoes.css";

const LS_KEY = "user_settings_v1";

function onlyDigits(s = "") {
  return String(s).replace(/\D/g, "");
}

function maskCPF(v = "") {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3) return p1;
  if (d.length <= 6) return `${p1}.${p2}`;
  if (d.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

function maskPhone(v = "") {
  const d = onlyDigits(v).slice(0, 11);
  const dd = d.slice(0, 2);
  const a = d.slice(2, 7);
  const b = d.slice(7, 11);

  if (d.length <= 2) return dd ? `(${dd}` : "";
  if (d.length <= 7) return `(${dd}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${dd}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${dd}) ${a}-${b}`;
}

function validEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function strongPassword(pw = "") {
  // mínimo 8, 1 maiúscula, 1 minúscula, 1 número
  const s = String(pw);
  if (s.length < 8) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  return true;
}

export default function Configuracoes() {
  const [tab, setTab] = useState("perfil"); // perfil | email | senha
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState({
    perfil: {
      nome: "",
      cpf: "",
      telefone: "",
      nascimento: "" // yyyy-mm-dd
    },
    email: {
      atual: "usuario@exemplo.com",
      novo: "",
      senhaAtual: ""
    },
    senha: {
      senhaAtual: "",
      nova: "",
      confirmar: ""
    }
  });

  // Toast
  const [toast, setToast] = useState(null); // { type, msg }
  const [toastState, setToastState] = useState("idle"); // idle | in | out
  const timerRef = useRef(null);

  const showToast = useCallback((type, msg, ms = 3600) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setToast({ type, msg });
    setToastState("in");

    timerRef.current = setTimeout(() => {
      setToastState("out");
      setTimeout(() => {
        setToast(null);
        setToastState("idle");
      }, 220);
    }, ms);
  }, []);

  const closeToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastState("out");
    setTimeout(() => {
      setToast(null);
      setToastState("idle");
    }, 220);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Load local
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        email: { ...prev.email, ...(parsed.email || {}) } // mantém defaults
      }));
    } catch {
      // ignore
    }
  }, []);

  // Helpers update
  const setPerfil = (patch) =>
    setData((prev) => ({ ...prev, perfil: { ...prev.perfil, ...patch } }));
  const setEmail = (patch) =>
    setData((prev) => ({ ...prev, email: { ...prev.email, ...patch } }));
  const setSenha = (patch) =>
    setData((prev) => ({ ...prev, senha: { ...prev.senha, ...patch } }));

  const canSave = useMemo(() => !saving, [saving]);

  // Validações por aba
  const errors = useMemo(() => {
    const e = { perfil: [], email: [], senha: [] };

    // Perfil
    if (!data.perfil.nome.trim()) e.perfil.push("Informe seu nome.");
    if (onlyDigits(data.perfil.cpf).length > 0 && onlyDigits(data.perfil.cpf).length !== 11)
      e.perfil.push("CPF deve ter 11 dígitos (ou deixe em branco).");

    // Email
    if (data.email.novo.trim()) {
      if (!validEmail(data.email.novo)) e.email.push("Novo e-mail inválido.");
      if (!data.email.senhaAtual) e.email.push("Confirme com sua senha atual.");
    }

    // Senha
    const { senhaAtual, nova, confirmar } = data.senha;
    if (nova || confirmar || senhaAtual) {
      if (!senhaAtual) e.senha.push("Informe a senha atual.");
      if (!nova) e.senha.push("Informe a nova senha.");
      if (nova && !strongPassword(nova))
        e.senha.push("Nova senha fraca (mín. 8, maiúscula, minúscula e número).");
      if (confirmar !== nova) e.senha.push("Confirmação não confere com a nova senha.");
    }

    return e;
  }, [data]);

  const hasErrors = (key) => errors[key].length > 0;

  async function handleSave() {
    if (!canSave) return;

    // regra: salva apenas a aba atual (e mantém as outras no estado)
    if (tab === "perfil" && hasErrors("perfil")) {
      showToast("err", errors.perfil[0]);
      return;
    }
    if (tab === "email" && hasErrors("email")) {
      showToast("err", errors.email[0]);
      return;
    }
    if (tab === "senha" && hasErrors("senha")) {
      showToast("err", errors.senha[0]);
      return;
    }

    setSaving(true);
    showToast("info", "Salvando…");

    try {
      // aqui você liga na API depois. Por ora: localStorage.
      const payload = {
        perfil: data.perfil,
        email: {
          atual: data.email.atual,
          // não persiste senha atual
          novo: data.email.novo
        }
        // não persiste senha
      };

      localStorage.setItem(LS_KEY, JSON.stringify(payload));

      // simula sucesso
      await new Promise((r) => setTimeout(r, 350));

      if (tab === "email" && data.email.novo.trim()) {
        // aplica como “atual” e limpa campos
        setData((prev) => ({
          ...prev,
          email: { ...prev.email, atual: prev.email.novo.trim(), novo: "", senhaAtual: "" }
        }));
      }

      if (tab === "senha") {
        setData((prev) => ({ ...prev, senha: { senhaAtual: "", nova: "", confirmar: "" } }));
      }

      showToast("ok", "Alterações salvas com sucesso.");
    } catch (e) {
      showToast("err", "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cfg-page">
      {toast && (
        <div className={`cfg-toast-wrap ${toastState === "in" ? "is-in" : ""} ${toastState === "out" ? "is-out" : ""}`}>
          <div className={`cfg-toast cfg-toast--${toast.type}`}>
            <div className="cfg-toast__msg">{toast.msg}</div>
            <button className="cfg-toast__close" onClick={closeToast} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="cfg-card">
        <header className="cfg-header">
          <div className="cfg-head">
            <h1 className="cfg-title">Configurações da Conta</h1>
            <p className="cfg-subtitle">Gerencie seus dados pessoais, e-mail e senha.</p>
          </div>

          <button className="cfg-save" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <FiRefreshCw className="cfg-spin" />
                Salvando…
              </>
            ) : (
              <>
                <FiSave />
                Salvar
              </>
            )}
          </button>
        </header>

        <nav className="cfg-tabs" role="tablist" aria-label="Configurações da conta">
          <button
            className={`cfg-tab ${tab === "perfil" ? "is-active" : ""}`}
            onClick={() => setTab("perfil")}
            role="tab"
            aria-selected={tab === "perfil"}
          >
            <FiUser /> Perfil
          </button>
          <button
            className={`cfg-tab ${tab === "email" ? "is-active" : ""}`}
            onClick={() => setTab("email")}
            role="tab"
            aria-selected={tab === "email"}
          >
            <FiMail /> E-mail
          </button>
          <button
            className={`cfg-tab ${tab === "senha" ? "is-active" : ""}`}
            onClick={() => setTab("senha")}
            role="tab"
            aria-selected={tab === "senha"}
          >
            <FiLock /> Senha
          </button>
        </nav>

        <div className="cfg-body">
          {tab === "perfil" && (
            <section className="cfg-section">
              <div className="cfg-section__head">
                <h2>Dados pessoais</h2>
                <p>Esses dados são usados para identificação e emissão.</p>
              </div>

              <div className="cfg-grid cfg-grid--2">
                <div className="cfg-field">
                  <label className="cfg-label">Nome</label>
                  <input
                    className="cfg-input"
                    value={data.perfil.nome}
                    onChange={(e) => setPerfil({ nome: e.target.value })}
                    placeholder="Seu nome"
                  />
                </div>

                <div className="cfg-field">
                  <label className="cfg-label">CPF</label>
                  <input
                    className="cfg-input"
                    value={data.perfil.cpf}
                    onChange={(e) => setPerfil({ cpf: maskCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>

                <div className="cfg-field">
                  <label className="cfg-label">Telefone</label>
                  <input
                    className="cfg-input"
                    value={data.perfil.telefone}
                    onChange={(e) => setPerfil({ telefone: maskPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                  />
                </div>

                <div className="cfg-field">
                  <label className="cfg-label">Data de nascimento</label>
                  <input
                    className="cfg-input"
                    type="date"
                    value={data.perfil.nascimento}
                    onChange={(e) => setPerfil({ nascimento: e.target.value })}
                  />
                </div>
              </div>

              {errors.perfil.length > 0 && (
                <div className="cfg-inline-alert cfg-inline-alert--err">
                  <FiAlertCircle />
                  <span>{errors.perfil[0]}</span>
                </div>
              )}
            </section>
          )}

          {tab === "email" && (
            <section className="cfg-section">
              <div className="cfg-section__head">
                <h2>Alterar e-mail</h2>
                <p>Para trocar o e-mail, confirme com sua senha atual.</p>
              </div>

              <div className="cfg-grid cfg-grid--2">
                <div className="cfg-field">
                  <label className="cfg-label">E-mail atual</label>
                  <input className="cfg-input" value={data.email.atual} readOnly />
                </div>

                <div className="cfg-field">
                  <label className="cfg-label">Novo e-mail</label>
                  <input
                    className="cfg-input"
                    value={data.email.novo}
                    onChange={(e) => setEmail({ novo: e.target.value })}
                    placeholder="novo@email.com"
                    inputMode="email"
                  />
                </div>

                <div className="cfg-field cfg-span-2">
                  <label className="cfg-label">Senha atual (confirmação)</label>
                  <input
                    className="cfg-input"
                    type="password"
                    value={data.email.senhaAtual}
                    onChange={(e) => setEmail({ senhaAtual: e.target.value })}
                    placeholder="Digite sua senha atual"
                  />
                </div>
              </div>

              <div className="cfg-tip">
                <FiCheckCircle />
                <span>Se o campo “Novo e-mail” ficar vazio, nada será alterado.</span>
              </div>

              {errors.email.length > 0 && (
                <div className="cfg-inline-alert cfg-inline-alert--err">
                  <FiAlertCircle />
                  <span>{errors.email[0]}</span>
                </div>
              )}
            </section>
          )}

          {tab === "senha" && (
            <section className="cfg-section">
              <div className="cfg-section__head">
                <h2>Alterar senha</h2>
                <p>Use uma senha forte. Sim, a gente vai julgar se for “123456”.</p>
              </div>

              <div className="cfg-grid cfg-grid--2">
                <div className="cfg-field cfg-span-2">
                  <label className="cfg-label">Senha atual</label>
                  <input
                    className="cfg-input"
                    type="password"
                    value={data.senha.senhaAtual}
                    onChange={(e) => setSenha({ senhaAtual: e.target.value })}
                    placeholder="Senha atual"
                  />
                </div>

                <div className="cfg-field">
                  <label className="cfg-label">Nova senha</label>
                  <input
                    className="cfg-input"
                    type="password"
                    value={data.senha.nova}
                    onChange={(e) => setSenha({ nova: e.target.value })}
                    placeholder="Nova senha"
                  />
                  <div className="cfg-help">
                    Mín. 8, com maiúscula, minúscula e número.
                  </div>
                </div>

                <div className="cfg-field">
                  <label className="cfg-label">Confirmar nova senha</label>
                  <input
                    className="cfg-input"
                    type="password"
                    value={data.senha.confirmar}
                    onChange={(e) => setSenha({ confirmar: e.target.value })}
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>

              {errors.senha.length > 0 && (
                <div className="cfg-inline-alert cfg-inline-alert--err">
                  <FiAlertCircle />
                  <span>{errors.senha[0]}</span>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
