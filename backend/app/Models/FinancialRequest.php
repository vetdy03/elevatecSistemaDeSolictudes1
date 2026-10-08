<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Solicitud de recursos. Se llama FinancialRequest (como la interfaz del frontend)
 * para no chocar con Illuminate\Http\Request; la tabla sigue siendo "requests".
 */
class FinancialRequest extends Model
{
    public const STATUS_PENDING = 'Pendiente';
    public const STATUS_APPROVED = 'Aprobado';
    public const STATUS_REJECTED = 'Rechazado';
    /** El Admin pidió más información; espera la respuesta de Secretaría. */
    public const STATUS_INFO = 'Más info';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_REJECTED, self::STATUS_INFO];
    /** Estados que el Admin puede fijar directamente con los botones (Pendiente = deshacer). */
    public const DECISIONS = [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_REJECTED];
    public const PRIORITIES = ['Alta', 'Media', 'Baja'];
    public const CURRENCIES = ['Bs', 'USD'];

    /** Ventana para detectar un reintento por solicitante + importe (cuando cambian el N° de trámite). */
    public const RETRY_WINDOW_DAYS = 90;

    protected $table = 'requests';

    /** Cualquier cambio en una fila actualiza la "Última actualización" (updated_at) de su lote. */
    protected $touches = ['batch'];

    protected $fillable = [
        'batch_id', 'retry_of_id', 'item_number', 'request_date', 'detail', 'amount', 'currency', 'procedure',
        'requester', 'authorized_by', 'priority', 'region', 'category', 'status', 'rejection_reason',
        'info_answered_at', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'request_date' => 'date',
            'amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
            'info_answered_at' => 'datetime',
        ];
    }

    /**
     * Solicitudes VIGENTES (no rechazadas) con alguno de estos N° de trámite, en otros lotes.
     * Sirve para avisar a Secretaría de un posible doble pago. Las rechazadas no se incluyen:
     * esas se marcan solo para el Admin como reintento (ver findRejectedOriginal).
     *
     * @param  list<string>  $procedures
     * @return Collection<string, self>  clave = N° de trámite en mayúsculas
     */
    public static function findActiveDuplicates(array $procedures, ?int $exceptBatchId = null): Collection
    {
        if (! $procedures) {
            return new Collection;
        }

        return static::query()
            ->with('batch:id,code')
            ->whereIn('procedure', array_values(array_unique($procedures)))
            ->where('status', '!=', self::STATUS_REJECTED)
            ->when($exceptBatchId, fn ($q) => $q->where('batch_id', '!=', $exceptBatchId))
            ->get(['id', 'batch_id', 'procedure', 'status'])
            ->keyBy(fn (self $row) => mb_strtoupper(trim($row->procedure)));
    }

    /**
     * Solicitud RECHAZADA en otro lote de la que esta parece un reintento:
     * mismo N° de trámite, o mismo solicitante + importe + moneda en los últimos 90 días.
     */
    public static function findRejectedOriginal(string $procedure, string $requester, float $amount, string $currency, ?int $exceptBatchId = null): ?self
    {
        return static::query()
            ->where('status', self::STATUS_REJECTED)
            ->when($exceptBatchId, fn ($q) => $q->where('batch_id', '!=', $exceptBatchId))
            ->where(fn ($q) => $q
                ->where('procedure', $procedure)
                ->orWhere(fn ($same) => $same
                    ->where('requester', $requester)
                    ->where('amount', $amount)
                    ->where('currency', $currency)
                    ->where('created_at', '>=', now()->subDays(self::RETRY_WINDOW_DAYS))))
            ->latest('id')
            ->first();
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function retryOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'retry_of_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(RequestEvent::class, 'request_id')->oldest('id');
    }

    /** Preguntas del Admin y respuestas de Secretaría ("Más info"). */
    public function conversation(): HasMany
    {
        return $this->events()->whereIn('type', [RequestEvent::INFO_REQUESTED, RequestEvent::INFO_ANSWERED]);
    }

    /**
     * Cambia el estado y deja constancia en el historial (quién, cuándo, de qué a qué y por qué).
     */
    public function transition(string $to, User $by, ?string $body = null, string $type = RequestEvent::STATUS_CHANGED): RequestEvent
    {
        $from = $this->status;
        $this->status = $to;
        $this->save();

        return $this->events()->create([
            'user_id' => $by->id,
            'type' => $type,
            'from_status' => $from,
            'to_status' => $to,
            'body' => $body,
        ]);
    }
}
