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

    // Proxy de IA (Gemini) - ver App\Services\Ai\GeminiAiService e
    // docs/MIGRACAO-DO-PROTOTIPO.md. A chave NUNCA vai pro cliente (kiosk/
    // admin) - só o backend chama a API Gemini, diferente do protótipo
    // original que a expunha direto no HTML.
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        // gemini-2.5-flash-preview-09-2025 (nome original do protótipo) foi
        // descontinuado pelo Google - confirmado via GET /v1beta/models
        // (2026-08-28) que não existe mais na lista; gemini-2.5-flash (sem
        // sufixo de preview datado) é o sucessor estável na mesma família.
        'text_model' => env('GEMINI_TEXT_MODEL', 'gemini-2.5-flash'),
        'tts_model' => env('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/models'),
    ],

];
