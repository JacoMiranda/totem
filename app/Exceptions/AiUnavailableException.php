<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Gemini indisponível após todas as tentativas (ver
 * GeminiAiService::postComRetry) - o controller traduz isso pro código de
 * erro `AI_UNAVAILABLE` de docs/API.md, nunca deixa vazar detalhe interno
 * (chave, URL) pro cliente (totem).
 */
class AiUnavailableException extends RuntimeException {}
