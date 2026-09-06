<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Sanity check das duas telas React (kiosk/admin) servidas pelo mesmo projeto Laravel via @vite. */
class RotasBaseTest extends TestCase
{
    /**
     * A raiz passou a ser a HOME de marketing (Fase 10). O totem físico não
     * é afetado: ele abre direto em /atendimento, em modo quiosque.
     */
    public function test_raiz_serve_a_home_de_marketing(): void
    {
        $this->get('/')->assertOk()->assertSee('Ouvidoria Cidadã', false);
    }

    public function test_kiosk_carrega(): void
    {
        $this->get('/atendimento')->assertOk()->assertSee('root', false);
    }

    public function test_admin_carrega(): void
    {
        $this->get('/admin')->assertOk()->assertSee('root', false);
    }
}
