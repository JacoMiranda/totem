<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Sanity check das duas telas React (kiosk/admin) servidas pelo mesmo projeto Laravel via @vite. */
class RotasBaseTest extends TestCase
{
    public function test_raiz_redireciona_para_o_kiosk(): void
    {
        $this->get('/')->assertRedirect('/atendimento');
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
