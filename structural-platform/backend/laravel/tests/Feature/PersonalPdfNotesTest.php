<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PersonalPdfNotesTest extends TestCase
{
    use RefreshDatabase;

    private const API = '/api/v1/personal-pdf-notes';
    private const PDF = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n";

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function upload(array $extra = []): array
    {
        return $this->postJson(self::API, array_merge([
            'title' => 'Wind comparison', 'description' => 'My own reading note',
            'file' => UploadedFile::fake()->createWithContent('Ghi chú gió.pdf', self::PDF),
        ], $extra))->assertCreated()->json('data');
    }

    public function test_owner_can_upload_read_rename_download_and_delete_unchanged_pdf(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $note = $this->upload(['user_id' => 999, 'storage_path' => '../../public/evil.pdf']);
        $row = DB::table('personal_pdf_notes')->first();
        $this->assertEquals($user->id, $row->user_id);
        $this->assertStringStartsWith('personal-pdf-notes/'.$user->id.'/', $row->storage_path);
        $this->assertSame(hash('sha256', self::PDF), $note['sha256']);
        $this->assertSame(strlen(self::PDF), $note['size_bytes']);
        $this->assertArrayNotHasKey('storage_path', $note);
        $this->assertArrayNotHasKey('user_id', $note);
        Storage::disk('local')->assertExists($row->storage_path);
        $this->getJson(self::API)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Wind comparison');
        $read = $this->get($note['file_url'])->assertOk()->assertHeader('Content-Type', 'application/pdf')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('private', $read->headers->get('Cache-Control'));
        $this->assertSame(self::PDF, file_get_contents($read->baseResponse->getFile()->getPathname()));
        $download = $this->get($note['file_url'].'?download=1')->assertDownload();
        $this->assertStringContainsString(rawurlencode('Ghi chú gió.pdf'), $download->headers->get('Content-Disposition'));
        $this->patchJson(self::API.'/'.$note['id'], ['title' => 'Đổi tên', 'description' => 'Nội dung mới', 'user_id' => 999])
            ->assertOk()->assertJsonPath('data.title', 'Đổi tên')->assertJsonPath('data.sha256', $note['sha256']);
        $this->assertSame(self::PDF, Storage::disk('local')->get($row->storage_path));
        $this->deleteJson(self::API.'/'.$note['id'])->assertOk();
        $this->getJson(self::API)->assertJsonCount(0, 'data');
        $this->getJson($note['file_url'])->assertNotFound();
        Storage::disk('local')->assertMissing($row->storage_path);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_guests_cannot_list_upload_read_edit_or_delete(): void
    {
        $id = '018d3852-37ab-7000-8000-000000000001';
        $this->getJson(self::API)->assertUnauthorized();
        $this->postJson(self::API, [])->assertUnauthorized();
        $this->getJson(self::API.'/'.$id.'/file')->assertUnauthorized();
        $this->patchJson(self::API.'/'.$id, [])->assertUnauthorized();
        $this->deleteJson(self::API.'/'.$id)->assertUnauthorized();
    }

    public function test_other_users_and_admin_cannot_access_private_note_by_known_id(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner);
        $note = $this->upload();
        foreach (['user', 'admin'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $this->getJson(self::API)->assertOk()->assertJsonCount(0, 'data');
            $this->getJson($note['file_url'])->assertNotFound();
            $this->getJson($note['file_url'].'?download=1')->assertNotFound();
            $this->patchJson(self::API.'/'.$note['id'], ['title' => 'Stolen'])->assertNotFound();
            $this->deleteJson(self::API.'/'.$note['id'])->assertNotFound();
        }
        $this->actingAs($owner)->getJson(self::API)->assertJsonPath('data.0.sha256', $note['sha256']);
        $this->assertDatabaseCount('personal_pdf_notes', 1);
    }

    public function test_invalid_or_oversized_upload_and_invalid_title_leave_no_files(): void
    {
        $this->actingAs(User::factory()->create());
        foreach ([
            UploadedFile::fake()->createWithContent('fake.pdf', 'Not a PDF'),
            UploadedFile::fake()->createWithContent('note.html', self::PDF),
            UploadedFile::fake()->create('huge.pdf', 20481, 'application/pdf'),
        ] as $file) {
            $this->postJson(self::API, ['title' => 'Note', 'file' => $file])->assertUnprocessable()->assertJsonValidationErrors('file');
        }
        foreach (['', '   ', str_repeat('a', 181)] as $title) {
            $this->postJson(self::API, ['title' => $title, 'file' => UploadedFile::fake()->createWithContent('note.pdf', self::PDF)])
                ->assertUnprocessable()->assertJsonValidationErrors('title');
        }
        $this->assertDatabaseCount('personal_pdf_notes', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_failed_database_insert_cleans_up_new_file(): void
    {
        $this->actingAs(User::factory()->create());
        DB::unprepared("CREATE TRIGGER reject_pdf_insert BEFORE INSERT ON personal_pdf_notes BEGIN SELECT RAISE(ABORT, 'test failure'); END");
        $this->withoutExceptionHandling();
        try {
            $this->postJson(self::API, ['title' => 'Note', 'file' => UploadedFile::fake()->createWithContent('note.pdf', self::PDF)]);
            $this->fail('Expected database failure');
        } catch (QueryException $error) {
            $this->assertStringContainsString('test failure', $error->getMessage());
        }
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertDatabaseCount('personal_pdf_notes', 0);
    }

    public function test_failed_database_delete_restores_original_pdf(): void
    {
        $this->actingAs(User::factory()->create());
        $note = $this->upload();
        $path = DB::table('personal_pdf_notes')->first()->storage_path;
        DB::unprepared("CREATE TRIGGER reject_pdf_delete BEFORE DELETE ON personal_pdf_notes BEGIN SELECT RAISE(ABORT, 'test failure'); END");
        $this->withoutExceptionHandling();
        try {
            $this->deleteJson(self::API.'/'.$note['id']);
            $this->fail('Expected database failure');
        } catch (QueryException $error) {
            $this->assertStringContainsString('test failure', $error->getMessage());
        }
        $this->assertDatabaseCount('personal_pdf_notes', 1);
        $this->assertSame(self::PDF, Storage::disk('local')->get($path));
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }

    public function test_account_delete_retains_files_on_rollback_then_cleans_only_owner_after_commit(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner); $mine = $this->upload();
        $other = User::factory()->create();
        $this->actingAs($other); $theirs = $this->upload();
        DB::beginTransaction();
        $owner->delete();
        $this->assertCount(2, Storage::disk('local')->allFiles());
        DB::rollBack();
        $this->assertDatabaseHas('personal_pdf_notes', ['id' => $mine['id']]);
        User::findOrFail($owner->id)->delete();
        $this->assertDatabaseMissing('personal_pdf_notes', ['id' => $mine['id']]);
        $this->assertDatabaseHas('personal_pdf_notes', ['id' => $theirs['id']]);
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $this->get($theirs['file_url'])->assertOk();
    }
}
