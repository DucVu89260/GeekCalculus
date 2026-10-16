<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MemberForceController extends Controller
{
    public function process(Request $request, string $operation)
    {
        if (strlen($request->getContent()) > 20_000_000) {
            return response()->json(['status' => 'error', 'code' => 'REQUEST_TOO_LARGE'], 413);
        }
        try {
            $result = Http::baseUrl(rtrim((string) config('sectional.engine_url'), '/'))
                ->acceptJson()->timeout(30)->connectTimeout(2)
                ->withBody($request->getContent(), 'application/json')
                ->post('/API_IF_SAP26.2.0_V1/'.$operation);
        } catch (ConnectionException) {
            return response()->json(['status' => 'error', 'code' => 'ENGINE_UNAVAILABLE'], 503);
        }
        if ($result->successful() && str_starts_with($result->header('Content-Type'), 'text/csv')) {
            return response($result->body(), 200, [
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="member-forces.csv"',
            ]);
        }
        $payload = $result->json();
        if (! is_array($payload) || $result->serverError()) {
            return response()->json(['status' => 'error', 'code' => 'ENGINE_UNAVAILABLE'], 503);
        }
        return response()->json($payload, $result->status());
    }
}
