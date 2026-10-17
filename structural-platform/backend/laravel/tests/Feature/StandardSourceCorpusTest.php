<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StandardSourceCorpusTest extends TestCase
{
    use RefreshDatabase;

    private string $bundle;
    protected function setUp(): void {
        parent::setUp(); Storage::fake('local'); $this->seed(StandardsSeeder::class);
        $this->bundle = sys_get_temp_dir().'/asce-corpus-'.bin2hex(random_bytes(8));
        mkdir($this->bundle.'/pages',0700,true);
        file_put_contents($this->bundle.'/source.pdf',"%PDF-1.5\nSynthetic test source, not a publication.");
        $pages = [];
        foreach ([1,2] as $n) {
            $image = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=');
            $path = sprintf('pages/%04d.png',$n); file_put_contents($this->bundle.'/'.$path,$image);
            $text = $n === 1 ? 'Velocity pressure q = Kz V² (27.3-1)' : 'Table 27.3-1 Exposure B C D';
            $pages[] = ['pdf_page'=>$n,'printed_label'=>(string)(259+$n),'chapter'=>'27','kind'=>'normative',
                'native_text'=>$text,'ocr_text'=>'','ocr_words_tsv'=>'','blocks'=>[],
                'numeric_tokens'=>[['raw'=>'0.613','offset'=>0,'channel'=>'native']],
                'extraction_method'=>'native','coverage_status'=>'EXTRACTED_UNVERIFIED',
                'image_path'=>$path,'image_sha256'=>hash('sha256',$image),'text_sha256'=>hash('sha256',$text),
                'items'=>[['kind'=>$n===1?'equation':'table','label'=>'27.3-1','channel'=>'native','offset'=>0,'context'=>$text]],
            ];
        }
        file_put_contents($this->bundle.'/manifest.json',json_encode([
            'schema_version'=>1,'edition_code'=>'ASCE7-10','source_sha256'=>hash_file('sha256',$this->bundle.'/source.pdf'),
            'pdf_page_count'=>2,'summary'=>['pages'=>2,'ocr_pages'=>0,'numeric_tokens'=>2,'source_occurrences'=>2],
            'clauses'=>[['code'=>'27','title'=>'Chapter 27','kind'=>'normative','pdf_page'=>1,'printed_label'=>'260']],
            'pages'=>$pages,
        ]));
    }
    protected function tearDown(): void {
        foreach (glob($this->bundle.'/pages/*') as $file) unlink($file);
        foreach (glob($this->bundle.'/*') as $file) if (is_file($file)) unlink($file);
        rmdir($this->bundle.'/pages'); rmdir($this->bundle); parent::tearDown();
    }
    private function import(): int { return Artisan::call('standards:import-corpus',['directory'=>$this->bundle]); }
    private function editManifest(callable $edit): void {
        $m=json_decode(file_get_contents($this->bundle.'/manifest.json'),true);$edit($m);
        file_put_contents($this->bundle.'/manifest.json',json_encode($m));
    }

    public function test_import_is_complete_idempotent_and_preserves_reviewed_occurrences(): void {
        $this->assertSame(0,$this->import(),Artisan::output());
        DB::table('standard_source_items')->where('kind','equation')->update(['verification_status'=>'verified']);
        $this->assertSame(0,$this->import(),Artisan::output());
        $this->assertDatabaseCount('standard_source_pages',2);$this->assertDatabaseCount('standard_source_items',2);
        $this->assertDatabaseCount('standard_documents',1);
        $this->assertDatabaseHas('standard_source_items',['kind'=>'equation','verification_status'=>'verified']);
        $this->assertDatabaseHas('standard_editions',['code'=>'ASCE7-10','status'=>'in_development']);
        $doc=DB::table('standard_documents')->first();Storage::disk('local')->assertExists($doc->private_path);
        Storage::disk('local')->assertExists($doc->corpus_path);
    }
    public function test_incomplete_page_coverage_is_rejected_without_writes(): void {
        $this->editManifest(function (&$m) {array_pop($m['pages']);});
        $this->assertSame(1,$this->import());$this->assertDatabaseCount('standard_documents',0);
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }
    public function test_corrupt_images_and_unsafe_paths_are_rejected(): void {
        $this->editManifest(function (&$m) {$m['pages'][1]['image_path']='../outside.png';});
        $this->assertSame(1,$this->import());$this->assertDatabaseCount('standard_source_pages',0);
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }
    public function test_authenticated_source_search_page_images_and_export_are_scoped_to_edition(): void {
        $this->assertSame(0,$this->import(),Artisan::output());
        $this->actingAs(User::factory()->create(['role'=>'user']));
        $id=DB::table('standard_documents')->value('id');$base='/api/v1/standards/ASCE7-10';
        $this->getJson($base.'/source-pages?q=Velocity')->assertOk()->assertJsonPath('meta.total',1);
        $this->getJson($base.'/source-items?kind=table&chapter=27')->assertOk()->assertJsonPath('meta.total',1);
        $this->getJson($base.'/source-items?kind=equation')->assertOk()->assertJsonPath('data.0.verification_status','candidate');
        $this->getJson($base.'/documents/'.$id.'/pages/1')->assertOk()->assertJsonPath('data.numeric_tokens.0.raw','0.613')
            ->assertJsonMissingPath('data.image_path');
        $this->get($base.'/documents/'.$id.'/pages/1/image')->assertOk()->assertHeader('Content-Type','image/png');
        $this->get($base.'/documents/'.$id.'/corpus')->assertOk()->assertDownload('ASCE7-10-source-corpus.json');
        $this->getJson('/api/v1/standards/AISC360-10/documents/'.$id.'/pages/1')->assertNotFound();
        $this->getJson($base.'/documents/'.$id.'/pages/3')->assertNotFound();
        $this->getJson($base.'/source-items?kind=unknown')->assertUnprocessable();
    }
    public function test_anonymous_users_cannot_access_any_corpus_route(): void {
        foreach (['source-pages','source-items','documents/1/pages/1','documents/1/pages/1/image','documents/1/corpus'] as $path) {
            $this->getJson('/api/v1/standards/ASCE7-10/'.$path)->assertUnauthorized();
            $this->get('/api/v1/standards/ASCE7-10/'.$path)->assertUnauthorized();
        }
    }
}
