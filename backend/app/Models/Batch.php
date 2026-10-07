<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Batch extends Model
{
    public const STATUS_PENDING = 'pendiente';
    public const STATUS_COMPLETED = 'completado';

    private const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    protected $fillable = ['code', 'title', 'uploaded_by', 'status', 'completed_at'];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public function requests(): HasMany
    {
        return $this->hasMany(FinancialRequest::class)->orderBy('item_number');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Agrega cantidad de filas y total solicitado POR MONEDA (Bs y USD no se suman entre sí).
     */
    public function scopeWithTotals(Builder $query): Builder
    {
        return $query->withCount('requests as items')
            ->withSum(['requests as total' => fn ($q) => $q->where('currency', 'Bs')], 'amount')
            ->withSum(['requests as total_usd' => fn ($q) => $q->where('currency', 'USD')], 'amount');
    }

    /**
     * Igual que scopeWithTotals, para un lote ya cargado.
     */
    public function loadTotals(): static
    {
        return $this->loadCount('requests as items')
            ->loadSum(['requests as total' => fn ($q) => $q->where('currency', 'Bs')], 'amount')
            ->loadSum(['requests as total_usd' => fn ($q) => $q->where('currency', 'USD')], 'amount');
    }

    /**
     * Lote activo = el lote pendiente más reciente.
     */
    public static function active(): ?self
    {
        return static::pending()->latest('created_at')->latest('id')->first();
    }

    /**
     * Genera el siguiente código correlativo: "N° 09-OCT-26".
     */
    public static function nextCode(?Carbon $date = null): string
    {
        $date ??= now();
        $sequence = (int) static::pluck('code')
            ->map(fn (string $code) => preg_match('/(\d+)-[A-Z]{3}-\d{2}$/', $code, $m) ? (int) $m[1] : 0)
            ->max() + 1;

        do {
            $code = sprintf('N° %02d-%s-%s', $sequence, self::MONTHS[$date->month - 1], $date->format('y'));
            $sequence++;
        } while (static::where('code', $code)->exists());

        return $code;
    }

    public function nextItemNumber(): int
    {
        return (int) $this->requests()->max('item_number') + 1;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }
}
