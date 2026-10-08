<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FinancialRequestResource;
use App\Models\Batch;
use App\Models\FinancialRequest;
use App\Models\RequestEvent;
use App\Models\User;
use App\Notifications\BatchActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RequestController extends Controller
{
    /** Relaciones que necesita el frontend para mostrar una fila completa. */
    public const ROW_RELATIONS = ['reviewer', 'conversation.user', 'retryOf.batch:id,code'];

    private const MIN_TEXT = 5;

    /**
     * Admin: decide una fila. Aprobado / Rechazado (con motivo obligatorio) o Pendiente para deshacer.
     * Mientras el lote está en revisión se puede cambiar libremente; cada cambio queda en el historial.
     */
    public function updateStatus(Request $request, FinancialRequest $financialRequest): JsonResponse|FinancialRequestResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(FinancialRequest::DECISIONS)],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($response = $this->ensureBatchOpen($financialRequest)) {
            return $response;
        }

        $reason = trim((string) ($data['reason'] ?? ''));
        $rejecting = $data['status'] === FinancialRequest::STATUS_REJECTED;

        if ($rejecting && mb_strlen($reason) < self::MIN_TEXT) {
            throw ValidationException::withMessages(['reason' => 'Escribe el motivo del rechazo (mínimo '.self::MIN_TEXT.' caracteres).']);
        }

        $isPending = $data['status'] === FinancialRequest::STATUS_PENDING;

        DB::transaction(function () use ($financialRequest, $data, $request, $rejecting, $reason, $isPending) {
            $financialRequest->fill([
                'rejection_reason' => $rejecting ? $reason : null,
                'reviewed_by' => $isPending ? null : $request->user()->id,
                'reviewed_at' => $isPending ? null : now(),
            ]);
            $financialRequest->transition($data['status'], $request->user(), $rejecting ? $reason : null);
        });

        return new FinancialRequestResource($financialRequest->load(self::ROW_RELATIONS));
    }

    /**
     * Admin: pide más información sobre una fila. Pasa a "Más info" y se avisa a Secretaría.
     */
    public function requestInfo(Request $request, FinancialRequest $financialRequest): JsonResponse|FinancialRequestResource
    {
        $data = $request->validate(['question' => ['required', 'string', 'max:2000']], [
            'question.required' => 'Escribe qué información necesitas.',
        ]);
        $question = trim($data['question']);

        if (mb_strlen($question) < self::MIN_TEXT) {
            throw ValidationException::withMessages(['question' => 'Escribe qué información necesitas (mínimo '.self::MIN_TEXT.' caracteres).']);
        }

        if ($response = $this->ensureBatchOpen($financialRequest)) {
            return $response;
        }

        DB::transaction(function () use ($financialRequest, $request, $question) {
            $financialRequest->fill(['rejection_reason' => null, 'reviewed_by' => null, 'reviewed_at' => null, 'info_answered_at' => null]);
            $financialRequest->transition(FinancialRequest::STATUS_INFO, $request->user(), $question, RequestEvent::INFO_REQUESTED);
        });

        $batch = $financialRequest->batch;
        Notification::send(
            User::where('role', User::ROLE_SECRETARIA)->get(),
            new BatchActivity($batch, "Se pidió más información · {$batch->code}", sprintf(
                '%s pregunta sobre %s (%s): “%s”',
                $request->user()->name,
                $financialRequest->procedure,
                Str::limit($financialRequest->detail, 60),
                Str::limit($question, 140),
            )),
        );

        return new FinancialRequestResource($financialRequest->load(self::ROW_RELATIONS));
    }

    /**
     * Secretaría: responde un pedido de "Más info" (texto + adjunto opcional).
     * La fila vuelve a Pendiente marcada como "Respondida" y se avisa al Admin.
     */
    public function answerInfo(Request $request, FinancialRequest $financialRequest): JsonResponse|FinancialRequestResource
    {
        $data = $request->validate([
            'answer' => ['required', 'string', 'max:2000'],
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png'],
        ], [
            'answer.required' => 'Escribe tu respuesta.',
            'attachment.max' => 'El adjunto supera el máximo de 10 MB.',
            'attachment.mimes' => 'El adjunto debe ser PDF, JPG o PNG.',
        ]);

        if ($financialRequest->status !== FinancialRequest::STATUS_INFO) {
            return response()->json(['message' => 'Esta solicitud ya no espera información.'], 422);
        }

        if ($response = $this->ensureBatchOpen($financialRequest)) {
            return $response;
        }

        $file = $request->file('attachment');
        $path = $file?->store("attachments/batch-{$financialRequest->batch_id}", 'local');

        DB::transaction(function () use ($financialRequest, $request, $data, $file, $path) {
            $financialRequest->fill(['info_answered_at' => now()]);
            $event = $financialRequest->transition(FinancialRequest::STATUS_PENDING, $request->user(), trim($data['answer']), RequestEvent::INFO_ANSWERED);
            $event->update(['attachment_path' => $path, 'attachment_name' => $file?->getClientOriginalName()]);
        });

        $batch = $financialRequest->batch;
        Notification::send(
            User::where('role', User::ROLE_ADMIN)->get(),
            new BatchActivity($batch, "Secretaría respondió · {$batch->code}", sprintf(
                '%s respondió sobre %s (%s)%s.',
                $request->user()->name,
                $financialRequest->procedure,
                Str::limit($financialRequest->detail, 60),
                $file ? ' y adjuntó un archivo' : '',
            )),
        );

        return new FinancialRequestResource($financialRequest->load(self::ROW_RELATIONS));
    }

    /**
     * Solicitudes que esperan una respuesta de Secretaría ("Más info"), de cualquier lote.
     */
    public function infoPending(): AnonymousResourceCollection
    {
        $rows = FinancialRequest::where('status', FinancialRequest::STATUS_INFO)
            ->with([...self::ROW_RELATIONS, 'batch:id,code'])
            ->orderBy('batch_id')
            ->orderBy('item_number')
            ->get();

        return FinancialRequestResource::collection($rows);
    }

    /**
     * Descarga el adjunto de una respuesta.
     */
    public function attachment(FinancialRequest $financialRequest, RequestEvent $event): StreamedResponse
    {
        abort_if($event->request_id !== $financialRequest->id || ! $event->attachment_path, 404, 'El adjunto no existe.');
        abort_unless(Storage::disk('local')->exists($event->attachment_path), 404, 'El adjunto ya no está disponible.');

        return Storage::disk('local')->download($event->attachment_path, $event->attachment_name);
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
            'authorized_by' => ['nullable', 'string', 'max:120'],
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

        $procedure = trim($data['procedure']);
        $batchId = (int) $data['batch_id'];
        $currency = $data['currency'] ?? 'Bs';

        if (FinancialRequest::where('batch_id', $batchId)->where('procedure', $procedure)->exists()) {
            return response()->json([
                'message' => "El N° de trámite {$procedure} ya está en este lote.",
                'errors' => ['procedure' => ["El N° de trámite {$procedure} ya está en este lote."]],
            ], 422);
        }

        // Duplicado vigente en otro lote → aviso a Secretaría (posible doble pago).
        $duplicate = FinancialRequest::findActiveDuplicates([$procedure], $batchId)->first();
        // Reintento de una rechazada → marca discreta SOLO para el Admin.
        $rejectedOriginal = FinancialRequest::findRejectedOriginal($procedure, $data['requester'], (float) $data['amount'], $currency, $batchId);

        $row = DB::transaction(function () use ($data, $procedure, $batchId, $currency, $rejectedOriginal) {
            // Bloquea el lote: dos filas agregadas a la vez no reciben el mismo N° de ítem.
            $batch = Batch::whereKey($batchId)->lockForUpdate()->firstOrFail();

            if ($batch->isCompleted()) {
                abort(response()->json(['message' => "El lote {$batch->code} ya fue finalizado."], 422));
            }

            return $batch->requests()->create([
                'retry_of_id' => $rejectedOriginal?->id,
                'item_number' => $batch->nextItemNumber(),
                'request_date' => $data['date'] ?? now()->toDateString(),
                'detail' => $data['detail'],
                'amount' => $data['amount'],
                'currency' => $currency,
                'procedure' => $procedure,
                'requester' => $data['requester'],
                'authorized_by' => filled($data['authorized_by'] ?? null) ? trim($data['authorized_by']) : null,
                'priority' => $data['priority'],
                'region' => $data['region'],
                'category' => mb_strtoupper($data['category']),
                'status' => FinancialRequest::STATUS_PENDING,
            ]);
        });

        $warning = $duplicate
            ? "Atención: el N° de trámite {$procedure} ya existe en el lote {$duplicate->batch->code} ({$duplicate->status})."
            : null;

        return (new FinancialRequestResource($row->load(self::ROW_RELATIONS)))->additional(['warning' => $warning])->response()->setStatusCode(201);
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

    /**
     * Un lote finalizado no admite cambios: el Admin debe reabrirlo primero.
     */
    private function ensureBatchOpen(FinancialRequest $financialRequest): ?JsonResponse
    {
        return $financialRequest->batch->isCompleted()
            ? response()->json(['message' => "El lote {$financialRequest->batch->code} está finalizado. Reábrelo para hacer cambios."], 422)
            : null;
    }
}
