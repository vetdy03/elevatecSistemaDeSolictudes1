<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FinancialRequestResource;
use App\Models\Batch;
use App\Models\FinancialRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RequestController extends Controller
{
    /**
     * Admin: cambia la decisión de una fila (Aprobado / Rechazado, o Pendiente para deshacer).
     */
    public function updateStatus(Request $request, FinancialRequest $financialRequest): JsonResponse|FinancialRequestResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(FinancialRequest::STATUSES)],
        ]);

        if ($financialRequest->batch->isCompleted()) {
            return response()->json(['message' => 'El lote ya fue finalizado y no admite cambios.'], 422);
        }

        $isPending = $data['status'] === FinancialRequest::STATUS_PENDING;

        $financialRequest->update([
            'status' => $data['status'],
            'reviewed_by' => $isPending ? null : $request->user()->id,
            'reviewed_at' => $isPending ? null : now(),
        ]);

        return new FinancialRequestResource($financialRequest->load('reviewer'));
    }

    /**
     * Secretaría: agrega una fila manual a un lote pendiente.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id' => ['required', 'integer', 'exists:batches,id'],
            'date' => ['nullable', 'date'],
            'detail' => ['required', 'string', 'max:500'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999999'],
            'currency' => ['nullable', Rule::in(FinancialRequest::CURRENCIES)],
            'procedure' => ['required', 'string', 'max:50'],
            'requester' => ['required', 'string', 'max:120'],
            'priority' => ['required', Rule::in(FinancialRequest::PRIORITIES)],
            'region' => ['required', 'string', 'max:80'],
            'category' => ['required', 'string', 'max:120'],
        ], [
            'batch_id.required' => 'Selecciona el lote al que pertenece la fila.',
            'batch_id.exists' => 'El lote seleccionado no existe.',
            'detail.required' => 'Ingresa el detalle de la solicitud.',
            'amount.required' => 'Ingresa el importe.',
            'amount.numeric' => 'El importe debe ser un número.',
            'amount.min' => 'El importe debe ser mayor a cero.',
            'procedure.required' => 'Ingresa el N° de trámite.',
            'requester.required' => 'Indica quién solicita.',
            'priority.required' => 'Selecciona la prioridad.',
            'region.required' => 'Selecciona la regional.',
            'category.required' => 'Selecciona la categoría.',
        ]);

        $batch = Batch::findOrFail($data['batch_id']);

        if ($batch->isCompleted()) {
            return response()->json(['message' => "El lote {$batch->code} ya fue finalizado."], 422);
        }

        $row = DB::transaction(fn () => $batch->requests()->create([
            'item_number' => $batch->nextItemNumber(),
            'request_date' => $data['date'] ?? now()->toDateString(),
            'detail' => $data['detail'],
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'Bs',
            'procedure' => $data['procedure'],
            'requester' => $data['requester'],
            'priority' => $data['priority'],
            'region' => $data['region'],
            'category' => mb_strtoupper($data['category']),
            'status' => FinancialRequest::STATUS_PENDING,
        ]));

        $batch->touch();

        return (new FinancialRequestResource($row))->response()->setStatusCode(201);
    }

    /**
     * Valores ya usados, para autocompletar el formulario manual.
     */
    public function options(): JsonResponse
    {
        return response()->json([
            'categories' => FinancialRequest::query()->distinct()->orderBy('category')->pluck('category'),
            'regions' => FinancialRequest::query()->distinct()->orderBy('region')->pluck('region'),
            'priorities' => FinancialRequest::PRIORITIES,
            'currencies' => FinancialRequest::CURRENCIES,
        ]);
    }
}
