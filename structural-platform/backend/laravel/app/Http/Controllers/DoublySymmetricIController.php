<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Structural\SteelDesign\HI\DoublySymmetricIParityCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;

final class DoublySymmetricIController extends Controller
{
    public function calculate(Request $request, DoublySymmetricIParityCalculator $calculator): JsonResponse
    {
        if (strlen($request->getContent()) > 65536) {
            return response()->json(['status' => 'error', 'code' => 'REQUEST_TOO_LARGE'], 413);
        }
        $rules = [
            'material' => 'required|array',
            'material.fy_mpa' => 'required|numeric|gt:0',
            'material.e_mpa' => 'required|numeric|gt:0',
            'section' => 'required|array',
            'section.h_mm' => 'required|numeric|gt:0',
            'section.bf_mm' => 'required|numeric|gt:0',
            'section.tw_mm' => 'required|numeric|gt:0',
            'section.tf_mm' => 'required|numeric|gt:0',
            'section.fabrication' => 'required|in:BUILT_UP,ROLLED',
            'member' => 'required|array',
            'member.lb_mm' => 'required|numeric|gt:0',
            'member.lx_mm' => 'required|numeric|gt:0',
            'stiffeners' => 'required|array',
            'stiffeners.spacing_mm' => 'required|numeric|min:0',
            'stiffeners.thickness_mm' => 'required|numeric|gt:0',
            'stiffeners.width_mm' => 'required|numeric|gt:0',
            'stiffeners.layout' => 'required|in:PAIRED,SINGLE_ANGLE,SINGLE_PLATE',
            'forces' => 'required|array',
        ];
        foreach (['axial_kN', 'moment_x_kNm', 'moment_y_kNm', 'shear_x_kN', 'shear_y_kN', 'moment_25_kNm', 'moment_50_kNm', 'moment_75_kNm'] as $name) {
            $rules['forces.'.$name] = 'required|numeric';
        }
        $validated = Validator::make($request->all(), $rules)->validate();
        try {
            return response()->json($calculator->calculate($validated));
        } catch (InvalidArgumentException $exception) {
            return response()->json(['status'=>'error', 'code'=>'INVALID_CALCULATION_INPUT', 'message'=>$exception->getMessage()], 422);
        }
    }
}
