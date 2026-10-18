from typing import Annotated, Literal
from pydantic import Field, model_validator
from ..member_forces.models import Model, Name
from ..member_forces.sap2000 import OutputCase
from .contract import DEFAULT_GROUPS, GROUPS


class SnapshotRequest(Model):
    frames: Annotated[list[Name] | None, Field(min_length=1, max_length=200)] = None
    expected_model: Name
    groups: Annotated[list[str], Field(min_length=1, max_length=len(GROUPS))] = list(DEFAULT_GROUPS)
    output_cases: Annotated[list[OutputCase], Field(max_length=2000)] = []

    @model_validator(mode='after')
    def known_groups(self):
        if set(self.groups) - set(GROUPS) or len(set(self.groups)) != len(self.groups):
            raise ValueError('Use unique known snapshot groups')
        if self.frames and len(set(self.frames)) != len(self.frames):
            raise ValueError('Frame names must be unique')
        keys = [(c.kind, c.name) for c in self.output_cases]
        if len(set(keys)) != len(keys):
            raise ValueError('Output cases must be unique')
        return self


class TableRequest(Model):
    table_key: Name
    expected_model: Name
    max_records: int = Field(default=5000, ge=1, le=50000, strict=True)
