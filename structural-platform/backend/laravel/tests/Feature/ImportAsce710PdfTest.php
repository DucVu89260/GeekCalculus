<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImportAsce710PdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_pdf_outline_import_is_idempotent_private_and_preserves_reviewed_content(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        $pdf = base_path('../../frontend/vue/public/standards/asce7-10.pdf');
        $args = ['pdf'=>$pdf];
        $this->assertSame(0, Artisan::call('standards:import-asce710-pdf', $args), Artisan::output());
        $edition = DB::table('standard_editions')->where('code','ASCE7-10')->value('id');
        $doc = DB::table('standard_documents')->where('edition_id',$edition)->first();
        $this->assertSame(658, $doc->page_count);
        $this->assertSame(hash_file('sha256',$pdf), hash_file('sha256',Storage::disk('local')->path($doc->private_path)));
        $this->assertSame(875, DB::table('standard_clauses')->where('edition_id',$edition)->count());
        $this->assertSame(0, DB::table('standard_equations')->count());
        $this->assertSame(0, DB::table('standard_source_pages')->count());
        $clause = DB::table('standard_clauses')->where('edition_id',$edition)->where('code','27')->first();
        $this->assertSame($doc->id,$clause->document_id);
        DB::table('standard_clauses')->where('id',$clause->id)->update(['title'=>'Reviewed heading','verification_status'=>'verified','pdf_page'=>306]);
        DB::table('standard_documents')->where('id',$doc->id)->update(['processing_status'=>'extracted_unverified','extraction_summary'=>'{"pages":658}']);
        $this->assertSame(0, Artisan::call('standards:import-asce710-pdf', $args), Artisan::output());
        $this->assertDatabaseCount('standard_documents',1);
        $this->assertDatabaseHas('standard_clauses',['id'=>$clause->id,'title'=>'Reviewed heading','verification_status'=>'verified','pdf_page'=>306]);
        $this->assertDatabaseHas('standard_documents',['id'=>$doc->id,'processing_status'=>'extracted_unverified','extraction_summary'=>'{"pages":658}']);
        $this->get('/api/v1/standards/ASCE7-10/documents/'.$doc->id.'/file',['Accept'=>'application/json'])->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role'=>'user']));
        $this->get('/api/v1/standards/ASCE7-10/documents/'.$doc->id.'/file')->assertOk()->assertHeader('Content-Type','application/pdf');
        $this->get('/api/v1/standards/AISC360-10/documents/'.$doc->id.'/file')->assertNotFound();
    }

    public function test_wrong_source_is_rejected_without_writes(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        $pdf = tempnam(sys_get_temp_dir(),'asce-invalid-');
        file_put_contents($pdf,"%PDF-1.4\nUnrelated source");
        try {
            $this->assertSame(1, Artisan::call('standards:import-asce710-pdf',['pdf'=>$pdf]));
            $this->assertDatabaseCount('standard_documents',0);
            $this->assertSame([],Storage::disk('local')->allFiles());
        } finally { unlink($pdf); }
    }
}
