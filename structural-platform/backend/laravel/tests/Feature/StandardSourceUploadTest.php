<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StandardSourceUploadTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/standards/AISC360-10/documents';
    // A signature fixture for the upload boundary, not a real standard or parsed PDF.
    private const BYTES = "%PDF-1.4\n% Synthetic upload test; not engineering evidence.\n%%EOF\n";

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
    }

    private function payload(): array
    {
        return ['file' => UploadedFile::fake()->createWithContent('AISC-360-10.pdf', self::BYTES),
            'kind' => 'combined', 'revision' => 'Synthetic test revision'];
    }

    public function test_guest_and_ordinary_user_cannot_upload_sources(): void
    {
        $this->postJson(self::URL, $this->payload())->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'user']))
            ->postJson(self::URL, $this->payload())->assertForbidden();
        $this->assertDatabaseCount('standard_documents', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_upload_is_private_hash_addressed_and_does_not_approve_any_equations(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        // Warm the edition cache before upload to exercise invalidation.
        $this->getJson('/api/v1/standards/AISC360-10')->assertOk()->assertJsonCount(0, 'data.documents');
        $response = $this->postJson(self::URL, $this->payload())->assertCreated()
            ->assertJsonPath('data.sha256', hash('sha256', self::BYTES))
            ->assertJsonPath('data.processing_status', 'pending')
            ->assertJsonPath('data.verification_status', 'candidate')
            ->assertJsonPath('data.page_count', null)
            ->assertJsonMissingPath('data.private_path');
        $id = $response->json('data.id');
        $path = 'standards/AISC360-10/'.hash('sha256', self::BYTES).'.pdf';
        Storage::disk('local')->assertExists($path);
        $this->assertSame(self::BYTES, Storage::disk('local')->get($path));
        $this->getJson('/api/v1/standards/AISC360-10')->assertOk()
            ->assertJsonPath('data.documents.0.id', $id);
        $this->getJson('/api/v1/standards/AISC360-10/rules?implementation_key=E3-1')->assertOk()->assertJsonPath('data', []);
        $this->assertDatabaseCount('standard_equations', 0);
        $this->assertDatabaseCount('standard_review_history', 0);
        $this->get('/api/v1/standards/AISC360-10/documents/'.$id.'/file')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson('/api/v1/standards/AISC360-16/documents/'.$id.'/file')->assertNotFound();
    }

    public function test_duplicate_returns_the_existing_source_without_overwriting_its_metadata(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $id = $this->postJson(self::URL, $this->payload())->assertCreated()->json('data.id');
        DB::table('standard_documents')->where('id', $id)->update(['verification_status' => 'needs_review']);
        $payload = $this->payload();
        $payload['revision'] = 'Different revision must not overwrite';
        $payload['kind'] = 'specification';
        $this->postJson(self::URL, $payload)->assertConflict()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.kind', 'combined')
            ->assertJsonPath('data.revision', 'Synthetic test revision')
            ->assertJsonPath('data.verification_status', 'needs_review')
            ->assertJsonMissingPath('data.private_path');
        $this->assertDatabaseCount('standard_documents', 1);
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }

    public function test_invalid_type_signature_and_oversize_uploads_leave_no_records_or_files(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->postJson(self::URL, ['file' => UploadedFile::fake()->createWithContent('wrong.pdf', 'not a PDF'), 'kind' => 'specification'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $payload = $this->payload();
        $payload['kind'] = 'executable';
        $this->postJson(self::URL, $payload)->assertUnprocessable()->assertJsonValidationErrors('kind');
        $this->postJson(self::URL, ['file' => UploadedFile::fake()->create('large.pdf', 102401, 'application/pdf'), 'kind' => 'specification'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->assertDatabaseCount('standard_documents', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_edition_reports_actual_runtime_upload_limits_and_allowed_document_types(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $response = $this->getJson('/api/v1/standards/AISC360-10')->assertOk();
        $limit = $response->json('data.upload.max_bytes');
        $this->assertGreaterThan(0, $limit);
        $this->assertLessThanOrEqual(100 * 1024 * 1024, $limit);
        foreach (['upload_max_filesize', 'post_max_size'] as $setting) {
            $value = ini_parse_quantity((string) ini_get($setting));
            if ($value > 0) { $this->assertLessThanOrEqual($value, $limit); }
        }
        $response->assertJsonPath('data.upload.document_types', ['specification', 'commentary', 'combined', 'errata', 'manual']);
    }
}
