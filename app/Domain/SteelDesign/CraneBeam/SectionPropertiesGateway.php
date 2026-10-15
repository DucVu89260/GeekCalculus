<?php
declare(strict_types=1);
namespace App\Domain\SteelDesign\CraneBeam;
/** Delegates exclusively to existing Section Properties / Asymmetric I/H engine. */
interface SectionPropertiesGateway {
    /** Input H,bt,tt,bb,tb,tw mm; outputs canonical geometry fields in mm units. */
    public function asymmetricIH(array $dimensions): array;
}