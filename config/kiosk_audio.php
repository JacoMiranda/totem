<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Locução pré-gravada do totem
    |--------------------------------------------------------------------------
    |
    | As frases FIXAS da jornada (boas-vindas, instruções, conclusão) não
    | mudam entre atendimentos - não faz sentido bater na API Gemini toda
    | vez. O comando `ouvidoria:gerar-audios-kiosk` gera um WAV por entrada
    | aqui (uma única vez, voz `voz` abaixo) em `public/audio/kiosk/` +
    | um `manifest.json`; o kiosk toca o arquivo estático (instantâneo,
    | offline, custo zero) e só cai em POST /ai/tts / síntese do navegador
    | se o arquivo faltar. Texto do cidadão (ex.: ler o resumo do relato
    | dele) continua dinâmico via /ai/tts.
    |
    */

    'voz' => env('KIOSK_TTS_VOZ', 'Aoede'),

    'saida' => public_path('audio/kiosk'),

    // id => texto. O id vira o nome do arquivo (`{id}.wav`) e a chave no
    // manifest.json consumido por resources/js/kiosk/lib/vozKiosk.ts.
    'frases' => [
        'boas-vindas' => 'Olá! Seja bem-vindo à Ouvidoria Cidadã. Toque na tela para começar o seu relato.',
        // Texto do consentimento LGPD lido em voz alta - tem que bater com o
        // que está escrito na tela (Inicio.tsx). Consentimento informado só
        // vale se a pessoa tiver acesso real ao conteúdo; quem não lê bem
        // depende deste áudio.
        'inicio-consentimento' => 'Concordo que meu relato seja registrado para fins de melhoria do atendimento público, conforme a Lei Geral de Proteção de Dados. Meus dados de identificação são opcionais e só ficam vinculados se eu optar por me identificar. Você concorda? Toque em Sim, concordo, ou em Não concordo.',
        'consentimento-recusado' => 'Sem a sua concordância não podemos registrar o relato. Obrigado pela sua visita. Se mudar de ideia, é só tocar na tela novamente.',
        'relato-instrucao' => 'Toque no microfone e conte o que aconteceu. Se preferir, pode escrever no campo abaixo.',
        'relato-gravando' => 'Pode falar. Toque novamente no microfone quando terminar.',
        'relato-processando' => 'Um momento, estou a processar o seu relato.',
        'relato-sem-microfone' => 'Não consegui usar o microfone. Escreva o seu relato no campo abaixo, por favor.',
        'classificacao-instrucao' => 'Confira a classificação do seu relato e ajuste se for necessário. Depois, toque em confirmar e enviar.',
        'conclusao-online' => 'O seu relato foi registrado com sucesso. Guarde o número de protocolo e o código de acompanhamento. Obrigado pela sua participação.',
        'conclusao-offline' => 'O seu relato foi guardado neste totem e será enviado assim que a conexão voltar. Anote a data e a hora do seu atendimento. Obrigado.',
    ],

    // Conclusão que menciona categoria + sentimento: em vez de uma chamada
    // dinâmica ao TTS, pré-geramos as 25 combinações possíveis (5 categorias
    // x 5 sentimentos - ver App\Enums\Category / App\Enums\Sentiment). O id
    // é `conclusao-{catSlug}-{sentSlug}` (slugs abaixo, sem acento). Se a
    // combinação faltar, o kiosk usa `conclusao-online`.
    'conclusao_combos' => [
        'template' => 'Identificámos o seu relato como :categoria, com sentimento :sentimento. O registro foi concluído com sucesso. Obrigado pela sua participação.',
        'categorias' => [
            'elogio' => 'Elogio',
            'sugestao' => 'Sugestão',
            'duvida' => 'Dúvida',
            'reclamacao' => 'Reclamação',
            'denuncia' => 'Denúncia',
        ],
        'sentimentos' => [
            'excelente' => 'Excelente',
            'satisfeito' => 'Satisfeito',
            'neutro' => 'Neutro',
            'preocupado' => 'Preocupado',
            'insatisfeito' => 'Insatisfeito',
        ],
    ],

];
