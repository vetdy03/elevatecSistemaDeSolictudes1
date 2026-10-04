<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->unsignedInteger('item_number');
            $table->date('request_date');
            $table->string('detail', 500);
            $table->decimal('amount', 14, 2);
            $table->enum('currency', ['Bs', 'USD'])->default('Bs');
            $table->string('procedure', 50);
            $table->string('requester', 120);
            $table->enum('priority', ['Alta', 'Media', 'Baja'])->default('Media');
            $table->string('region', 80);
            $table->string('category', 120);
            $table->enum('status', ['Pendiente', 'Aprobado', 'Rechazado'])->default('Pendiente')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['batch_id', 'item_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};
