<?php

namespace App\Http\Controllers;

use App\Services\Standards\StandardsReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class StandardsReviewController extends Controller
{
    public function edit(Request $request, string $code, string $resource, int $id, StandardsReviewService $review): JsonResponse
    {
        $edition = DB::table('standard_editions')->where('code', $code)->first();
        abort_unless($edition, 404);
        $data = Validator::make($request->all(), [
            'notes' => ['required', 'string', 'min:1', 'max:5000'],
            'data' => ['required', 'array'],
        ])->validate();

        try {
            $record = $review->edit((int) $edition->id, $resource, $id, $data['data'], (int) $request->user()->id, $data['notes']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return response()->json(['data' => $record]);
    }

    public function transition(Request $request, string $code, string $resource, int $id, StandardsReviewService $review): JsonResponse
    {
        $edition = DB::table('standard_editions')->where('code', $code)->first();
        abort_unless($edition, 404);
        $data = Validator::make($request->all(), [
            'status' => ['required', 'in:needs_review,verified,published,deprecated'],
            'notes' => ['required_if:status,verified,published', 'nullable', 'string', 'min:10', 'max:5000'],
        ])->validate();

        try {
            $record = $review->transition((int) $edition->id, $resource, $id, $data['status'], (int) $request->user()->id, $data['notes'] ?? null);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return response()->json(['data' => $record]);
    }

    public function history(string $code, string $resource, int $id, Request $request, StandardsReviewService $review): JsonResponse
    {
        $edition = DB::table('standard_editions')->where('code', $code)->first();
        abort_unless($edition, 404);
        $limit = $request->integer('limit', 100);

        return response()->json(['data' => $review->history((int) $edition->id, $resource, $id, $limit)]);
    }
}
