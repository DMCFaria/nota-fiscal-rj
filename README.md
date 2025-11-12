# 🧾 Nota Fiscal 

Aplicação web desenvolvida em **React + Vite (JavaScript)** para emissão, consulta e gerenciamento de **notas fiscais eletrônicas (NF-e)**.  
O projeto tem foco em **simplicidade, usabilidade e performance**, com interface escura e componentes reutilizáveis.

---

## 🚀 Tecnologias Utilizadas

- **React (Vite)** — Framework principal do frontend  
- **JavaScript (ESNext)** — Lógica da aplicação  
- **CSS modular** — Estilização por página e componente  
- **React Icons** — Ícones vetoriais  
- **Axios / Fetch** — Requisições HTTP para os serviços  
- **Local Storage / APIs simuladas** — Persistência local de dados  

---

## 🧩 Estrutura do Projeto

nota-fiscal/
├── public/ # Ícones, imagens e arquivos públicos
├── src/
│ ├── components/ # Componentes reutilizáveis (Ex: Modal, EmpresaSelect, LogEmissao)
│ ├── pages/ # Páginas principais
│ ├──── emissao/ 
│ │ ├── Fatura.jsx
│ │ ├── RPS.jsx
│ │ └── Individual.jsx
│ ├── Consultas.jsx
│ ├── Configuracoes.jsx
│ └── Historico.jsx
│ ├── services/ # Comunicação com a API / funções utilitárias
│ │ ├── notas.js
│ │ ├── emissao.js
│ │ ├── storage.js
│ │ └── log.js
│ ├── styles/ # Arquivos CSS globais e específicos
│ │ ├── global.css
│ │ ├── consultas.css
│ │ ├── configuracoes.css
│ │ ├── emissao.css
│ │ ├── log.css
│ │ ├── sidebar.css
│ │ └── historico.css
│ ├── App.jsx # Estrutura principal de rotas e layout
│ └── main.jsx # Ponto de entrada do React + Vite
│
├── package.json
├── vite.config.js
└── README.md


---

## 💡 Funcionalidades

- **Emissão de notas fiscais** (por fatura, RPS ou individual)  
- **Transmissão automática** com feedback visual  
- **Download do PDF** após emissão bem-sucedida  
- **Histórico completo de notas** emitidas e com erro  
- **Consulta detalhada** com accordions e ações rápidas  
- **Cancelamento e substituição de notas** modal de confirmação  
- **Sistema de logs e status visual** para cada operação  

---

🧪 Boas Práticas

Componentes organizados e reutilizáveis.

Evitar lógica de negócio dentro do JSX.

Centralizar chamadas de API em services/.

Utilizar classes e variáveis CSS para consistência visual.

Manter responsividade mínima e foco no tema escuro.

Tratar erros e status de forma visual (alertas, badges, logs).


🧑‍💻 Desenvolvido por:

Ingrid Aylana | Desenvolvedora Front-End | Linkedin: www.linkedin.com/in/ingryd-aylana-silva-dos-santos-4a2701158

Daniel Mello | Desenvolvedor Back-end | Linkedin: https://www.linkedin.com/in/danielmellocf/ | GitHub: https://github.com/DMCFaria