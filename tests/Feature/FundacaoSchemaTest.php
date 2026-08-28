<?php

namespace Tests\Feature;

use App\Enums\Category;
use App\Enums\Sentiment;
use App\Enums\Urgency;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\ManifestationNote;
use App\Models\ManifestationStatusHistory;
use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sanity check da Fase 0: as migrations rodam limpo (inclusive contra o
 * sqlite em memória do phpunit.xml, diferente do MySQL usado em dev/
 * produção) e os relacionamentos básicos funcionam - manifestação
 * anônima, com pessoa e com empresa (requerente polimórfico).
 */
class FundacaoSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_manifestacao_anonima_sem_requerente(): void
    {
        $manifestacao = Manifestation::create([
            'client_id' => (string) \Illuminate\Support\Str::uuid(),
            'protocolo' => 'OUV-202608-000001',
            'canal' => 'Totem',
            'transcricao' => 'Reclamação de teste',
            'sentimento' => Sentiment::Insatisfeito,
            'categoria' => Category::Reclamacao,
            'urgencia' => Urgency::Alta,
            'consentimento_lgpd' => true,
            'criado_em' => now(),
        ]);

        $this->assertNull($manifestacao->requerente);
        $this->assertSame(Sentiment::Insatisfeito, $manifestacao->sentimento);
        $this->assertSame('Reclamação de teste', $manifestacao->transcricao);
    }

    public function test_manifestacao_com_pessoa_identificada(): void
    {
        $pessoa = Person::create(['nome' => 'Fulano de Tal', 'cpf' => '123.456.789-00']);

        $manifestacao = Manifestation::create([
            'client_id' => (string) \Illuminate\Support\Str::uuid(),
            'canal' => 'Totem',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
            'requerente_type' => $pessoa->getMorphClass(),
            'requerente_id' => $pessoa->id,
        ]);

        $this->assertTrue($manifestacao->requerente->is($pessoa));
        $this->assertTrue($pessoa->manifestations->contains($manifestacao));
    }

    public function test_manifestacao_com_empresa_identificada(): void
    {
        $empresa = Company::create(['razao_social' => 'Empresa Teste LTDA', 'cnpj' => '00.000.000/0001-00']);

        $manifestacao = Manifestation::create([
            'client_id' => (string) \Illuminate\Support\Str::uuid(),
            'canal' => 'Web',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
            'requerente_type' => $empresa->getMorphClass(),
            'requerente_id' => $empresa->id,
        ]);

        $this->assertTrue($manifestacao->requerente->is($empresa));
    }

    public function test_historico_de_status_e_nota_interna(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $manifestacao = Manifestation::create([
            'client_id' => (string) \Illuminate\Support\Str::uuid(),
            'canal' => 'Totem',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
        ]);

        ManifestationStatusHistory::create([
            'manifestation_id' => $manifestacao->id,
            'de_status' => null,
            'para_status' => 'Recebida',
            'autor_id' => null,
        ]);
        ManifestationNote::create([
            'manifestation_id' => $manifestacao->id,
            'autor_id' => $admin->id,
            'texto' => 'Nota interna de teste',
        ]);

        $this->assertCount(1, $manifestacao->statusHistory);
        $this->assertCount(1, $manifestacao->notes);
    }

    public function test_hierarquia_de_papel_rbac(): void
    {
        $admin = User::factory()->make(['role' => UserRole::Admin]);
        $leitor = User::factory()->make(['role' => UserRole::Leitor]);

        $this->assertTrue($admin->temPapelMinimo(UserRole::Analista));
        $this->assertFalse($leitor->temPapelMinimo(UserRole::Analista));
        $this->assertTrue($leitor->temPapelMinimo(UserRole::Leitor));
    }

    public function test_device_existe_e_esconde_api_key_hash(): void
    {
        $device = Device::create([
            'codigo' => 'TOTEM-CENTRO-01',
            'nome' => 'Totem Centro',
            'api_key_hash' => hash('sha256', 'chave-de-teste'),
        ]);

        $this->assertArrayNotHasKey('api_key_hash', $device->toArray());
    }
}
