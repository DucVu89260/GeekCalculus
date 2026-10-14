"""Validated geometry and calculation-option models for sectional properties.

All geometry dimensions are expressed in millimetres. These models validate
input only; they do not calculate section properties.
"""

from __future__ import annotations

import hashlib
import json
from typing import Annotated, Literal, TypeAlias, Union

from pydantic import BaseModel, ConfigDict, Field, StrictBool, TypeAdapter, model_validator
from pydantic_core import PydanticCustomError


GEOMETRY_MODEL_VERSION = "1.0.0"
GEOMETRY_UNITS = "mm"

PositiveFiniteDimension: TypeAlias = Annotated[
    float,
    Field(strict=True, gt=0, allow_inf_nan=False),
]
PositiveFiniteTolerance: TypeAlias = Annotated[
    float,
    Field(strict=True, gt=0, le=1e-2, allow_inf_nan=False),
]
BoundedTermCount: TypeAlias = Annotated[int, Field(strict=True, ge=1, le=100_000)]
RequiredProperty: TypeAlias = Literal[
    "torsion_constant_j",
    "warping_constant_cw",
    "shear_center",
    "effective_shear_area",
]


class _FrozenModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", revalidate_instances="always")


class RectangleGeometry(_FrozenModel):
    """Solid rectangle with dimensions in millimetres."""

    type: Literal["rectangle"]
    width: PositiveFiniteDimension
    height: PositiveFiniteDimension
    geometry_variant: Literal["solid"] = "solid"
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION


class CircleGeometry(_FrozenModel):
    """Solid circle with diameter in millimetres."""

    type: Literal["circle"]
    diameter: PositiveFiniteDimension
    geometry_variant: Literal["solid"] = "solid"
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION


class ISectionGeometry(_FrozenModel):
    """Sharp-corner I-section geometry with dimensions in millimetres."""

    type: Literal["i_section"]
    depth: PositiveFiniteDimension
    top_flange_width: PositiveFiniteDimension
    bottom_flange_width: PositiveFiniteDimension
    web_thickness: PositiveFiniteDimension
    top_flange_thickness: PositiveFiniteDimension
    bottom_flange_thickness: PositiveFiniteDimension
    geometry_variant: Literal["sharp_corner"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION

    @model_validator(mode="after")
    def validate_proportions(self) -> ISectionGeometry:
        if self.depth <= self.top_flange_thickness + self.bottom_flange_thickness:
            raise PydanticCustomError(
                "invalid_geometry",
                "depth must exceed the sum of flange thicknesses",
            )
        if self.web_thickness > min(self.top_flange_width, self.bottom_flange_width):
            raise PydanticCustomError(
                "invalid_geometry",
                "web_thickness must not exceed either flange width",
            )
        return self


class RectangularHollowGeometry(_FrozenModel):
    """Sharp-corner rectangular hollow section; dimensions are in mm."""

    type: Literal["rectangular_hollow"]
    width: PositiveFiniteDimension
    height: PositiveFiniteDimension
    thickness: PositiveFiniteDimension
    geometry_variant: Literal["sharp_corner"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION

    @model_validator(mode="after")
    def validate_proportions(self) -> RectangularHollowGeometry:
        inner_width = self.width - 2 * self.thickness
        inner_height = self.height - 2 * self.thickness
        if not (inner_width > 0 and inner_height > 0 and inner_width < self.width and inner_height < self.height):
            raise PydanticCustomError("invalid_geometry", "2 * thickness must be representably less than width and height")
        return self


class CircularHollowGeometry(_FrozenModel):
    """Sharp-corner circular hollow section (CHS); dimensions are in mm."""

    type: Literal["circular_hollow"]
    diameter: PositiveFiniteDimension
    thickness: PositiveFiniteDimension
    geometry_variant: Literal["uniform_wall"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION

    @model_validator(mode="after")
    def validate_proportions(self) -> CircularHollowGeometry:
        inner_diameter = self.diameter - 2 * self.thickness
        if not (inner_diameter > 0 and inner_diameter < self.diameter):
            raise PydanticCustomError("invalid_geometry", "2 * thickness must be representably less than diameter")
        return self


class ChannelGeometry(_FrozenModel):
    """Sharp-corner C-section with its web on the left and flanges to the right."""

    type: Literal["channel"]
    depth: PositiveFiniteDimension
    width: PositiveFiniteDimension
    web_thickness: PositiveFiniteDimension
    flange_thickness: PositiveFiniteDimension
    geometry_variant: Literal["sharp_corner"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION

    @model_validator(mode="after")
    def validate_proportions(self) -> ChannelGeometry:
        clear_depth = self.depth - 2 * self.flange_thickness
        flange_projection = self.width - self.web_thickness
        if not (clear_depth > 0 and clear_depth < self.depth and flange_projection > 0 and flange_projection < self.width):
            raise PydanticCustomError("invalid_geometry", "channel needs representable clear web depth and flange projection")
        return self


class TeeGeometry(_FrozenModel):
    """Sharp-corner T-section with a centered web below the top flange."""

    type: Literal["tee"]
    depth: PositiveFiniteDimension
    width: PositiveFiniteDimension
    web_thickness: PositiveFiniteDimension
    flange_thickness: PositiveFiniteDimension
    geometry_variant: Literal["sharp_corner"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION

    @model_validator(mode="after")
    def validate_proportions(self) -> TeeGeometry:
        clear_depth = self.depth - self.flange_thickness
        flange_projection = self.width - self.web_thickness
        if not (clear_depth > 0 and clear_depth < self.depth and flange_projection > 0 and flange_projection < self.width):
            raise PydanticCustomError("invalid_geometry", "tee needs representable clear web depth and flange projection")
        return self


class AngleGeometry(_FrozenModel):
    """Sharp-corner L-section with its heel at the lower-left corner."""

    type: Literal["angle"]
    depth: PositiveFiniteDimension
    width: PositiveFiniteDimension
    thickness: PositiveFiniteDimension
    geometry_variant: Literal["sharp_corner"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION

    @model_validator(mode="after")
    def validate_proportions(self) -> AngleGeometry:
        clear_depth = self.depth - self.thickness
        clear_width = self.width - self.thickness
        if not (clear_depth > 0 and clear_depth < self.depth and clear_width > 0 and clear_width < self.width):
            raise PydanticCustomError("invalid_geometry", "angle thickness must be representably less than width and depth")
        return self


Geometry: TypeAlias = Annotated[
    Union[
        RectangleGeometry,
        CircleGeometry,
        ISectionGeometry,
        RectangularHollowGeometry,
        CircularHollowGeometry,
        ChannelGeometry,
        TeeGeometry,
        AngleGeometry,
    ],
    Field(discriminator="type"),
]
_GEOMETRY_ADAPTER = TypeAdapter(Geometry)


class _GeometryDefinitionEnvelope(_FrozenModel):
    """Strict wrapper used to validate canonical internal definitions."""

    type: Literal["rectangle", "circle", "i_section", "rectangular_hollow", "circular_hollow", "channel", "tee", "angle"]
    geometry_variant: Literal["solid", "sharp_corner", "uniform_wall"]
    geometry_model_version: Literal["1.0.0"] = GEOMETRY_MODEL_VERSION
    dimensions: dict[str, object]

    @model_validator(mode="after")
    def validate_dimension_keys(self) -> _GeometryDefinitionEnvelope:
        reserved = {"type", "geometry_variant", "geometry_model_version"}
        if reserved.intersection(self.dimensions):
            raise PydanticCustomError(
                "invalid_geometry",
                "dimensions may contain geometry dimensions only",
            )
        return self


class CalculationOptions(_FrozenModel):
    """Numerical settings accepted by the analytical sectional engine."""

    solver: Literal["analytical"] = "analytical"
    include_plastic: StrictBool = True
    include_advanced: StrictBool = False
    rectangle_j_relative_tolerance: PositiveFiniteTolerance = 1e-10
    rectangle_j_max_terms: BoundedTermCount = 10_000
    required_properties: tuple[RequiredProperty, ...] = ()


_DIMENSION_FIELDS: dict[type[BaseModel], tuple[str, ...]] = {
    RectangleGeometry: ("width", "height"),
    CircleGeometry: ("diameter",),
    ISectionGeometry: (
        "depth",
        "top_flange_width",
        "bottom_flange_width",
        "web_thickness",
        "top_flange_thickness",
        "bottom_flange_thickness",
    ),
    RectangularHollowGeometry: ("width", "height", "thickness"),
    CircularHollowGeometry: ("diameter", "thickness"),
    ChannelGeometry: ("depth", "width", "web_thickness", "flange_thickness"),
    TeeGeometry: ("depth", "width", "web_thickness", "flange_thickness"),
    AngleGeometry: ("depth", "width", "thickness"),
}


def validate_geometry(data: object) -> Geometry:
    """Validate a geometry mapping and return its immutable model instance."""

    return _GEOMETRY_ADAPTER.validate_python(data)


def geometry_definition(model: Geometry) -> dict[str, object]:
    """Return the canonical, unit-explicit geometry envelope.

    The dimensions themselves are in millimetres. The returned ``dimensions``
    object contains geometry fields only; axis conventions and other analysis
    assumptions are intentionally outside this input model.
    """

    model = validate_geometry(model)
    dimension_names = _DIMENSION_FIELDS[type(model)]
    dimensions = {name: getattr(model, name) for name in dimension_names}
    return {
        "type": model.type,
        "geometry_variant": model.geometry_variant,
        "geometry_model_version": model.geometry_model_version,
        "dimensions": dimensions,
    }


def geometry_hash(model: Geometry) -> str:
    """Return a stable SHA-256 digest for geometry, model version, and units."""

    canonical = {"units": GEOMETRY_UNITS, **geometry_definition(model)}
    encoded = json.dumps(
        canonical,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_geometry_definition(data: object) -> Geometry:
    """Validate a strict geometry envelope and flatten it into a geometry model."""

    envelope = _GeometryDefinitionEnvelope.model_validate(data)
    flattened: dict[str, object] = {
        **envelope.dimensions,
        "type": envelope.type,
        "geometry_variant": envelope.geometry_variant,
        "geometry_model_version": envelope.geometry_model_version,
    }
    return validate_geometry(flattened)


__all__ = [
    "GEOMETRY_MODEL_VERSION",
    "GEOMETRY_UNITS",
    "CalculationOptions",
    "AngleGeometry",
    "ChannelGeometry",
    "CircleGeometry",
    "CircularHollowGeometry",
    "Geometry",
    "ISectionGeometry",
    "RectangleGeometry",
    "RectangularHollowGeometry",
    "TeeGeometry",
    "geometry_definition",
    "geometry_hash",
    "validate_geometry",
    "validate_geometry_definition",
]
