<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manifestation_status_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('manifestation_id');
            $table->foreign('manifestation_id')->references('id')->on('manifestations')->cascadeOnDelete();
            $table->string('de_status')->nullable(); // nulo na criação
            $table->string('para_status');
            $table->foreignId('autor_id')->nullable()->constrained('users')->nullOnDelete(); // nulo = sistema
            $table->text('motivo')->nullable();
            $table->timestamp('criado_em')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manifestation_status_history');
    }
};
