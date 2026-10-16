<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class StandardsController extends Controller {
    private function asce710Library(): array {
        return json_decode(file_get_contents(base_path('../../standards/asce7-10-library.json')), true, 512, JSON_THROW_ON_ERROR);
    }
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
            ->get(['id','kind','original_name','page_count','processing_status','sha256','extraction_summary']);
        foreach ($documents as $doc) $doc->extraction_summary = json_decode($doc->extraction_summary ?? 'null', true);
        $library = $code === 'ASCE7-10' ? $this->asce710Library() : null;
        if ($library && $clauses->isEmpty()) $clauses = collect($library['clauses']);
        return response()->json(['data'=>['edition'=>$edition,'clauses'=>$clauses,'documents'=>$documents,
            'library'=>$library ? array_intersect_key($library,array_flip(['source_sha256','page_count','summary'])) : null]]);
    }
    public function equations(string $code) {
        $edition = DB::table('standard_editions')->where('code',$code)->first();
        abort_unless($edition,404);
        $rows = DB::table('standard_equations as e')->join('standard_clauses as c','c.id','=','e.clause_id')
            ->where('c.edition_id',$edition->id)
            ->get(['e.id','e.label','e.pdf_page','e.latex','e.variables','e.conditions','e.verification_status','e.implementation_key','c.code as clause_code']);
        if ($code === 'ASCE7-10') {
            // Shared source-label index is also available before a private PDF import.
            // Any stored engineering-reviewed row takes precedence over its candidate.
            $rows = collect($this->asce710Library()['equations'])->keyBy('label')->merge($rows->keyBy('label'))->values();
        }
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

    public function sourcePages(Request $request, string $code) {
        $data = $request->validate(['q'=>'nullable|string|max:200','chapter'=>'nullable|string|max:30',
            'page'=>'nullable|integer|min:1','document_id'=>'nullable|integer|min:1']);
        $edition = DB::table('standard_editions')->where('code',$code)->first(); abort_unless($edition,404);
        $query = DB::table('standard_source_pages as p')->join('standard_documents as d','d.id','=','p.document_id')
            ->where('d.edition_id',$edition->id);
        if (isset($data['document_id'])) $query->where('p.document_id',$data['document_id']);
        if (!empty($data['chapter'])) $query->where('p.chapter',$data['chapter']);
        if (!empty($data['q'])) $query->where(function ($q) use ($data) {
            $q->where('p.native_text','like','%'.$data['q'].'%')->orWhere('p.ocr_text','like','%'.$data['q'].'%');
        });
        $rows = $query->orderBy('p.document_id')->orderBy('p.pdf_page')->paginate(20,[
            'p.document_id','p.pdf_page','p.printed_label','p.chapter','p.kind','p.extraction_method','p.coverage_status',
        ]);
        return response()->json(['data'=>$rows->items(),'meta'=>['total'=>$rows->total(),'current_page'=>$rows->currentPage(),'last_page'=>$rows->lastPage()]])
            ->header('Cache-Control','private, no-store');
    }

    public function sourceItems(Request $request, string $code) {
        $data = $request->validate(['q'=>'nullable|string|max:200','kind'=>'nullable|in:equation,table,figure',
            'chapter'=>'nullable|string|max:30','page'=>'nullable|integer|min:1','document_id'=>'nullable|integer|min:1']);
        $edition = DB::table('standard_editions')->where('code',$code)->first(); abort_unless($edition,404);
        $q = DB::table('standard_source_items as i')->join('standard_source_pages as p','p.id','=','i.page_id')
            ->join('standard_documents as d','d.id','=','p.document_id')->where('d.edition_id',$edition->id);
        foreach (['kind'=>'i.kind','chapter'=>'p.chapter','document_id'=>'p.document_id'] as $key=>$column)
            if (!empty($data[$key])) $q->where($column,$data[$key]);
        if (!empty($data['q'])) $q->where(function ($q) use ($data) {
            $q->where('i.label','like','%'.$data['q'].'%')->orWhere('i.context','like','%'.$data['q'].'%');
        });
        $rows = $q->orderBy('p.document_id')->orderBy('p.pdf_page')->orderBy('i.offset')->paginate(30,[
            'i.id','i.kind','i.label','i.channel','i.offset','i.context','i.occurrence_type','i.verification_status',
            'p.pdf_page','p.document_id','p.chapter','p.kind as source_kind',
        ]);
        return response()->json(['data'=>$rows->items(),'meta'=>['total'=>$rows->total(),'current_page'=>$rows->currentPage(),'last_page'=>$rows->lastPage()]])
            ->header('Cache-Control','private, no-store');
    }

    private function sourceDocument(string $code, int $id) {
        $doc = DB::table('standard_documents as d')->join('standard_editions as e','e.id','=','d.edition_id')
            ->where('e.code',$code)->where('d.id',$id)->select('d.*')->first();
        abort_unless($doc,404); return $doc;
    }

    public function sourcePage(string $code, int $id, int $page) {
        $doc = $this->sourceDocument($code,$id);
        $row = DB::table('standard_source_pages')->where('document_id',$doc->id)->where('pdf_page',$page)->first();
        abort_unless($row,404); unset($row->image_path);
        foreach (['blocks','numeric_tokens'] as $field) $row->$field = json_decode($row->$field,true);
        return response()->json(['data'=>$row])->header('Cache-Control','private, no-store');
    }

    public function sourceImage(string $code, int $id, int $page) {
        $doc = $this->sourceDocument($code,$id);
        $path = DB::table('standard_source_pages')->where('document_id',$doc->id)->where('pdf_page',$page)->value('image_path');
        abort_unless($path && Storage::disk('local')->exists($path),404);
        return response()->file(Storage::disk('local')->path($path),[
            'Content-Type'=>'image/png','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff',
        ]);
    }

    public function corpus(string $code, int $id) {
        $doc = $this->sourceDocument($code,$id);
        abort_unless($doc->corpus_path && Storage::disk('local')->exists($doc->corpus_path),404);
        return response()->download(Storage::disk('local')->path($doc->corpus_path),$code.'-source-corpus.json',[
            'Content-Type'=>'application/json','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff',
        ]);
    }
}
