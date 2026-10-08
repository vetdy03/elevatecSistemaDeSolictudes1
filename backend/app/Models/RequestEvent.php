<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historial de una solicitud: cambios de estado (con motivo), preguntas del Admin
 * ("Más info") y respuestas de Secretaría (con adjunto opcional).
 */
class RequestEvent extends Model
{
    public const STATUS_CHANGED = 'status_changed';
    public const INFO_REQUESTED = 'info_requested';
    public const INFO_ANSWERED = 'info_answered';

    protected $fillable = ['request_id', 'user_id', 'type', 'from_status', 'to_status', 'body', 'attachment_path', 'attachment_name'];

    public function request(): BelongsTo
    {
        return $this->belongsTo(FinancialRequest::class, 'request_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
