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
        // Histórico de modelos (Google aposenta rápido):
        //  - gemini-2.5-flash-preview-09-2025 (protótipo): sumiu da lista.
        //  - gemini-2.5-flash / -lite: 404 "no longer available to new users".
        //  - gemini-flash-latest: funciona, mas a chamada de ÁUDIO estava
        //    levando 30-55s (e às vezes 503) - inviável no totem.
        // `gemini-flash-lite-latest`: transcrição de áudio em ~12s, texto em
        // ~2s. NÃO aceita `thinkingConfig` (400) - por isso foi removido dos
        // payloads em GeminiAiService.
        'text_model' => env('GEMINI_TEXT_MODEL', 'gemini-flash-lite-latest'),
        'tts_model' => env('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/models'),
    ],

];
