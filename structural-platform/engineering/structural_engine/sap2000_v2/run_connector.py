"""Start V2 locally. Deliberately shares port8010 to exclude simultaneous V1 use."""
import argparse
import os
import secrets
import socket
import threading
import webbrowser
from urllib.parse import quote
import uvicorn
from .connector import create_app
from .contract import PORT


def main():
    parser=argparse.ArgumentParser(description='SAP2000 26.2.0 V2 local steel-data panel')
    parser.add_argument('--pid',type=int)
    parser.add_argument('--dll')
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    if args.pid is not None:os.environ['SAP2000_PID']=str(args.pid)
    else:os.environ.pop('SAP2000_PID',None)
    if args.dll:os.environ['SAP2000_DLL']=args.dll
    try:
        with socket.socket() as listener:listener.bind(('127.0.0.1',PORT))
    except OSError as error:
        raise SystemExit('Port8010 is occupied. Finish active reads and stop the V1/V2 connector with Ctrl+C first; do not close SAP2000.') from error
    token=os.environ.get('SAP2000_V2_TOKEN') or secrets.token_urlsafe(32)
    app=create_app(token)
    if not args.no_browser:
        timer=threading.Timer(1,lambda:webbrowser.open('http://127.0.0.1:'+str(PORT)+'/?lang=vi#token='+quote(token,safe='')))
        timer.daemon=True;timer.start()
    uvicorn.run(app,host='127.0.0.1',port=PORT,workers=1)


if __name__=='__main__':main()
