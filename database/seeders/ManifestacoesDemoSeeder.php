<?php

namespace Database\Seeders;

use App\Models\Device;
use App\Models\Manifestation;
use App\Models\Organizacao;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Manifestações fictícias para o painel e os relatórios terem o que
 * mostrar em desenvolvimento. Só roda em `local` (ver DatabaseSeeder).
 *
 * Distribui ao longo dos últimos 60 dias com pesos realistas (reclamação
 * é o teor mais comum numa ouvidoria, denúncia o mais raro) e deixa parte
 * em aberto e parte já concluída - senão os indicadores de SLA e backlog
 * ficam todos zerados e não dá pra avaliar a tela.
 */
class ManifestacoesDemoSeeder extends Seeder
{
    private const RELATOS = [
        'Reclamação' => [
            ['Fiquei mais de duas horas na fila e não havia cadeiras suficientes.', 'Insatisfeito', 'Alta'],
            ['O atendimento demorou muito e ninguém explicava o motivo da espera.', 'Insatisfeito', 'Média'],
            ['O banheiro estava sujo e sem papel durante toda a manhã.', 'Preocupado', 'Média'],
            ['A climatização não funcionava e fazia muito calor na sala de espera.', 'Preocupado', 'Baixa'],
        ],
        'Elogio' => [
            ['Fui muito bem atendido, equipe atenciosa e rápida. Parabéns!', 'Excelente', 'Baixa'],
            ['O serviço melhorou bastante desde a última vez que vim aqui.', 'Satisfeito', 'Baixa'],
        ],
        'Sugestão' => [
            ['Sugiro ampliar o horário de atendimento até as 19h.', 'Neutro', 'Baixa'],
            ['Seria bom ter senha por prioridade para idosos.', 'Neutro', 'Média'],
        ],
        'Dúvida' => [
            ['Onde fica o setor de protocolo e qual o horário de funcionamento?', 'Neutro', 'Baixa'],
            ['Preciso saber quais documentos levar para abrir o processo.', 'Neutro', 'Baixa'],
        ],
        'Denúncia' => [
            ['Venho denunciar cobrança indevida de taxa que deveria ser gratuita.', 'Insatisfeito', 'Crítica'],
        ],
    ];

    /** Peso de cada teor na amostra - reflete o que uma ouvidoria real recebe. */
    private const PESO = ['Reclamação' => 9, 'Sugestão' => 5, 'Dúvida' => 5, 'Elogio' => 4, 'Denúncia' => 2];

    public function run(): void
    {
        $organizacao = Organizacao::where('slug', 'TotemDev')->first();
        $device = Device::withoutGlobalScopes()->where('codigo', 'TOTEM-DEV-01')->first();

        if (! $organizacao || ! $device) {
            $this->command->warn('ManifestacoesDemoSeeder: rode o DevSeeder antes.');

            return;
        }

        // Recomeça do zero: uma execução anterior pode ter parado no meio e
        // deixado dados pela metade, o que estraga qualquer leitura do
        // relatório. São dados fictícios de `local`, apagar é seguro.
        $existentes = Manifestation::withoutGlobalScopes()
            ->where('organizacao_id', $organizacao->id)
            ->where('protocolo', 'like', 'DEMO-%');

        if ($existentes->exists()) {
            $this->command->line('  Removendo manifestações de exemplo anteriores...');
            $existentes->delete();
        }

        $sorteio = [];
        foreach (self::PESO as $categoria => $peso) {
            $sorteio = array_merge($sorteio, array_fill(0, $peso, $categoria));
        }

        $criadas = 0;
        for ($i = 0; $i < 60; $i++) {
            $categoria = $sorteio[array_rand($sorteio)];
            [$texto, $sentimento, $urgencia] = self::RELATOS[$categoria][array_rand(self::RELATOS[$categoria])];

            $criadoEm = now()->subDays(random_int(0, 59))->subHours(random_int(0, 23));
            // Antigas tendem a estar resolvidas; recentes, em aberto.
            $status = $criadoEm->diffInDays(now()) > 20
                ? ['Concluída', 'Concluída', 'Arquivada', 'Respondida'][random_int(0, 3)]
                : ['Recebida', 'Em triagem', 'Em análise'][random_int(0, 2)];

            Manifestation::withoutGlobalScopes()->create([
                'organizacao_id' => $organizacao->id,
                // Prefixo DEMO- para nunca colidir com protocolo real e para
                // este seeder saber o que é dele na hora de recomeçar.
                'protocolo' => 'DEMO-'.$criadoEm->format('Ym').'-'.str_pad((string) ($i + 1), 6, '0', STR_PAD_LEFT),
                'client_id' => (string) Str::uuid(),
                'device_id' => $device->id,
                'canal' => 'Totem',
                'transcricao' => $texto,
                'resumo' => Str::limit($texto, 90),
                'keywords' => ['atendimento', 'totem'],
                'sentimento' => $sentimento,
                'categoria' => $categoria,
                'urgencia' => $urgencia,
                'status' => $status,
                'consentimento_lgpd' => true,
                'criado_em' => $criadoEm,
                // `atualizado_em` (não updated_at) é o campo do modelo; o
                // ReportController usa ele como aproximação do momento da
                // conclusão pra calcular o tempo médio de resolução.
                'atualizado_em' => in_array($status, ['Concluída', 'Arquivada'], true)
                    ? $criadoEm->clone()->addHours(random_int(4, 120))
                    : $criadoEm,
            ]);
            $criadas++;
        }

        $this->command->line("  {$criadas} manifestações de exemplo criadas (últimos 60 dias).");
    }
}
