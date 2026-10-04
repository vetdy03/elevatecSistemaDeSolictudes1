<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportFilterRequest;
use App\Models\FinancialRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

class PdfController extends Controller
{
    /**
     * Reporte PDF del lote. Mismos filtros que el Excel; ?full=1 agrega la trazabilidad
     * (quién decidió cada fila y cuándo) y el resumen por categoría.
     */
    public function export(ReportFilterRequest $request): Response
    {
        $batch = $request->batch()->load('uploader');
        $rows = $request->rows($batch);
        $full = $request->boolean('full');

        $summary = [
            'requested' => (float) $rows->sum('amount'),
            'approved' => (float) $rows->where('status', FinancialRequest::STATUS_APPROVED)->sum('amount'),
            'rejected' => (float) $rows->where('status', FinancialRequest::STATUS_REJECTED)->sum('amount'),
            'pending' => $rows->where('status', FinancialRequest::STATUS_PENDING)->count(),
        ];

        $pdf = Pdf::loadView('pdf.requests', [
            'batch' => $batch,
            'groups' => $rows->groupBy('category'),
            'summary' => $summary,
            'filterLabel' => $request->filterLabel(),
            'full' => $full,
            'generatedBy' => $request->user()->name,
        ])->setPaper('a4', 'landscape')->setOption('isFontSubsettingEnabled', true);

        return $pdf->download($request->fileName($batch, 'pdf'));
    }
}
