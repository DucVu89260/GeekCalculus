<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class StandardsController extends Controller {
    public function index() {
        $families = DB::table('standard_families')->orderBy('code')->get()->map(function ($f) {
            $f->editions = DB::table('standard_editions')->where('family_id',$f->id)->orderBy('year')->get(['id','code','year','title','status']);
            return $f;
        });
        return response()->json(['data'=>$families]);
    }
    public function show(string $code) {
        $edition = DB::table('standard_editions')->where('code',$code)->first();
        abort_unless($edition,404);
        $clauses = DB::table('standard_clauses')->where('edition_id',$edition->id)
            ->orderByRaw('COALESCE(printed_page, 999999)')->orderBy('code')
            ->get(['id','code','title','parent_id','kind','pdf_page','printed_page','summary','verification_status']);
        $documents = DB::table('standard_documents')->where('edition_id',$edition->id)
            ->get(['id','kind','original_name','page_count','processing_status']);
        return response()->json(['data'=>['edition'=>$edition,'clauses'=>$clauses,'documents'=>$documents]]);
    }
    public function equations(string $code) {
        $edition = DB::table('standard_editions')->where('code',$code)->first();
        abort_unless($edition,404);
        $rows = DB::table('standard_equations as e')->join('standard_clauses as c','c.id','=','e.clause_id')
            ->where('c.edition_id',$edition->id)
            ->get(['e.id','e.label','e.pdf_page','e.latex','e.variables','e.conditions','e.verification_status','e.implementation_key','c.code as clause_code']);
        return response()->json(['data'=>$rows]);
    }
    public function document(Request $request, string $code, int $id) {
        $edition = DB::table('standard_editions')->where('code',$code)->first();
        abort_unless($edition,404);
        $doc = DB::table('standard_documents')->where('id',$id)->where('edition_id',$edition->id)->first();
        abort_unless($doc,404);
        abort_unless(Storage::disk('local')->exists($doc->private_path),404);
        return response()->file(Storage::disk('local')->path($doc->private_path),[
            'Content-Type'=>'application/pdf','Cache-Control'=>'private, no-store',
            'X-Content-Type-Options'=>'nosniff',
        ]);
    }
    public function upload(Request $request, string $code) {
        $edition = DB::table('standard_editions')->where('code',$code)->first();
        abort_unless($edition,404);
        $data = Validator::make($request->all(),['file'=>'required|file|mimes:pdf|max:102400','kind'=>'required|in:specification,commentary,errata,manual'])->validate();
        $file = $data['file'];
        $hash = hash_file('sha256',$file->getRealPath());
        if (DB::table('standard_documents')->where('edition_id',$edition->id)->where('sha256',$hash)->exists()) {
            return response()->json(['message'=>'This document was already uploaded.'],409);
        }
        $path = $file->store('private/standards/'.$code,'local');
        $id = DB::table('standard_documents')->insertGetId([
            'edition_id'=>$edition->id,'kind'=>$data['kind'],'original_name'=>$file->getClientOriginalName(),
            'private_path'=>$path,'sha256'=>$hash,'processing_status'=>'pending','created_at'=>now(),'updated_at'=>now()
        ]);
        return response()->json(['data'=>['id'=>$id,'processing_status'=>'pending']],201);
    }
}
