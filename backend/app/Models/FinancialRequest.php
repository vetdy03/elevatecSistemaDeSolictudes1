<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Solicitud de recursos. Se llama FinancialRequest (como la interfaz del frontend)
 * para no chocar con Illuminate\Http\Request; la tabla sigue siendo "requests".
 */
class FinancialRequest extends Model
{
    public const STATUS_PENDING = 'Pendiente';
    public const STATUS_APPROVED = 'Aprobado';
    public const STATUS_REJECTED = 'Rechazado';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_REJECTED];
    public const PRIORITIES = ['Alta', 'Media', 'Baja'];
    public const CURRENCIES = ['Bs', 'USD'];

    protected $table = 'requests';

    /** Cualquier cambio en una fila actualiza la "Última actualización" (updated_at) de su lote. */
    protected $touches = ['batch'];

    protected $fillable = [
        'batch_id', 'item_number', 'request_date', 'detail', 'amount', 'currency', 'procedure',
        'requester', 'priority', 'region', 'category', 'status', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'request_date' => 'date',
            'amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * Solicitudes ya registradas con alguno de estos N° de trámite (sin distinguir mayúsculas).
     *
     * @param  list<string>  $procedures
     * @return Collection<string, self>  clave = N° de trámite en mayúsculas
     */
    public static function findByProcedures(array $procedures): Collection
    {
        if (! $procedures) {
            return new Collection;
        }

        return static::query()
            ->with('batch:id,code')
            ->whereIn('procedure', array_values(array_unique($procedures)))
            ->get(['id', 'batch_id', 'procedure', 'status'])
            ->keyBy(fn (self $row) => mb_strtoupper(trim($row->procedure)));
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
