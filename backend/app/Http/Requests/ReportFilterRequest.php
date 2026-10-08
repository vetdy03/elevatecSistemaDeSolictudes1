<?php

namespace App\Http\Requests;

use App\Models\Batch;
use App\Models\FinancialRequest;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filtros comunes de los reportes Excel y PDF:
 * ?batch_id=1&status=Aprobado|Rechazado|Pendiente|Decididos&category=...&region=...
 * Sin batch_id se usa el lote activo.
 */
class ReportFilterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'batch_id' => ['nullable', 'integer', 'exists:batches,id'],
            'status' => ['nullable', Rule::in([...FinancialRequest::STATUSES, 'Decididos'])], // incluye "Más info"
            'category' => ['nullable', 'string', 'max:120'],
            'region' => ['nullable', 'string', 'max:80'],
        ];
    }

    public function batch(): Batch
    {
        $batch = $this->filled('batch_id') ? Batch::find($this->integer('batch_id')) : Batch::active();

        abort_if(! $batch, 404, 'No hay un lote para exportar.');

        return $batch;
    }

    /**
     * @return Collection<int, FinancialRequest>
     */
    public function rows(Batch $batch): Collection
    {
        $status = $this->input('status');

        return $batch->requests()
            ->with('reviewer')
            ->when($status === 'Decididos', fn ($q) => $q->where('status', '!=', FinancialRequest::STATUS_PENDING))
            ->when($status && $status !== 'Decididos', fn ($q) => $q->where('status', $status))
            ->when($this->input('category'), fn ($q, $category) => $q->where('category', $category))
            ->when($this->input('region'), fn ($q, $region) => $q->where('region', $region))
            ->reorder()
            ->orderBy('category')
            ->orderBy('item_number')
            ->get();
    }

    public function filterLabel(): string
    {
        $parts = array_filter([
            $this->input('status') === 'Decididos' ? 'Aprobados y rechazados' : $this->input('status'),
            $this->input('category'),
            $this->input('region'),
        ]);

        return $parts ? implode(' · ', $parts) : 'Todas las solicitudes';
    }

    public function fileName(Batch $batch, string $extension): string
    {
        $slug = preg_replace('/[^A-Za-z0-9-]+/', '', str_replace(' ', '-', str_replace('N°', 'Lote', $batch->code)));
        $suffix = $this->input('status') ? '-'.strtolower($this->input('status')) : '';

        return "{$slug}{$suffix}.{$extension}";
    }
}
