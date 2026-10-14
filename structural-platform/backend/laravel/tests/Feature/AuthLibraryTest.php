<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Section;
use App\Models\SectionType;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Concerns\SectionPropertyTestSupport;
use Tests\TestCase;

class AuthLibraryTest extends TestCase
{
    use RefreshDatabase;
    use SectionPropertyTestSupport;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    private function material(array $changes = []): array
    {
        return array_replace(['code' => 'test-steel', 'name_vi' => 'Thép thử', 'name_en' => 'Test steel', 'category' => 'steel', 'source' => 'Test fixture', 'properties' => ['elastic_modulus' => 210000, 'poisson_ratio' => .3, 'density' => 7850, 'thermal_expansion' => .000012, 'damping_ratio' => .02, 'yield_strength' => 235, 'ultimate_strength' => 360]], $changes);
    }

    private function section(array $changes = []): array
    {
        return array_replace(['code' => 'test-rc', 'name_vi' => 'Cột thử', 'name_en' => 'Test column', 'section_type_id' => SectionType::where('shape', 'rectangle')->first()->id, 'material_id' => Material::where('category', 'concrete')->first()->id, 'properties' => ['width' => 300, 'depth' => 500, 'concrete_cover' => 30, 'area_modifier' => .9]], $changes);
    }

    public function test_guests_cannot_access_projects_library_or_admin(): void
    {
        foreach (['/api/projects', '/api/catalog', '/api/materials', '/api/section-types', '/api/sections', '/api/admin/users'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data', null);
    }

    public function test_login_and_logout_use_session_and_never_expose_password(): void
    {
        $u = User::factory()->create(['email' => 'admin@test.example', 'password' => 'ValidPassword!123', 'role' => 'admin']);
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'ValidPassword!123'])->assertOk()->assertJsonPath('data.role', 'admin')->assertJsonMissingPath('data.password');
        $this->getJson('/api/auth/me')->assertJsonPath('data.id', $u->id);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->getJson('/api/auth/me')->assertJsonPath('data', null);
    }

    public function test_normal_users_can_read_but_cannot_mutate_any_library_resource(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'user']));
        foreach (['materials', 'section-types', 'sections'] as $resource) {
            $this->getJson('/api/'.$resource)->assertOk();
            $this->postJson('/api/'.$resource, [])->assertForbidden();
            $this->patchJson('/api/'.$resource.'/1', [])->assertForbidden();
            $this->deleteJson('/api/'.$resource.'/1')->assertForbidden();
        }
        $this->getJson('/api/admin/users')->assertForbidden();
        $this->postJson('/api/admin/users', [])->assertForbidden();
    }

    public function test_materials_support_full_crud_and_derived_shear_modulus(): void
    {
        $this->actingAs($this->admin());
        $id = $this->postJson('/api/materials', $this->material())->assertCreated()->assertJsonPath('data.computed.shear_modulus', 210000 / (2 * 1.3))->json('data.id');
        $this->getJson('/api/materials')->assertJsonFragment(['code' => 'test-steel']);
        $this->patchJson('/api/materials/'.$id, $this->material(['name_en' => 'Edited steel']))->assertOk()->assertJsonPath('data.name_en', 'Edited steel');
        $this->deleteJson('/api/materials/'.$id)->assertOk();
        $this->assertDatabaseMissing('materials', ['id' => $id]);
    }

    public function test_invalid_material_physics_and_unknown_properties_fail(): void
    {
        $this->actingAs($this->admin());
        $data = $this->material();
        $data['properties']['poisson_ratio'] = .5;
        $this->postJson('/api/materials', $data)->assertUnprocessable()->assertJsonValidationErrors('properties.poisson_ratio');
        $data = $this->material();
        $data['properties']['ultimate_strength'] = 200;
        $this->postJson('/api/materials', $data)->assertUnprocessable()->assertJsonValidationErrors('properties.ultimate_strength');
        $data = $this->material();
        $data['properties']['unrecognized'] = 5;
        $this->postJson('/api/materials', $data)->assertUnprocessable()->assertJsonValidationErrors('properties');
    }

    public function test_types_support_crud_and_shape_category_validation(): void
    {
        $this->actingAs($this->admin());
        $data = ['code' => 'custom-type', 'name_vi' => 'Thép U thử', 'name_en' => 'Test channel', 'category' => 'steel', 'shape' => 'channel'];
        $id = $this->postJson('/api/section-types', $data)->assertCreated()->json('data.id');
        $this->patchJson('/api/section-types/'.$id, array_replace($data, ['name_en' => 'Edited type']))->assertOk();
        $this->postJson('/api/section-types', array_replace($data, ['code' => 'invalid-type', 'category' => 'rc']))->assertUnprocessable()->assertJsonValidationErrors('shape');
        $this->deleteJson('/api/section-types/'.$id)->assertOk();
    }

    public function test_sections_support_full_crud_and_computed_radii(): void
    {
        $this->actingAs($this->admin());
        $fixture = $this->sectionPropertyFixture();
        $changedGeometryFixture = $this->sectionPropertyFixture('section-rectangle-400x500.json');
        $this->fakeSectionPropertyCalculations([$fixture, $changedGeometryFixture]);
        $data = $this->section();
        $data['properties'] += [
            // Known derived fields are compatibility inputs only and never override the solver.
            'area' => 999999,
            'inertia_y' => 999999,
            'inertia_z' => 888888,
            'torsion_constant' => 777777,
            'elastic_modulus_y' => 666666,
            'elastic_modulus_z' => 555555,
            'shear_area_y' => 444444,
            'shear_area_z' => 333333,
            'warping_constant' => 222222,
            'plastic_modulus_y' => 111111,
            'shear_center_y' => -100,
        ];
        $data['section_properties'] = ['status' => 'tampered'];
        $data['section_properties_calculated_at'] = '2000-01-01T00:00:00Z';
        $response = $this->postJson('/api/sections', $data)->assertCreated()
            ->assertJsonPath('data.computed.rx', $fixture['properties']['elastic']['rx'])
            ->assertJsonPath('data.computed.ry', $fixture['properties']['elastic']['ry'])
            ->assertJsonMissingPath('data.computed.radius_y')
            ->assertJsonMissingPath('data.computed.radius_z');
        $id = $response->json('data.id');
        $this->assertEquals($fixture['properties']['geometric']['area'], $response->json('data.section_properties.properties.geometric.area'));
        $section = Section::findOrFail($id);
        $this->assertEquals($fixture, $section->section_properties);
        $this->assertNotNull($section->section_properties_calculated_at);
        $this->assertEquals(['width' => 300.0, 'depth' => 500.0, 'concrete_cover' => 30.0, 'area_modifier' => .9], $section->properties);
        $this->getJson('/api/sections')->assertJsonFragment(['code' => 'test-rc']);
        $section->section_properties_calculated_at = now()->subYear();
        $section->save();
        $previousCalculationTime = $section->section_properties_calculated_at;
        $changedInput = $this->section(['name_en' => 'Edited section']);
        $changedInput['properties']['width'] = 400;
        $updated = $this->patchJson('/api/sections/'.$id, $changedInput)
            ->assertOk()->assertJsonPath('data.name_en', 'Edited section')
            ->assertJsonPath('data.computed.rx', $changedGeometryFixture['properties']['elastic']['rx'])
            ->assertJsonPath('data.computed.ry', $changedGeometryFixture['properties']['elastic']['ry'])
            ->assertJsonStructure(['data' => ['section_properties' => ['properties' => ['elastic' => ['rx', 'ry']]]]]);
        $this->assertEquals(200000, $updated->json('data.section_properties.properties.geometric.area'));
        $savedAfterGeometryChange = Section::findOrFail($id);
        $this->assertEquals(400.0, $savedAfterGeometryChange->properties['width']);
        $this->assertEquals($changedGeometryFixture, $savedAfterGeometryChange->section_properties);
        $this->assertTrue($savedAfterGeometryChange->section_properties_calculated_at->greaterThan($previousCalculationTime));
        Http::assertSent(fn ($request) => $request->data()['geometry']['dimensions'] == ['width' => 400, 'height' => 500]);
        Http::assertSentCount(2);
        $this->assertEquals($changedGeometryFixture, Section::findOrFail($id)->section_properties);
        $this->deleteJson('/api/sections/'.$id)->assertOk();
        $this->assertDatabaseCount('sections', 0);
    }

    public function test_referenced_materials_and_types_cannot_be_deleted_or_retyped(): void
    {
        $this->actingAs($this->admin());
        $this->fakeSectionPropertyCalculations([$this->sectionPropertyFixture()]);
        $data = $this->section();
        $this->postJson('/api/sections', $data)->assertCreated();
        $this->deleteJson('/api/materials/'.$data['material_id'])->assertStatus(409);
        $this->deleteJson('/api/section-types/'.$data['section_type_id'])->assertStatus(409);
        $type = SectionType::find($data['section_type_id']);
        $this->patchJson('/api/section-types/'.$type->id, ['code' => $type->code, 'name_vi' => $type->name_vi, 'name_en' => $type->name_en, 'category' => 'rc', 'shape' => 'circle'])->assertStatus(409);
    }

    public function test_incompatible_material_geometry_and_missing_section_constants_fail(): void
    {
        $this->actingAs($this->admin());
        $this->postJson('/api/sections', $this->section(['material_id' => Material::where('category', 'steel')->first()->id]))->assertUnprocessable()->assertJsonValidationErrors('material_id');
        $data = $this->section();
        unset($data['properties']['width']);
        $this->postJson('/api/sections', $data)->assertUnprocessable()->assertJsonValidationErrors('properties.width');
        $data = $this->section();
        $data['properties']['concrete_cover'] = 200;
        $this->postJson('/api/sections', $data)->assertUnprocessable()->assertJsonValidationErrors('properties.concrete_cover');
    }

    public function test_projects_are_owned_by_users_and_not_visible_to_other_users(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($owner)->postJson('/api/projects', ['name' => 'Private project', 'project_type' => 'building', 'standard' => 'tcvn_5574_2018', 'material' => 'concrete_b25', 'unit' => 'kn_m', 'module' => 'rc_beam'])->assertCreated()->assertJsonPath('data.user_id', $owner->id);
        $this->actingAs($other)->getJson('/api/projects')->assertJsonCount(0, 'data');
        $this->actingAs($owner)->getJson('/api/projects')->assertJsonCount(1, 'data');
        $this->actingAs($this->admin())->getJson('/api/projects')->assertJsonCount(1, 'data');
    }

    public function test_admin_user_crud_hashes_password_and_blocks_self_delete_and_demotion(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $data = ['name' => 'New user', 'email' => 'new@test.example', 'role' => 'user', 'password' => 'ValidPassword!123'];
        $id = $this->postJson('/api/admin/users', $data)->assertCreated()->assertJsonMissingPath('data.password')->json('data.id');
        $this->assertTrue(Hash::check($data['password'], User::find($id)->password));
        unset($data['password']);
        $data['name'] = 'Updated user';
        $this->patchJson('/api/admin/users/'.$id, $data)->assertOk();
        $this->deleteJson('/api/admin/users/'.$admin->id)->assertStatus(409);
        $this->patchJson('/api/admin/users/'.$admin->id, ['name' => $admin->name, 'email' => $admin->email, 'role' => 'user'])->assertStatus(409);
        $this->deleteJson('/api/admin/users/'.$id)->assertOk();
    }

    public function test_repeated_seeding_preserves_admin_material_edits_and_creates_no_default_users(): void
    {
        $this->assertDatabaseCount('users', 0);
        Material::where('code', 'steel_s235')->update(['name_en' => 'Admin edited name']);
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseHas('materials', ['code' => 'steel_s235', 'name_en' => 'Admin edited name']);
        $this->assertDatabaseCount('materials', 4);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_deleting_seed_records_survives_reseeding(): void
    {
        $this->actingAs($this->admin());
        $m = Material::where('code', 'steel_s235')->first();
        $this->deleteJson('/api/materials/'.$m->id)->assertOk();
        $type = SectionType::where('shape', 'channel')->first();
        $this->deleteJson('/api/section-types/'.$type->id)->assertOk();
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseMissing('materials', ['code' => 'steel_s235']);
        $this->assertDatabaseMissing('catalog_options', ['code' => 'steel_s235']);
        $this->assertDatabaseMissing('section_types', ['id' => $type->id]);
    }

    public function test_passwords_over_bcrypt_byte_limit_are_rejected(): void
    {
        $this->actingAs($this->admin());
        $this->postJson('/api/admin/users', ['name' => 'Too long password', 'email' => 'long@test.example', 'role' => 'user', 'password' => str_repeat('é', 40)])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_real_csrf_middleware_rejects_cookie_mutations_without_token(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        try {
            $this->postJson('/api/auth/login', ['email' => 'nobody@test.example', 'password' => 'InvalidPassword!123'])->assertStatus(419);
        } finally {
            $this->app->detectEnvironment(fn () => 'testing');
        }
    }
}
