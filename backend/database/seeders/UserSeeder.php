<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_USER_PASSWORD', 'FinControl2026!');

        $users = [
            ['name' => 'Alejandro Montaño', 'email' => 'admin@fincontrol.local', 'role' => User::ROLE_ADMIN],
            ['name' => 'Patricia Quispe', 'email' => 'secretaria@fincontrol.local', 'role' => User::ROLE_SECRETARIA],
            ['name' => 'Marco Gutiérrez', 'email' => 'colaborador@fincontrol.local', 'role' => User::ROLE_COLABORADOR],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(['email' => $user['email']], $user + ['password' => $password]);
        }
    }
}
