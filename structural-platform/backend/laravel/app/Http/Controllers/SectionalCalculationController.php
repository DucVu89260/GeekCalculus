<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class SectionalCalculationController extends Controller
{
    private function error(int $status, string $code, string $message): JsonResponse
    {
        return response()->json(['status' => 'error', 'code' => $code, 'message' => $message], $status);
    }

    private function engineRequest(string $path, string $method = 'GET', ?string $body = null): JsonResponse
    {
        $baseUrl = rtrim((string) config('sectional.engine_url'), '/');

        try {
            $request = Http::baseUrl($baseUrl)
                ->acceptJson()
                ->timeout((float) config('sectional.timeout_seconds', 8))
                ->connectTimeout((float) config('sectional.connect_timeout_seconds', 2));

            $response = $method === 'POST'
                ? $request->withBody($body ?? '', 'application/json')->post($path)
                : $request->get($path);
        } catch (ConnectionException) {
            return $this->error(503, 'ENGINE_UNAVAILABLE', 'Section calculation service is unavailable.');
        }

        $payload = $response->json();
        if (!is_array($payload)) {
            return $this->error(503, 'ENGINE_UNAVAILABLE', 'Section calculation service returned an invalid response.');
        }

        return response()->json($payload, $response->status());
    }

    public function calculate(Request $request): JsonResponse
    {
        $body = $request->getContent();
        if (strlen($body) > (int) config('sectional.max_request_bytes', 65_536)) {
            return $this->error(413, 'REQUEST_TOO_LARGE', 'Calculation request exceeds the allowed size.');
        }

        return $this->engineRequest('/v1/sections/calculate', 'POST', $body);
    }

    public function sectionTypes(): JsonResponse
    {
        return $this->engineRequest('/v1/section-types');
    }
}
