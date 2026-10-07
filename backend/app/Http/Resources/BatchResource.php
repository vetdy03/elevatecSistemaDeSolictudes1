<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Batch
 */
class BatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'title' => $this->title,
            'status' => $this->isCompleted() ? 'Completado' : 'Pendiente',
            'date' => $this->created_at->toIso8601String(),
            'completedAt' => $this->completed_at?->toIso8601String(),
            'updatedAt' => $this->updated_at->toIso8601String(),
            'uploadedBy' => $this->whenLoaded('uploader', fn () => $this->uploader?->name),
            // Totales separados por moneda: Bs y USD nunca se suman entre sí.
            'total' => (float) ($this->total ?? $this->requests()->where('currency', 'Bs')->sum('amount')),
            'totalUsd' => (float) ($this->total_usd ?? $this->requests()->where('currency', 'USD')->sum('amount')),
            'items' => (int) ($this->items ?? $this->requests()->count()),
            'requests' => FinancialRequestResource::collection($this->whenLoaded('requests')),
        ];
    }
}
