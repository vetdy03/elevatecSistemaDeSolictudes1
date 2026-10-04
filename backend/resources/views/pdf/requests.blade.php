@php
    $money = fn ($v) => number_format((float) $v, 2, ',', '.');
    $colspan = $full ? 12 : 10;
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>{{ $batch->code }}</title>
    <style>
        @page { margin: 22px 26px 34px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #0f172a; }
        .header { background: #0f172a; color: #fff; padding: 12px 14px; }
        .header .code { background: #1e40af; padding: 2px 6px; font-weight: bold; font-size: 9px; }
        .header .state { color: #fcd34d; font-weight: bold; margin-left: 6px; }
        .header .state.done { color: #6ee7b7; }
        .header h1 { font-size: 14px; margin: 8px 0 0; }
        .meta { color: #64748b; margin: 6px 0 10px; }
        .metrics { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .metrics td { border: 1px solid #e2e8f0; padding: 7px 10px; width: 25%; }
        .metrics .label { color: #64748b; font-size: 8px; }
        .metrics .value { font-size: 12px; font-weight: bold; }
        .approved { color: #047857; } .rejected { color: #be123c; } .pending { color: #b45309; }
        table.rows { width: 100%; border-collapse: collapse; }
        table.rows th { background: #f1f5f9; color: #475569; font-size: 7.5px; text-transform: uppercase; text-align: left; padding: 6px 5px; }
        table.rows td { border-bottom: 1px solid #f1f5f9; padding: 5px; vertical-align: top; }
        table.rows tr.category td { background: #f8fafc; color: #64748b; font-weight: bold; font-size: 8px; border-top: 1px solid #e2e8f0; }
        table.rows tr.subtotal td { font-weight: bold; color: #334155; }
        table.rows tfoot td { background: #0f172a; color: #fff; font-weight: bold; padding: 8px 5px; font-size: 10px; }
        .right { text-align: right; }
        .badge { padding: 1px 5px; border-radius: 6px; font-size: 7.5px; font-weight: bold; }
        .b-Aprobado { background: #ecfdf5; color: #047857; }
        .b-Rechazado { background: #fff1f2; color: #be123c; }
        .b-Pendiente { background: #fffbeb; color: #b45309; }
        .footer { position: fixed; bottom: -20px; left: 0; right: 0; color: #94a3b8; font-size: 7.5px; }
    </style>
</head>
<body>
<div class="footer">FinControl · Generado por {{ $generatedBy }} el {{ now()->format('d/m/Y H:i') }}</div>

<div class="header">
    <span class="code">{{ $batch->code }}</span>
    <span class="state {{ $batch->isCompleted() ? 'done' : '' }}">{{ $batch->isCompleted() ? 'COMPLETADO' : 'EN REVISIÓN' }}</span>
    <h1>{{ $batch->title }}</h1>
</div>
<p class="meta">
    Filtro: {{ $filterLabel }}
    · Cargado {{ $batch->created_at->format('d/m/Y') }}@if ($batch->uploader) por {{ $batch->uploader->name }}@endif
    @if ($batch->completed_at) · Finalizado {{ $batch->completed_at->format('d/m/Y H:i') }} @endif
</p>

<table class="metrics">
    <tr>
        <td><div class="label">Total solicitado</div><div class="value">Bs {{ $money($summary['requested']) }}</div></td>
        <td><div class="label">Total aprobado</div><div class="value approved">Bs {{ $money($summary['approved']) }}</div></td>
        <td><div class="label">Total rechazado</div><div class="value rejected">Bs {{ $money($summary['rejected']) }}</div></td>
        <td><div class="label">Filas pendientes</div><div class="value pending">{{ $summary['pending'] }}</div></td>
    </tr>
</table>

<table class="rows">
    <thead>
    <tr>
        <th>N°</th><th>Fecha</th><th>Detalle</th><th class="right">Importe</th><th>Moneda</th>
        <th>N° trámite</th><th>Solicitado por</th><th>Prioridad</th><th>Regional</th><th>Estado</th>
        @if ($full)<th>Revisado por</th><th>Fecha revisión</th>@endif
    </tr>
    </thead>
    <tbody>
    @forelse ($groups as $category => $items)
        <tr class="category"><td colspan="{{ $colspan }}">{{ $category }}</td></tr>
        @foreach ($items as $r)
            <tr>
                <td>{{ $r->item_number }}</td>
                <td>{{ $r->request_date->format('d/m/Y') }}</td>
                <td>{{ $r->detail }}</td>
                <td class="right">{{ $money($r->amount) }}</td>
                <td>{{ $r->currency }}</td>
                <td>{{ $r->procedure }}</td>
                <td>{{ $r->requester }}</td>
                <td>{{ $r->priority }}</td>
                <td>{{ $r->region }}</td>
                <td><span class="badge b-{{ $r->status }}">{{ $r->status }}</span></td>
                @if ($full)
                    <td>{{ $r->reviewer?->name ?? '—' }}</td>
                    <td>{{ $r->reviewed_at?->format('d/m/Y H:i') ?? '—' }}</td>
                @endif
            </tr>
        @endforeach
        @if ($full)
            <tr class="subtotal"><td colspan="3">Subtotal {{ $category }}</td><td class="right">{{ $money($items->sum('amount')) }}</td><td colspan="{{ $colspan - 4 }}"></td></tr>
        @endif
    @empty
        <tr><td colspan="{{ $colspan }}" style="text-align:center; padding:20px; color:#64748b;">No hay solicitudes con estos filtros.</td></tr>
    @endforelse
    </tbody>
    <tfoot>
    <tr><td colspan="3">SUMA TOTAL GENERAL</td><td class="right">Bs {{ $money($summary['requested']) }}</td><td colspan="{{ $colspan - 4 }}"></td></tr>
    </tfoot>
</table>
</body>
</html>
