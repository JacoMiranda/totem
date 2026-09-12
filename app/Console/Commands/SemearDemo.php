<?php

namespace App\Console\Commands;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\ManifestationStatusHistory;
use App\Models\Organizacao;
use App\Models\Plano;
use App\Models\PulsoPonto;
use App\Models\PulsoResposta;
use App\Models\User;
use App\Services\MuralService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Empresa-demo pronta pra apresentação / vídeo / marketing: uma conta
 * fictícia ("Rede Aurora") com totens, ~170 manifestações realistas ao
 * longo de 5 meses, respostas oficiais, o mural público já ligado num
 * link fixo, e 3 pontos de s-Totem (QR sem tablet) com histórico de
 * exemplo + painel público ligado. Ver docs/DEMO-APRESENTACAO.md.
 *
 * Dados 100% fictícios, prefixo de protocolo `AURORA-`. Idempotente:
 * `--fresh` apaga a demo antes de recriar.
 */
class SemearDemo extends Command
{
    protected $signature = 'ouvidoria:semear-demo {--fresh : Apaga a empresa-demo e recria do zero} {--force : Permite rodar em produção}';

    protected $description = 'Cria a empresa-demo "Rede Aurora" (totens + manifestações + mural) para apresentação';

    private const SLUG = 'RedeAurora';

    private const MURAL_TOKEN = 'demoredeauroraouvidoria';

    private const SENHA_DEMO = 'demo1234';

    /** [transcrição, sentimento, urgência, [keywords]] por teor. */
    private const RELATOS = [
        'Reclamação' => [
            ['Esperei quarenta minutos no caixa e só dois estavam abertos num sábado lotado.', 'Insatisfeito', 'Alta', ['fila', 'caixa', 'espera']],
            ['Comprei um pacote de queijo que já estava vencido dois dias na prateleira.', 'Insatisfeito', 'Alta', ['produto', 'vencido', 'validade']],
            ['Fui cobrado por uma sacola que eu não pedi e o caixa não quis estornar.', 'Preocupado', 'Média', ['cobrança', 'sacola', 'estorno']],
            ['O funcionário da padaria respondeu de forma grosseira quando pedi para trocar um pão.', 'Insatisfeito', 'Média', ['atendimento', 'padaria', 'grosseria']],
            ['O ar-condicionado da loja estava desligado e o calor no corredor era insuportável.', 'Preocupado', 'Baixa', ['climatização', 'loja', 'calor']],
            ['A vaga de idoso no estacionamento estava ocupada por um carro sem identificação.', 'Preocupado', 'Baixa', ['estacionamento', 'acessibilidade', 'vaga']],
            ['O aplicativo travou três vezes na hora de finalizar a compra e perdi a promoção.', 'Insatisfeito', 'Média', ['aplicativo', 'promoção', 'erro']],
        ],
        'Elogio' => [
            ['A atendente do balcão de trocas resolveu meu problema em cinco minutos, muito educada.', 'Excelente', 'Baixa', ['atendimento', 'troca', 'agilidade']],
            ['A loja está muito mais organizada e limpa depois da reforma, parabéns à equipe.', 'Satisfeito', 'Baixa', ['organização', 'limpeza', 'reforma']],
            ['Fui muito bem recebido, o segurança até me ajudou a levar as compras até o carro.', 'Excelente', 'Baixa', ['recepção', 'cortesia', 'segurança']],
            ['O setor de hortifruti está sempre com produtos frescos, faço questão de vir aqui por isso.', 'Satisfeito', 'Baixa', ['hortifruti', 'qualidade', 'frescor']],
            ['Pedi ajuda para encontrar um item e o repositor largou o que fazia para me acompanhar.', 'Excelente', 'Baixa', ['atendimento', 'ajuda', 'equipe']],
            ['Registrei uma reclamação semana passada e me responderam de verdade, com solução. Fiquei impressionado.', 'Excelente', 'Baixa', ['ouvidoria', 'resposta', 'solução']],
            ['O caixa preferencial agora anda rápido e o pessoal trata os idosos com muita paciência.', 'Satisfeito', 'Baixa', ['caixa', 'preferencial', 'paciência']],
            ['Esqueci a carteira e a gerente segurou minhas compras até eu voltar. Atendimento humano.', 'Excelente', 'Baixa', ['gerência', 'gentileza', 'atendimento']],
            ['Os preços das ofertas batem certinho no caixa desde que criaram esse canal. Melhorou muito.', 'Satisfeito', 'Baixa', ['preço', 'oferta', 'confiança']],
        ],
        'Sugestão' => [
            ['Seria ótimo ter um caixa preferencial só para quem leva poucos itens.', 'Neutro', 'Baixa', ['caixa', 'preferencial', 'agilidade']],
            ['Sugiro estender o horário de funcionamento até as 22h nos dias de semana.', 'Neutro', 'Baixa', ['horário', 'funcionamento', 'semana']],
            ['Poderiam ampliar as opções sem glúten na seção de pães e bolos.', 'Neutro', 'Baixa', ['produto', 'sem-glúten', 'variedade']],
            ['Uma balança a mais no hortifruti evitaria o acúmulo de gente num ponto só.', 'Neutro', 'Média', ['hortifruti', 'balança', 'fila']],
            ['Que tal um programa de devolução de embalagens com desconto na próxima compra?', 'Neutro', 'Baixa', ['sustentabilidade', 'embalagem', 'desconto']],
        ],
        'Dúvida' => [
            ['Qual é o prazo para trocar um produto com defeito e o que preciso levar?', 'Neutro', 'Baixa', ['troca', 'prazo', 'defeito']],
            ['Vocês aceitam pagamento por aproximação em todos os caixas?', 'Neutro', 'Baixa', ['pagamento', 'aproximação', 'caixa']],
            ['Como faço para participar do clube de fidelidade e usar os pontos?', 'Neutro', 'Baixa', ['fidelidade', 'pontos', 'cadastro']],
            ['O estacionamento é gratuito por quanto tempo para quem compra na loja?', 'Neutro', 'Baixa', ['estacionamento', 'gratuidade', 'tempo']],
            ['A entrega em domicílio atende o meu bairro e qual o valor do frete?', 'Neutro', 'Baixa', ['entrega', 'frete', 'bairro']],
        ],
        'Denúncia' => [
            ['Presenciei um funcionário exigindo a compra de um produto para liberar a oferta anunciada.', 'Insatisfeito', 'Crítica', ['venda-casada', 'oferta', 'conduta']],
            ['Vi descarte de óleo de cozinha usado direto no bueiro dos fundos da loja.', 'Preocupado', 'Crítica', ['descarte', 'ambiental', 'irregular']],
            ['A promoção da vitrine tinha preço diferente no caixa e disseram que o cartaz estava errado.', 'Insatisfeito', 'Crítica', ['propaganda-enganosa', 'preço', 'promoção']],
        ],
    ];

    private const RESPOSTAS = [
        'Reclamação' => 'Agradecemos o seu contato e pedimos desculpas pelo transtorno. O caso foi encaminhado à gerência da unidade, que reforçou a escala da equipe e revisou o procedimento. Estamos à disposição pelo mesmo protocolo.',
        'Elogio' => 'Muito obrigado pelo carinho! Encaminhamos o seu reconhecimento à equipe da unidade — comentários como o seu incentivam todo o time.',
        'Sugestão' => 'Obrigado pela sugestão. Ela foi registrada e levada à área responsável para avaliação no próximo ciclo de melhorias das lojas.',
        'Dúvida' => 'Olá! Respondemos a sua dúvida pelo canal de acompanhamento com todas as informações. Qualquer coisa, é só retornar pelo protocolo.',
        'Denúncia' => 'Recebemos a sua denúncia e ela foi tratada com prioridade e sigilo pela área de conformidade. As medidas cabíveis foram adotadas junto à unidade. Agradecemos por nos ajudar a melhorar.',
    ];

    private const PESO = ['Reclamação' => 7, 'Sugestão' => 5, 'Dúvida' => 5, 'Elogio' => 7, 'Denúncia' => 2];

    private const PRAZO_DIAS = ['Crítica' => 1, 'Alta' => 3, 'Média' => 7, 'Baixa' => 15];

    private const UNIDADES = [
        'RedeAurora-01-Recepcao' => ['Recepção', 'demo-aurora-recepcao'],
        'RedeAurora-02-Centro' => ['Matriz Centro', 'demo-aurora-centro'],
        'RedeAurora-03-Norte' => ['Filial Norte', 'demo-aurora-norte'],
        'RedeAurora-04-Shopping' => ['Loja Shopping', 'demo-aurora-shopping'],
    ];

    private const PULSO_PAINEL_TOKEN = 'redeaurora-painel';

    /**
     * 3 QRs de exemplo (ver App\Http\Controllers\Api\PulsoController) - a
     * Aurora é porte médio (já tem totem físico nas 4 unidades acima), mas
     * o pedido explícito foi ter exemplos de s-Totem na conta-demo mesmo
     * assim, pra mostrar o recurso em apresentação/vídeo.
     */
    private const PULSO_PONTOS = [
        'redeaurora-recepcao-qr' => ['nome' => 'QR Recepção', 'unidade' => 'Recepção', 'perguntas' => ['Atendimento', 'Tempo de espera']],
        'redeaurora-caixa-qr' => ['nome' => 'QR Caixa', 'unidade' => 'Loja Shopping', 'perguntas' => ['Atendimento', 'Produto/Serviço']],
        'redeaurora-sac-qr' => ['nome' => 'QR SAC', 'unidade' => 'Matriz Centro', 'perguntas' => ['Atendimento', 'Resolução do problema']],
    ];

    public function handle(MuralService $mural): int
    {
        if (app()->environment('production') && ! $this->option('force')) {
            $this->error('Isto cria dados fictícios. Em produção, rode com --force se for mesmo um ambiente de demonstração.');

            return self::FAILURE;
        }

        $org = Organizacao::firstWhere('slug', self::SLUG);

        // `--fresh` só zera as MANIFESTAÇÕES. A organização, os totens e a
        // equipe são preservados (updateOrCreate abaixo) - senão o UUID da
        // org e as linhas de device mudam a cada reseed e qualquer totem já
        // pareado (que guarda a device key) passa a apontar pra org antiga.
        if ($org && $this->option('fresh')) {
            $this->line('Zerando as manifestações da empresa-demo...');
            Manifestation::withoutGlobalScopes()->where('organizacao_id', $org->id)->delete();
        }

        $org = $org ?? new Organizacao(['slug' => self::SLUG]);
        $org->fill([
            'nome' => 'Rede Aurora',
            'documento' => '00.000.000/0001-00',
            'plano_id' => Plano::where('slug', 'profissional')->value('id'),
            'status' => OrganizacaoStatus::Ativa,
            'mural_ativo' => true,
            'mural_token' => self::MURAL_TOKEN,
            'mural_titulo' => 'Ouvidoria Rede Aurora',
            'pulso_painel_ativo' => true,
            'pulso_painel_token' => self::PULSO_PAINEL_TOKEN,
        ]);
        $org->save();

        $admin = User::updateOrCreate(
            ['email' => 'demo@aurora.test'],
            [
                'organizacao_id' => $org->id,
                'name' => 'Ana — Ouvidoria',
                'password' => Hash::make(self::SENHA_DEMO),
                'role' => UserRole::Admin,
                'ativo' => true,
                'email_verified_at' => now(),
            ],
        );
        // Ana (admin) coordena e fica FORA do rodízio. Bruno e Carla
        // (analistas) recebem os casos automaticamente, equilibrado.
        $admin->forceFill(['recebe_atribuicao' => false])->save();

        $analistas = collect(['Bruno — Análise' => 'analista@aurora.test', 'Carla — Análise' => 'carla@aurora.test'])
            ->map(fn ($email, $nome) => User::updateOrCreate(
                ['email' => $email],
                [
                    'organizacao_id' => $org->id,
                    'name' => $nome,
                    'password' => Hash::make(self::SENHA_DEMO),
                    'role' => UserRole::Analista,
                    'ativo' => true,
                    'recebe_atribuicao' => true,
                    'email_verified_at' => now(),
                ],
            ))
            ->values();

        $devices = [];
        foreach (self::UNIDADES as $codigo => [$unidade, $chave]) {
            $devices[] = Device::withoutGlobalScopes()->updateOrCreate(
                ['codigo' => $codigo],
                [
                    'organizacao_id' => $org->id,
                    'nome' => 'Rede Aurora · '.$unidade,
                    'unidade' => $unidade,
                    'api_key_hash' => hash('sha256', $chave),
                    'ativo' => true,
                    'ultima_sync_em' => now()->subMinutes(random_int(2, 90)),
                ],
            );
        }

        $pontosPulso = [];
        foreach (self::PULSO_PONTOS as $token => $dados) {
            $pontosPulso[] = PulsoPonto::withoutGlobalScopes()->updateOrCreate(
                ['token' => $token],
                [
                    'organizacao_id' => $org->id,
                    'nome' => $dados['nome'],
                    'unidade' => $dados['unidade'],
                    'perguntas' => $dados['perguntas'],
                    'ativo' => true,
                ],
            );
        }

        // Sempre refeito (como as manifestações abaixo) - histórico de
        // exemplo, não dado real que precise ser preservado entre seeds.
        PulsoResposta::withoutGlobalScopes()
            ->whereIn('pulso_ponto_id', collect($pontosPulso)->pluck('id'))
            ->delete();
        foreach ($pontosPulso as $ponto) {
            for ($i = 0, $totalRespostas = random_int(40, 90); $i < $totalRespostas; $i++) {
                PulsoResposta::withoutGlobalScopes()->create([
                    'pulso_ponto_id' => $ponto->id,
                    'organizacao_id' => $org->id,
                    'pergunta' => $ponto->perguntas[array_rand($ponto->perguntas)],
                    'valor' => $this->sorteioPonderado([['positivo', 65], ['neutro', 25], ['negativo', 10]]),
                    'criado_em' => now()->subDays(random_int(0, 29))->setTime(random_int(8, 20), random_int(0, 59)),
                ]);
            }
        }

        Manifestation::withoutGlobalScopes()->where('organizacao_id', $org->id)->delete();
        $sorteio = [];
        foreach (self::PESO as $cat => $peso) {
            $sorteio = array_merge($sorteio, array_fill(0, $peso, $cat));
        }

        $total = 170;
        $criadas = 0;
        for ($n = 1; $n <= $total; $n++) {
            $categoria = $sorteio[array_rand($sorteio)];
            [$texto, $sentimento, $urgencia, $keywords] = self::RELATOS[$categoria][array_rand(self::RELATOS[$categoria])];
            $device = $devices[array_rand($devices)];

            // Distribuição enviesada pro recente (mais movimento agora do que 5 meses atrás).
            $diasAtras = (int) round((150 * (1 - sqrt(mt_rand() / mt_getrandmax()))));
            $criadoEm = Carbon::now()->subDays($diasAtras)->setTime(random_int(8, 19), random_int(0, 59));

            [$status, $respostaEm, $atualizadoEm] = $this->cicloDeVida($criadoEm, $urgencia);

            $m = new Manifestation;
            $m->forceFill([
                'organizacao_id' => $org->id,
                'protocolo' => 'AURORA-'.$criadoEm->format('Ym').'-'.str_pad((string) $n, 6, '0', STR_PAD_LEFT),
                'client_id' => (string) Str::uuid(),
                // sha256 como o ProtocoloService::hashPin (não bcrypt) - dados fictícios, e 170x bcrypt é lento.
                'pin_acompanhamento' => hash('sha256', str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT)),
                'canal' => 'Totem',
                'device_id' => $device->id,
                'transcricao' => $texto,
                'resumo' => Str::limit($texto, 150, ''),
                'keywords' => $keywords,
                'sentimento' => $sentimento,
                'categoria' => $categoria,
                'urgencia' => $urgencia,
                'status' => $status,
                // "Recebida"/"Em triagem" ainda sem dono (acabou de chegar);
                // o resto rodou entre os analistas do rodízio.
                'responsavel_id' => in_array($status, ['Em análise', 'Respondida', 'Concluída', 'Arquivada'], true)
                    ? $analistas[$n % $analistas->count()]->id
                    : null,
                'resposta_oficial' => $respostaEm ? self::RESPOSTAS[$categoria] : null,
                'resposta_publicada_em' => $respostaEm,
                'consentimento_lgpd' => true,
                'origem_ip' => '203.0.113.'.random_int(2, 250),
                'criado_em' => $criadoEm,
                'recebido_em' => $criadoEm->clone()->addMinutes(random_int(0, 5)),
                'atualizado_em' => $atualizadoEm,
            ]);
            $m->save();

            ManifestationStatusHistory::create([
                'manifestation_id' => $m->id,
                'de_status' => null,
                'para_status' => 'Recebida',
                'autor_id' => null,
                'criado_em' => $criadoEm,
            ]);
            $criadas++;
        }

        $numeros = $mural->paraOrganizacao($org->fresh());

        $this->newLine();
        $this->info('== Empresa-demo "Rede Aurora" pronta ==');
        $this->line("  Manifestações:   {$criadas} (últimos 150 dias)");
        $this->line('  Painel admin:    /admin  →  demo@aurora.test (Ana, admin)  /  '.self::SENHA_DEMO);
        $this->line('                   analista@aurora.test (Bruno)  ·  carla@aurora.test (Carla)  /  '.self::SENHA_DEMO);
        $this->line('  Mural público:   '.url('/mural/'.self::MURAL_TOKEN));
        $this->line('  Totens (device key):');
        foreach (self::UNIDADES as $codigo => [$unidade, $chave]) {
            $this->line("     {$codigo}  ({$unidade})  →  {$chave}");
        }
        $this->newLine();
        $this->line('  s-Totem (QR sem tablet):');
        foreach (self::PULSO_PONTOS as $token => $dados) {
            $this->line("     {$dados['nome']}  ({$dados['unidade']})  →  ".url('/pulso/'.$token));
        }
        $this->line('  Painel s-Totem:  '.url('/s-totem/'.self::PULSO_PAINEL_TOKEN));
        $this->newLine();
        $this->line('  Números do mural agora:');
        foreach ($numeros['indicadores'] as $k => $v) {
            $this->line(sprintf('     %-26s %s', $k, $v ?? '—'));
        }
        $this->line('     dias sem atraso            '.$numeros['compromisso']['diasSemAtraso']);
        $this->line('     dias ouvindo               '.$numeros['compromisso']['diasOuvindo']);
        $this->line('     elogios em destaque        '.count($numeros['elogios']));

        return self::SUCCESS;
    }

    /**
     * Define status / data de resposta / atualizado_em de forma que os
     * números do mural fiquem bons E plausíveis:
     *  - < 4 dias: quase tudo ainda em aberto (dentro do prazo).
     *  - 4 a 22 dias: resolvido, respondido DENTRO do prazo.
     *  - > 22 dias: 92% resolvido (85% no prazo), resto ainda em análise.
     *
     * @return array{0:string,1:?Carbon,2:Carbon}
     */
    private function cicloDeVida(Carbon $criadoEm, string $urgencia): array
    {
        $idade = $criadoEm->diffInDays(now());
        $prazo = self::PRAZO_DIAS[$urgencia] ?? 15;
        $horasNoPrazo = fn () => random_int(2, 6) + random_int(0, $prazo * 3);

        // Só fica "em aberto" quem ainda está DENTRO do prazo - senão já
        // conta como atraso e derruba a sequência do mural. (Denúncia é
        // Crítica, prazo 1 dia: quase nunca cai aqui.)
        if ($idade < 4 && $idade < $prazo) {
            $status = ['Recebida', 'Recebida', 'Em triagem', 'Em análise'][random_int(0, 3)];

            return [$status, null, $criadoEm->clone()->addHours(random_int(1, 20))];
        }

        if ($idade <= 30) {
            $respostaEm = $criadoEm->clone()->addHours($horasNoPrazo());
            $status = random_int(0, 100) < 88 ? 'Concluída' : 'Respondida';

            return [$status, $respostaEm, $respostaEm->clone()->addHours(random_int(1, 40))];
        }

        $r = random_int(0, 100);
        if ($r < 5) {
            return ['Em análise', null, $criadoEm->clone()->addDays(random_int(3, 12))];
        }

        $noPrazo = $r < 92;
        $horas = $noPrazo
            ? $horasNoPrazo()
            : random_int($prazo * 24 + 12, $prazo * 24 + 96);
        $respostaEm = $criadoEm->clone()->addHours($horas);
        $escolha = $this->sorteioPonderado([['Concluída', 62], ['Arquivada', 26], ['Respondida', 12]]);

        return [$escolha, $respostaEm, $respostaEm->clone()->addHours(random_int(2, 72))];
    }

    /** @param array<array{0:string,1:int}> $opcoes */
    private function sorteioPonderado(array $opcoes): string
    {
        $bolsa = [];
        foreach ($opcoes as [$valor, $peso]) {
            $bolsa = array_merge($bolsa, array_fill(0, $peso, $valor));
        }

        return $bolsa[array_rand($bolsa)];
    }
}
