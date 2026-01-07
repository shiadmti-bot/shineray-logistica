<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   public function up(): void
{
    Schema::create('filials', function (Blueprint $table) {
        $table->id();
        $table->string('nome');   // Ex: "Loja Acará"
        $table->string('cidade'); // Ex: "Acará"
        $table->string('uf', 2);  // Ex: "PA"
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('filials');
    }
};
