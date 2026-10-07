<?php

namespace App\Http\Controllers\Api;

use App\Exports\RequestsExport;
use App\Exports\RequestsTemplateExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReportFilterRequest;
use App\Http\Resources\BatchResource;
use App\Imports\RequestsImport;
use App\Models\Batch;
use App\Models\FinancialRequest;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class ExcelController extends Controller
{
    private const FILE_RULES = ['required', 'file', 'max:10240', 'mimes:xlsx,csv,txt'];

    /**
     * Valida el archivo y devuelve las filas detectadas, sin guardar nada.
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['file' => self::FILE_RULES], $this->fileMessages());

        $import = $this->parse($request->file('file'));
        $warnings = $this->checkDuplicates($import);
        $rows = collect($import->rows);

        return response()->json([
            'rows' => $import->rows,
            'errors' => $import->errors,
            'warnings' => $warnings,
            // Totales por moneda: Bs y USD no se suman entre sí.
            'totals' => [
                'Bs' => round((float) $rows->where('currency', 'Bs')->sum('amount'), 2),
                'USD' => round((float) $rows->where('currency', 'USD')->sum('amount'), 2),
            ],
            'suggestedCode' => Batch::nextCode(),
        ]);
    }

    /**
     * N° de trámite repetidos:
     *  - dentro del mismo archivo → error (bloquea la publicación);
     *  - ya registrados en otro lote → advertencia (se permite publicar, puede ser un reingreso).
     *
     * @return list<string> advertencias
     */
    private function checkDuplicates(RequestsImport $import): array
    {
        $byProcedure = collect($import->rows)->groupBy(fn (array $row) => mb_strtoupper($row['procedure']));

        foreach ($byProcedure as $procedure => $rows) {
            if ($rows->count() > 1) {
                $import->errors[] = "El N° de trámite {$rows->first()['procedure']} está repetido en las filas ".$rows->pluck('line')->implode(', ').'.';
            }
        }

        $existing = FinancialRequest::findByProcedures($byProcedure->keys()->all());

        return $byProcedure
            ->filter(fn ($rows, $procedure) => $existing->has($procedure))
            ->map(function ($rows, $procedure) use ($existing) {
                $match = $existing->get($procedure);

                return "Fila {$rows->first()['line']}: el N° de trámite {$rows->first()['procedure']} ya existe en el lote {$match->batch->code} ({$match->status}).";
            })
            ->values()
            ->all();
    }

    /**
     * Crea un lote nuevo con todas las filas del archivo ("Publicar lote").
     */
    public function import(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => self::FILE_RULES,
            'title' => ['required', 'string', 'max:255'],
        ], $this->fileMessages() + ['title.required' => 'Ingresa el título del lote.']);

        $import = $this->parse($request->file('file'));
        $this->checkDuplicates($import);

        if ($import->errors) {
            return response()->json([
                'message' => 'El archivo tiene filas con errores. Corrígelas y vuelve a cargarlo.',
                'errors' => ['file' => $import->errors],
            ], 422);
        }

        // Si dos personas publican a la vez, ambas pueden calcular el mismo código:
        // la segunda choca con el índice único y se reintenta con el código siguiente.
        for ($attempt = 1; ; $attempt++) {
            try {
                $batch = DB::transaction(fn () => $this->createBatch($import, $data['title'], $request->user()->id));
                break;
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt >= 3) {
                    throw $e;
                }
            }
        }

        $batch->loadTotals();

        return (new BatchResource($batch))->response()->setStatusCode(201);
    }

    private function createBatch(RequestsImport $import, string $title, int $userId): Batch
    {
        $batch = Batch::create([
            'code' => Batch::nextCode(),
            'title' => mb_strtoupper($title),
            'uploaded_by' => $userId,
            'status' => Batch::STATUS_PENDING,
        ]);

        // Sin "touch" del lote por cada fila: el lote se acaba de crear.
        FinancialRequest::withoutTouching(function () use ($batch, $import) {
            foreach ($import->rows as $i => $row) {
                $batch->requests()->create([
                    'item_number' => $i + 1,
                    'request_date' => $row['date'],
                    'detail' => $row['detail'],
                    'amount' => $row['amount'],
                    'currency' => $row['currency'],
                    'procedure' => $row['procedure'],
                    'requester' => $row['requester'],
                    'priority' => $row['priority'],
                    'region' => $row['region'],
                    'category' => $row['category'],
                    'status' => FinancialRequest::STATUS_PENDING,
                ]);
            }
        });

        return $batch;
    }

    public function export(ReportFilterRequest $request): BinaryFileResponse
    {
        $batch = $request->batch();

        return Excel::download(
            new RequestsExport($batch, $request->rows($batch), $request->filterLabel()),
            $request->fileName($batch, 'xlsx'),
        );
    }

    public function template(): BinaryFileResponse
    {
        return Excel::download(new RequestsTemplateExport, 'plantilla-solicitudes.xlsx');
    }

    private function parse(UploadedFile $file): RequestsImport
    {
        $isCsv = in_array(strtolower($file->getClientOriginalExtension()), ['csv', 'txt'], true);
        $delimiter = ',';
        $encoding = 'UTF-8';

        if ($isCsv) {
            // Excel en español suele guardar CSV con ";" y en Windows-1252.
            $sample = (string) file_get_contents($file->getRealPath(), false, null, 0, 4096);
            $firstLine = strtok($sample, "\r\n") ?: '';
            $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
            $encoding = mb_check_encoding($sample, 'UTF-8') ? 'UTF-8' : 'Windows-1252';
        }

        $import = new RequestsImport($delimiter, $encoding);

        try {
            Excel::import($import, $file, null, $isCsv ? \Maatwebsite\Excel\Excel::CSV : \Maatwebsite\Excel\Excel::XLSX);
        } catch (Throwable $e) {
            report($e);
            abort(response()->json([
                'message' => 'No se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.',
                'errors' => ['file' => ['No se pudo leer el archivo.']],
            ], 422));
        }

        return $import;
    }

    private function fileMessages(): array
    {
        return [
            'file.required' => 'Selecciona un archivo.',
            'file.max' => 'El archivo supera el máximo de 10 MB.',
            'file.mimes' => 'Selecciona un archivo .xlsx o .csv.',
        ];
    }
}
