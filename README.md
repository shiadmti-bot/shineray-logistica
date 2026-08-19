# 🚛 BySabel Logística / Shineray By Sabel (v3.0)

![Laravel](https://img.shields.io/badge/Laravel-11.x-FF2D20?style=for-the-badge&logo=laravel)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=for-the-badge&logo=tailwind-css)
![Inertia.js](https://img.shields.io/badge/Inertia.js-Core-purple?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)
![TiDB](https://img.shields.io/badge/Database-TiDB_Cloud-4479A1?style=for-the-badge&logo=mysql)

Sistema corporativo de **Gestão Logística, Expedição e Peças** desenvolvido para a **Shineray By Sabel**.

O **BySabel Logística** é a espinha dorsal de todo o fluxo operacional logístico da Shineray. A plataforma otimiza a distribuição, expedição e montagem de cargas com extrema eficiência, trazendo controle total do estoque em trânsito e do planejamento tático.

---

## 👨‍💻 Créditos e Desenvolvimento

Desenvolvido e arquitetado por **Délcio Farias Dias Neto**, construído inteiramente para atender as demandas logísticas e operacionais exclusivas da **Shineray By Sabel**.

> *"Logística não é sobre transportar coisas, é sobre cumprir promessas."*

---

## 📋 Índice

- [O Fluxo BySabel](#-o-fluxo-bysabel)
- [Novidades da Versão 3.0](#-novidades-da-versão-30)
- [Controle de Acesso e Perfis (ACL)](#-controle-de-acesso-e-perfis-acl)
- [Funcionalidades por Módulo](#-funcionalidades-por-módulo)
- [Stack Tecnológica](#-stack-tecnológica)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Solução de Performance (TiDB/Vercel)](#-solução-de-performance-tidbvercel)

---

## 🔄 O Fluxo BySabel

O **BySabel Logística** estrutura um fluxo contínuo e inteligente:

1. **Geração de Pedido:** A loja (ou matriz) registra a necessidade de reposição ou transferência de motos e peças.
2. **Auditoria e Aprovação:** O painel de gestão avalia as solicitações de acordo com a viabilidade e prioridade operacional.
3. **Planejamento Visual (Calendário):** Os gestores alocam entregas e expedições de acordo com datas, disponibilidade de veículos e rotas geográficas ideais.
4. **Montagem Granular da Carga:** Os chassis de motos e lotes de peças são designados no nível unitário, permitindo que as docas do Centro de Distribuição (CD) saibam exatamente o que deve subir em qual caminhão.
5. **Expedição e Trânsito:** Geração automática do romaneio e manifesto de carga em PDF. A mercadoria muda de status e o sistema monitora o trânsito da frota até o destino.
6. **Recebimento e Confirmação:** O destino (loja ou cliente final) acusa recebimento anexando o canhoto digital assinado.

---

## 🌟 Novidades da Versão 3.0

Esta grande atualização traz a expansão completa para **Peças**, **Padronização Visual Completa (Design System v3)** e **Saneamento Arquitetural**:

1. **Módulo Completo de Gestão de Peças:**
   - Catálogo global com mais de 2.380 SKUs sincronizados com o Microwork.
   - Motor de compatibilidade e mapeamento automático por modelo (JET, JEF, SHI, STORM, FLASH, etc.).
   - Pedidos de peças por lojas com carrinho e controle de urgência.
   - Gestão de estoque gerenciado no CD com livro-razão (ledger) auditável.
2. **Consulta "Onde Encontrar" (Saldos Microwork Agrupados):**
   - Exibição da disponibilidade de peças por empresa do Microwork (CD + Filiais).
   - Apoio operacional imediato para remanejamento de peças entre filiais.
3. **Design System v3 & Unificação de Telas:**
   - Padronização de 100% dos tokens de cores temáticos (0 cores cruas no projeto).
   - Shell unificada com `AppLayout` e cabeçalhos universais com `PageHeader` em todas as 24 telas autenticadas elegíveis.
   - Nova tela de confirmação de pedidos personalizada.
   - Componentes visuais consistentes: `StatusBadge`, `StatCard`, `DataTable`, `PageHeader`, `Card`.
4. **Segurança e Saneamento de Rotas:**
   - Restrição estrita do módulo de **Gestão de Acessos/Usuários** (`/usuarios*`) exclusivamente para perfil `admin` (403 para demais perfis).
   - Eliminação de rotas REST mortas no `MotoController` com `->only(['index'])`, garantindo respostas 404 estritas para acessos diretos.

---

## 🔐 Controle de Acesso e Perfis (ACL)

| Perfil | Escopo e Responsabilidade | Acessos Principais |
|---|---|---|
| **Admin** | Gestão global da infraestrutura e regras do sistema | Auditoria, Gestão de Usuários (`/usuarios`), Configuração de Rotas, Painel Global |
| **Gestor** | Diretoria comercial e tomadores de decisão | Aprovação/Rejeição de Pedidos, BI Executivo, Histórico Comercial |
| **CD** | Operação física de galpão e distribuição | Expedição, Montagem de Romaneios, Calendário Logístico, Rastreio de Chassis |
| **Loja** | Pontos de venda e revendedoras autorizadas | Criação de Pedidos (Motos/Peças), Conferência & Finalização de Entregas |

---

## 📦 Funcionalidades por Módulo

### 🏪 Módulo Loja (Revenda)
* **Solicitação Simplificada:** Formulário inteligente que verifica regras de negócio (Duplicidade, Bloqueios).
* **Visualização de Fluxo:** Identificação clara se o pedido é uma **Reposição (Vem do CD)** ou **Transferência (Vem de outra Loja)**.
* **Recebimento:** Confirmação digital com upload de canhoto assinado e registro de avarias.

### 👮 Módulo Gestor (Comercial)
* **Painel de Aprovações:** Aprovação, corte parcial ou rejeição de pedidos com um clique.
* **BI Executivo:** Indicadores de SLA, ranking de lojas e pipeline de pedidos.
* **Visão Macro:** Dashboard com KPIs de volumes expedidos e pendentes.

### 🏭 Módulo CD (Logística Operacional)
* **Romaneio V2:**
    * Agrupamento automático por Cidade/Destino.
    * Seleção via Checkbox com 3 estados (Vazio, Parcial, Completo).
    * Contadores em tempo real de volume de carga na barra inferior ("Sticky Footer").
* **Expedição:**
    * Geração de Manifesto de Carga PDF.
    * Controle de saída de portaria e confirmação de coletas intermediárias (*milk run*).
    * Atualização em massa de status para "Em Trânsito".

---

## 💻 Stack Tecnológica

* **Backend:** Laravel 11 (PHP 8.2+)
* **Frontend:** React.js 18 + Inertia.js
* **UI/UX:** Tailwind CSS + SweetAlert2 + FullCalendar + Heroicons
* **Database:** TiDB Cloud (MySQL Compatible)
* **Real-time:** Pusher / Laravel Echo / OneSignal
* **Infra:** Vercel (Serverless Functions)

---

## 🚀 Instalação e Configuração

### Pré-requisitos
* PHP 8.2+
* Composer
* Node.js & NPM

### Passo a Passo

1. **Clonar o repositório**
   ```bash
   git clone https://github.com/shiadmti-bot/shineray-logistica.git
   cd shineray-logistica
   ```

2. **Instalar Dependências**
   ```bash
   composer install
   npm install
   ```

3. **Configurar Ambiente**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. **Banco de Dados & Seeds**
   Configure o TiDB ou MySQL local no `.env` e rode:
   ```bash
   php artisan migrate --seed
   ```

5. **Build dos Assets & Execução**
   ```bash
   npm run build
   # ou em modo desenvolvimento:
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