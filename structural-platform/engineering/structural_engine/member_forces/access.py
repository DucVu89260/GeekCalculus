"""Read-only Windows process token inspection. Never expose account SIDs in responses."""
import os


def _identity(pid):
    result={'pid':pid,'elevated':None,'session_id':None,'sid':None,'error':None}
    if os.name!='nt':
        return result
    import ctypes as C
    from ctypes import wintypes as W
    kernel=C.WinDLL('kernel32',use_last_error=True)
    advapi=C.WinDLL('advapi32',use_last_error=True)
    kernel.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];kernel.OpenProcess.restype=W.HANDLE
    kernel.CloseHandle.argtypes=[W.HANDLE];kernel.CloseHandle.restype=W.BOOL
    advapi.OpenProcessToken.argtypes=[W.HANDLE,W.DWORD,C.POINTER(W.HANDLE)];advapi.OpenProcessToken.restype=W.BOOL
    advapi.GetTokenInformation.argtypes=[W.HANDLE,C.c_int,W.LPVOID,W.DWORD,C.POINTER(W.DWORD)];advapi.GetTokenInformation.restype=W.BOOL
    advapi.GetLengthSid.argtypes=[W.LPVOID];advapi.GetLengthSid.restype=W.DWORD
    process=kernel.OpenProcess(0x1000,False,pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    token=W.HANDLE()
    if not process:
        result['error']=C.get_last_error()
        return result
    try:
        if not advapi.OpenProcessToken(process,0x0008,C.byref(token)):  # TOKEN_QUERY
            result['error']=C.get_last_error()
            return result
        for token_class,key in [(20,'elevated'),(12,'session_id')]:
            value=W.DWORD();needed=W.DWORD()
            if advapi.GetTokenInformation(token,token_class,C.byref(value),C.sizeof(value),C.byref(needed)):
                result[key]=bool(value.value) if key=='elevated' else value.value
            else:
                result['error']=C.get_last_error()
        needed=W.DWORD()
        advapi.GetTokenInformation(token,1,None,0,C.byref(needed))
        if needed.value:
            buffer=C.create_string_buffer(needed.value)
            if advapi.GetTokenInformation(token,1,buffer,needed.value,C.byref(needed)):
                class SidAndAttributes(C.Structure):
                    _fields_=[('sid',W.LPVOID),('attributes',W.DWORD)]
                sid=C.cast(buffer,C.POINTER(SidAndAttributes)).contents.sid
                length=advapi.GetLengthSid(sid)
                if length:
                    result['sid']=C.string_at(sid,length)
            else:
                result['error']=C.get_last_error()
    finally:
        if token:
            kernel.CloseHandle(token)
        kernel.CloseHandle(process)
    return result


def access_report(pid, identity_reader=None):
    reader=identity_reader or _identity
    own=reader(os.getpid());target=reader(pid)
    return {'connector_pid':os.getpid(),'sap_pid':pid,
        'connector_elevated':own['elevated'],'sap_elevated':target['elevated'],
        'same_user':own['sid']==target['sid'] if own['sid'] is not None and target['sid'] is not None else None,
        'same_session':own['session_id']==target['session_id'] if own['session_id'] is not None and target['session_id'] is not None else None,
        'inspection_error':target['error'] or own['error']}


def access_hint(report):
    label=lambda value:'Administrator' if value is True else 'Thường' if value is False else 'Chưa đọc được'
    prefix=f"PID {report['sap_pid']}: Connector={label(report['connector_elevated'])}; SAP2000={label(report['sap_elevated'])}. "
    if report['same_user'] is False or report['same_session'] is False:
        return prefix+'Hãy chạy SAP2000 và connector trong cùng tài khoản/phiên đăng nhập Windows.'
    if report['connector_elevated'] is False and report['sap_elevated'] is True:
        return prefix+'SAP2000 đang chạy Administrator. Dừng connector rồi chạy start-sap2000-panel.cmd bằng Run as administrator.'
    if report['connector_elevated'] is True and report['sap_elevated'] is False:
        return prefix+'Mức quyền hai bên khác nhau. Hãy chạy SAP2000 và connector cùng mức quyền.'
    if report['inspection_error']:
        return prefix+f"Không đọc đủ quyền tiến trình (Windows error {report['inspection_error']}). Kiểm tra quyền và chạy chẩn đoán cùng PID."
    return prefix+'Helper không trả về đối tượng SAP2000. Chạy diagnose-sap2000.cmd --pid '+str(report['sap_pid'])+' để kiểm tra phiên này.'

