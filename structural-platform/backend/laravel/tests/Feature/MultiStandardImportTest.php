<?php

namespace Tests\Feature;

use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MultiStandardImportTest extends TestCase
{
    use RefreshDatabase;

    private array $temporary = [];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
    }

    protected function tearDown(): void
    {
        foreach ($this->temporary as $file) @unlink($file);
        parent::tearDown();
    }

    private function file(string $contents): string
    {
        $file = tempnam(sys_get_temp_dir(),'standard-import-');
        $this->temporary[] = $file;
        file_put_contents($file,$contents);
        return $file;
    }

    private function manifest(string $code = 'ASCE7-16'): array
    {
        return ['edition_code'=>$code,'source_sha256'=>hash('sha256',"%PDF-1.4\nFixture"),'page_count'=>12,
            'clauses'=>[
                ['id'=>70,'code'=>'TEST','title'=>'Root','kind'=>'normative','pdf_page'=>1,'parent_id'=>null],
                ['id'=>80,'code'=>'TEST.1','title'=>'Child','kind'=>'normative','pdf_page'=>12,'parent_id'=>70],
            ],
            'equation_candidates'=>[['label'=>'1.2-3','clause_code'=>'TEST.1','pdf_page'=>12]],
        ];
    }

    private function runImport(array $manifest, bool $pdf = false): int
    {
        $json = $this->file(json_encode($manifest));
        return $pdf
            ? Artisan::call('standards:import-pdf',['pdf'=>$this->file("%PDF-1.4\nFixture"),'manifest'=>$json])
            : Artisan::call('standards:import-outline',['json'=>$json]);
    }

    public function test_general_pdf_import_is_idempotent_and_isolates_registered_editions(): void
    {
        foreach (['ASCE7-16','AISC360-22'] as $code) {
            $manifest = $this->manifest($code);
            $this->assertSame(0,$this->runImport($manifest,true),Artisan::output());
            $this->assertSame(0,$this->runImport($manifest,true),Artisan::output());
            $edition = DB::table('standard_editions')->where('code',$code)->value('id');
            $doc = DB::table('standard_documents')->where('edition_id',$edition)->first();
            $root = DB::table('standard_clauses')->where('edition_id',$edition)->where('code','TEST')->first();
            $child = DB::table('standard_clauses')->where('edition_id',$edition)->where('code','TEST.1')->first();
            $this->assertSame($root->id,$child->parent_id);
            $this->assertSame($doc->id,$child->document_id);
            $this->assertDatabaseHas('standard_equations',['clause_id'=>$child->id,'label'=>'1.2-3','verification_status'=>'candidate','latex'=>null]);
            Storage::disk('local')->assertExists($doc->private_path);
        }
        $this->assertDatabaseCount('standard_documents',2);
        $this->assertDatabaseCount('standard_equations',2);
    }

    public function test_outline_only_import_accepts_real_asce_json_without_transcription(): void
    {
        $json = base_path('../../standards/asce7-10-library.json');
        $this->assertSame(0,Artisan::call('standards:import-outline',['json'=>$json]),Artisan::output());
        $this->assertSame(0,Artisan::call('standards:import-outline',['json'=>$json]),Artisan::output());
        $edition = DB::table('standard_editions')->where('code','ASCE7-10')->value('id');
        $this->assertSame(875,DB::table('standard_clauses')->where('edition_id',$edition)->count());
        $this->assertDatabaseCount('standard_documents',0);
        $this->assertDatabaseCount('standard_equations',0);
    }

    public function test_invalid_manifests_do_not_partially_write(): void
    {
        $bad = [];
        $m = $this->manifest(); $m['edition_code']='UNREGISTERED'; $bad[]=$m;
        $m = $this->manifest(); $m['source_sha256']='invalid'; $bad[]=$m;
        $m = $this->manifest(); $m['page_count']=0; $bad[]=$m;
        $m = $this->manifest(); $m['clauses'][1]['pdf_page']=13; $bad[]=$m;
        $m = $this->manifest(); $m['clauses'][1]['parent_id']=999; $bad[]=$m;
        $m = $this->manifest(); $m['clauses'][0]['parent_id']=80; $bad[]=$m;
        $m = $this->manifest(); $m['clauses'][]=$m['clauses'][0]; $bad[]=$m;
        $m = $this->manifest(); $m['equation_candidates'][0]['clause_code']='MISSING'; $bad[]=$m;
        $m = $this->manifest(); $m['equation_candidates'][0]['pdf_page']=0; $bad[]=$m;
        $m = $this->manifest(); $m['clauses'][1]['kind']='commentary'; $bad[]=$m;
        $before = DB::table('standard_clauses')->count();
        foreach ($bad as $manifest) {
            $this->assertSame(1,$this->runImport($manifest,true),json_encode($manifest));
            $this->assertSame($before,DB::table('standard_clauses')->count());
            $this->assertDatabaseCount('standard_documents',0);
            $this->assertDatabaseCount('standard_equations',0);
            $this->assertSame([],Storage::disk('local')->allFiles());
        }
    }

    public function test_reviewed_rows_and_corpus_metadata_are_preserved(): void
    {
        $m = $this->manifest();
        $this->assertSame(0,$this->runImport($m,true),Artisan::output());
        $doc = DB::table('standard_documents')->first();
        $child = DB::table('standard_clauses')->where('document_id',$doc->id)->where('code','TEST.1')->first();
        DB::table('standard_clauses')->where('id',$child->id)->update(['title'=>'Reviewed','pdf_page'=>5,'verification_status'=>'verified']);
        DB::table('standard_equations')->where('clause_id',$child->id)->update(['latex'=>'reviewed math','pdf_page'=>5,'verification_status'=>'verified']);
        DB::table('standard_documents')->where('id',$doc->id)->update(['processing_status'=>'extracted_unverified','extraction_summary'=>'{"pages":12}']);
        $this->assertSame(0,$this->runImport($m,true),Artisan::output());
        $this->assertDatabaseHas('standard_clauses',['id'=>$child->id,'title'=>'Reviewed','pdf_page'=>5,'verification_status'=>'verified']);
        $this->assertDatabaseHas('standard_equations',['clause_id'=>$child->id,'latex'=>'reviewed math','pdf_page'=>5,'verification_status'=>'verified']);
        $this->assertDatabaseHas('standard_documents',['id'=>$doc->id,'processing_status'=>'extracted_unverified','extraction_summary'=>'{"pages":12}']);
    }

    public function test_different_artifact_conflict_rolls_back_new_doc_file_and_partial_outline(): void
    {
        $m = $this->manifest();
        $this->assertSame(0,$this->runImport($m,true),Artisan::output());
        $files = Storage::disk('local')->allFiles();
        $before = DB::table('standard_clauses')->count();
        $m['source_sha256']=hash('sha256',"%PDF-1.4\nOther source");
        array_unshift($m['clauses'],['id'=>5,'code'=>'NEW','title'=>'Must roll back','kind'=>'normative','pdf_page'=>1,'parent_id'=>null]);
        $this->assertSame(1,Artisan::call('standards:import-pdf',[
            'pdf'=>$this->file("%PDF-1.4\nOther source"),'manifest'=>$this->file(json_encode($m)),
        ]));
        $this->assertSame($before,DB::table('standard_clauses')->count());
        $this->assertDatabaseCount('standard_documents',1);
        $this->assertSame($files,Storage::disk('local')->allFiles());
    }

    public function test_corrupt_existing_archive_is_not_overwritten(): void
    {
        $m = $this->manifest();
        $this->assertSame(0,$this->runImport($m,true),Artisan::output());
        $doc = DB::table('standard_documents')->first();
        Storage::disk('local')->put($doc->private_path,'corrupt');
        $this->assertSame(1,$this->runImport($m,true));
        $this->assertSame('corrupt',Storage::disk('local')->get($doc->private_path));
        $this->assertDatabaseCount('standard_documents',1);
    }
    public function test_legacy_bookmarks_and_late_pdf_binding_preserve_printed_pages(): void
    {
        $m = $this->manifest('AISC360-16');
        unset($m['clauses'],$m['page_count']);
        $m['pdf_page_count'] = 12;
        $m['bookmarks'] = [
            ['code'=>'TEST.1','title'=>'Child','kind'=>'normative','pdf_page'=>12,'parent_code'=>'TEST'],
            ['code'=>'TEST','title'=>'Root','kind'=>'normative','pdf_page'=>1],
        ];
        $m['equation_candidates'][0]['latex'] = 'not approved';
        $m['equation_candidates'][0]['verification_status'] = 'verified';
        $this->assertSame(0,$this->runImport($m),Artisan::output());
        $edition = DB::table('standard_editions')->where('code','AISC360-16')->value('id');
        $child = DB::table('standard_clauses')->where('edition_id',$edition)->where('code','TEST.1')->first();
        $this->assertNull($child->document_id);
        DB::table('standard_clauses')->where('id',$child->id)->update(['printed_page'=>7]);
        $this->assertSame(0,$this->runImport($m,true),Artisan::output());
        $doc = DB::table('standard_documents')->first();
        $this->assertDatabaseHas('standard_clauses',['id'=>$child->id,'document_id'=>$doc->id,'printed_page'=>7]);
        $this->assertDatabaseHas('standard_equations',['clause_id'=>$child->id,'verification_status'=>'candidate','latex'=>null]);
    }

    public function test_existing_source_page_count_conflict_is_rejected(): void
    {
        $m = $this->manifest();
        $this->assertSame(0,$this->runImport($m,true),Artisan::output());
        $m['page_count'] = 13;
        $this->assertSame(1,$this->runImport($m,true));
        $this->assertDatabaseHas('standard_documents',['page_count'=>12]);
        $this->assertDatabaseCount('standard_documents',1);
    }
}
