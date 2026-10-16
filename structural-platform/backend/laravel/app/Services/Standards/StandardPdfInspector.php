<?php

namespace App\Services\Standards;

use Illuminate\Support\Facades\Process;
use RuntimeException;
use Throwable;

class StandardPdfInspector
{
    /** @return array<string, mixed> */
    public function inspect(string $pdfPath, string $editionCode): array
    {
        $extractor = (string) config('standards.extractor');
        if (!is_file($extractor)) {
            throw new RuntimeException('The configured standards PDF extractor is not available.');
        }

        $result = Process::timeout((int) config('standards.inspector_timeout_seconds', 120))
            ->run([
                (string) config('standards.python', 'python3'),
                $extractor,
                $pdfPath,
                '--inspect',
                '--edition',
                $editionCode,
            ]);

        if (!$result->successful()) {
            throw new RuntimeException('PDF inspection failed: '.trim($result->errorOutput() ?: $result->output()));
        }

        try {
            $inspection = json_decode($result->output(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new RuntimeException('PDF inspector returned invalid JSON.', previous: $exception);
        }

        if (!is_array($inspection)) {
            throw new RuntimeException('PDF inspector returned an invalid result.');
        }

        return $inspection;
    }

    /** @return array<string, mixed> */
    public function extract(string $pdfPath, string $editionCode): array
    {
        $extractor = (string) config('standards.extractor');
        if (!is_file($extractor)) {
            throw new RuntimeException('The configured standards PDF extractor is not available.');
        }
        $outputPath = tempnam(sys_get_temp_dir(), 'standards-manifest-');
        if ($outputPath === false) {
            throw new RuntimeException('Unable to create a temporary extraction manifest.');
        }

        try {
            $result = Process::timeout((int) config('standards.inspector_timeout_seconds', 120))
                ->run([
                    (string) config('standards.python', 'python3'),
                    $extractor,
                    $pdfPath,
                    $outputPath,
                    '--edition',
                    $editionCode,
                ]);
            if (!$result->successful()) {
                throw new RuntimeException('PDF extraction failed: '.trim($result->errorOutput() ?: $result->output()));
            }
            $manifest = json_decode(file_get_contents($outputPath), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($manifest)) {
                throw new RuntimeException('PDF extractor returned an invalid manifest.');
            }

            return $manifest;
        } catch (Throwable $exception) {
            if ($exception instanceof RuntimeException) {
                throw $exception;
            }
            throw new RuntimeException('PDF extraction did not produce a valid manifest.', previous: $exception);
        } finally {
            @unlink($outputPath);
        }
    }
}
