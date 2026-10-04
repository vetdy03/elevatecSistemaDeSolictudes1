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

        return response()->json([
            'rows' => $import->rows,
            'errors' => $import->errors,
            'total' => round(array_sum(array_column($import->rows, 'amount')), 2),
            'suggestedCode' => Batch::nextCode(),
        ]);
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

        if ($import->errors) {
            return response()->json([
                'message' => 'El archivo tiene filas con errores. Corrígelas y vuelve a cargarlo.',
                'errors' => ['file' => $import->errors],
            ], 422);
        }

        $batch = DB::transaction(function () use ($import, $data, $request) {
            $batch = Batch::create([
                'code' => Batch::nextCode(),
                'title' => mb_strtoupper($data['title']),
                'uploaded_by' => $request->user()->id,
                'status' => Batch::STATUS_PENDING,
            ]);

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

            return $batch;
        });

        $batch->loadCount('requests as items')->loadSum('requests as total', 'amount');

        return (new BatchResource($batch))->response()->setStatusCode(201);
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
