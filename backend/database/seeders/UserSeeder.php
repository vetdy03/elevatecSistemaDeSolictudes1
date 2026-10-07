<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Usuarios iniciales. Seguro de repetir: firstOrCreate solo crea los que faltan y
     * NO cambia la contraseña ni los datos de usuarios que ya existen.
     * La contraseña inicial sale de SEED_USER_PASSWORD (.env); nunca la escribas aquí.
     */
    public function run(): void
    {
        $password = env('SEED_USER_PASSWORD', 'FinControl2026!');

        $users = [
            ['name' => 'Grover Jaldin', 'email' => 'groverj@jalmeco.com', 'role' => User::ROLE_ADMIN],
            ['name' => 'Jhenny Gracia', 'email' => 'jhennyg@jalmeco.com', 'role' => User::ROLE_SECRETARIA],
            ['name' => 'Colaborador 1', 'email' => 'colaborador1@jalmeco.com', 'role' => User::ROLE_COLABORADOR],
        ];

        foreach ($users as $user) {
            User::firstOrCreate(['email' => $user['email']], $user + ['password' => $password]);
        }
    }
}
