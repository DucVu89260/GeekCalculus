"""Synthetic observed-layout bytes only; not an actual CFS product fixture."""
import struct
from pathlib import Path

INCH_M = 0.0254
OPAQUE = b'COMBINATIONS-OPAQUE-NOT-A-CFS-PRODUCT-FILE\x00' + bytes(range(256))
SECTION = b'OPAQUE-CFSS-TEST-BYTES\x00\x01\xff'


def fixture(second_xt=True):
    data = bytearray(b'\x0bGCFS-TEST' + b'SYNTHETIC - NOT FOR CFS DESIGN'.ljust(120, b' ') + b'\x12\x34')
    data += bytes([2])
    member_offsets = []
    for start, end in [(-1, 6.5), (5.5, 13)]:
        name = b'C:\\SECTIONS\\Z200.cfss'
        data += struct.pack('<H', len(name)) + name + struct.pack('<d', 123.456)
        member_offsets.append(len(data))
        data += struct.pack('<ff', start / INCH_M, end / INCH_M) + bytes(range(21))
    supports = [(7, 0), (5, 3), (7, 6), (7, 12)]
    if second_xt:
        supports.insert(3, (5, 9))
    count_offset = len(data)
    data += bytes([len(supports)])
    for code, x in supports:
        data += struct.pack('<Bfff2s', code, x / INCH_M, 1.0, 2.0, b'\xaa\xbb')
    end_table = len(data)
    data += bytes([2])
    for name, magnitude in [(b'D', 1.25), (b'W', -0.75)]:
        data += name.ljust(20, b' ') + bytes([1])
        data += struct.pack('<Bffffff', 1, 0, -1 / INCH_M, 13 / INCH_M, magnitude, magnitude, 1)
    combination_offset = len(data)
    data += OPAQUE
    return bytes(data), {'member_offsets': member_offsets, 'count_offset': count_offset,
                         'end_table': end_table, 'combination_offset': combination_offset,
                         'support_count': len(supports)}


if __name__ == '__main__':
    import sys
    root = Path(sys.argv[1])
    (root / 'SECTIONS').mkdir(parents=True, exist_ok=True)
    data, offsets = fixture()
    (root / 'synthetic.cfsa').write_bytes(data)
    import json
    (root / 'offsets.json').write_text(json.dumps(offsets))
    (root / 'SECTIONS' / 'Z200.cfss').write_bytes(SECTION)
