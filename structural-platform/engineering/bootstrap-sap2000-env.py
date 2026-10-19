"""Repair machine-specific virtual environments without deleting their contents.

Invoked by a healthy Python selected by the Windows launcher. Standard library only.
"""
from __future__ import annotations
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import socket
import stat
import struct
import subprocess
import sys
from uuid import uuid4

SUPPORTED_MINORS = (11, 12, 13)
PROBE = "import sys,struct,pip,json; print(json.dumps({'version':list(sys.version_info[:3]),'bits':8*struct.calcsize('P'),'prefix':sys.prefix,'executable':sys.executable}))"


class BootstrapError(RuntimeError):
    pass


def environment_python(root):
    return Path(root) / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def inspect_environment(root):
    executable=environment_python(root)
    if not executable.is_file():return None
    try:
        result=subprocess.run([str(executable),'-I','-c',PROBE],capture_output=True,text=True,timeout=15,check=False)
        if result.returncode:return None
        info=json.loads(result.stdout)
        version=info.get('version',[])
        if len(version)!=3 or version[0]!=3 or version[1] not in SUPPORTED_MINORS or info.get('bits')!=64:return None
        if os.path.normcase(str(Path(info['prefix']).resolve())) != os.path.normcase(str((Path(root)/'.venv').resolve())):return None
        return info
    except (OSError,ValueError,KeyError,TypeError,subprocess.TimeoutExpired):return None


def port_in_use(port=8010):
    try:
        with socket.socket() as sock:sock.bind(('127.0.0.1',port))
        return False
    except OSError:return True


def verify_driver():
    if sys.version_info.major!=3 or sys.version_info.minor not in SUPPORTED_MINORS or struct.calcsize('P')!=8:
        raise BootstrapError('Use Python 3.13, 3.12 or 3.11, 64-bit. Python 3.15 is not selected automatically.')
    try:
        import venv  # noqa: F401
        import ensurepip  # noqa: F401
    except ImportError as error:
        raise BootstrapError('A full Python installation with venv/ensurepip is required; the minimal embeddable distribution alone is insufficient.') from error


def ensure_environment(root):
    root=Path(root).resolve()
    info=inspect_environment(root)
    if info:return {'action':'reused','backup':None,'python':info}
    verify_driver()
    if port_in_use():raise BootstrapError('Port 8010 is occupied. Finish reads and stop the old connector with Ctrl+C before repairing its environment. SAP2000 may remain open.')
    target=root/'.venv';backup=None
    if target.exists() or target.is_symlink():
        attributes=getattr(target.lstat(),'st_file_attributes',0)
        if target.is_symlink() or attributes & getattr(stat,'FILE_ATTRIBUTE_REPARSE_POINT',1024):
            raise BootstrapError('The .venv path is a link/junction. Use a private environment directory rather than automatically changing a shared target.')
        if not target.is_dir():raise BootstrapError('The .venv path is not a directory; no files were changed.')
        backup=root/('.venv-backup-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid4().hex[:8])
        target.rename(backup)
    try:
        subprocess.run([sys.executable,'-I','-m','venv',str(target)],check=True)
    except (OSError,subprocess.CalledProcessError) as error:
        raise BootstrapError('Could not create the environment. Any previous environment was preserved at '+str(backup)) from error
    info=inspect_environment(root)
    if not info:raise BootstrapError('Created Python environment did not pass validation. Previous data remains in '+str(backup))
    return {'action':'rebuilt' if backup else 'created','backup':str(backup) if backup else None,'python':info}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent)
    parser.add_argument('--check',action='store_true',help='Check only; never create, move or install anything')
    args=parser.parse_args()
    if args.check:return 0 if inspect_environment(args.root) else 1
    try:
        result=ensure_environment(args.root)
        info=result['python']
        print('Python '+'.'.join(map(str,info['version']))+' / '+str(info['bits'])+'-bit: '+info['executable'])
        print('Environment: '+result['action'])
        if result['backup']:print('Previous environment preserved: '+result['backup'])
        return 0
    except BootstrapError as error:
        print('SAP2000 Python setup: '+str(error),file=sys.stderr)
        return 1


if __name__=='__main__':raise SystemExit(main())
