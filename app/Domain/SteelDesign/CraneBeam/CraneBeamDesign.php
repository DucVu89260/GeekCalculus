<?php
declare(strict_types=1);
namespace App\Domain\SteelDesign\CraneBeam;
use InvalidArgumentException;
final class CraneBeamDesign {
    public function __construct(private readonly SectionPropertiesGateway $sections) {}
    public function calculate(array $input): array {
        $dimensions=[];
        foreach (['H','bt','tt','bb','tb','tw'] as $key) {
            $v=$input[$key]??null;
            if (!is_numeric($v) || !is_finite((float)$v) || (float)$v<=0) throw new InvalidArgumentException("Invalid dimension: {$key}");
            $dimensions[$key]=(float)$v;
        }
        if ($dimensions['H'] <= $dimensions['tt']+$dimensions['tb'] || $dimensions['tw']>min($dimensions['bt'],$dimensions['bb']))
            throw new InvalidArgumentException('Invalid I/H dimensions');
        $properties=$this->sections->asymmetricIH($dimensions);
        foreach (['A_mm2','Ix_mm4','Iy_mm4','Sx_top_mm3','Sx_bottom_mm3','rx_mm','ry_mm'] as $key)
            if (!isset($properties[$key]) || !is_numeric($properties[$key]) || (float)$properties[$key]<=0)
                throw new InvalidArgumentException("Section Properties missing: {$key}");
        return ['section_family'=>'asymmetric_ih','source'=>'Section Properties / Asymmetric I/H','dimensions_mm'=>$dimensions,
          'section_properties'=>$properties,'engineering_status'=>'GEOMETRY_ONLY_PENDING_DESIGN_VERIFICATION',
          'checks'=>array_map(fn($label)=>['name'=>$label,'status'=>'NOT VERIFIED'], [
          'AISC 360-10 F4 major-axis bending / LTB','AISC 360-10 F6 minor-axis bending',
          'AISC 360-10 G2/G7 shear','AISC 360-10 J10 wheel concentrated forces',
          'AISC 360-10 H1 interaction','Fatigue and stiffener design'])];
    }
}