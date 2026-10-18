"""Inspect installed getter signatures; never print a connector token."""
import argparse
import json
from pathlib import Path
from ..member_forces.dotnet import ConnectionSettings, DEFAULT_DLL
from ..member_forces.sap2000 import SapError
from .worker import run_worker


def main():
    parser=argparse.ArgumentParser(description='V2 read-only installed DLL capability diagnostics')
    parser.add_argument('--pid',type=int)
    parser.add_argument('--dll',default=DEFAULT_DLL)
    parser.add_argument('--json',help='New output file; existing files are not overwritten')
    args=parser.parse_args()
    try:
        result=run_worker('capabilities',ConnectionSettings(pid=args.pid,dll_path=args.dll))
        available=[r for r in result['data'] if r['available']]
        missing=[r for r in result['data'] if not r['available']]
        print('API_IF_SAP26.2.0_V2 - local capability report')
        print('PID:',result['pid'],'- available:',len(available),'- unsupported:',len(missing))
        for item in missing:print('UNSUPPORTED:',item['source'],item['reason'])
        if args.json:
            target=Path(args.json)
            with target.open('x',encoding='utf-8') as stream:json.dump(result,stream,ensure_ascii=False,indent=2,allow_nan=False)
            print('Report saved:',target)
        print('Do not share connector tokens. Capability presence is not proof of a successful model read.')
    except (SapError,OSError) as error:
        print('FAILED:',str(error));return 1
    return 0


if __name__=='__main__':raise SystemExit(main())
