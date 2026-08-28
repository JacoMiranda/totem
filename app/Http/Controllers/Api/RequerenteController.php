<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Person;
use App\Rules\Cnpj;
use App\Rules\Cpf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Cadastro de pessoas/empresas (pedido do usuário, não estava no plano
 * original) - device key, chamado pelo kiosk quando o cidadão opta por se
 * identificar (nunca obrigatório - o modo anônimo do totem continua sendo
 * o padrão). findOrCreate por CPF/CNPJ: um documento já cadastrado nunca
 * cria um segundo registro nem sobrescreve dados existentes só porque uma
 * nova manifestação informou algo diferente - devolve o registro já
 * existente como está.
 */
class RequerenteController extends Controller
{
    public function findOrCreatePerson(Request $request): JsonResponse
    {
        $validado = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cpf' => ['required', 'string', new Cpf],
            'email' => ['nullable', 'email'],
            'telefone' => ['nullable', 'string', 'max:20'],
        ]);

        $cpf = preg_replace('/\D/', '', $validado['cpf']);
        $pessoa = Person::where('cpf', $cpf)->first();

        if (! $pessoa) {
            $pessoa = Person::create([
                'nome' => $validado['nome'],
                'cpf' => $cpf,
                'email' => $validado['email'] ?? null,
                'telefone' => $validado['telefone'] ?? null,
            ]);
        }

        return response()->json(['type' => 'person', 'id' => $pessoa->id, 'nome' => $pessoa->nome]);
    }

    public function findOrCreateCompany(Request $request): JsonResponse
    {
        $validado = $request->validate([
            'razaoSocial' => ['required', 'string', 'max:255'],
            'cnpj' => ['required', 'string', new Cnpj],
            'nomeFantasia' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'responsavelNome' => ['nullable', 'string', 'max:255'],
        ]);

        $cnpj = preg_replace('/\D/', '', $validado['cnpj']);
        $empresa = Company::where('cnpj', $cnpj)->first();

        if (! $empresa) {
            $empresa = Company::create([
                'razao_social' => $validado['razaoSocial'],
                'cnpj' => $cnpj,
                'nome_fantasia' => $validado['nomeFantasia'] ?? null,
                'email' => $validado['email'] ?? null,
                'telefone' => $validado['telefone'] ?? null,
                'responsavel_nome' => $validado['responsavelNome'] ?? null,
            ]);
        }

        return response()->json(['type' => 'company', 'id' => $empresa->id, 'razaoSocial' => $empresa->razao_social]);
    }
}
