<?php

namespace App\Support;

use App\Models\FinancialRequest;
use Illuminate\Support\Collection;

/**
 * Totales por moneda. Bs y USD nunca se suman entre sí.
 */
class Money
{
    /**
     * @param  Collection<int, FinancialRequest>  $rows
     * @return array{Bs: float, USD: float}
     */
    public static function totals(Collection $rows, ?string $status = null): array
    {
        $rows = $status ? $rows->where('status', $status) : $rows;

        return [
            'Bs' => (float) $rows->where('currency', 'Bs')->sum('amount'),
            'USD' => (float) $rows->where('currency', 'USD')->sum('amount'),
        ];
    }

    /**
     * "Bs 1.000,00" o "Bs 1.000,00 · USD 50,00" (USD solo si hay montos en dólares).
     *
     * @param  array{Bs: float, USD: float}  $totals
     */
    public static function format(array $totals, int $decimals = 2): string
    {
        $text = 'Bs '.number_format($totals['Bs'], $decimals, ',', '.');

        if ($totals['USD'] > 0) {
            $text .= ' · USD '.number_format($totals['USD'], $decimals, ',', '.');
        }

        return $text;
    }
}
