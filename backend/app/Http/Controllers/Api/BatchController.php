<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BatchResource;
use App\Models\Batch;
use App\Models\FinancialRequest;
use App\Models\User;
use App\Notifications\BatchActivity;
use App\Notifications\BatchCompleted;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class BatchController extends Controller
{
    /**
     * Histórico / listado con filtros: ?status=Completado|Pendiente&q=texto&from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', 'in:Pendiente,Completado'],
            'q' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $batches = Batch::query()
            ->withTotals()
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where(
                'status',
                $status === 'Completado' ? Batch::STATUS_COMPLETED : Batch::STATUS_PENDING,
            ))
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where(
                fn ($w) => $w->where('code', 'like', "%{$term}%")->orWhere('title', 'like', "%{$term}%"),
            ))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('created_at', '<=', $to))
            ->latest('created_at')
            ->latest('id')
            ->get();

        return BatchResource::collection($batches);
    }

    /**
     * Lote activo (pendiente más reciente) con sus solicitudes. data = null si no hay ninguno.
     */
    public function active(): JsonResponse|BatchResource
    {
        $batch = Batch::active();

        if (! $batch) {
            return response()->json(['data' => null]);
        }

        return $this->show($batch);
    }

    public function show(Batch $batch): BatchResource
    {
        $batch->load([
            'uploader',
            ...collect(RequestController::ROW_RELATIONS)->map(fn (string $relation) => "requests.{$relation}")->all(),
        ])->loadTotals();

        return new BatchResource($batch);
    }

    /**
     * Admin: reabre un lote finalizado para corregir decisiones. Se avisa a Secretaría.
     */
    public function reopen(Request $request, Batch $batch): JsonResponse|BatchResource
    {
        if (! $batch->isCompleted()) {
            return response()->json(['message' => "El lote {$batch->code} ya está en revisión."], 422);
        }

        $batch->update(['status' => Batch::STATUS_PENDING, 'completed_at' => null]);

        Notification::send(
            User::where('role', User::ROLE_SECRETARIA)->get(),
            new BatchActivity($batch, "Lote {$batch->code} reabierto", "{$request->user()->name} reabrió el lote para revisar decisiones. Espera el nuevo cierre antes de procesarlo."),
        );

        return $this->show($batch);
    }

    public function finalize(Request $request, Batch $batch): JsonResponse|BatchResource
    {
        if ($batch->isCompleted()) {
            return response()->json(['message' => "El lote {$batch->code} ya fue finalizado."], 422);
        }

        if (! $batch->requests()->exists()) {
            return response()->json(['message' => "El lote {$batch->code} no tiene solicitudes; no se puede finalizar."], 422);
        }

        $waitingInfo = $batch->requests()->where('status', FinancialRequest::STATUS_INFO)->count();

        if ($waitingInfo > 0) {
            return response()->json([
                'message' => "Hay {$waitingInfo} solicitudes esperando más información de Secretaría.",
            ], 422);
        }

        $pending = $batch->requests()->where('status', FinancialRequest::STATUS_PENDING)->pluck('id');

        if ($pending->isNotEmpty()) {
            return response()->json([
                'message' => "Aún hay {$pending->count()} solicitudes sin decisión.",
                'pending_ids' => $pending,
            ], 422);
        }

        DB::transaction(fn () => $batch->update([
            'status' => Batch::STATUS_COMPLETED,
            'completed_at' => now(),
        ]));

        Notification::send(
            User::where('role', User::ROLE_SECRETARIA)->get(),
            new BatchCompleted($batch, $request->user()),
        );

        return $this->show($batch);
    }
}
