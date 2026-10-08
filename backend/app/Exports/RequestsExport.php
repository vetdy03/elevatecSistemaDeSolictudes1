<?php

namespace App\Exports;

use App\Models\Batch;
use App\Models\FinancialRequest;
use App\Support\Money;
use Illuminate\Database\Eloquent\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class RequestsExport implements FromArray, WithHeadings, WithStyles, WithColumnFormatting, ShouldAutoSize, WithTitle
{
    private const COLUMNS = [
        'N°', 'Fecha', 'Detalle', 'Importe', 'Moneda', 'N° trámite', 'Solicitado por', 'Autorizado por',
        'Prioridad', 'Regional', 'Categoría', 'Estado', 'Motivo de rechazo', 'Revisado por', 'Fecha revisión',
    ];

    /**
     * @param  Collection<int, FinancialRequest>  $rows
     */
    public function __construct(private Batch $batch, private Collection $rows, private string $filterLabel)
    {
    }

    public function title(): string
    {
        return mb_substr(str_replace(['N°', '/'], ['Lote', '-'], $this->batch->code), 0, 31);
    }

    public function headings(): array
    {
        return [
            ["{$this->batch->code} — {$this->batch->title}"],
            ["Filtro: {$this->filterLabel} · Generado: ".now()->format('d/m/Y H:i')],
            self::COLUMNS,
        ];
    }

    public function array(): array
    {
        $data = $this->rows->map(fn (FinancialRequest $r) => [
            $r->item_number,
            $r->request_date->format('d/m/Y'),
            $r->detail,
            (float) $r->amount,
            $r->currency,
            $r->procedure,
            $r->requester,
            $r->authorized_by ?? '—',
            $r->priority,
            $r->region,
            $r->category,
            $r->status,
            $r->rejection_reason ?? '',
            $r->reviewer?->name ?? '',
            $r->reviewed_at?->format('d/m/Y H:i') ?? '',
        ])->all();

        // Un total por moneda: Bs y USD no se suman entre sí.
        foreach ($this->totalRows() as $currency => $amount) {
            $data[] = ['', '', "SUMA TOTAL {$currency}", $amount, $currency];
        }

        return $data;
    }

    /**
     * @return array<string, float> moneda => total (USD solo si hay filas en dólares)
     */
    private function totalRows(): array
    {
        $totals = Money::totals($this->rows);

        return $totals['USD'] > 0 ? $totals : ['Bs' => $totals['Bs']];
    }

    public function columnFormats(): array
    {
        return ['D' => '#,##0.00'];
    }

    public function styles(Worksheet $sheet): array
    {
        $firstTotalRow = $this->rows->count() + 4;
        $lastTotalRow = $firstTotalRow + count($this->totalRows()) - 1;

        $sheet->mergeCells('A1:O1');
        $sheet->mergeCells('A2:O2');
        $sheet->freezePane('A4');

        return [
            1 => ['font' => ['bold' => true, 'size' => 13]],
            2 => ['font' => ['italic' => true, 'color' => ['rgb' => '64748B']]],
            3 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
            ],
        ] + array_fill_keys(range($firstTotalRow, $lastTotalRow), ['font' => ['bold' => true]]);
    }
}
