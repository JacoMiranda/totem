<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** Usada em transação (lockForUpdate) por ProtocoloService pra gerar OUV-AAAAMM-NNNNNN. */
#[Fillable(['ano_mes', 'ultimo'])]
class ProtocolSequence extends Model
{
    protected $table = 'protocol_sequences';

    protected $primaryKey = 'ano_mes';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;
}
