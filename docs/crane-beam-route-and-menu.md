# Crane Beam / Steel Design / Component
Add Crane Beam at the SAME LEVEL as Symmetric I/H in the existing Steel Design > Component sidebar/navigation file:
```blade
<a href="{{ route('steel-design.component.crane-beam.index') }}">Crane Beam</a>
```
Append to existing routes/web.php (do not replace the route file):
```php
use App\Http\Controllers\SteelDesign\CraneBeamController;
Route::get('/steel-design/component/crane-beam', [CraneBeamController::class,'index'])->name('steel-design.component.crane-beam.index');
Route::post('/steel-design/component/crane-beam/calculate', [CraneBeamController::class,'calculate'])->name('steel-design.component.crane-beam.calculate');
```
IMPORTANT: Bind SectionPropertiesGateway to a concrete adapter using the EXISTING Section Properties Asymmetric I/H calculator; do not duplicate section geometry formulas. The actual existing menu and service-provider files were not accessible to this integration, so these edits remain pending. Current code reports GEOMETRY_ONLY_PENDING_DESIGN_VERIFICATION; it must not be treated as a complete Crane Beam design.
