"""Named, typed getter invocation using actual CSI interface metadata."""
from __future__ import annotations
from math import isfinite
from ..member_forces.dotnet import members, normalize
from .registry import GETTERS

MAX_VALUES = 500000


def block(status, method, *, data=None, reason=None, code=None, signature=None, **extra):
    return {'status': status, 'source': method, 'data': data, 'reason': reason,
            'return_code': code, 'signature': signature or [], **extra}


def cleaned(value, budget=None):
    budget = [MAX_VALUES] if budget is None else budget
    budget[0] -= 1
    if budget[0] < 0:
        raise ValueError('Returned data exceeds the per-getter safety limit')
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if not isfinite(value):
            raise ValueError('SAP returned a non-finite number')
        return value
    if isinstance(value, (tuple, list)):
        return [cleaned(v, budget) for v in value]
    if isinstance(value, dict):
        return {str(k): cleaned(v, budget) for k, v in value.items()}
    raise ValueError('Unsupported SAP output value type')


def field(result, name, default=None):
    data = result.get('data') or {}
    return next((v for k, v in data.items() if k.casefold() == name.casefold()), default)


class RuntimeReader:
    def __init__(self, model):
        self.model = model

    def _resolve(self, key):
        spec = GETTERS[key]
        parts = spec.path.split('.')
        target = self.model
        for name in parts[:-1]:
            target = getattr(target, name)
        if not all(hasattr(target, name) for name in ('_interface', '_system', '_target')):
            raise AttributeError('Actual CSI interface metadata is required')
        choices = [method for i in members(target._interface) for method in i.GetMethods()
                   if method.Name == parts[-1]]
        # Duplicate inherited declarations are identical; distinct overloads are not guessed.
        choices = {str(m): m for m in choices}
        if len(choices) != 1:
            raise AttributeError('Missing or ambiguous method on installed CSI interface')
        return target, next(iter(choices.values()))

    def describe(self, key):
        spec = GETTERS[key]
        try:
            _, method = self._resolve(key)
            return {'key': key, 'source': spec.path, 'group': spec.group, 'available': True,
                    'parameters': self._parameters(method), 'return_type': str(method.ReturnType),
                    'axes': spec.axes, 'notes': spec.notes}
        except Exception as error:
            return {'key': key, 'source': spec.path, 'group': spec.group, 'available': False,
                    'reason': type(error).__name__, 'axes': spec.axes, 'notes': spec.notes}

    @staticmethod
    def _parameters(method):
        return [{'name': p.Name, 'type': str(p.ParameterType), 'by_ref': bool(p.ParameterType.IsByRef),
                 'optional': bool(p.IsOptional)} for p in method.GetParameters()]

    def read(self, key, **inputs):
        if key not in GETTERS:
            raise ValueError('Getter is not allowlisted')
        spec = GETTERS[key]
        try:
            target, method = self._resolve(key)
        except Exception as error:
            return block('unsupported', spec.path, reason='Installed DLL has no verified method signature: '+type(error).__name__)
        signature = self._parameters(method)
        system = target._system
        parameters = list(method.GetParameters())
        values = system.Array[system.Object]([None] * len(parameters))
        lookup = {k.casefold(): v for k, v in inputs.items()}

        def typed(kind, value):
            if value is None:
                return system.Activator.CreateInstance(kind) if kind.IsValueType else None
            if kind.IsArray:
                result = system.Array.CreateInstance(kind.GetElementType(), len(value))
                for i, item in enumerate(value):
                    result[i] = typed(kind.GetElementType(), item)
                return result
            if kind.IsEnum:
                return system.Enum.ToObject(kind, int(value))
            return system.Convert.ChangeType(value, kind)

        try:
            for i, p in enumerate(parameters):
                kind = p.ParameterType.GetElementType() if p.ParameterType.IsByRef else p.ParameterType
                if p.Name.casefold() in lookup:
                    value = lookup[p.Name.casefold()]
                elif p.ParameterType.IsByRef:
                    value = None
                elif p.IsOptional:
                    value = p.DefaultValue
                else:
                    return block('unsupported_signature', spec.path, reason='Unknown required input '+p.Name, signature=signature)
                array = system.Array.CreateInstance(kind, 1)
                converted = typed(kind, value)
                if converted is not None:
                    array[0] = converted
                system.Array.Copy(array, 0, values, i, 1)
            returned = method.Invoke(target._target, values)
            data = {p.Name: normalize(values[i], system) for i, p in enumerate(parameters) if p.ParameterType.IsByRef}
            return_type = str(method.ReturnType)
            if return_type in ('System.Int32', 'System.Int64') and not method.ReturnType.IsEnum:
                code = int(returned)
                if code != 0:
                    return block('unavailable', spec.path, code=code, reason='SAP getter returned a nonzero status; no default substituted', signature=signature)
            else:
                code = None
                data['return_value'] = normalize(returned, system)
            data = cleaned(data)
            # CSI result arrays are per record; reject mismatches rather than zip/truncate.
            for counter in ('NumberResults', 'NumberNames', 'NumberTables', 'NumberItems', 'NumberHinges', 'NumberSprings'):
                count = next((v for k, v in data.items() if k.casefold() == counter.casefold()), None)
                if count is not None:
                    if not isinstance(count, int) or count < 0:
                        raise ValueError('Invalid returned count')
                    if any(isinstance(v, list) and len(v) != count for v in data.values()):
                        raise ValueError('Returned arrays do not match the SAP count')
            count = next((v for k, v in data.items() if k.casefold() in ('numberresults','numberitems','numberhinges','numbersprings','numbertables','numbernames')), None)
            return block('empty' if count == 0 else 'ok', spec.path, data=data, code=code,
                         signature=signature, axes=spec.axes)
        except Exception as error:
            # Never echo argument values (table contents, model data or tokens) in diagnostics.
            return block('invalid_data' if isinstance(error, ValueError) else 'call_failed', spec.path,
                         reason=type(error).__name__+': getter failed or returned invalid data', signature=signature)
