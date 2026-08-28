<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** Materialização pra dashboards rápidos (Fase 5) - nunca apagada, mesmo após retenção/anonimização. */
#[Fillable(['dia', 'unidade', 'categoria', 'sentimento', 'urgencia', 'status', 'total'])]
class ReportDaily extends Model
{
    use HasUuids;

    protected $table = 'report_daily';

    public $timestamps = false;

    protected function casts(): array
    {
        return ['dia' => 'date'];
    }
}
