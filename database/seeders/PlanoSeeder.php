<?php

namespace Database\Seeders;

use App\Models\Plano;
use Illuminate\Database\Seeder;

/**
 * Catálogo de pacotes exibido na home. **Preços ainda não definidos** -
 * `preco_centavos` nulo aparece como "sob consulta" em vez de um número
 * inventado. Basta preencher aqui quando o comercial fechar os valores.
 */
class PlanoSeeder extends Seeder
{
    public function run(): void
    {
        $planos = [
            [
                'slug' => 'teste',
                'nome' => 'Teste',
                'descricao' => 'Experimente o totem por 7 dias, sem compromisso.',
                'limite_dispositivos' => 1,
                'preco_centavos' => 0,
                'trial_dias' => 7,
                'ordem' => 1,
                'recursos' => [
                    '1 totem',
                    'Atendimento por voz com transcrição',
                    'Painel de manifestações',
                    'Conta descartável — expira em 7 dias',
                ],
            ],
            [
                'slug' => 'essencial',
                'nome' => 'Essencial',
                'descricao' => 'Para uma recepção ou um ponto de atendimento.',
                'limite_dispositivos' => 2,
                'preco_centavos' => null,
                'trial_dias' => 0,
                'ordem' => 2,
                'recursos' => [
                    'Até 2 totens',
                    'Classificação automática por IA',
                    'Relatórios e exportação',
                    'Consulta pública por protocolo',
                ],
            ],
            [
                'slug' => 'profissional',
                'nome' => 'Profissional',
                'descricao' => 'Para órgãos e empresas com várias unidades.',
                'limite_dispositivos' => 5,
                'preco_centavos' => null,
                'trial_dias' => 0,
                'ordem' => 3,
                'recursos' => [
                    'Até 5 totens',
                    'Notificações por e-mail e webhook',
                    'Alertas de SLA',
                    'Suporte prioritário',
                ],
            ],
        ];

        foreach ($planos as $dados) {
            Plano::updateOrCreate(['slug' => $dados['slug']], $dados);
        }
    }
}
