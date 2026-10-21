<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Throwable;

class PersonalPdfNoteController extends Controller
{
    private const MAX_BYTES = 20 * 1024 * 1024;

    private function owned(Request $request, string $id): object
    {
        return DB::table('personal_pdf_notes')->where('user_id', $request->user()->id)->where('id', $id)->firstOrFail();
    }

    private function payload(object $note): array
    {
        return [
            'id' => $note->id, 'title' => $note->title, 'description' => $note->description ?? '',
            'original_name' => $note->original_name, 'size_bytes' => (int) $note->size_bytes,
            'sha256' => $note->sha256, 'created_at' => Carbon::parse($note->created_at)->toISOString(),
            'updated_at' => Carbon::parse($note->updated_at)->toISOString(),
            'file_url' => '/api/v1/personal-pdf-notes/'.$note->id.'/file',
        ];
    }

    private function uploadLimit(): int
    {
        $limits = [self::MAX_BYTES];
        foreach (['upload_max_filesize', 'post_max_size'] as $setting) {
            $bytes = ini_parse_quantity((string) ini_get($setting));
            if ($bytes > 0) $limits[] = max(0, $bytes - ($setting === 'post_max_size' ? 65536 : 0));
        }
        return min($limits);
    }

    public function index(Request $request)
    {
        return response()->json([
            'data' => DB::table('personal_pdf_notes')->where('user_id', $request->user()->id)
                ->orderByDesc('created_at')->orderBy('id')->get()->map(fn ($note) => $this->payload($note)),
            'meta' => ['upload_limit_bytes' => $this->uploadLimit()],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request)
    {
        $input = $request->validate([
            'title' => ['required', 'string', 'max:180', 'regex:/\S/u'],
            'description' => ['nullable', 'string', 'max:2000'],
            'file' => ['required', 'file', 'mimes:pdf', 'extensions:pdf', 'max:20480'],
        ]);
        $file = $request->file('file');
        if ($file->getSize() > $this->uploadLimit() || file_get_contents($file->getRealPath(), false, null, 0, 5) !== '%PDF-') {
            throw ValidationException::withMessages(['file' => ['A PDF within the upload size limit is required.']]);
        }
        $id = (string) Str::uuid();
        // Neither ownership nor the destination path is accepted from the client.
        $path = 'personal-pdf-notes/'.$request->user()->id.'/'.$id.'.pdf';
        $name = Str::limit(preg_replace('/[\x00-\x1f\x7f]/u', '', basename(str_replace('\\', '/', $file->getClientOriginalName()))), 240, '');
        $note = [
            'id' => $id, 'user_id' => $request->user()->id,
            'title' => trim($input['title']), 'description' => trim($input['description'] ?? ''),
            'original_name' => $name ?: 'note.pdf', 'storage_path' => $path,
            'size_bytes' => $file->getSize(), 'sha256' => hash_file('sha256', $file->getRealPath()),
            'created_at' => now(), 'updated_at' => now(),
        ];
        try {
            if (! Storage::disk('local')->putFileAs(dirname($path), $file, basename($path))) abort(503, 'Could not store PDF.');
            DB::table('personal_pdf_notes')->insert($note);
        } catch (Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }
        return response()->json(['data' => $this->payload((object) $note)], 201);
    }

    public function update(Request $request, string $id)
    {
        $this->owned($request, $id);
        $input = $request->validate([
            'title' => ['required', 'string', 'max:180', 'regex:/\S/u'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);
        DB::table('personal_pdf_notes')->where('user_id', $request->user()->id)->where('id', $id)->update([
            'title' => trim($input['title']), 'description' => trim($input['description'] ?? ''), 'updated_at' => now(),
        ]);
        return response()->json(['data' => $this->payload($this->owned($request, $id))]);
    }

    public function file(Request $request, string $id)
    {
        $note = $this->owned($request, $id);
        $disk = Storage::disk('local');
        abort_unless($disk->exists($note->storage_path), 404);
        $response = response()->file($disk->path($note->storage_path), [
            'Content-Type' => 'application/pdf', 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => 'sandbox',
        ]);
        $response->setContentDisposition($request->boolean('download') ? 'attachment' : 'inline', $note->original_name);
        $response->setPrivate();
        $response->headers->set('Cache-Control', 'private, no-store');
        return $response;
    }

    public function destroy(Request $request, string $id)
    {
        $note = $this->owned($request, $id);
        $disk = Storage::disk('local');
        $staged = $note->storage_path.'.deleting-'.Str::uuid();
        $moved = false;
        try {
            DB::transaction(function () use ($request, $id, $note, $disk, $staged, &$moved) {
                DB::table('personal_pdf_notes')->where('user_id', $request->user()->id)->where('id', $id)->lockForUpdate()->firstOrFail();
                if ($disk->exists($note->storage_path)) {
                    if (! $disk->move($note->storage_path, $staged)) abort(503, 'Could not delete PDF.');
                    $moved = true;
                }
                DB::table('personal_pdf_notes')->where('user_id', $request->user()->id)->where('id', $id)->delete();
            });
        } catch (Throwable $error) {
            if ($moved) $disk->move($staged, $note->storage_path);
            throw $error;
        }
        if ($moved && ! $disk->delete($staged)) report(new \RuntimeException('Personal PDF trash cleanup failed.'));
        return response()->json(['data' => ['id' => $id]]);
    }
}
