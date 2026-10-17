from __future__ import annotations

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Number = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Name = Annotated[str, Field(strict=True, min_length=1, max_length=500)]
Component = Literal['P', 'V2', 'V3', 'T', 'M2', 'M3']
COMPONENTS = ('P', 'V2', 'V3', 'T', 'M2', 'M3')


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class ForceRow(Model):
    record_id: Name
    frame: Name
    element: Name
    station: Annotated[Number, Field(ge=0)]
    element_station: Annotated[Number, Field(ge=0)]
    output_case: Name
    case_kind: Literal['case', 'combination']
    step_type: Annotated[str, Field(strict=True, max_length=100)] = ''
    step_num: Number = 0
    concurrency: Literal['concurrent', 'nonconcurrent', 'unknown'] = 'unknown'
    P: Number
    V2: Number
    V3: Number
    T: Number
    M2: Number
    M3: Number


class MissingResult(Model):
    output_case: Name
    case_kind: Literal['case', 'combination']
    frame: Name | None = None
    result: None = None
    reason: Name


class SectionPart(Model):
    index: int
    start_section: Name
    end_section: Name
    start_type: Name
    end_type: Name
    length: Number
    length_type: int
    ei33_variation: int
    ei22_variation: int


class MemberInfo(Model):
    frame: Name
    section: Name
    auto_select_list: str = ''
    section_type_code: int
    section_type: Name
    units_code: int
    components: list[SectionPart] = Field(default_factory=list)


class Dataset(Model):
    api_name: Literal['API_IF_SAP26.2.0_V1'] = 'API_IF_SAP26.2.0_V1'
    sap2000_version: Literal['26.2.0'] = '26.2.0'
    schema_version: Literal['1.0'] = '1.0'
    source: Literal['SAP2000'] = 'SAP2000'
    model: Name
    extracted_at: Name
    units: Literal['kN_m_C'] = 'kN_m_C'
    axes: Literal['SAP2000_local_123'] = 'SAP2000_local_123'
    rows: Annotated[list[ForceRow], Field(max_length=100000)]
    members: Annotated[list[MemberInfo], Field(max_length=1000)] = Field(default_factory=list)
    missing_results: Annotated[list[MissingResult], Field(max_length=100000)] = Field(default_factory=list)

    @model_validator(mode='after')
    def unique_records(self):
        if not self.rows and not self.missing_results:
            raise ValueError('Dataset must contain force rows or missing results')
        if len({r.record_id for r in self.rows}) != len(self.rows):
            raise ValueError('record_id must be unique within a dataset')
        return self


class Filter(Model):
    dataset: Dataset
    frames: Annotated[list[Name] | None, Field(min_length=1, max_length=1000)] = None
    output_cases: Annotated[list[Name] | None, Field(min_length=1, max_length=2000)] = None


class ExtremeRequest(Filter):
    scope: Literal['per_frame', 'global'] = 'per_frame'
    components: Annotated[list[Component], Field(min_length=1, max_length=6)] = list(COMPONENTS)


class ExportRequest(Filter):
    format: Literal['json', 'csv'] = 'json'
    record_ids: Annotated[list[Name] | None, Field(min_length=1, max_length=100000)] = None
