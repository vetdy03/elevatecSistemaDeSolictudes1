<?php

namespace App\Notifications;

use App\Models\Batch;
use Illuminate\Notifications\Notification;

/**
 * Aviso in-app genérico sobre un lote: lote publicado, lote reabierto,
 * pedido de más información, respuesta de Secretaría…
 */
class BatchActivity extends Notification
{
    public function __construct(public Batch $batch, public string $title, public string $message)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'batch_id' => $this->batch->id,
            'code' => $this->batch->code,
            'title' => $this->title,
            'message' => $this->message,
        ];
    }
}
