<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Rota autenticada da API, batida SEM `Accept: application/json` (como o
 * navegador faz ao abrir a URL na barra de endereço), tem que devolver
 * 401 JSON - não 500 por tentar redirecionar pra rota `login` inexistente.
 */
class ApiRespondeJsonTest extends TestCase
{
    use RefreshDatabase;

    public function test_rota_protegida_sem_accept_json_devolve_401(): void
    {
        $r = $this->get('/api/v1/logs'); // sem nenhum header

        $r->assertStatus(401);
        $r->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_rota_protegida_com_accept_json_tambem_401(): void
    {
        $this->getJson('/api/v1/manifestations')->assertStatus(401);
    }
}
