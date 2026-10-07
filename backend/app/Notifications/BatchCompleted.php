<?php

namespace App\Notifications;

use App\Models\Batch;
use App\Models\FinancialRequest;
use App\Models\User;
use App\Support\Money;
use Illuminate\Notifications\Notification;

/**
 * Aviso in-app (canal database) para Secretaría cuando el Admin finaliza un lote.
 */
class BatchCompleted extends Notification
{
    public function __construct(public Batch $batch, public User $completedBy)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $requests = $this->batch->requests()->get(['amount', 'currency', 'status']);

        return [
            'batch_id' => $this->batch->id,
            'code' => $this->batch->code,
            'title' => "Lote {$this->batch->code} finalizado",
            'message' => sprintf(
                '%s aprobó %d y rechazó %d solicitudes. Total aprobado: %s.',
                $this->completedBy->name,
                $requests->where('status', FinancialRequest::STATUS_APPROVED)->count(),
                $requests->where('status', FinancialRequest::STATUS_REJECTED)->count(),
                Money::format(Money::totals($requests, FinancialRequest::STATUS_APPROVED), 0),
            ),
        ];
    }
}
