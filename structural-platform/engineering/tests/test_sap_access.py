import os
from structural_engine.member_forces.access import access_report,access_hint


def test_access_report_never_exposes_sids_and_explains_elevation_mismatch():
    def identity(pid):
        return {'pid':pid,'elevated':pid!=os.getpid(),'session_id':1,'sid':b'private-sid','error':None}
    report=access_report(17340,identity)
    assert report['same_user'] is True and report['same_session'] is True
    assert 'sid' not in str(report) and 'private' not in str(report)
    assert 'Run as administrator' in access_hint(report)
    report['same_session']=False
    assert 'phiên đăng nhập' in access_hint(report)


def test_unknown_access_is_not_reported_as_a_confirmed_matching_level():
    def identity(pid):
        return {'pid':pid,'elevated':None,'session_id':None,'sid':None,'error':5}
    report=access_report(17340,identity)
    assert report['same_user'] is None and report['same_session'] is None
    assert 'Windows error 5' in access_hint(report)
