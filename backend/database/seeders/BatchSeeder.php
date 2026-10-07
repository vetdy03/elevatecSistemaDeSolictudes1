<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\FinancialRequest;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Datos iniciales tomados de frontend/src/data/requests.ts:
 *  - initialRequests → lote activo N° 08-SEP-26
 *  - batchHistory    → lotes históricos. El frontend solo tenía el total y la cantidad de filas,
 *                      así que se generan filas sintéticas (deterministas) que suman exactamente eso.
 */
class BatchSeeder extends Seeder
{
    private const ACTIVE_REQUESTS = [
        ['2026-09-29', 'Renovación de licencia anual del sistema de nómina', 18400, 'Bs', 'TR-58214', 'Carla Mendoza', 'Alta', 'La Paz', 'OTROS GASTOS DE LA EMPRESA'],
        ['2026-09-29', 'Servicio de internet corporativo — septiembre', 6290, 'Bs', 'TR-58218', 'Javier Rojas', 'Media', 'Santa Cruz', 'OTROS GASTOS DE LA EMPRESA'],
        ['2026-09-28', 'Anticipo de viáticos para visita técnica a planta', 9450, 'Bs', 'TR-58192', 'María Soria', 'Alta', 'Cochabamba', 'GASTOS DEL PERSONAL'],
        ['2026-09-28', 'Reembolso de movilidad para reuniones comerciales', 2180, 'Bs', 'TR-58186', 'Diego Arce', 'Baja', 'La Paz', 'GASTOS DEL PERSONAL'],
        ['2026-09-27', 'Pago de aranceles para repuestos de línea de envasado', 32700, 'Bs', 'TR-58164', 'Sofía Vargas', 'Alta', 'Santa Cruz', 'IMPORTACIÓN'],
        ['2026-09-27', 'Compra de insumos de seguridad industrial', 12650, 'Bs', 'TR-58161', 'Luis Paredes', 'Media', 'Cochabamba', 'PRODUCCIÓN'],
        ['2026-09-26', 'Mantenimiento preventivo de compresor principal', 19800, 'Bs', 'TR-58148', 'Andrea Ruiz', 'Media', 'Santa Cruz', 'PRODUCCIÓN'],
    ];

    /** [código, fecha, título, total, estado, filas] */
    private const HISTORY = [
        ['N° 04-JUL-26', '2026-07-30', 'Solicitudes de recursos — julio', 211200, Batch::STATUS_PENDING, 27],
        ['N° 05-AGO-26', '2026-08-15', 'Gastos de producción — agosto', 96800, Batch::STATUS_COMPLETED, 16],
        ['N° 06-AGO-26', '2026-08-29', 'Solicitudes operativas — agosto', 142850, Batch::STATUS_COMPLETED, 19],
        ['N° 07-SEP-26', '2026-09-15', 'Solicitudes de recursos — primera quincena', 186400, Batch::STATUS_COMPLETED, 23],
    ];

    private const CATALOG = [
        'OTROS GASTOS DE LA EMPRESA' => ['Servicio de limpieza de oficinas', 'Renovación de dominio y hosting', 'Pago de servicio de telefonía móvil', 'Suscripción de software contable', 'Material de escritorio'],
        'GASTOS DEL PERSONAL' => ['Viáticos para capacitación regional', 'Reembolso de pasajes aéreos', 'Refrigerios para taller interno', 'Anticipo de viáticos para auditoría'],
        'IMPORTACIÓN' => ['Despacho aduanero de repuestos', 'Flete internacional de insumos', 'Pago de aranceles de maquinaria'],
        'PRODUCCIÓN' => ['Compra de materia prima', 'Mantenimiento de línea de envasado', 'Calibración de balanzas industriales', 'Repuestos para caldero'],
    ];

    private const REQUESTERS = ['Carla Mendoza', 'Javier Rojas', 'María Soria', 'Diego Arce', 'Sofía Vargas', 'Luis Paredes', 'Andrea Ruiz'];
    private const REGIONS = ['La Paz', 'Santa Cruz', 'Cochabamba'];

    public function run(): void
    {
        // Seguro de repetir: si ya hay lotes (datos reales), no toca nada.
        if (Batch::exists()) {
            $this->command?->warn('BatchSeeder omitido: ya existen lotes en la base de datos.');

            return;
        }

        mt_srand(2026);

        $admin = User::where('role', User::ROLE_ADMIN)->first();
        $secretary = User::where('role', User::ROLE_SECRETARIA)->first();

        foreach (self::HISTORY as $i => [$code, $date, $title, $total, $status, $items]) {
            $createdAt = Carbon::parse("{$date} 09:00");
            $batch = Batch::updateOrCreate(['code' => $code], [
                'title' => mb_strtoupper($title),
                'uploaded_by' => $secretary?->id,
                'status' => $status,
                'completed_at' => $status === Batch::STATUS_COMPLETED ? $createdAt->copy()->addDays(2)->setTime(17, 30) : null,
            ]);
            $batch->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

            $batch->requests()->delete();
            $this->seedSyntheticRows($batch, $createdAt, $total, $items, $status, $admin, 50000 + $i * 1000);
        }

        $activeDate = Carbon::parse('2026-09-29 10:32');
        $active = Batch::updateOrCreate(['code' => 'N° 08-SEP-26'], [
            'title' => 'SOLICITUDES DE RECURSOS — AL 29 DE SEPTIEMBRE 2026',
            'uploaded_by' => $secretary?->id,
            'status' => Batch::STATUS_PENDING,
            'completed_at' => null,
        ]);
        $active->forceFill(['created_at' => $activeDate, 'updated_at' => $activeDate])->save();

        $active->requests()->delete();
        foreach (self::ACTIVE_REQUESTS as $n => [$date, $detail, $amount, $currency, $procedure, $requester, $priority, $region, $category]) {
            $active->requests()->create([
                'item_number' => $n + 1,
                'request_date' => $date,
                'detail' => $detail,
                'amount' => $amount,
                'currency' => $currency,
                'procedure' => $procedure,
                'requester' => $requester,
                'priority' => $priority,
                'region' => $region,
                'category' => $category,
                'status' => FinancialRequest::STATUS_PENDING,
            ]);
        }
    }

    private function seedSyntheticRows(Batch $batch, Carbon $date, int $total, int $items, string $batchStatus, ?User $admin, int $procedureBase): void
    {
        // Reparte el total en montos enteros que suman exactamente $total.
        $weights = array_map(fn () => mt_rand(20, 100), range(1, $items));
        $sum = array_sum($weights);
        $amounts = array_map(fn ($w) => (int) floor($total * $w / $sum / 10) * 10, $weights);
        $amounts[$items - 1] += $total - array_sum($amounts);

        $categories = array_keys(self::CATALOG);

        foreach ($amounts as $n => $amount) {
            $category = $categories[$n % count($categories)];
            $details = self::CATALOG[$category];

            $status = match (true) {
                $batchStatus === Batch::STATUS_PENDING && $n % 3 !== 0 => FinancialRequest::STATUS_PENDING,
                mt_rand(1, 100) <= 80 => FinancialRequest::STATUS_APPROVED,
                default => FinancialRequest::STATUS_REJECTED,
            };
            $decided = $status !== FinancialRequest::STATUS_PENDING;

            $batch->requests()->create([
                'item_number' => $n + 1,
                'request_date' => $date->copy()->subDays(mt_rand(0, 4))->toDateString(),
                'detail' => $details[mt_rand(0, count($details) - 1)],
                'amount' => $amount,
                'currency' => 'Bs',
                'procedure' => 'TR-'.($procedureBase + $n * 7),
                'requester' => self::REQUESTERS[mt_rand(0, count(self::REQUESTERS) - 1)],
                'priority' => ['Alta', 'Media', 'Baja'][mt_rand(0, 2)],
                'region' => self::REGIONS[mt_rand(0, count(self::REGIONS) - 1)],
                'category' => $category,
                'status' => $status,
                'reviewed_by' => $decided ? $admin?->id : null,
                'reviewed_at' => $decided ? $date->copy()->addDays(1)->setTime(11, 0) : null,
            ]);
        }
    }
}
