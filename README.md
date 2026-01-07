# 🏍️ Shineray By Sabel - Sistema Integrado de Logística (SIL)

![Status](https://img.shields.io/badge/Status-Production-green)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![Stack](https://img.shields.io/badge/Stack-TALL-red)

Sistema corporativo desenvolvido para orquestrar o fluxo de distribuição de motocicletas entre o Centro de Distribuição (CD) e as Filiais (Lojas), garantindo rastreabilidade, auditoria e prevenção de erros de estoque.

---

## 🚀 Tecnologias & Arquitetura

Este projeto utiliza uma arquitetura **Monolito Modular Moderno**, otimizada para baixo custo de infraestrutura (Serverless) e alta performance.

### Stack Principal
* **Backend:** [Laravel 11](https://laravel.com) (PHP 8.2+)
* **Frontend:** [React.js 18](https://react.dev)
* **Comunicação:** [Inertia.js](https://inertiajs.com) (Server-side Routing)
* **Estilização:** [Tailwind CSS](https://tailwindcss.com)
* **Banco de Dados:** MySQL 8.0 (Compatível com TiDB Cloud / MariaDB)

### Bibliotecas Chave
* `spatie/laravel-activitylog`: Auditoria forense de alterações.
* `masbug/flysystem-google-drive-ext`: Armazenamento de arquivos via Google Drive API.
* `nprogress`: Feedback visual de carregamento.
* `headlessui/react`: Componentes acessíveis.

### Infraestrutura (Deploy Sugerido)
* **App:** Vercel (Serverless)
* **DB:** TiDB Cloud ou Aiven (MySQL Remoto)
* **Storage:** Google Drive (via Service Account)

---

## 🛠️ Instalação e Configuração (Local)

Siga estes passos para rodar o projeto em ambiente de desenvolvimento:

### 1. Pré-requisitos
* PHP 8.2+
* Composer
* Node.js & NPM
* MySQL Local

### 2. Passo a Passo
```bash
# 1. Clonar o repositório
git clone [https://github.com/seu-usuario/shineray-logistica.git](https://github.com/seu-usuario/shineray-logistica.git)
cd shineray-logistica

# 2. Instalar dependências de Backend e Frontend
composer install
npm install

# 3. Configurar Ambiente
cp .env.example .env
php artisan key:generate

# 4. Configurar Banco de Dados
# Abra o arquivo .env e configure DB_DATABASE, DB_USERNAME, etc.

# 5. Migrar Banco de Dados
php artisan migrate --seed

# 6. Rodar o servidor
npm run dev
# (Em outro terminal)
php artisan serve