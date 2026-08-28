<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Algoritmo padrão de dígito verificador de CNPJ (pesos 5,4,3,2,9,8,7,6,5,4,3,2 / 6,5,4,3,2,9,8,7,6,5,4,3,2). */
class Cnpj implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $cnpj = preg_replace('/\D/', '', (string) $value);

        if (strlen($cnpj) !== 14 || preg_match('/^(\d)\1{13}$/', $cnpj)) {
            $fail('CNPJ inválido.');

            return;
        }

        $pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        $pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        if ($this->digito($cnpj, 12, $pesos1) !== (int) $cnpj[12] || $this->digito($cnpj, 13, $pesos2) !== (int) $cnpj[13]) {
            $fail('CNPJ inválido.');
        }
    }

    /** @param  int[]  $pesos */
    private function digito(string $cnpj, int $tamanho, array $pesos): int
    {
        $soma = 0;
        for ($i = 0; $i < $tamanho; $i++) {
            $soma += (int) $cnpj[$i] * $pesos[$i];
        }
        $resto = $soma % 11;

        return $resto < 2 ? 0 : 11 - $resto;
    }
}
