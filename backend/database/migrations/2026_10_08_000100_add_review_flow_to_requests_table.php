<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Flujo de revisión ampliado:
 *  - estado "Más info" (el Admin pide información y Secretaría responde)
 *  - "Autorizado por" (opcional, viene de la planilla)
 *  - motivo de rechazo
 *  - marca de reintento de una solicitud rechazada en otro lote
 *  - historial de eventos por solicitud (decisiones, preguntas, respuestas y adjuntos)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->enum('status', ['Pendiente', 'Aprobado', 'Rechazado', 'Más info'])->default('Pendiente')->change();
            $table->string('authorized_by', 120)->nullable()->after('requester');
            $table->text('rejection_reason')->nullable()->after('status');
            $table->timestamp('info_answered_at')->nullable()->after('rejection_reason');
            $table->foreignId('retry_of_id')->nullable()->after('batch_id')->constrained('requests')->nullOnDelete();
        });

        Schema::create('request_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // status_changed | info_requested | info_answered
            $table->string('type', 30);
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20)->nullable();
            $table->text('body')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->timestamps();

            $table->index(['request_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_events');

        Schema::table('requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('retry_of_id');
            $table->dropColumn(['authorized_by', 'rejection_reason', 'info_answered_at']);
        });

        // Las filas en "Más info" vuelven a Pendiente antes de quitar el valor del enum.
        DB::table('requests')->where('status', 'Más info')->update(['status' => 'Pendiente']);

        Schema::table('requests', function (Blueprint $table) {
            $table->enum('status', ['Pendiente', 'Aprobado', 'Rechazado'])->default('Pendiente')->change();
        });
    }
};
