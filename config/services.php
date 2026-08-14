<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'onesignal' => [
        'app_id' => env('ONESIGNAL_APP_ID'),
        'rest_api_key' => env('ONESIGNAL_REST_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    'google' => [
            'client_id' => env('GOOGLE_DRIVE_CLIENT_ID'),
            'client_secret' => env('GOOGLE_DRIVE_CLIENT_SECRET'),
            'refresh_token' => env('GOOGLE_DRIVE_REFRESH_TOKEN'),
            'folder_id' => env('GOOGLE_DRIVE_FOLDER_ID', env('GOOGLE_DRIVE_FOLDER')),
    ],
    'microwork' => [
        'token' => env('MICROWORK_TOKEN'),

        /*
         * Relatório de PEÇAS (Estoque de Mercadorias) — ids confirmados.
         *
         * Devolve uma linha por (mercadoria, empresa). A tradução
         * empresa -> local vive em estoque_locais.codigo_empresa_microwork;
         * sem ela o sync não sabe de quem é o saldo e recusa rodar.
         *
         * `empresas` vazio = consulta apenas as empresas já mapeadas.
         */
        'pecas' => [
            'relatorio_configuracao' => env('MICROWORK_PECAS_CONFIG', 151),
            'relatorio_consulta'     => env('MICROWORK_PECAS_CONSULTA', 67),
            'leiaute'                => env('MICROWORK_PECAS_LEIAUTE', 151),
            'usuario_leiaute'        => env('MICROWORK_PECAS_USUARIO_LEIAUTE', 172),
            'empresas'               => env('MICROWORK_PECAS_EMPRESAS', ''),
            'filtros'                => env('MICROWORK_PECAS_FILTROS', ''),
        ],
    ],

];
