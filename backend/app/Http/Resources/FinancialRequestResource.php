<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Misma forma que la interfaz FinancialRequest de frontend/src/data/requests.ts.
 *
 * @mixin \App\Models\FinancialRequest
 */
class FinancialRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batchId' => $this->batch_id,
            'itemNumber' => $this->item_number,
            'date' => $this->request_date->toDateString(),
            'detail' => $this->detail,
            'amount' => (float) $this->amount,
            'currency' => $this->currency,
            'procedure' => $this->procedure,
            'requester' => $this->requester,
            'priority' => $this->priority,
            'region' => $this->region,
            'category' => $this->category,
            'status' => $this->status,
            'reviewedBy' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
            'reviewedAt' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
