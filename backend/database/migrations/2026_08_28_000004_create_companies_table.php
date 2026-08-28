<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Cadastro de pessoa jurídica - mesmo motivo de people (ver comentário lá). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('razao_social');
            $table->string('nome_fantasia')->nullable();
            $table->string('cnpj', 18)->nullable()->unique();
            $table->string('email')->nullable();
            $table->string('telefone')->nullable();
            $table->string('responsavel_nome')->nullable(); // pessoa de contato na empresa
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
