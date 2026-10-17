"""Build a source-only Windows kit; never include environments, exports or tokens."""
from pathlib import Path
import hashlib
import re
import zipfile


def main():
    repo = Path(__file__).resolve().parents[2]
    source = repo / 'structural-platform' / 'engineering'
    output = repo / 'downloads' / 'API_IF_SAP26.2.0_V1.zip'
    output.parent.mkdir(exist_ok=True)
    files = [source / name for name in ['requirements-test.lock', 'requirements-windows.txt',
        'start-sap2000-panel.cmd', 'stop-sap2000-panel.cmd', 'diagnose-sap2000.cmd', 'SAP2000-API.md', 'CB-AISC360-10.md',
        'structural_engine/__init__.py']]
    for folder in ['member_forces', 'design']:
        files.extend(p for p in (source / 'structural_engine' / folder).rglob('*')
            if p.is_file() and p.suffix in ('.py', '.html') and '__pycache__' not in p.parts)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            data = path.read_bytes()
            if path.suffix == '.cmd':
                data = path.read_text().replace('\r\n', '\n').replace('\n', '\r\n').encode()
            archive.writestr(str(path.relative_to(source)).replace('\\', '/'), data)
        archive.writestr('BAT-DAU.txt', '''API_IF_SAP26.2.0_V1 — .NET/PID build 2026.10.17.11 — Panel 5 bước
1. Giải nén toàn bộ ZIP vào C:\\SAP2000-Forces; dừng connector cũ bằng Ctrl+C trước khi cập nhật.
2. Giữ .venv đang có; launcher tự cài/cập nhật dependencies, gồm pythonnet 3.2.1.
3. Mở SAP2000 26.2.0 và model đã phân tích. Dùng cùng tài khoản/mức quyền với connector.
4. Có thể mở nhiều phiên SAP2000. Không cần tìm hoặc nhập PID thủ công.
5. Nếu cổng 8010 bị chiếm: đóng các tác vụ xuất, chạy stop-sap2000-panel.cmd bằng Administrator.
   Sau đó chạy start-sap2000-panel.cmd, bấm Quét SAP2000 đang mở, chọn file/PID rồi Kết nối.
   Danh sách hiện tên file, đường dẫn và PID để phân biệt các model.
6. DLL: C:\\Program Files\\Computers and Structures\\SAP2000 26\\SAP2000v1.dll
7. Chọn Output Cases, chọn frame objects trong SAP2000, quay panel và lấy nội lực.
8. Nếu lỗi: chạy diagnose-sap2000.cmd, gửi kết quả, không gửi token.
Không cần Repair hay đăng ký COM Helper. PID có thể đổi sau khi khởi động lại SAP2000.
Đã kiểm tra adapter trên CLR thực và panel với SAP giả lập; cần nghiệm thu nội lực trên model thật.
''')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    readme = output.with_name('README.md')
    if readme.exists():
        readme.write_text(re.sub(r'SHA256: `[a-f0-9]+`', f'SHA256: `{digest}`', readme.read_text()))
    print(f'{output.name}: {output.stat().st_size} bytes; SHA256={digest}')


if __name__ == '__main__':
    main()
