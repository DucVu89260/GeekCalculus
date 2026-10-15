<?php
declare(strict_types=1);
namespace App\Http\Controllers\SteelDesign;
use App\Http\Controllers\Controller;
use App\Domain\SteelDesign\CraneBeam\CraneBeamDesign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
final class CraneBeamController extends Controller {
    public function index(): View { return view('steel-design.component.crane-beam'); }
    public function calculate(Request $request, CraneBeamDesign $design): JsonResponse {
        $input=$request->validate(['H'=>'required|numeric|gt:0','bt'=>'required|numeric|gt:0','tt'=>'required|numeric|gt:0','bb'=>'required|numeric|gt:0','tb'=>'required|numeric|gt:0','tw'=>'required|numeric|gt:0']);
        return response()->json($design->calculate($input));
    }
}