<?php

namespace App\Imports;

use App\Models\FinancialRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Throwable;

/**
 * Lee la planilla de solicitudes (.xlsx o .csv) y la normaliza SIN escribir en la BD.
 * Tras Excel::import($import, $file) quedan disponibles $import->rows y $import->errors.
 *
 * Encabezados aceptados (sin importar mayúsculas/tildes): Fecha, Detalle, Importe, Moneda,
 * N° trámite, Solicitado por, Prioridad, Regional, Categoría. Una fila que solo tenga texto en
 * la primera celda se interpreta como título de categoría para las filas siguientes.
 */
class RequestsImport implements ToCollection, WithHeadingRow, WithCalculatedFormulas, WithCustomCsvSettings
{
    /** Encabezado normalizado (slug) => campo interno */
    private const ALIASES = [
        'date' => ['fecha', 'date', 'fecha_solicitud', 'fecha_de_solicitud'],
        'detail' => ['detalle', 'detail', 'descripcion', 'concepto'],
        'amount' => ['importe', 'monto', 'amount', 'importe_bs'],
        'currency' => ['moneda', 'currency'],
        'procedure' => ['n_tramite', 'no_tramite', 'nro_tramite', 'numero_tramite', 'n_de_tramite', 'tramite', 'procedure'],
        'requester' => ['solicitado_por', 'solicitante', 'requester'],
        // Opcional: puede faltar la columna o venir vacía
        'authorized_by' => ['autorizado_por', 'autorizado', 'autorizo', 'autorizada_por', 'authorized_by'],
        'priority' => ['prioridad', 'priority'],
        'region' => ['regional', 'region'],
        'category' => ['categoria', 'category'],
    ];

    private const REQUIRED = ['detail', 'amount', 'procedure', 'requester', 'region'];

    private const MONTHS = [
        'ene' => 1, 'feb' => 2, 'mar' => 3, 'abr' => 4, 'may' => 5, 'jun' => 6,
        'jul' => 7, 'ago' => 8, 'sep' => 9, 'set' => 9, 'oct' => 10, 'nov' => 11, 'dic' => 12,
    ];

    /** @var list<array<string, mixed>> */
    public array $rows = [];

    /** @var list<string> */
    public array $errors = [];

    public function __construct(private string $csvDelimiter = ',', private string $csvEncoding = 'UTF-8')
    {
    }

    public function getCsvSettings(): array
    {
        return ['delimiter' => $this->csvDelimiter, 'input_encoding' => $this->csvEncoding];
    }

    public function collection(Collection $collection): void
    {
        $currentCategory = null;

        foreach ($collection as $index => $raw) {
            $line = $index + 2; // fila 1 = encabezados
            $values = $raw->map(fn ($v) => is_string($v) ? trim($v) : $v)->filter(fn ($v) => $v !== null && $v !== '');

            if ($values->isEmpty()) {
                continue;
            }

            $field = fn (string $name) => $this->pick($raw, $name);

            // Fila separadora de categoría (p. ej. "GASTOS DEL PERSONAL")
            if ($values->count() === 1 && $field('amount') === null) {
                $currentCategory = mb_strtoupper((string) $values->first());
                continue;
            }

            $row = [
                'line' => $line,
                'date' => $this->parseDate($field('date')),
                'detail' => $field('detail'),
                'amount' => $this->parseAmount($field('amount')),
                'currency' => $this->parseCurrency($field('currency')),
                'procedure' => $field('procedure') !== null ? trim((string) $field('procedure')) : null,
                'requester' => $field('requester'),
                'authorized_by' => $field('authorized_by') !== null ? mb_substr(trim((string) $field('authorized_by')), 0, 120) : null,
                'priority' => $this->parsePriority($field('priority')),
                'region' => $field('region'),
                'category' => $field('category') !== null ? mb_strtoupper((string) $field('category')) : $currentCategory,
            ];

            $rowErrors = [];
            foreach (self::REQUIRED as $required) {
                if ($row[$required] === null || $row[$required] === '') {
                    $rowErrors[] = "falta {$this->label($required)}";
                }
            }
            if ($field('amount') !== null && ($row['amount'] === null || $row['amount'] <= 0)) {
                $rowErrors[] = 'importe inválido';
            }
            if ($field('date') !== null && $row['date'] === null) {
                $rowErrors[] = 'fecha inválida';
            }
            if ($row['category'] === null) {
                $rowErrors[] = 'falta categoría';
            }

            if ($rowErrors) {
                $this->errors[] = "Fila {$line}: ".implode(', ', $rowErrors).'.';
                continue;
            }

            $row['date'] ??= now()->toDateString();
            $this->rows[] = $row;
        }

        if (! $this->rows && ! $this->errors) {
            $this->errors[] = 'El archivo no contiene solicitudes.';
        }
    }

    private function pick(Collection $raw, string $field): mixed
    {
        foreach (self::ALIASES[$field] as $key) {
            $value = $raw->get($key);
            if (is_string($value)) {
                $value = trim($value);
            }
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function parseAmount(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }
        if (is_int($value) || is_float($value)) {
            return round((float) $value, 2);
        }

        $clean = preg_replace('/[^\d.,-]/', '', (string) $value);
        if ($clean === '' || $clean === '-') {
            return null;
        }

        $lastDot = strrpos($clean, '.');
        $lastComma = strrpos($clean, ',');

        if ($lastDot !== false && $lastComma !== false) {
            // El separador que aparece al final es el decimal: 18.400,50 o 18,400.50
            $decimal = $lastComma > $lastDot ? ',' : '.';
            $thousands = $decimal === ',' ? '.' : ',';
            $clean = str_replace([$thousands, $decimal], ['', '.'], $clean);
        } elseif ($lastComma !== false) {
            // 18,400 (miles) vs 18,5 (decimal)
            $clean = preg_match('/^-?\d{1,3}(,\d{3})+$/', $clean) ? str_replace(',', '', $clean) : str_replace(',', '.', $clean);
        } elseif ($lastDot !== false && preg_match('/^-?\d{1,3}(\.\d{3})+$/', $clean)) {
            // 18.400 (miles en formato boliviano)
            $clean = str_replace('.', '', $clean);
        }

        return is_numeric($clean) ? round((float) $clean, 2) : null;
    }

    private function parseDate(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        try {
            if (is_numeric($value)) {
                return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $value))->toDateString();
            }

            $text = mb_strtolower(trim((string) $value));

            // "29 Sep" o "29 sep 2026"
            if (preg_match('/^(\d{1,2})\s+([a-zñ]{3})[a-z.]*\s*(\d{4})?$/u', $text, $m) && isset(self::MONTHS[$m[2]])) {
                return Carbon::create((int) ($m[3] ?? now()->year), self::MONTHS[$m[2]], (int) $m[1])->toDateString();
            }

            // DateTime nativo devuelve false si no coincide (Carbon 3 lanza excepción y cortaría el bucle).
            foreach (['d/m/Y', 'd-m-Y', 'Y-m-d', 'd/m/y', 'd.m.Y', 'j/n/Y'] as $format) {
                $date = \DateTimeImmutable::createFromFormat("!{$format}", $text);
                if ($date && $date->format($format) === $text) {
                    return $date->format('Y-m-d');
                }
            }
        } catch (Throwable) {
            // cae al return null
        }

        return null;
    }

    private function parseCurrency(mixed $value): string
    {
        $text = mb_strtoupper(preg_replace('/[\s.]/', '', (string) $value));

        return in_array($text, ['USD', '$US', '$', 'US$', 'DOLARES', 'DÓLARES'], true) ? 'USD' : 'Bs';
    }

    private function parsePriority(mixed $value): string
    {
        $text = mb_convert_case(trim((string) $value), MB_CASE_TITLE);

        return in_array($text, FinancialRequest::PRIORITIES, true) ? $text : 'Media';
    }

    private function label(string $field): string
    {
        return [
            'detail' => 'detalle',
            'amount' => 'importe',
            'procedure' => 'N° de trámite',
            'requester' => 'solicitante',
            'region' => 'regional',
        ][$field] ?? $field;
    }
}
