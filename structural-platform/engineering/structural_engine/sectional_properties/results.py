"""Versioned, finite-valued results, independent of storage and transport."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

PositiveResult = Annotated[FiniteFloat, Field(gt=0)]


class ResultModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class GeometricProperties(ResultModel):
    area: PositiveResult
    perimeter: PositiveResult
    centroid_x: FiniteFloat
    centroid_y: FiniteFloat


class ElasticProperties(ResultModel):
    ix: PositiveResult
    iy: PositiveResult
    ixy: FiniteFloat
    sx_positive: PositiveResult
    sx_negative: PositiveResult
    sy_positive: PositiveResult
    sy_negative: PositiveResult
    rx: PositiveResult
    ry: PositiveResult


class PlasticProperties(ResultModel):
    pna_x: FiniteFloat
    pna_y: FiniteFloat
    zx: PositiveResult
    zy: PositiveResult


class PrincipalProperties(ResultModel):
    i_major: PositiveResult
    i_minor: PositiveResult
    major_axis_angle_degrees: FiniteFloat | None
    orientation_status: Literal["determinate", "indeterminate"]


class Properties(ResultModel):
    geometric: GeometricProperties
    elastic: ElasticProperties
    plastic: PlasticProperties | None
    principal: PrincipalProperties


class AdvancedProperty(ResultModel):
    status: Literal["computed", "not_computed"]
    value: FiniteFloat | None
    reason: str | None = None

    @model_validator(mode="after")
    def validate_availability(self):
        if self.status == "computed" and (self.value is None or self.reason is not None):
            raise ValueError("computed properties need a value and no unavailable reason")
        if self.status == "not_computed" and (self.value is not None or not self.reason):
            raise ValueError("unavailable properties need a reason and a null value")
        return self


class AdvancedProperties(ResultModel):
    torsion_constant_j: AdvancedProperty
    warping_constant_cw: AdvancedProperty
    shear_center: AdvancedProperty
    effective_shear_area: AdvancedProperty


class SolverIdentity(ResultModel):
    method: Literal["analytical"] = "analytical"
    version: str
    config_hash: str


class ResultUnits(ResultModel):
    length: Literal["mm"] = "mm"
    area: Literal["mm2"] = "mm2"
    section_modulus: Literal["mm3"] = "mm3"
    second_moment: Literal["mm4"] = "mm4"
    torsion_constant: Literal["mm4"] = "mm4"
    warping_constant: Literal["mm6"] = "mm6"
    angle: Literal["deg"] = "deg"


class CalculationResult(ResultModel):
    schema_version: Literal["1.0"] = "1.0"
    geometry_model_version: Literal["1.0.0"] = "1.0.0"
    geometry_type: Literal["rectangle", "circle", "i_section"]
    geometry_hash: str
    solver: SolverIdentity
    units: ResultUnits = Field(default_factory=ResultUnits)
    normalized_input: dict
    properties: Properties
    advanced: AdvancedProperties
    diagnostics: dict
    status: Literal["success"] = "success"
