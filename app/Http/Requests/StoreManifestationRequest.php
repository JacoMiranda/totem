<?php

namespace App\Http\Requests;

use App\Enums\Category;
use App\Enums\Sentiment;
use App\Enums\Urgency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/** Contrato de docs/API.md (POST /manifestations). */
class StoreManifestationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // autenticação já resolvida pelo middleware device.key
    }

    public function rules(): array
    {
        return [
            'clientId' => ['required', 'uuid'],
            'criadoEm' => ['required', 'date'],
            'consentimentoLgpd' => ['required', 'accepted'],
            'transcricao' => ['nullable', 'string'],
            'resumo' => ['nullable', 'string'],
            // Sem piso: o fallback local e o próprio Gemini às vezes devolvem
            // 1-2 palavras num relato curto. Rejeitar por isso mandava a
            // manifestação inteira pro limbo (422 -> fila local presa em
            // 'erro', cidadão via "guardado/temporário" mesmo online).
            'keywords' => ['nullable', 'array', 'max:8'],
            'keywords.*' => ['string', 'max:60'],
            'sentimento' => ['nullable', new Enum(Sentiment::class)],
            'categoria' => ['nullable', new Enum(Category::class)],
            'urgencia' => ['nullable', new Enum(Urgency::class)],
            'temAudio' => ['nullable', 'boolean'],
            'requerenteType' => ['nullable', 'in:person,company'],
            'requerenteId' => ['nullable', 'required_with:requerenteType', 'uuid'],
        ];
    }
}
