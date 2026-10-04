<?php

namespace App\Exports;

use App\Models\Batch;
use App\Models\FinancialRequest;
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
        'N°', 'Fecha', 'Detalle', 'Importe', 'Moneda', 'N° trámite', 'Solicitado por',
        'Prioridad', 'Regional', 'Categoría', 'Estado', 'Revisado por', 'Fecha revisión',
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
            $r->priority,
            $r->region,
            $r->category,
            $r->status,
            $r->reviewer?->name ?? '',
            $r->reviewed_at?->format('d/m/Y H:i') ?? '',
        ])->all();

        $data[] = ['', '', 'SUMA TOTAL', (float) $this->rows->sum('amount')];

        return $data;
    }

    public function columnFormats(): array
    {
        return ['D' => '#,##0.00'];
    }

    public function styles(Worksheet $sheet): array
    {
        $lastRow = $this->rows->count() + 4;

        $sheet->mergeCells('A1:M1');
        $sheet->mergeCells('A2:M2');
        $sheet->freezePane('A4');

        return [
            1 => ['font' => ['bold' => true, 'size' => 13]],
            2 => ['font' => ['italic' => true, 'color' => ['rgb' => '64748B']]],
            3 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
            ],
            $lastRow => ['font' => ['bold' => true]],
        ];
    }
}
