# 🚛 Shineray Logística Integrada ERP

![Laravel](https://img.shields.io/badge/Laravel-10.x-FF2D20?style=for-the-badge&logo=laravel)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=for-the-badge&logo=tailwind-css)
![Inertia.js](https://img.shields.io/badge/Inertia.js-Core-purple?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)

Sistema corporativo de **Gestão Logística e Expedição** desenvolvido para a **Sabel Logística / Shineray do Brasil**. A plataforma orquestra todo o fluxo de distribuição de motocicletas, desde a solicitação das revendas até a confirmação de entrega via reconhecimento digital, garantindo integridade de estoque e rastreabilidade em tempo real.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades por Módulo](#-funcionalidades-por-módulo)
- [Stack Tecnológica](#-stack-tecnológica)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Modo de Manutenção](#-modo-de-manutenção)
- [Integrações Externas](#-integrações-externas)
- [Troubleshooting](#-troubleshooting)
- [Autor](#-autor)

---

## 🔭 Visão Geral

O sistema substitui planilhas e controles manuais por um fluxo digital integrado:
1.  **Lojas** solicitam motos com validação de chassi.
2.  **Gestor Comercial** audita e aprova/corta itens (Painel Mobile/Tablet).
3.  **CD (Centro de Distribuição)** visualiza pedidos aprovados, realiza separação e monta cargas (Romaneios) via leitura de código de barras.
4.  **Entrega** é confirmada via upload de foto do manifesto assinado, com arquivamento automático na nuvem.

---

## 📦 Funcionalidades por Módulo

### 🏪 Módulo Loja (Revenda)
* **Solicitação Inteligente:** Validação de chassi (11-17 caracteres) e verificação de duplicidade.
* **Rastreamento:** Status em tempo real (Em Análise → Aprovado → Em Trânsito).
* **Recebimento:** Upload de comprovante de entrega (foto) que finaliza o pedido automaticamente.

### 👮 Módulo Gestor (Comercial)
* **Painel de Auditoria:** Interface otimizada para Tablets.
* **Fluxo de Aprovação:** Permite aprovar ou rejeitar itens individualmente antes de enviar ao CD.
* **Notificações:** Alertas sonoros ("Plim") e Push Notifications para novos pedidos.

### 🏭 Módulo CD (Logística)
* **Separação:** Visualização apenas de itens aprovados financeiramente.
* **Expedição (Romaneio):**
    * **Scanner:** Leitura de QR Code/Código de Barras via câmera ou leitor USB.
    * **Agrupamento Inteligente:** O sistema organiza a carga por **Cidade de Destino**, permitindo múltiplas paradas na mesma viagem.
    * **Manifesto:** Geração automática de PDF para impressão.
* **Dashboard:** KPIs de expedição e pendências em tempo real.

---

## 💻 Stack Tecnológica

* **Backend:** Laravel 10 (PHP 8.2+)
* **Frontend:** React.js 18 (via Inertia.js)
* **Estilização:** Tailwind CSS (Design System "Red Shineray")
* **Banco de Dados:** MySQL (Produção: TiDB Cloud / Local: MySQL 8)
* **Notificações:** OneSignal (Web Push)
* **Armazenamento:** Google Drive API v3 (Service Account)
* **Logs:** Spatie ActivityLog

---

## 🚀 Instalação e Configuração

### Pré-requisitos
* PHP 8.2+
* Composer
* Node.js & NPM
* MySQL

### Passo a Passo

1.  **Clonar o repositório**
    ```bash
    git clone [https://github.com/seu-repo/shineray-logistica.git](https://github.com/seu-repo/shineray-logistica.git)
    cd shineray-logistica
    ```

2.  **Instalar Dependências**
    ```bash
    composer install
    npm install
    ```

3.  **Configurar Ambiente**
    ```bash
    cp .env.example .env
    php artisan key:generate
    ```

4.  **Banco de Dados**
    Configure as credenciais do banco no arquivo `.env` e rode as migrações:
    ```bash
    php artisan migrate --seed
    # O seed cria usuários padrão: admin@shineray.com / senha: password
    ```

5.  **Executar**
    ```bash
    npm run dev
    # Em outro terminal:
    php artisan serve
    ```

---

## 🔑 Variáveis de Ambiente

Para o sistema funcionar corretamente, configure estas chaves no `.env`:

```ini
# Banco de Dados
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=shineray_db
DB_USERNAME=root
DB_PASSWORD=

# Sistema de Manutenção (Controle via Código)
SISTEMA_MANUTENCAO=false

# Google Drive API (Para comprovantes)
GOOGLE_DRIVE_CLIENT_ID=seu_client_id
GOOGLE_DRIVE_CLIENT_SECRET=seu_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=seu_refresh_token
GOOGLE_DRIVE_FOLDER_ID=id_da_pasta_raiz

# OneSignal (Notificações Push)
ONESIGNAL_APP_ID=seu_app_id
ONESIGNAL_REST_API_KEY=sua_api_key

```

---

## 🛠️ Modo de Manutenção

O sistema possui um modo de manutenção exclusivo controlado via variável de ambiente, ideal para deploys na Vercel sem derrubar o serviço bruscamente.

1. **Ativar:** Mude `SISTEMA_MANUTENCAO=true` no `.env` (ou nas configurações da Vercel).
2. **Comportamento:** Usuários comuns são redirecionados para uma tela de "Em Manutenção".
3. **Acesso TI (Bypass):** A equipe de TI pode acessar a rota secreta `/liberar-acesso-ti` para navegar normalmente e testar as correções enquanto o sistema está fechado para o público.

---

## ☁️ Integrações Externas

### Google Drive API

O sistema utiliza uma **Service Account** do Google Cloud para gerenciar arquivos.

1. Os comprovantes são salvos automaticamente na estrutura: `Ano > Mês > Pedido`.
2. Garanta que o e-mail da Service Account tenha permissão de **Editor** na pasta raiz definida no `.env`.

### OneSignal

Utilizado para disparar notificações em tempo real para Desktop e Mobile quando:

* Um pedido é criado (Avisa Gestor).
* Um pedido é aprovado (Avisa Loja).
* Uma carga sai para entrega (Avisa Loja).

---

## ❓ Troubleshooting

| Problema | Causa Provável | Solução |
| --- | --- | --- |
| **Tela Branca (Produção)** | Cache desatualizado ou erro de JS. | Rodar `php artisan optimize:clear` e verificar console do navegador. |
| **Erro "File not found" (Drive)** | Token expirado ou pasta sem permissão. | Renovar Refresh Token ou verificar permissão da Service Account na pasta do Drive. |
| **Scanner não abre câmera** | Site sem HTTPS. | A API de câmera do navegador exige contexto seguro (HTTPS). |
| **Romaneio agrupando errado** | Lógica de destino antiga. | A versão `v1.0.6+` corrige isso agrupando pelo campo `pivot->destino`. |
| **Erro 401 manifest.json** | Arquivo PWA faltando. | Verifique se `public/manifest.json` existe e tem permissão de leitura. |

---

## 👨‍💻 Autor

**Délcio Farias Dias Neto** *Desenvolvedor Full Stack & Líder de TI*

**Sabel Logística Integrada** *Tecnologia movendo o seu negócio.