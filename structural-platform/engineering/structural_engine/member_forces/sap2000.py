"""Read-only SAP2000 adapter using the direct .NET DLL/PID transport.

The .NET bridge normalizes ref/out arguments before the trailing CSI return code.
No analysis, file opening/saving, object selection or model edits are performed.
"""
from __future__ import annotations

from contextlib import contextmanager
import re
from .contract import TARGET_SAP2000_VERSION
from datetime import datetime, timezone
from pathlib import PureWindowsPath
from .models import Dataset, ForceRow, Model, Name
from pydantic import Field
from typing import Annotated, Literal


class SapError(RuntimeError):
    pass


class OutputCase(Model):
    name: Name
    kind: Literal['case', 'combination']


class ExtractionRequest(Model):
    output_cases: Annotated[list[OutputCase], Field(min_length=1, max_length=2000)]
    # Omit frames to read the current SAP2000 object selection.
    frames: Annotated[list[Name] | None, Field(min_length=1, max_length=1000)] = None
    expected_model: Name | None = None


def outputs(result, count):
    if not isinstance(result, (tuple, list)) or len(result) != count + 1 or result[-1] != 0:
        raise SapError('SAP2000 API operation failed or returned an unsupported COM signature; run diagnose-sap2000.cmd to inspect GetVersion and COM attachment')
    return result[:-1]


def checked(code):
    if code != 0:
        raise SapError('SAP2000 API operation failed')


class Sap2000:
    def __init__(self, model):
        self.model = model

    def verify_version(self):
        version, version_number = outputs(com_operation('SAP2000_GET_VERSION', self.model.GetVersion), 2)
        if not isinstance(version, str) or not re.search(r'(?<![\d.])26\.2\.0(?![\d.])', version):
            raise SapError('API_IF_SAP26.2.0_V1 requires SAP2000 ' + TARGET_SAP2000_VERSION + '; reported version: ' + str(version)[:100])
        return TARGET_SAP2000_VERSION

    def model_info(self):
        from .contract import API_NAME
        filename = self.model.GetModelFilename()
        return {'api_name': API_NAME, 'sap2000_version': TARGET_SAP2000_VERSION,
                'model': filename, 'filename': PureWindowsPath(filename).name,
                'locked': bool(self.model.GetModelIsLocked())}

    def names(self, interface):
        count, names = outputs(interface.GetNameList(), 2)
        if count != len(names or ()):
            raise SapError('SAP2000 returned inconsistent name counts')
        return list(names or ())

    def cases(self):
        statuses = outputs(self.model.Analyze.GetCaseStatus(), 3)
        count, names, states = statuses
        if count != len(names or ()) or count != len(states or ()):
            raise SapError('SAP2000 returned inconsistent analysis status counts')
        state = dict(zip(names or (), states or ()))
        return ([{'name': n, 'kind': 'case', 'analysis_status': state.get(n), 'results_available': state.get(n) == 4}
                 for n in self.names(self.model.LoadCases)] +
                [{'name': n, 'kind': 'combination', 'analysis_status': None, 'results_available': None}
                 for n in self.names(self.model.RespCombo)])

    def concurrency(self, case, visiting=None, statuses=None):
        # Spectrum/modal/SRSS/absolute/envelope outputs cannot form an action vector.
        visiting = set() if visiting is None else visiting
        statuses = {c['name']: c['results_available'] for c in self.cases() if c['kind'] == 'case'} if statuses is None else statuses
        key = (case.name, case.kind)
        if key in visiting:
            raise SapError('Cyclic SAP2000 output combination')
        if case.kind == 'case':
            if statuses.get(case.name) is not True:
                raise SapError('An underlying analysis case has no finished results')
            case_type, subtype = outputs(self.model.LoadCases.GetTypeOAPI(case.name), 2)
            return 'concurrent' if case_type in (1, 2, 5, 6) else 'nonconcurrent'
        combo_type, = outputs(self.model.RespCombo.GetTypeOAPI(case.name), 1)
        if combo_type != 0:
            return 'nonconcurrent'
        count, kinds, names, factors = outputs(self.model.RespCombo.GetCaseList(case.name), 4)
        if count < 1 or any(len(x or ()) != count for x in (kinds, names, factors)):
            raise SapError('Invalid SAP2000 combination definition')
        for kind, name in zip(kinds, names):
            if kind not in (0, 1):
                return 'unknown'
            child = OutputCase(name=name, kind='case' if kind == 0 else 'combination')
            if child.kind == 'case':
                if statuses.get(name) is not True:
                    raise SapError('An underlying analysis case has no finished results')
                case_type, subtype = outputs(self.model.LoadCases.GetTypeOAPI(name), 2)
                if case_type not in (1, 2):
                    return 'nonconcurrent'
            elif self.concurrency(child, visiting | {key}, statuses) != 'concurrent':
                return 'nonconcurrent'
        return 'concurrent'

    def selection(self):
        count, types, names = outputs(self.model.SelectObj.GetSelected(), 3)
        if count != len(types or ()) or count != len(names or ()):
            raise SapError('SAP2000 returned inconsistent selection counts')
        return [n for t, n in zip(types or (), names or ()) if t == 2]

    def extract(self, request: ExtractionRequest):
        model_filename = self.model.GetModelFilename()
        if request.expected_model is not None and request.expected_model != model_filename:
            raise SapError('Active SAP2000 model changed; reconnect and confirm the file before extraction')
        if not self.model.GetModelIsLocked():
            raise SapError('Model must be analyzed and locked before extraction')
        frames = request.frames if request.frames is not None else self.selection()
        frames = list(dict.fromkeys(frames))
        if not frames:
            raise SapError('Select at least one frame object in SAP2000')
        if len(frames) > 1000 or set(frames) - set(self.names(self.model.FrameObj)):
            raise SapError('Frame selection contains unknown objects or exceeds 1000 frames')
        available = self.cases()
        lookup = {(c['name'], c['kind']): c for c in available}
        requested = {(c.name, c.kind) for c in request.output_cases}
        if len(requested) != len(request.output_cases) or requested - set(lookup):
            raise SapError('Output cases must be unique existing case/combination names')
        if any(lookup[key]['results_available'] is False for key in requested):
            raise SapError('A requested analysis case has no finished results')
        setup = self.model.Results.Setup
        # Read all prior state before making any changes.
        previous = []
        for case in available:
            getter = setup.GetCaseSelectedForOutput if case['kind'] == 'case' else setup.GetComboSelectedForOutput
            selected, = outputs(getter(case['name']), 1)
            previous.append((case, selected))
        old_units = self.model.GetPresentUnits()
        if not isinstance(old_units, int) or old_units <= 0:
            raise SapError('Cannot determine existing SAP2000 units')
        rows = []
        primary_error = None
        try:
            checked(self.model.SetPresentUnits(6))  # CSI eUnits.kN_m_C
            # Query one output at a time so case/combo names can never be conflated.
            for case in request.output_cases:
                checked(setup.DeselectAllCasesAndCombosForOutput())
                setter = setup.SetCaseSelectedForOutput if case.kind == 'case' else setup.SetComboSelectedForOutput
                checked(setter(case.name, True))
                concurrency = self.concurrency(case)
                for frame in frames:
                    result = outputs(self.model.Results.FrameForce(frame, 0), 14)  # ObjectElm
                    count, *columns = result
                    if count < 1:
                        raise SapError('No frame forces for a requested frame/output; run analysis and check output availability')
                    if any(len(column or ()) != count for column in columns):
                        raise SapError('SAP2000 returned inconsistent frame force array lengths')
                    if len(rows) + count > 100000:
                        raise SapError('Extraction exceeds 100000 rows; reduce frames or output cases')
                    for values in zip(*columns):
                        obj, objsta, elm, elmsta, loadcase, steptype, stepnum, p, v2, v3, t, m2, m3 = values
                        if obj != frame or loadcase != case.name:
                            raise SapError('SAP2000 returned a different frame/output case than requested')
                        rows.append(ForceRow(record_id=str(len(rows)+1), frame=obj, element=elm,
                            station=objsta, element_station=elmsta, output_case=loadcase, case_kind=case.kind,
                            step_type=steptype, step_num=stepnum, concurrency=concurrency,
                            P=p, V2=v2, V3=v3, T=t, M2=m2, M3=m3))
        except BaseException as error:
            primary_error = error
            raise
        finally:
            failures = []
            for action in [lambda: setup.DeselectAllCasesAndCombosForOutput(),
                           *[(lambda c=c, selected=selected: (setup.SetCaseSelectedForOutput if c['kind'] == 'case' else setup.SetComboSelectedForOutput)(c['name'], selected)) for c, selected in previous],
                           lambda: self.model.SetPresentUnits(old_units)]:
                try:
                    checked(action())
                except Exception:
                    failures.append(True)
            if failures:
                raise SapError('Could not restore SAP2000 output selection/units; verify SAP2000 settings before continuing') from primary_error
        if self.model.GetModelFilename() != model_filename:
            raise SapError('Active SAP2000 model changed during extraction; discard results and reconnect')
        return Dataset(model=model_filename, extracted_at=datetime.now(timezone.utc).isoformat(), rows=rows)


def com_operation(stage, operation):
    try:
        return operation()
    except SapError:
        raise
    except Exception as error:
        cause = getattr(error, 'InnerException', None) or error
        hresult = getattr(cause, 'hresult', getattr(cause, 'HResult', None))
        code = f' HRESULT=0x{hresult & 0xffffffff:08X}' if isinstance(hresult, int) else ''
        raise SapError(f'{stage}: {type(error).__name__}{code}. Run diagnose-sap2000.cmd; check the SAP2000 Windows session and elevation level.') from error


@contextmanager
def connect():
    from .dotnet import ConnectionSettings, connect_dotnet
    with connect_dotnet(ConnectionSettings.from_environment()) as sap:
        yield sap
