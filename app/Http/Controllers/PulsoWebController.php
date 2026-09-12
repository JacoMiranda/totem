<?php

namespace App\Http\Controllers;

use App\Models\PulsoPonto;
use App\Services\PulsoService;
use Illuminate\Http\RedirectResponse;

/**
 * Ponto de entrada do QR impresso: `/pulso/{token}` NUNCA muda (é o que
 * está no papel), mas cada visita mint uma sessão nova com hash próprio e
 * redireciona pra ela - ver PulsoService. Fora da API porque devolve um
 * redirect, não JSON.
 */
class PulsoWebController extends Controller
{
    public function iniciar(string $token, PulsoService $pulso): RedirectResponse
    {
        $ponto = PulsoPonto::where('token', $token)->where('ativo', true)->first();

        abort_unless($ponto, 404);

        $sessao = $pulso->iniciarSessao($ponto);

        return redirect("/pulso/s/{$sessao->hash}");
    }
}
