<?php

namespace App\Services;

use App\Models\Device;
use App\Models\Organizacao;
use Illuminate\Support\Str;

/**
 * Gera código e nome dos totens a partir do nome da empresa, para o
 * cliente não precisar inventar identificadores:
 *
 *   "Luiza Brok", 3 totens        -> LuizaBrok-01, LuizaBrok-02, LuizaBrok-03
 *   "Luiza Brok" + local Recepção -> LuizaBrok-01-Recepcao
 *
 * Separação proposital entre os dois campos:
 *  - `codigo`: identificador de máquina. Sem acento e sem espaço, porque
 *    aparece em URL, log, nome de arquivo e export CSV.
 *  - `nome`: rótulo humano, com acento ("Luiza Brok 01 · Recepção").
 */
class NomeadorDeTotens
{
    /** "Luiza Brok" -> "LuizaBrok"; "Prefeitura de São Paulo" -> "PrefeituraDeSaoPaulo". */
    public function slugDaOrganizacao(string $nome): string
    {
        $palavras = preg_split('/[^\p{L}\p{N}]+/u', $this->semAcento($nome), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $slug = implode('', array_map(fn (string $p) => Str::ucfirst(Str::lower($p)), $palavras));

        return $slug !== '' ? Str::limit($slug, 40, '') : 'Organizacao';
    }

    /**
     * Monta os dados de N totens ainda não persistidos.
     *
     * @param  string[]  $locais  local de cada totem, na ordem (opcional; ex.: ['Recepção', 'Triagem'])
     * @return array<int, array{codigo: string, nome: string, unidade: ?string}>
     */
    public function gerar(Organizacao $organizacao, int $quantidade, array $locais = []): array
    {
        $jaUsados = Device::withoutGlobalScopes()
            ->where('organizacao_id', $organizacao->id)
            ->count();

        $totens = [];
        for ($i = 1; $i <= $quantidade; $i++) {
            $sequencia = str_pad((string) ($jaUsados + $i), 2, '0', STR_PAD_LEFT);
            $local = $this->normalizarLocal($locais[$i - 1] ?? null);

            $totens[] = [
                'codigo' => $this->codigoDisponivel($organizacao->slug, $sequencia, $local),
                'nome' => trim($organizacao->nome.' '.$sequencia.($local ? ' · '.$local : '')),
                'unidade' => $local,
            ];
        }

        return $totens;
    }

    /**
     * `codigo` é único no sistema inteiro (duas empresas podem se chamar
     * "Luiza Brok"), então desempata com um sufixo curto em vez de falhar
     * o cadastro na cara do cliente.
     */
    private function codigoDisponivel(string $slugOrg, string $sequencia, ?string $local): string
    {
        $base = $slugOrg.'-'.$sequencia.($local ? '-'.$this->semEspaco($local) : '');

        if (! $this->codigoEmUso($base)) {
            return $base;
        }

        for ($tentativa = 2; $tentativa <= 99; $tentativa++) {
            $candidato = $base.'-'.$tentativa;
            if (! $this->codigoEmUso($candidato)) {
                return $candidato;
            }
        }

        return $base.'-'.Str::lower(Str::random(4));
    }

    private function codigoEmUso(string $codigo): bool
    {
        return Device::withoutGlobalScopes()->where('codigo', $codigo)->exists();
    }

    /** Rótulo humano do local: "  recepção " -> "Recepção". */
    private function normalizarLocal(?string $local): ?string
    {
        $local = trim((string) $local);

        return $local === '' ? null : Str::limit(Str::ucfirst($local), 60, '');
    }

    /** "Recepção Central" -> "RecepcaoCentral" (parte do código). */
    private function semEspaco(string $texto): string
    {
        $palavras = preg_split('/[^\p{L}\p{N}]+/u', $this->semAcento($texto), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return implode('', array_map(fn (string $p) => Str::ucfirst(Str::lower($p)), $palavras));
    }

    private function semAcento(string $texto): string
    {
        return Str::ascii($texto);
    }
}
