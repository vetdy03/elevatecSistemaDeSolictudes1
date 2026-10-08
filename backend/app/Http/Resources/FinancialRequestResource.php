<?php

namespace App\Http\Resources;

use App\Models\FinancialRequest;
use App\Models\RequestEvent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Misma forma que la interfaz FinancialRequest de frontend/src/types.ts.
 *
 * @mixin \App\Models\FinancialRequest
 */
class FinancialRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isAdmin = $request->user()?->hasRole(User::ROLE_ADMIN) ?? false;

        return [
            'id' => $this->id,
            'batchId' => $this->batch_id,
            'batchCode' => $this->whenLoaded('batch', fn () => $this->batch?->code),
            'itemNumber' => $this->item_number,
            'date' => $this->request_date->toDateString(),
            'detail' => $this->detail,
            'amount' => (float) $this->amount,
            'currency' => $this->currency,
            'procedure' => $this->procedure,
            'requester' => $this->requester,
            'authorizedBy' => $this->authorized_by,
            'priority' => $this->priority,
            'region' => $this->region,
            'category' => $this->category,
            'status' => $this->status,
            'rejectionReason' => $this->rejection_reason,
            'infoAnsweredAt' => $this->info_answered_at?->toIso8601String(),
            'reviewedBy' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
            'reviewedAt' => $this->reviewed_at?->toIso8601String(),

            // Reintento de una solicitud rechazada: SOLO para el Admin (Secretaría no recibe este dato).
            // (solo mientras la original siga rechazada)
            'retry' => $this->when($isAdmin && $this->retry_of_id !== null, fn () => $this->retryOf?->status === FinancialRequest::STATUS_REJECTED ? [
                'batchCode' => $this->retryOf->batch?->code,
                'rejectedAt' => ($this->retryOf->reviewed_at ?? $this->retryOf->updated_at)?->toIso8601String(),
                'reason' => $this->retryOf->rejection_reason,
                'procedure' => $this->retryOf->procedure,
            ] : null),

            // Preguntas y respuestas de "Más info"
            'conversation' => $this->whenLoaded('conversation', fn () => $this->conversation->map(fn (RequestEvent $event) => [
                'id' => $event->id,
                'type' => $event->type === RequestEvent::INFO_REQUESTED ? 'question' : 'answer',
                'body' => $event->body,
                'user' => $event->user?->name,
                'createdAt' => $event->created_at->toIso8601String(),
                'attachmentName' => $event->attachment_name,
                'attachmentUrl' => $event->attachment_path ? "/requests/{$this->id}/events/{$event->id}/attachment" : null,
            ])),
        ];
    }
}
