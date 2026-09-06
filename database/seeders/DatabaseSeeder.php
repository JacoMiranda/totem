<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\App;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // Admin + totem de conveniência pra desenvolvimento local.
        if (App::environment('local')) {
            $this->call(DevSeeder::class);
        }
    }
}
