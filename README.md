# 🚛 BySabel Logística / Shineray By Sabel (v2.0)

![Laravel](https://img.shields.io/badge/Laravel-11.x-FF2D20?style=for-the-badge&logo=laravel)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=for-the-badge&logo=tailwind-css)
![Inertia.js](https://img.shields.io/badge/Inertia.js-Core-purple?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)
![TiDB](https://img.shields.io/badge/Database-TiDB_Cloud-4479A1?style=for-the-badge&logo=mysql)

Sistema corporativo de **Gestão Logística e Expedição** desenvolvido para a **Shineray By Sabel**.

O **BySabel Logística** é a espinha dorsal de todo o fluxo operacional logístico da Shineray. A plataforma otimiza a distribuição, expedição e montagem de cargas com extrema eficiência, trazendo controle total do estoque em trânsito e do planejamento tático.

---

## 👨‍💻 Créditos e Desenvolvimento

Desenvolvido e arquitetado por **Délcio Farias Dias Neto**, construído inteiramente para atender as demandas logísticas e operacionais exclusivas da **Shineray By Sabel**.

> *"Logística não é sobre transportar coisas, é sobre cumprir promessas."*

---

## 📋 Índice

- [O Fluxo BySabel](#-o-fluxo-bysabel)
- [Novidades da Versão 2](#-novidades-da-versão-2)
- [Funcionalidades por Módulo](#-funcionalidades-por-módulo)
- [Stack Tecnológica](#-stack-tecnológica)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Solução de Performance (TiDB/Vercel)](#-solução-de-performance-tidbvercel)

---

## 🔄 O Fluxo BySabel

O **BySabel Logística** estrutura um fluxo contínuo e inteligente:

1. **Geração de Pedido:** A loja (ou matriz) registra a necessidade de reposição ou transferência de estoque.
2. **Auditoria e Aprovação:** O painel de gestão avalia as solicitações de acordo com a viabilidade e prioridade operacional.
3. **Planejamento Visual (Calendário):** Os gestores alocam entregas e expedições de acordo com datas, disponibilidade de veículos e rotas geográficas ideais.
4. **Montagem Granular da Carga:** Os chassis são designados no nível unitário, permitindo que as docas do Centro de Distribuição (CD) saibam exatamente qual moto (com respectivo chassi) deve subir em qual caminhão.
5. **Expedição e Trânsito:** Geração automática do romaneio e manifesto de carga em PDF. A mercadoria muda de status e o sistema monitora o trânsito da frota até o destino.
6. **Recebimento e Confirmação:** O destino (loja ou cliente final) acusa recebimento anexando o canhoto digital assinado.

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
    git clone https://github.com/seu-repo/shineray-logistica.git
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
```