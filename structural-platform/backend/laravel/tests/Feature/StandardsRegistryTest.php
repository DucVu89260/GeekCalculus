<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Database\Seeders\StandardsSeeder;
use Tests\TestCase;
use App\Models\User;

class StandardsRegistryTest extends TestCase {
    use RefreshDatabase;

    public function test_edition_registry_contains_six_edition_records(): void {
        $this->seed(StandardsSeeder::class);
        $this->assertDatabaseCount('standard_families', 2);
        $this->assertDatabaseCount('standard_editions', 6);
        $this->assertDatabaseHas('standard_editions',['code'=>'AISC360-10','year'=>2010]);
        $this->assertDatabaseHas('standard_editions',['code'=>'ASCE7-22','year'=>2022]);
    }

    public function test_seed_is_idempotent(): void {
        $this->seed(StandardsSeeder::class);
        $this->seed(StandardsSeeder::class);
        $this->assertDatabaseCount('standard_editions',6);
    }

    public function test_authenticated_user_can_read_db_backed_aisc_catalog(): void {
        $this->seed(StandardsSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'user']));
        $this->getJson('/api/v1/standards')->assertOk()
            ->assertJsonFragment(['code'=>'AISC360-10'])
            ->assertJsonFragment(['code'=>'ASCE7-22']);
        $this->getJson('/api/v1/standards/AISC360-10')->assertOk()
            ->assertJsonPath('data.edition.status','in_development');
        $this->getJson('/api/v1/standards/AISC360-10/equations')->assertOk()
            ->assertJsonPath('data',[]);
        $this->getJson('/api/v1/standards/UNKNOWN')->assertNotFound();
    }

    public function test_anonymous_user_cannot_access_private_standards(): void {
        $this->getJson('/api/v1/standards')->assertUnauthorized();
        $this->getJson('/api/v1/standards/AISC360-10')->assertUnauthorized();
        $this->post('/api/v1/standards/AISC360-10/documents',[])->assertUnauthorized();
    }

    public function test_asce710_explorer_has_source_index_before_private_corpus_import(): void {
        $this->seed(StandardsSeeder::class);
        $this->actingAs(User::factory()->create(['role'=>'user']));
        $this->getJson('/api/v1/standards/ASCE7-10')->assertOk()
            ->assertJsonCount(875,'data.clauses')->assertJsonPath('data.library.page_count',658);
        $this->getJson('/api/v1/standards/ASCE7-10/equations')->assertOk()->assertJsonCount(310,'data');
    }
    public function test_equations_and_clauses_include_exact_source_document_without_other_editions(): void {
        $this->seed(StandardsSeeder::class);
        $this->actingAs(User::factory()->create(['role'=>'user']));
        $edition = \Illuminate\Support\Facades\DB::table('standard_editions')->where('code','AISC360-10')->value('id');
        $doc = \Illuminate\Support\Facades\DB::table('standard_documents')->insertGetId([
            'edition_id'=>$edition,'kind'=>'specification','original_name'=>'fixture.pdf',
            'private_path'=>'private/fixture.pdf','sha256'=>str_repeat('a',64),
        ]);
        $clause = \Illuminate\Support\Facades\DB::table('standard_clauses')->where('edition_id',$edition)->where('code','E3')->value('id');
        \Illuminate\Support\Facades\DB::table('standard_clauses')->where('id',$clause)->update(['document_id'=>$doc,'pdf_page'=>95]);
        \Illuminate\Support\Facades\DB::table('standard_equations')->insert([
            'clause_id'=>$clause,'label'=>'E3-1','pdf_page'=>95,'latex'=>null,'verification_status'=>'candidate',
        ]);
        $this->getJson('/api/v1/standards/AISC360-10')->assertOk()->assertJsonFragment(['id'=>$clause,'code'=>'E3','document_id'=>$doc,'pdf_page'=>95]);
        $this->getJson('/api/v1/standards/AISC360-10/equations')->assertOk()
            ->assertJsonCount(1,'data')->assertJsonPath('data.0.document_id',$doc)
            ->assertJsonPath('data.0.pdf_page',95)->assertJsonPath('data.0.latex',null)
            ->assertJsonPath('data.0.verification_status','candidate');
        $this->getJson('/api/v1/standards/AISC360-16/equations')->assertOk()->assertJsonPath('data',[]);
        $this->getJson('/api/v1/standards/AISC360-16/documents/'.$doc.'/file')->assertNotFound();
    }
}
