<?php

namespace Tests\Feature;

use App\Models\Device;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Cadastro de pessoa/empresa (device key) - findOrCreate por CPF/CNPJ, nunca duplica nem sobrescreve. */
class RequerenteApiTest extends TestCase
{
    use RefreshDatabase;

    private function criarDevice(): string
    {
        $chaveCrua = 'chave-de-teste-'.Str::random(20);
        Device::create([
            'codigo' => 'TOTEM-REQ-01',
            'nome' => 'Totem Requerente',
            'api_key_hash' => hash('sha256', $chaveCrua),
            'ativo' => true,
        ]);

        return $chaveCrua;
    }

    public function test_cria_pessoa_com_cpf_valido(): void
    {
        $chave = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/people', ['nome' => 'Maria Silva', 'cpf' => '111.444.777-35'], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJson(['type' => 'person', 'nome' => 'Maria Silva']);
        $this->assertDatabaseHas('people', ['cpf' => '11144477735']);
    }

    public function test_cpf_invalido_e_rejeitado(): void
    {
        $chave = $this->criarDevice();

        $this->postJson('/api/v1/people', ['nome' => 'Fulano', 'cpf' => '111.111.111-11'], ['X-Device-Key' => $chave])
            ->assertUnprocessable();
    }

    /** Reenviar o mesmo CPF nunca cria um segundo registro nem sobrescreve o nome já cadastrado. */
    public function test_mesmo_cpf_reenviado_nao_duplica(): void
    {
        $chave = $this->criarDevice();

        $this->postJson('/api/v1/people', ['nome' => 'Maria Silva', 'cpf' => '111.444.777-35'], ['X-Device-Key' => $chave])->assertOk();
        $segunda = $this->postJson('/api/v1/people', ['nome' => 'Nome Diferente Digitado Errado', 'cpf' => '111.444.777-35'], ['X-Device-Key' => $chave]);

        $segunda->assertOk();
        $segunda->assertJson(['nome' => 'Maria Silva']); // devolve o registro já existente, não o nome novo
        $this->assertSame(1, \App\Models\Person::where('cpf', '11144477735')->count());
    }

    public function test_cria_empresa_com_cnpj_valido(): void
    {
        $chave = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/companies', ['razaoSocial' => 'Empresa Teste LTDA', 'cnpj' => '11.222.333/0001-81'], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJson(['type' => 'company', 'razaoSocial' => 'Empresa Teste LTDA']);
        $this->assertDatabaseHas('companies', ['cnpj' => '11222333000181']);
    }

    public function test_cnpj_invalido_e_rejeitado(): void
    {
        $chave = $this->criarDevice();

        $this->postJson('/api/v1/companies', ['razaoSocial' => 'Empresa X', 'cnpj' => '11.111.111/1111-11'], ['X-Device-Key' => $chave])
            ->assertUnprocessable();
    }

    public function test_sem_device_key_e_rejeitado(): void
    {
        $this->postJson('/api/v1/people', ['nome' => 'Maria Silva', 'cpf' => '111.444.777-35'])->assertUnauthorized();
    }
}
