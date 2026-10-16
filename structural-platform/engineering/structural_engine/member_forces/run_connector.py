"""Run a local web panel and one COM worker in the Windows SAP2000 session."""
import argparse
import os
import secrets
import threading
import webbrowser
from urllib.parse import quote
import uvicorn
from .connector import create_app


def main():
    parser = argparse.ArgumentParser(description='API_IF_SAP26.2.0_V1 local web panel')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--pid', type=int, help='PID of the running SAP2000 instance')
    parser.add_argument('--dll', help='Full path to the installed SAP2000v1.dll')
    args = parser.parse_args()
    if args.pid is not None:
        os.environ['SAP2000_PID'] = str(args.pid)
    if args.dll:
        os.environ['SAP2000_DLL'] = args.dll
    token = os.environ.setdefault('SAP2000_CONNECTOR_TOKEN', secrets.token_urlsafe(32))
    app = create_app(token)
    if not args.no_browser:
        # Fragment is never sent in HTTP requests or access logs; panel clears it immediately.
        timer = threading.Timer(1, lambda: webbrowser.open('http://127.0.0.1:8010/#token=' + quote(token, safe='')))
        timer.daemon = True
        timer.start()
    uvicorn.run(app, host='127.0.0.1', port=8010, workers=1)


if __name__ == '__main__':
    main()
