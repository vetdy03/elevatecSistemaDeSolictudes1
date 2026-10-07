<?php

use App\Http\Middleware\EnsureRole;
use App\Models\Batch;
use App\Models\FinancialRequest;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA: las peticiones del frontend (mismo origen) usan cookie de sesión.
        $middleware->statefulApi();

        // Nginx y el proxy inverso de Synology van delante: respetar X-Forwarded-*.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // 404 legible en español (p. ej. al abrir la notificación de un lote que fue eliminado).
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            $previous = $e->getPrevious();

            if (! $request->is('api/*') || ! $previous instanceof ModelNotFoundException) {
                return null; // otros 404 conservan su propio mensaje
            }

            $message = match ($previous->getModel()) {
                Batch::class => 'El lote solicitado no existe o fue eliminado.',
                FinancialRequest::class => 'La solicitud no existe o fue eliminada.',
                default => 'El registro solicitado no existe.',
            };

            return response()->json(['message' => $message], 404);
        });
    })->create();
