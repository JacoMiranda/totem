<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Retenção de dados (LGPD)
    |--------------------------------------------------------------------------
    |
    | docs/PLANO-SISTEMA-PROFISSIONAL.md (Fase 8): "política de retenção
    | (job que expurga/anonimiza áudio e PII após N dias)". Passado esse
    | prazo desde `criado_em`, o comando `ouvidoria:expurgar-lgpd` apaga o
    | áudio do disco e remove transcrição/vínculo com requerente - mantém
    | só o que é necessário pra estatística agregada (protocolo, status,
    | classificação, datas), nunca o conteúdo pessoal bruto.
    |
    */
    'retencao_dias' => env('OUVIDORIA_RETENCAO_DIAS', 730),

];
