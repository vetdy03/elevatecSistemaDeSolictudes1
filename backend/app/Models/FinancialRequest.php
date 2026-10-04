<?php

namespace App\Models;

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

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
