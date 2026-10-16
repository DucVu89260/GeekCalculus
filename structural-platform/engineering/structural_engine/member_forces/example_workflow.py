"""Local CLI example. Reads the token from the process, never writes it to disk."""
import json
import os
import urllib.request
from pathlib import Path
from .contract import API_PREFIX


def main():
    token = os.environ['SAP2000_CONNECTOR_TOKEN']
    base = 'http://127.0.0.1:8010' + API_PREFIX

    def call(path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(base + path, data=data, headers={
            'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)

    cases = call('/output-cases')['data']
    for i, case in enumerate(cases):
        print(i, case['kind'], case['name'], 'results:', case['results_available'])
    indices = [int(value) for value in input('Output case indices (comma separated): ').split(',')]
    selected = [{'name': cases[i]['name'], 'kind': cases[i]['kind']} for i in indices]
    data = call('/frame-forces', {'output_cases': selected})
    # Exclusive creation protects any existing exports.
    with Path('sap2000-forces.json').open('x', encoding='utf-8') as output:
        json.dump(data, output, ensure_ascii=False, indent=2)
    extremes = call('/extremes', {'dataset': data, 'scope': 'per_frame'})
    with Path('sap2000-extremes.json').open('x', encoding='utf-8') as output:
        json.dump(extremes, output, ensure_ascii=False, indent=2)
    print('Saved force dataset and per-frame extremes. Units: kN, m, kN.m; SAP local axes.')


if __name__ == '__main__':
    main()
