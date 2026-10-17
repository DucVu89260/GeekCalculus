# CFS Lapping and Node Add-in

Open Steel Structure → CFS Design → CFS Lapping and Node Add-in
(`#/modules/steel/cfs/lapping-node`). Works in native Vue and GitHub Pages.

## Sử dụng

1. Đợi thông báo **Python sẵn sàng**. Lần đầu tải runtime khoảng 12 MB, từ cùng website.
2. Chọn file `.cfsa` đã lưu từ CFS, rồi **Chọn thư mục SECTIONS** chứa các `.cfss` tương ứng. Nhấn **Import .cfsa**.
3. Chọn vùng lap trên sơ đồ hoặc dòng trong bảng. Chỉnh độc lập Lap Left/Lap Right. Tab Supports & Bracing cho phép dịch chuyển XT và Preview/Apply bố trí XT cho các nhịp đã chọn. Gối XYT được khóa.
4. **Save Draft / Load Draft** lưu và tải bản nháp trong trình duyệt hiện tại. **Export JSON / Import JSON Draft** sao lưu hoặc chuyển bản nháp sang máy khác. Đây không phải dữ liệu lưu trên Laravel; xóa dữ liệu trình duyệt sẽ xóa bản nháp tại đó.
5. Nhấn **Export CFSA TEST COPY**, đọc và xác nhận cảnh báo. Trình duyệt tải bản `<tên>_WEBTEST.cfsa`; không ghi vào file gốc. Đặt bản sao trong môi trường mô hình/SECTIONS phù hợp, mở lại bằng CFS 11.0.2 và đối chiếu trước khi dùng.

Sau reload/Load Draft, chọn và Import lại CFSA gốc cùng SECTIONS, rồi Load Draft để khôi phục chỉnh sửa trước khi export. Hash phải khớp bản gốc; thiếu section sẽ chặn export. Chọn lại một file CFSA khác cũng yêu cầu Import trước khi export.

CFSA giới hạn 10 MB. SECTIONS giới hạn 2000 file / 50 MB; tên không được trùng, kể cả khác chữ hoa/thường. JSON giới hạn 2 MB. Không cài Python Windows, không mở port 8765 và không chạy bridge khi dùng bản web. Các nút trong studio giữ ngôn ngữ gốc của package; phần điều hướng GeekCalculus hỗ trợ VI/EN.

## Kiến trúc và nguồn

Package người dùng cung cấp: `geekcalculus_cfs_z_lapping_and_node.zip`, portable UI v0.5D.1, SHA-256 `9f7e542ef1703d7320b90de6bd7cf795d83c5336cff70bd4355dca2fdff56456`.

`public/cfs-lapping-node/python/{cfsa_reader,adapter,cfsa_patch,cfsa_insert}.py` giữ nguyên byte từ ZIP. `upstream-manifest.json` ghi hash bốn module và chín hàm hình học/chỉnh sửa UI gốc. Không có bản dịch thuật toán sang JS/PHP hoặc solver thứ hai. `browser_api.py` chỉ bổ sung kiểm tra dữ liệu và I/O cho hệ thống file ảo, chọn file và xuất byte qua worker.

Pyodide **0.29.3** được pin trong package-lock. `scripts/build-cfs-browser.cjs` chuẩn bị runtime vào thư mục generated `public/cfs-runtime` trong `predev`/`prebuild`; Vite copy sang đầu ra, bao gồm Pages. Không tải Python từ CDN ngoài. Runtime worker không mount filesystem máy thật. Browser file pickers chỉ đọc các file được người dùng chọn; không upload CFSA, CFSS hoặc draft lên API. Bridge HTTP/tkinter/BAT/pyc trong ZIP không được triển khai lên server.

Draft cache có key theo user ID để tránh nhầm bản nháp khi chuyển tài khoản trong UI; đây là cache cục bộ, **không** là ranh giới phân quyền server. JSON backup là cách chuyển và giữ dữ liệu lâu dài. Đóng tab/reload giải phóng project ảo; bản nháp không lưu byte gốc hoặc nội dung section.

Pyodide runtime được phân phối nguyên bản theo MPL-2.0; [license](public/cfs-lapping-node/PYODIDE-LICENSE.txt), [mã nguồn phiên bản](https://github.com/pyodide/pyodide/tree/0.29.3), [gói npm](https://www.npmjs.com/package/pyodide/v/0.29.3). CPython trong runtime là 3.13.2: [license](public/cfs-lapping-node/CPYTHON-LICENSE.txt), [source](https://github.com/python/cpython/tree/v3.13.2). Không sửa các runtime artifacts.

## Giới hạn giữ nguyên từ portable

- Decoder chỉ xử lý binary layout đã quan sát của CFS 11; không phải đặc tả định dạng chính thức.
- Quy đổi tọa độ inch → m vẫn **provisional**. Mã 7=XYT, 5=XT chưa được xác minh; YT chưa có mapping. Tải giữ đơn vị native, không giả định kN/m.
- Chỉ sửa vùng lap, XT và các trường được exporter cho phép; không đổi section, main bearing, flags hoặc tổ hợp tải. CFSS chỉ được resolve theo tên/file tồn tại, chưa được phân tích hay kiểm chứng nội dung.
- Thêm XT cần template gốc trong cùng nhịp. Các giới hạn số lượng, span và xuất negative supports giữ nguyên. Domain âm của member vẫn được hiển thị.
- Export là **EXPERIMENTAL COPY ONLY**. Không có solver sức kháng hay kết luận thiết kế PASS. Kiểm thử binary/browser không chứng minh CFS thực tế chấp nhận file; chưa có file mô hình thật hoặc CFS 11.0.2 để nghiệm thu product read-back.

## Build và kiểm thử

Từ `structural-platform/frontend/vue`:

```sh
npm ci
npm run typecheck
npm test
npm run build -- --outDir /tmp/geek-cfs-build --emptyOutDir
python3 -m unittest discover -s ../../tests/cfs -v
```

Để cập nhật Docker local đang chạy (từ `structural-platform`, sau `git pull`):

```sh
docker compose run --rm --no-deps frontend npm ci --no-audit --no-fund
docker compose restart frontend
```

Không migration, reset dữ liệu hoặc rebuild section-engine cho module browser này. Frontend production dùng quy trình build hiện có. `predev` và `prebuild` tự chuẩn bị runtime sau `npm ci`.

Từ root repo, với Playwright/Chromium đã có:

```sh
CFS_BASE_URL=http://127.0.0.1:5173/ AUTH_FIXTURES=/private/test-accounts.json \
  node structural-platform/tests/cfs-portable-smoke.cjs
```

Demo dùng `TEST_DEMO=1` và URL của bản build static. Có thể đặt `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `ENGINE_PYTHON`. Không commit account fixtures. Browser smoke tạo fixture **tổng hợp**, chạy Python thật trong worker, đối chiếu byte lap độc lập, kiểm tra XT insert/delete, immutable original/combination, draft reload, missing sections/source gate, không upload và 320/390 px. Python suite kiểm tra thêm schema/path/hash, tên section khác case và tính nguyên bản của core/UI. CI chạy Python suite cùng các kiểm thử hiện có.
