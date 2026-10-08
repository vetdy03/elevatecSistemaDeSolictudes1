<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Plantilla vacía con los encabezados que entiende RequestsImport.
 */
class RequestsTemplateExport implements FromArray, WithHeadings, WithStyles, ShouldAutoSize
{
    public function headings(): array
    {
        // "Autorizado por" es opcional: puede quedar vacía o eliminarse la columna.
        return ['Fecha', 'Detalle', 'Importe', 'Moneda', 'N° trámite', 'Solicitado por', 'Autorizado por', 'Prioridad', 'Regional', 'Categoría'];
    }

    public function array(): array
    {
        return [
            [now()->format('d/m/Y'), 'Ejemplo: compra de insumos de oficina', 1500, 'Bs', 'TR-00001', 'Nombre Apellido', 'Jefe de área (opcional)', 'Media', 'La Paz', 'OTROS GASTOS DE LA EMPRESA'],
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
