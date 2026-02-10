# 🚛 Shineray Logística Integrada ERP (v2.0)

![Laravel](https://img.shields.io/badge/Laravel-11.x-FF2D20?style=for-the-badge&logo=laravel)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=for-the-badge&logo=tailwind-css)
![Inertia.js](https://img.shields.io/badge/Inertia.js-Core-purple?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)
![TiDB](https://img.shields.io/badge/Database-TiDB_Cloud-4479A1?style=for-the-badge&logo=mysql)

Sistema corporativo de **Gestão Logística e Expedição** desenvolvido para a **Sabel Logística / Shineray do Brasil**.

A **Versão 2 (V2)** introduz uma arquitetura otimizada para operação Serverless (Vercel), suporte a banco de dados distribuído (TiDB), controle granular de estoque em trânsito e um novo módulo de **Planejamento Logístico Visual (Calendário)**.

---

## 📋 Índice

- [Novidades da Versão 2](#-novidades-da-versão-2)
- [Funcionalidades por Módulo](#-funcionalidades-por-módulo)
- [Stack Tecnológica](#-stack-tecnológica)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Solução de Performance (TiDB/Vercel)](#-solução-de-performance-tidbvercel)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Autor](#-autor)

---

## 🌟 Novidades da Versão 2

Esta atualização foca em **Granularidade**, **Performance** e **Planejamento Visual**:

1.  **Calendário Logístico Interativo:**
    * Visualização mensal/semanal das rotas.
    * Status visual: 🟠 **Planejado** (Previsão) vs 🟢 **Confirmado** (Carga Fechada).
    * Edição rápida de status e rotas sem necessidade de recriação.
2.  **Montagem de Carga V2 (Granular):**
    * Seleção individual de chassis (Motos) dentro de um pedido.
    * Permite envio parcial de pedidos (Ex: Pedido de 10 motos, envia 4 agora e 6 depois).
    * Separação visual entre **Expedição CD** (Saída) e **Coletas/Milk Run** (Logística Reversa).
3.  **Performance Serverless:**
    * Implementação de **Bulk Insert** para gravação de pedidos, reduzindo o tempo de transação de 12s para <1s.
    * Correção de Timeouts no ambiente Vercel (Hobby/Pro).
4.  **UX/UI Refinado:**
    * Feedback visual imediato com SweetAlert2.
    * Indicadores de fluxo `Origem ➔ Destino` claros nas listagens.

---

## 📦 Funcionalidades por Módulo

### 🏪 Módulo Loja (Revenda)
* **Solicitação Simplificada:** Formulário inteligente que verifica regras de negócio (Duplicidade, Bloqueios).
* **Visualização de Fluxo:** Identificação clara se o pedido é uma **Reposição (Vem do CD)** ou **Transferência (Vem de outra Loja)**.
* **Recebimento:** Confirmação digital com upload de canhoto assinado.

### 👮 Módulo Gestor (Comercial/Admin)
* **Painel de Auditoria:** Aprovação ou rejeição de pedidos com um clique.
* **Controle de Calendário:** Capacidade de planejar rotas futuras e confirmar execuções.
* **Visão Macro:** Dashboard com KPIs de volumes expedidos e pendentes.

### 🏭 Módulo CD (Logística Operacional)
* **Romaneio V2:**
    * Agrupamento automático por Cidade/Destino.
    * Seleção via Checkbox com 3 estados (Vazio, Parcial, Completo).
    * Contadores em tempo real de volume de carga na barra inferior ("Sticky Footer").
* **Expedição:**
    * Geração de Manifesto de Carga PDF.
    * Controle de saída de portaria.
    * Atualização em massa de status para "Em Trânsito".

---

## 💻 Stack Tecnológica

* **Backend:** Laravel 11 (PHP 8.2+)
* **Frontend:** React.js 18 + Inertia.js
* **UI/UX:** Tailwind CSS + SweetAlert2 + FullCalendar
* **Database:** TiDB Cloud (MySQL Compatible)
* **Real-time:** Pusher / Laravel Echo (Notificações de "Plim" na expedição)
* **Infra:** Vercel (Serverless Functions)

---

## 🚀 Instalação e Configuração

### Pré-requisitos
* PHP 8.2+
* Composer
* Node.js & NPM

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

4.  **Banco de Dados & Seeds**
    Configure o TiDB ou MySQL local no `.env` e rode:
    ```bash
    php artisan migrate --seed
    # Seeds atualizados com novas filiais (PA/CE) e usuários admin.
    ```

5.  **Executar (Desenvolvimento)**
    ```bash
    npm run dev
    # Em outro terminal:
    php artisan serve
    ```

---

## ⚡ Solução de Performance (TiDB/Vercel)

Devido à latência entre a Vercel (Serverless) e o TiDB, a inserção de pedidos grandes (10+ motos) causava **Timeout (504)**.

**Solução Aplicada na V2:**
Substituição de loops `foreach { create() }` por **`Model::insert($array)` (Bulk Insert)**.
Isso garante que uma carga de 50 motos seja gravada em uma única query SQL, mantendo o tempo de execução abaixo de 1 segundo.

**Configuração `vercel.json` recomendada:**
```json
{
    "functions": {
        "api/index.php": {
            "memory": 1024,
            "maxDuration": 10
        }
    }
}

👨‍💻 Autor
Délcio Farias Dias Neto Líder de Tecnologia & Inovação - Sabel Logística

"Logística não é sobre transportar coisas, é sobre cumprir promessas."