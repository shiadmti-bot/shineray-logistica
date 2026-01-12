# Shineray Logística Integrada

## Visão Geral

O sistema **Shineray Logística Integrada** centraliza, digitaliza e rastreia o fluxo de distribuição de motocicletas entre o Centro de Distribuição (CD) e as Lojas/Revendas. Ele elimina controles manuais, garante a integridade do estoque e fornece KPIs em tempo real para a diretoria.

## Stack Tecnológica

Este projeto utiliza uma arquitetura Monolítica Modular com Inertia.js, combinando as seguintes tecnologias:

*   **Backend:** Laravel 11 (PHP 8.3)
*   **Frontend:** React.js 18 (via Inertia.js)
*   **Estilização:** Tailwind CSS (Design System "Red Shineray")
*   **Banco de Dados:** MySQL / TiDB (Cloud)
*   **Servidor Web:** Nginx / Apache (Compatível com Vercel Serverless)

## Funcionalidades Principais

*   **Gestão de Pedidos:** Criação, acompanhamento de status e confirmação de recebimento por Lojas.
*   **Gestão de Romaneios:** Separação, expedição e geração de manifestos de carga pelo CD.
*   **Rastreamento em Tempo Real:** Acompanhamento do status de pedidos e cargas.
*   **Dashboard Interativo:** KPIs em tempo real com auto-refresh para o perfil CD.
*   **Scanner de Chassi:** Leitura via câmera ou leitor USB com validação de estoque.
*   **Central de Notificações:** Avisos sonoros, toasts e histórico de eventos.
*   **Integração Google Drive API:** Armazenamento de comprovantes de entrega.

## Instalação Local

Para configurar o ambiente de desenvolvimento local, siga os passos abaixo:

```bash
# 1. Clonar repositório
git clone https://github.com/seu-repo/shineray-logistica.git

# 2. Instalar dependências
composer install
npm install

# 3. Configurar ambiente
cp .env.example .env
php artisan key:generate

# 4. Configurar Banco de Dados (no .env) e rodar migrations
php artisan migrate --seed 
# (Nota: O seed cria usuários padrão: admin@shineray.com / 12345678)

# 5. Rodar
npm run dev
php artisan serve
```

## Configuração Google Drive API

Para o funcionamento do upload de comprovantes, configure a Google Drive API:

1.  Crie uma **Service Account** no Google Cloud Console.
2.  Baixe o arquivo JSON de credenciais.
3.  Compartilhe a pasta do Google Drive com o e-mail da Service Account (permissão Editor).
4.  Preencha as variáveis no `.env`:
    *   `GOOGLE_DRIVE_CLIENT_ID`
    *   `GOOGLE_DRIVE_CLIENT_SECRET`
    *   `GOOGLE_DRIVE_REFRESH_TOKEN`
    *   `GOOGLE_DRIVE_FOLDER` (ID da pasta raiz)

## Troubleshooting Comum

| Problema | Causa Provável | Solução |
|---|---|---|
| **Tela Branca após Deploy** | Cache antigo ou build falho. | Rodar `/limpar-cache` ou `php artisan optimize:clear`. |
| **Erro "File not found" (Google Drive)** | Pasta do Drive apagada/ID incorreto/permissão insuficiente. | Verificar ID no `.env` e permissões do e-mail robô na pasta. |
| **Scanner não abre câmera** | Permissão do navegador ou ambiente não HTTPS. | Site em HTTPS; conceder acesso à câmera no celular. |
| **Numeração de Carga (ID 3000+)** | Salto de ID do TiDB/Cloud. | Rodar `/corrigir-numeracao` para resetar `AUTO_INCREMENT`. |
| **Erro 401 manifest.json** | Arquivo `public/manifest.json` faltando ou com permissões incorretas. | Garantir que o arquivo exista e tenha permissão de leitura. |

## Autor

Délcio Farias Dias Neto

**Shineray By Sabel Logística**
**Tecnologia movendo o seu negócio.**
