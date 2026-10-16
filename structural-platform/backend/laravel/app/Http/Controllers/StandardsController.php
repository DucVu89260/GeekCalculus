<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class StandardsController extends Controller
{
    public function index(): JsonResponse
    {
        $families = DB::table('standard_families')->orderBy('code')->get();
        $editionRows = DB::table('standard_editions')->orderBy('year')->get(['id', 'family_id', 'code', 'year', 'title', 'status']);
        $byFamily = $editionRows->groupBy('family_id');
        $families->each(function ($family) use ($byFamily) {
            $family->editions = $byFamily->get($family->id, collect())->values();
        });

        return response()->json(['data' => $families]);
    }

    public function show(string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $result = $this->remember($edition, 'show', [], function () use ($edition) {
            $clauses = DB::table('standard_clauses')->where('edition_id', $edition->id)
                ->orderByRaw('COALESCE(printed_page, 999999)')->orderBy('code')->orderBy('source_context')
                ->get()->map(fn ($row) => $this->clausePayload($row))->all();
            $documents = DB::table('standard_documents')->where('edition_id', $edition->id)
                ->orderBy('id')->get()->map(fn ($row) => $this->documentPayload($row))->all();
            $coverage = [
                'clauses' => count($clauses),
                'equations' => DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')->where('c.edition_id', $edition->id)->count(),
                'parameters' => DB::table('standard_parameters')->where('edition_id', $edition->id)->count(),
                'tables' => DB::table('standard_tables')->where('edition_id', $edition->id)->count(),
                'verified_equations' => DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')->where('c.edition_id', $edition->id)->whereIn('e.verification_status', ['verified', 'published'])->count(),
            ];

            return ['data' => ['edition' => $edition, 'clauses' => $clauses, 'documents' => $documents, 'coverage' => $coverage]];
        });

        return response()->json($result);
    }

    public function clauses(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $filters = $this->filters($request);
        $query = DB::table('standard_clauses')->where('edition_id', $edition->id);
        if ($filters['kind']) {
            $query->where('kind', $filters['kind']);
        }
        if ($filters['status']) {
            $query->where('verification_status', $filters['status']);
        }
        if ($filters['document_id']) {
            $query->where('document_id', $filters['document_id']);
        }
        if ($filters['q'] !== '') {
            $needle = '%'.mb_strtolower($filters['q']).'%';
            $query->where(function ($builder) use ($needle) {
                $builder->whereRaw('LOWER(code) LIKE ?', [$needle])->orWhereRaw('LOWER(title) LIKE ?', [$needle]);
            });
        }
        $query->orderByRaw('COALESCE(printed_page, 999999)')->orderBy('code')->orderBy('source_context');

        return $this->page($edition, 'clauses', $filters, $query, fn ($row) => $this->clausePayload($row));
    }

    public function equations(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $filters = $this->filters($request);
        $query = DB::table('standard_equations as e')
            ->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
            ->where('c.edition_id', $edition->id)
            ->select(['e.*', 'c.code as clause_code', 'c.kind', 'c.document_id as clause_document_id', 'c.source_sha256 as clause_source_sha256', 'c.printed_page_label as clause_printed_page_label']);
        if ($filters['kind']) {
            $query->where('c.kind', $filters['kind']);
        }
        if ($filters['status']) {
            $query->where('e.verification_status', $filters['status']);
        }
        if ($filters['document_id']) {
            $query->where(function ($builder) use ($filters) {
                $builder->where('e.document_id', $filters['document_id'])->orWhere('c.document_id', $filters['document_id']);
            });
        }
        if ($filters['clause_id']) {
            $query->where('e.clause_id', $filters['clause_id']);
        }
        if ($filters['q'] !== '') {
            $needle = '%'.mb_strtolower($filters['q']).'%';
            $query->where(function ($builder) use ($needle) {
                $builder->whereRaw('LOWER(e.label) LIKE ?', [$needle])->orWhereRaw('LOWER(c.code) LIKE ?', [$needle]);
            });
        }
        $query->orderBy('c.code')->orderBy('e.label')->orderBy('e.source_context');

        return $this->page($edition, 'equations', $filters + ['clause_id' => $request->input('clause_id')], $query, fn ($row) => $this->equationPayload($row));
    }

    public function parameters(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $filters = $this->filters($request);
        $query = DB::table('standard_parameters as p')->leftJoin('standard_clauses as c', 'c.id', '=', 'p.clause_id')
            ->where('p.edition_id', $edition->id)
            ->select(['p.*', 'c.code as clause_code']);
        if ($filters['kind']) {
            $query->where('p.kind', $filters['kind']);
        }
        if ($filters['data_type']) {
            $query->where('p.data_type', $filters['data_type']);
        }
        if ($filters['status']) {
            $query->where('p.verification_status', $filters['status']);
        }
        if ($filters['document_id']) {
            $query->where('p.document_id', $filters['document_id']);
        }
        if ($filters['q'] !== '') {
            $needle = '%'.mb_strtolower($filters['q']).'%';
            $query->where(function ($builder) use ($needle) {
                $builder->whereRaw('LOWER(p.parameter_key) LIKE ?', [$needle])->orWhereRaw('LOWER(p.label) LIKE ?', [$needle]);
            });
        }
        $query->orderBy('p.parameter_key')->orderBy('p.source_context');

        return $this->page($edition, 'parameters', $filters, $query, fn ($row) => $this->parameterPayload($row));
    }

    public function tables(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $filters = $this->filters($request);
        $query = DB::table('standard_tables as t')->leftJoin('standard_clauses as c', 'c.id', '=', 't.clause_id')
            ->where('t.edition_id', $edition->id)
            ->select(['t.*', 'c.code as clause_code']);
        if ($filters['kind']) {
            $query->where('t.kind', $filters['kind']);
        }
        if ($filters['status']) {
            $query->where('t.verification_status', $filters['status']);
        }
        if ($filters['document_id']) {
            $query->where('t.document_id', $filters['document_id']);
        }
        if ($filters['q'] !== '') {
            $needle = '%'.mb_strtolower($filters['q']).'%';
            $query->where(function ($builder) use ($needle) {
                $builder->whereRaw('LOWER(t.table_code) LIKE ?', [$needle])->orWhereRaw('LOWER(t.title) LIKE ?', [$needle]);
            });
        }
        $query->orderBy('t.table_code')->orderBy('t.source_context');

        return $this->page($edition, 'tables', $filters, $query, fn ($row) => $this->tablePayload($row));
    }

    public function search(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $data = Validator::make($request->query(), ['q' => ['required', 'string', 'min:1', 'max:200']])->validate();
        $filters = $this->filters($request);
        $filters['q'] = trim($data['q']);
        $needle = '%'.mb_strtolower($filters['q']).'%';

        $clauses = DB::table('standard_clauses')->where('edition_id', $edition->id)
            ->where(function ($query) use ($needle) { $query->whereRaw('LOWER(code) LIKE ?', [$needle])->orWhereRaw('LOWER(title) LIKE ?', [$needle]); })
            ->selectRaw("'clause' as record_type, id, code, title, kind, verification_status, pdf_page, printed_page_label, document_id, source_sha256, source_anchor, NULL as clause_code, NULL as implementation_key, NULL as data_type");
        $equations = DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
            ->where('c.edition_id', $edition->id)
            ->where(function ($query) use ($needle) { $query->whereRaw('LOWER(e.label) LIKE ?', [$needle])->orWhereRaw('LOWER(c.code) LIKE ?', [$needle]); })
            ->selectRaw("'equation' as record_type, e.id, e.label as code, e.label as title, c.kind, e.verification_status, e.pdf_page, e.printed_page_label, e.document_id, e.source_sha256, e.source_anchor, c.code as clause_code, e.implementation_key, NULL as data_type");
        $parameters = DB::table('standard_parameters as p')->leftJoin('standard_clauses as c', 'c.id', '=', 'p.clause_id')
            ->where('p.edition_id', $edition->id)
            ->where(function ($query) use ($needle) { $query->whereRaw('LOWER(p.parameter_key) LIKE ?', [$needle])->orWhereRaw('LOWER(p.label) LIKE ?', [$needle]); })
            ->selectRaw("'parameter' as record_type, p.id, p.parameter_key as code, COALESCE(p.label, p.parameter_key) as title, p.kind, p.verification_status, p.pdf_page, p.printed_page_label, p.document_id, p.source_sha256, p.source_anchor, c.code as clause_code, p.implementation_key, p.data_type");
        $tables = DB::table('standard_tables as t')->leftJoin('standard_clauses as c', 'c.id', '=', 't.clause_id')
            ->where('t.edition_id', $edition->id)
            ->where(function ($query) use ($needle) { $query->whereRaw('LOWER(t.table_code) LIKE ?', [$needle])->orWhereRaw('LOWER(t.title) LIKE ?', [$needle]); })
            ->selectRaw("'table' as record_type, t.id, t.table_code as code, COALESCE(t.title, t.table_code) as title, t.kind, t.verification_status, t.pdf_page, t.printed_page_label, t.document_id, t.source_sha256, t.source_anchor, c.code as clause_code, t.implementation_key, NULL as data_type");

        $union = $clauses->unionAll($equations)->unionAll($parameters)->unionAll($tables);
        $query = DB::query()->fromSub($union, 'standards_search')->orderBy('record_type')->orderBy('code');
        if ($filters['kind']) {
            $query->where('kind', $filters['kind']);
        }
        if ($filters['data_type']) {
            $query->where('data_type', $filters['data_type']);
        }
        if ($filters['status']) {
            $query->where('verification_status', $filters['status']);
        }
        if ($filters['document_id']) {
            $query->where('document_id', $filters['document_id']);
        }

        return $this->page($edition, 'search', $filters, $query, fn ($row) => $this->searchPayload($row));
    }

    public function approvedRules(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $data = Validator::make($request->query(), [
            'implementation_key' => ['required_without_all:parameter_key,equation_id', 'string', 'max:160'],
            'parameter_key' => ['required_without_all:implementation_key,equation_id', 'string', 'max:160'],
            'equation_id' => ['nullable', 'integer', 'min:1'],
            'method' => ['nullable', 'in:ASD,LRFD'],
            'clause_code' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $filters = [
            'implementation_key' => $data['implementation_key'] ?? null,
            'parameter_key' => $data['parameter_key'] ?? null,
            'equation_id' => isset($data['equation_id']) ? (int) $data['equation_id'] : null,
            'method' => $data['method'] ?? null,
            'clause_code' => $data['clause_code'] ?? null,
            'page' => (int) ($data['page'] ?? 1),
            'per_page' => (int) ($data['per_page'] ?? 50),
        ];
        $result = $this->remember($edition, 'approved-rules', $filters, function () use ($edition, $filters) {
            $editionPayload = [
                'family_code' => DB::table('standard_families')->where('id', $edition->family_id)->value('code'),
                'code' => $edition->code,
                'year' => (int) $edition->year,
                'title' => $edition->title,
            ];
            $key = $filters['implementation_key'];
            $method = $filters['method'];
            $clauses = $filters['clause_code'];
            $equationRows = [];
            if ($key || $filters['equation_id']) {
                $equations = DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
                    ->leftJoin('standard_documents as d', 'd.id', '=', 'e.document_id')
                    ->where('c.edition_id', $edition->id)->whereIn('e.verification_status', ['verified', 'published']);
                if ($key) { $equations->where('e.implementation_key', $key); }
                if ($filters['equation_id']) { $equations->where('e.id', $filters['equation_id']); }
                if ($method) { $equations->whereIn('e.design_method', [$method, 'both']); }
                if ($clauses) { $equations->where('c.code', $clauses); }
                $equationRows = $equations->get(['e.*', 'c.code as clause_code', 'c.kind', 'd.revision as source_revision', 'd.kind as source_document_kind'])
                    ->map(fn ($row) => $this->approvedPayload('equation', $row, $editionPayload))->all();
            }

            $parameterRows = [];
            if ($key || $filters['parameter_key']) {
                $parameters = DB::table('standard_parameters as p')->leftJoin('standard_clauses as c', 'c.id', '=', 'p.clause_id')
                    ->leftJoin('standard_documents as d', 'd.id', '=', 'p.document_id')
                    ->where('p.edition_id', $edition->id)->whereIn('p.verification_status', ['verified', 'published']);
                if ($key) { $parameters->where('p.implementation_key', $key); }
                if ($filters['parameter_key']) { $parameters->where('p.parameter_key', $filters['parameter_key']); }
                if ($method) { $parameters->whereIn('p.design_method', [$method, 'both']); }
                if ($clauses) { $parameters->where('c.code', $clauses); }
                $parameterRows = $parameters->get(['p.*', 'c.code as clause_code', 'd.revision as source_revision', 'd.kind as source_document_kind'])
                    ->map(fn ($row) => $this->approvedPayload('parameter', $row, $editionPayload))->all();
            }
            $all = array_merge($equationRows, $parameterRows);
            $page = $filters['page'];
            $perPage = $filters['per_page'];
            $offset = ($page - 1) * $perPage;
            $count = count($all);

            return [
                'data' => array_slice($all, $offset, $perPage),
                'meta' => ['current_page' => $page, 'per_page' => $perPage, 'total' => $count, 'last_page' => max(1, (int) ceil($count / $perPage))],
                'edition' => $editionPayload,
            ];
        });

        return response()->json($result);
    }

    public function notes(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $data = Validator::make($request->query(), ['clause_id' => ['required', 'integer', 'min:1']])->validate();
        $clauseId = (int) $data['clause_id'];
        abort_unless(DB::table('standard_clauses')->where('edition_id', $edition->id)->where('id', $clauseId)->exists(), 404);
        $notes = DB::table('standard_notes')->where('clause_id', $clauseId)->where('user_id', $request->user()->id)
            ->where('kind', 'personal_note')->orderBy('updated_at', 'desc')->get(['id', 'clause_id', 'body', 'review_status', 'created_at', 'updated_at']);

        return response()->json(['data' => $notes]);
    }

    public function createNote(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $data = Validator::make($request->all(), [
            'clause_id' => ['required', 'integer', 'min:1'],
            'body' => ['required', 'string', 'max:20000'],
        ])->validate();
        $clause = DB::table('standard_clauses')->where('edition_id', $edition->id)->where('id', $data['clause_id'])->first();
        abort_unless($clause, 404);
        $now = now();
        $id = DB::table('standard_notes')->insertGetId([
            'clause_id' => $clause->id,
            'user_id' => $request->user()->id,
            'kind' => 'personal_note',
            'body' => $data['body'],
            'review_status' => 'draft',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['data' => DB::table('standard_notes')->where('id', $id)->first()], 201);
    }

    public function document(Request $request, string $code, int $id)
    {
        $edition = $this->edition($code);
        $doc = DB::table('standard_documents')->where('id', $id)->where('edition_id', $edition->id)->first();
        abort_unless($doc, 404);
        $diskName = (string) config('standards.private_disk', 'local');
        $disk = Storage::disk($diskName);
        abort_unless($disk->exists($doc->private_path), 404);
        $headers = [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition' => 'inline; filename="'.$this->safeFilename($doc->original_name).'"',
        ];
        if (config('filesystems.disks.'.$diskName.'.driver') === 'local') {
            $response = response()->file($disk->path($doc->private_path), $headers);
            $response->setPrivate();
            $response->headers->set('Cache-Control', 'private, no-store');
            return $response;
        }

        return response()->stream(function () use ($disk, $doc) {
            $stream = $disk->readStream($doc->private_path);
            abort_unless(is_resource($stream), 404);
            fpassthru($stream);
            fclose($stream);
        }, 200, $headers);
    }

    public function upload(Request $request, string $code): JsonResponse
    {
        $edition = $this->edition($code);
        $allowedKinds = config('standards.editions.'.$code.'.document_types', ['specification', 'commentary', 'errata', 'manual']);
        $data = Validator::make($request->all(), [
            'file' => ['required', 'file', 'mimes:pdf', 'max:102400'],
            'kind' => ['required', 'in:'.implode(',', $allowedKinds)],
            'revision' => ['nullable', 'string', 'max:100'],
        ])->validate();
        $file = $data['file'];
        $sourcePath = $file->getRealPath();
        $stream = fopen($sourcePath, 'rb');
        $signature = is_resource($stream) ? fread($stream, 5) : false;
        if (is_resource($stream)) { fclose($stream); }
        if ($signature !== '%PDF-') {
            throw ValidationException::withMessages(['file' => 'The uploaded source must begin with a PDF signature.']);
        }

        $hash = hash_file('sha256', $sourcePath);
        $existing = DB::table('standard_documents')->where('edition_id', $edition->id)->where('sha256', $hash)->first();
        if ($existing) {
            return response()->json(['message' => 'This source document is already registered.', 'data' => $this->documentPayload($existing)], 409);
        }

        $disk = Storage::disk((string) config('standards.private_disk', 'local'));
        $relative = 'standards/'.$code.'/'.$hash.'.pdf';
        $createdFile = false;
        if ($disk->exists($relative)) {
            if (!hash_equals($hash, $this->hashStream($disk->readStream($relative)))) {
                abort(409, 'A private file at the source hash path has different contents.');
            }
        } else {
            $source = fopen($sourcePath, 'rb');
            if (!is_resource($source)) {
                throw new \RuntimeException('Unable to read uploaded source PDF.');
            }
            try {
                if (!$disk->put($relative, $source)) {
                    throw new \RuntimeException('Unable to store uploaded PDF in private storage.');
                }
                $createdFile = true;
            } catch (\Throwable $exception) {
                $disk->delete($relative);
                throw $exception;
            } finally {
                fclose($source);
            }
            if (!hash_equals($hash, $this->hashStream($disk->readStream($relative)))) {
                $disk->delete($relative);
                throw new \RuntimeException('Stored uploaded PDF failed its SHA-256 check.');
            }
        }

        try {
            $id = DB::transaction(fn () => DB::table('standard_documents')->insertGetId([
                'edition_id' => $edition->id,
                'kind' => $data['kind'],
                'original_name' => $file->getClientOriginalName(),
                'private_path' => $relative,
                'sha256' => $hash,
                'page_count' => null,
                'processing_status' => 'pending',
                'revision' => $data['revision'] ?? null,
                'verification_status' => 'candidate',
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        } catch (\Throwable $exception) {
            if ($createdFile) { $disk->delete($relative); }
            throw $exception;
        }

        app(\App\Services\Standards\StandardsRegistryCache::class)->invalidate((int) $edition->id);

        return response()->json(['data' => $this->documentPayload(DB::table('standard_documents')->where('id', $id)->first())], 201);
    }

    private function edition(string $code): object
    {
        $edition = DB::table('standard_editions')->where('code', $code)->first();
        abort_unless($edition, 404);
        return $edition;
    }

    /** @return array{q:string,kind:?string,status:?string,document_id:?int,page:int,per_page:int} */
    private function filters(Request $request): array
    {
        $data = Validator::make($request->query(), [
            'q' => ['nullable', 'string', 'max:200'],
            'kind' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', 'string', 'max:30'],
            'document_id' => ['nullable', 'integer', 'min:1'],
            'clause_id' => ['nullable', 'integer', 'min:1'],
            'data_type' => ['nullable', 'string', 'max:40'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ])->validate();

        return [
            'q' => trim((string) ($data['q'] ?? '')),
            'kind' => $data['kind'] ?? null,
            'status' => $data['status'] ?? null,
            'document_id' => isset($data['document_id']) ? (int) $data['document_id'] : null,
            'clause_id' => isset($data['clause_id']) ? (int) $data['clause_id'] : null,
            'data_type' => $data['data_type'] ?? null,
            'page' => (int) ($data['page'] ?? 1),
            'per_page' => (int) ($data['per_page'] ?? 50),
        ];
    }

    private function page(object $edition, string $resource, array $filters, $query, Closure $transform): JsonResponse
    {
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 50);
        $result = $this->remember($edition, $resource, $filters, function () use ($query, $transform, $page, $perPage) {
            /** @var LengthAwarePaginator $paginator */
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            return [
                'data' => collect($paginator->items())->map($transform)->values()->all(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => max(1, $paginator->lastPage()),
                ],
            ];
        });

        return response()->json($result);
    }

    private function remember(object $edition, string $resource, array $filters, Closure $callback): array
    {
        $version = app(\App\Services\Standards\StandardsRegistryCache::class)->version((int) $edition->id);
        $cacheKey = 'standards:registry:'.$edition->id.':'.$version.':'.$resource.':'.hash('sha256', json_encode($filters, JSON_THROW_ON_ERROR));

        return Cache::remember($cacheKey, now()->addSeconds(max(1, (int) config('standards.response_cache_seconds', 60))), $callback);
    }

    private function clausePayload(object $row): array
    {
        $payload = (array) $row;
        if (array_key_exists('source_anchor', $payload)) { $payload['source_anchor'] = $this->decode($payload['source_anchor']); }
        $payload['printed_page_label'] = $payload['printed_page_label'] ?? null;
        $payload['printed_page'] = $payload['printed_page_label'] ?? (isset($payload['printed_page']) ? (string) $payload['printed_page'] : null);
        return $payload;
    }

    private function documentPayload(object $row): array
    {
        $payload = (array) $row;
        foreach (['metadata', 'source_identity', 'import_report'] as $field) {
            if (array_key_exists($field, $payload)) { $payload[$field] = $this->decode($payload[$field]); }
        }
        unset($payload['private_path']);
        return $payload;
    }

    private function searchPayload(object $row): array
    {
        $payload = (array) $row;
        if (array_key_exists('source_anchor', $payload)) {
            $payload['source_anchor'] = $this->decode($payload['source_anchor']);
        }
        $payload['printed_page'] = $payload['printed_page_label'] ?? null;
        return $payload;
    }

    private function equationPayload(object $row): array
    {
        $payload = (array) $row;
        $payload['document_id'] = $payload['document_id'] ?? $payload['clause_document_id'] ?? null;
        $payload['source_sha256'] = $payload['source_sha256'] ?? $payload['clause_source_sha256'] ?? null;
        $payload['printed_page'] = $payload['printed_page_label'] ?? $payload['clause_printed_page_label'] ?? null;
        foreach (['variables', 'conditions'] as $field) {
            if (array_key_exists($field, $payload)) { $payload[$field] = $this->decode($payload[$field]); }
        }
        foreach (['dependencies', 'source_metadata'] as $field) {
            if (array_key_exists($field, $payload)) { $payload[$field] = $this->decode($payload[$field]); }
        }
        if (array_key_exists('source_anchor', $payload)) { $payload['source_anchor'] = $this->decode($payload['source_anchor']); }
        $payload['design_methods'] = match ($payload['design_method'] ?? null) {
            'ASD' => ['ASD'],
            'LRFD' => ['LRFD'],
            'both' => ['ASD', 'LRFD'],
            default => [],
        };
        unset($payload['clause_document_id'], $payload['clause_source_sha256'], $payload['clause_printed_page_label']);
        return $payload;
    }

    private function parameterPayload(object $row): array
    {
        $payload = (array) $row;
        $payload['printed_page'] = $payload['printed_page_label'] ?? null;
        $payload['document_id'] = $payload['document_id'] ?? $payload['clause_document_id'] ?? null;
        $payload['source_sha256'] = $payload['source_sha256'] ?? $payload['clause_source_sha256'] ?? null;
        foreach (['value', 'dimensions', 'conditions', 'source_anchor', 'source_metadata'] as $field) {
            if (array_key_exists($field, $payload)) { $payload[$field] = $this->decode($payload[$field]); }
        }
        unset($payload['clause_document_id'], $payload['clause_source_sha256']);
        return $payload;
    }

    private function tablePayload(object $row): array
    {
        $payload = (array) $row;
        $payload['printed_page'] = $payload['printed_page_label'] ?? null;
        foreach (['columns', 'rows', 'footnotes', 'applicability', 'merged_cells', 'coverage', 'design_methods', 'source_anchor', 'source_metadata'] as $field) {
            if (array_key_exists($field, $payload)) { $payload[$field] = $this->decode($payload[$field]); }
        }
        return $payload;
    }

    private function approvedPayload(string $type, object $row, array $edition): array
    {
        $payload = $type === 'equation' ? $this->equationPayload($row) : $this->parameterPayload($row);
        return [
            'record_type' => $type,
            'edition' => $edition,
            'id' => $payload['id'],
            'key' => $type === 'equation' ? $payload['implementation_key'] : $payload['parameter_key'],
            'implementation_key' => $payload['implementation_key'],
            'verification_status' => $payload['verification_status'],
            'record_version' => $payload['record_version'] ?? 1,
            'design_method' => $payload['design_method'] ?? null,
            'clause_code' => $payload['clause_code'] ?? null,
            'pdf_page' => $payload['pdf_page'] ?? null,
            'printed_page' => $payload['printed_page'] ?? $payload['printed_page_label'] ?? null,
            'source' => [
                'document_id' => $payload['document_id'] ?? null,
                'sha256' => $payload['source_sha256'] ?? null,
                'revision' => $payload['source_revision'] ?? null,
                'document_kind' => $payload['source_document_kind'] ?? null,
                'anchor' => $payload['source_anchor'] ?? null,
                'extraction_method' => $payload['extraction_method'] ?? null,
            ],
            'content' => $type === 'equation'
                ? ['label' => $payload['label'], 'latex' => $payload['latex'], 'variables' => $payload['variables'], 'conditions' => $payload['conditions']]
                : ['parameter_key' => $payload['parameter_key'], 'data_type' => $payload['data_type'], 'value' => $payload['value'], 'units' => $payload['units'], 'conditions' => $payload['conditions']],
        ];
    }

    private function decode(mixed $value): mixed
    {
        if (!is_string($value)) { return $value; }
        try { return json_decode($value, true, 512, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { return $value; }
    }

    private function safeFilename(string $filename): string
    {
        $name = basename(str_replace(["\r", "\n", "\\", '"'], '', $filename));
        return $name !== '' ? $name : 'standard.pdf';
    }

    /** @param resource|false $stream */
    private function hashStream($stream): string
    {
        if (!is_resource($stream)) { throw new \RuntimeException('Unable to read private file.'); }
        $context = hash_init('sha256');
        hash_update_stream($context, $stream);
        fclose($stream);
        return hash_final($context);
    }
}
