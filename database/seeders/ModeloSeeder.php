<?php

namespace Database\Seeders;

use App\Models\Modelo;
use Illuminate\Database\Seeder;

class ModeloSeeder extends Seeder
{
    public function run(): void
    {
        $modelos = [
            '50Q - CICLOMOTOR JET S',
            '50Q - CICLOMOTOR PHOENIX',
            '50Q - CICLOMOTOR PHOENIX S',
            'QUADRICICLO ATV 200',
            'SCOOTER PT1',
            'SCOOTER PT2',
            'SCOOTER PT2X S',
            'SCOOTER PT3',
            'SCOOTER PT4',
            'SHE3000',
            'SHI 175 RS',
            'SHI 175 SS',
            'SHI 175 EFI',
            'XY125-6A - MOTO JET SS',
            'XY125-6A - MOTO JET SS EFI',
            'XY125-6A - MOTO RIO',
            'XY125-6A - MOTO RIO EFI',
            'XY150-8 - MOTO JEF S',
            'XY150-8 - MOTO JEF S EFI',
            'XY150-8 - MOTO URBAN 150 EFI',
            'XY150-EX - MOTO FREE 150 EFI',
            'XY250-6B - MOTO SHI 250 EFI',
            'KART CROSS 200 S',
            'FLASH 250 EFI',
            'TITANIUM EFI',
            'DENVER EFI',
            'IRON EFI',
            'STORM 200',
            'DRIFT 01',
            'PTXR',
            'SCOOTER SH3',
            'SHI250 EFI',
            'TRICICLO SOUZA',
            'SCOOTER SH-4',
            'SOUZA CROSS',
            'SBM 400',
            'SBM 250',
            'SBM 600',
            'SBM 150',
            // Modelos antigos que já tínhamos (opcional manter)
            'WORKER 125',
            'WORKER 150',
            'WORKER CROSS 150',
            'RAY 50'
        ];

        foreach ($modelos as $nome) {
            // O 'trim' remove espaços acidentais no início/fim
            Modelo::firstOrCreate(['nome' => trim($nome)]);
        }
    }
}