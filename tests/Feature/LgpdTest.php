<?php

namespace Tests\Feature;

use App\Models\Manifestation;
use App\Models\Person;
use App\Services\ProtocoloService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Fase 8 (LGPD) - retenção automática (ouvidoria:expurgar-lgpd) e eliminação a pedido do cidadão. */
class LgpdTest extends TestCase
{
    use RefreshDatabase;

    private function criarManifestacao(array $atributos = []): Manifestation
    {
        return Manifestation::create([
            'client_id' => (string) Str::uuid(),
            'protocolo' => app(ProtocoloService::class)->gerarProtocolo(),
            'canal' => 'Totem',
            'transcricao' => 'Relato pessoal detalhado do cidadão.',
            'resumo' => 'Resumo pessoal.',
            'keywords' => ['nome-proprio', 'endereco'],
            'urgencia' => 'Média',
            'status' => 'Concluída',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
            ...$atributos,
        ]);
    }

    public function test_expurgo_anonimiza_manifestacao_alem_do_prazo_de_retencao(): void
    {
        config(['ouvidoria.retencao_dias' => 30]);
        Storage::fake('local');
        Storage::disk('local')->put('audio/velho.webm', 'conteudo-fake');

        $pessoa = Person::create(['nome' => 'Fulano de Tal', 'cpf' => '11144477735']);
        $antiga = $this->criarManifestacao([
            'criado_em' => now()->subDays(60),
            'audio_object_key' => 'audio/velho.webm',
            'requerente_type' => $pessoa->getMorphClass(),
            'requerente_id' => $pessoa->id,
        ]);

        Artisan::call('ouvidoria:expurgar-lgpd');

        $antiga->refresh();
        $this->assertNull($antiga->transcricao);
        $this->assertNull($antiga->resumo);
        $this->assertNull($antiga->keywords);
        $this->assertNull($antiga->requerente_type);
        $this->assertNull($antiga->audio_object_key);
        $this->assertNotNull($antiga->anonimizado_em);
        Storage::disk('local')->assertMissing('audio/velho.webm');
        // protocolo/status/urgência continuam - dado estatístico, não pessoal.
        $this->assertNotNull($antiga->protocolo);
        $this->assertSame('Concluída', $antiga->status->value);
    }

    public function test_expurgo_nao_toca_manifestacao_dentro_do_prazo(): void
    {
        config(['ouvidoria.retencao_dias' => 730]);
        $recente = $this->criarManifestacao(['criado_em' => now()->subDays(10)]);

        Artisan::call('ouvidoria:expurgar-lgpd');

        $recente->refresh();
        $this->assertNotNull($recente->transcricao);
        $this->assertNull($recente->anonimizado_em);
    }

    public function test_expurgo_e_idempotente(): void
    {
        config(['ouvidoria.retencao_dias' => 1]);
        $antiga = $this->criarManifestacao(['criado_em' => now()->subDays(5)]);

        Artisan::call('ouvidoria:expurgar-lgpd');
        $primeiraAnonimizacao = $antiga->refresh()->anonimizado_em;

        // Rodar de novo não falha nem reprocessa (whereNull('anonimizado_em') já exclui).
        Artisan::call('ouvidoria:expurgar-lgpd');
        $this->assertTrue($antiga->refresh()->anonimizado_em->equalTo($primeiraAnonimizacao));
    }

    public function test_cidadao_elimina_os_proprios_dados_com_pin_correto(): void
    {
        $servico = app(ProtocoloService::class);
        $pin = '7890';
        $manifestacao = $this->criarManifestacao(['pin_acompanhamento' => $servico->hashPin($pin)]);

        $resposta = $this->deleteJson("/api/v1/public/manifestations/{$manifestacao->protocolo}?pin={$pin}");

        $resposta->assertOk()->assertJson(['ok' => true]);
        $this->assertNotNull($manifestacao->refresh()->anonimizado_em);
        $this->assertNull($manifestacao->transcricao);
    }

    public function test_eliminar_com_pin_errado_da_erro_generico(): void
    {
        $servico = app(ProtocoloService::class);
        $manifestacao = $this->criarManifestacao(['pin_acompanhamento' => $servico->hashPin('1234')]);

        $this->deleteJson("/api/v1/public/manifestations/{$manifestacao->protocolo}?pin=0000")
            ->assertNotFound()
            ->assertJson(['error' => ['code' => 'NOT_FOUND']]);
        $this->assertNull($manifestacao->refresh()->anonimizado_em);
    }
}
