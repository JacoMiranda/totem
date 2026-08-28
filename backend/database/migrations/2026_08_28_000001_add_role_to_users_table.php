<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('atendente')->after('email');
            $table->string('unidade')->nullable()->after('role');
            $table->boolean('ativo')->default(true)->after('unidade');
            $table->timestamp('ultimo_login_em')->nullable()->after('ativo');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'unidade', 'ativo', 'ultimo_login_em']);
        });
    }
};
