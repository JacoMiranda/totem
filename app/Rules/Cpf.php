<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Algoritmo padrão de dígito verificador de CPF - mesmo usado em política-laravel (auth.py::validar_cpf). */
class Cpf implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $cpf = preg_replace('/\D/', '', (string) $value);

        if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) {
            $fail('CPF inválido.');

            return;
        }

        for ($posicaoDigito = 9; $posicaoDigito <= 10; $posicaoDigito++) {
            $soma = 0;
            for ($i = 0; $i < $posicaoDigito; $i++) {
                $soma += (int) $cpf[$i] * (($posicaoDigito + 1) - $i);
            }
            $resto = ($soma * 10) % 11;
            $digitoEsperado = $resto === 10 ? 0 : $resto;

            if ((int) $cpf[$posicaoDigito] !== $digitoEsperado) {
                $fail('CPF inválido.');

                return;
            }
        }
    }
}
