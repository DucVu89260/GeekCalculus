<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StandardsSeeder extends Seeder {
    public function run(): void {
        foreach ([
            ['AISC360','AISC 360','American Institute of Steel Construction',[2010,2016,2022]],
            ['ASCE7','ASCE 7','American Society of Civil Engineers',[2010,2016,2022]],
        ] as [$code,$name,$publisher,$years]) {
            $family = DB::table('standard_families')->where('code',$code)->first();
            if (!$family) { $id = DB::table('standard_families')->insertGetId(['code'=>$code,'name'=>$name,'publisher'=>$publisher,'created_at'=>now(),'updated_at'=>now()]); }
            else $id = $family->id;
            foreach ($years as $year) {
                DB::table('standard_editions')->updateOrInsert(['code'=>$code.'-'.substr((string)$year,-2)], [
                    'family_id'=>$id,'year'=>$year,'title'=>$name.'-'.substr((string)$year,-2),
                    'status'=>$year === 2010 ? 'in_development' : 'coming_soon','updated_at'=>now(),
                ]);
            }
        }
        // Navigation-only clause headings grounded in the AISC 360-10 table of contents.
        $edition = DB::table('standard_editions')->where('code','AISC360-10')->first();
        $pdfPages = ['E3' => 89]; // Only confirmed source-page mappings are linked.
        foreach ([
            ['A','General Provisions',1],['B','Design Requirements',10],
            ['B4','Member Properties',14],['C','Design for Stability',20],
            ['D','Design of Members for Tension',26],['D2','Tensile Strength',26],
            ['E','Design of Members for Compression',31],['E3','Flexural Buckling of Members without Slender Elements',33],
            ['F','Design of Members for Flexure',44],['G','Design of Members for Shear',67],
            ['H','Design of Members for Combined Forces and Torsion',73],
            ['I','Design of Composite Members',81],['J','Design of Connections',105],
            ['K','Design of HSS and Box Member Connections',140],
            ['L','Design for Serviceability',163],['M','Fabrication and Erection',165],
            ['N','Quality Control and Quality Assurance',170],
        ] as [$code,$title,$printedPage]) {
            DB::table('standard_clauses')->insertOrIgnore([
                'edition_id'=>$edition->id,'kind'=>'normative','code'=>$code,
                'title'=>$title,'printed_page'=>$printedPage,'pdf_page'=>$pdfPages[$code] ?? null,
                'verification_status'=>'index_only','created_at'=>now(),'updated_at'=>now()
            ]);
        }
    }
}
