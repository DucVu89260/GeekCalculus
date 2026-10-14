# SectionalProperties v1 — engine và giao diện thử nghiệm

Lõi Python tính đặc trưng hình học của RECTANGLE, CIRCLE, I_SECTION,
RECTANGULAR_HOLLOW, CIRCULAR_HOLLOW, CHANNEL, TEE và ANGLE (solver 1.2.0).
Không cần vật liệu, Laravel, HTTP, database hoặc FEM để chạy phép tính.
Mã lõi nằm trong `structural_engine/sectional_properties/`.

## Chạy thử Python

Python >= 3.11. Trong thư mục `structural-platform/engineering`:

```sh
python -m venv .venv
# Linux/macOS/WSL
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements-test.lock
python -m pip install --no-deps .
python -m pytest -q
python -m structural_engine.sectional_properties < examples/i-asymmetric.json
```

PowerShell có thể dùng:

```powershell
Get-Content -Raw examples/i-asymmetric.json | python -m structural_engine.sectional_properties
```

Tệp mẫu: `examples/rectangle.json`, `circle.json`, `i-asymmetric.json`.
CLI trả JSON và exit code 0 khi thành công, JSON lỗi + exit code 2 khi từ chối.
CLI không tạo/sửa dữ liệu thư viện trên website. Khóa kích thước bắt buộc không
được đoán hoặc điền bằng số 0. Các trường không có trong schema bị từ chối.

## Docker độc lập

Từ `structural-platform`, build image dành cho nghiệm thu lõi:

```sh
docker build -t geekcalculus-sectional-properties:1.2.0 engineering
docker run --rm geekcalculus-sectional-properties:1.2.0 python -m pytest -q
docker run --rm -i geekcalculus-sectional-properties:1.2.0 < engineering/examples/i-asymmetric.json
```

Trên PowerShell, thay dòng cuối bằng:

```powershell
Get-Content -Raw engineering/examples/i-asymmetric.json | docker run --rm -i geekcalculus-sectional-properties:1.2.0
```

Image có CLI/test và FastAPI adapter; Compose khởi động API nội bộ ở port 8001.
Không mount database Laravel vào engine. Dependencies Python
đã pin trong `pyproject.toml` và `requirements-test.lock`; mpmath/Hypothesis/
pytest chỉ phục vụ nghiệm thu, không được import trong production solver.

## Dùng trong Python

```python
from structural_engine.sectional_properties import (
    CalculationOptions, calculate, validate_geometry_definition,
)

geometry = validate_geometry_definition({
    "type": "i_section", "geometry_variant": "sharp_corner",
    "dimensions": {
        "depth": 400, "top_flange_width": 200,
        "bottom_flange_width": 250, "web_thickness": 8,
        "top_flange_thickness": 12, "bottom_flange_thickness": 16,
    },
})
result = calculate(geometry, CalculationOptions(include_advanced=True))
print(result.properties.geometric.area)  # 9376
print(result.properties.plastic.pna_y)   # 102
print(result.model_dump_json(indent=2))
```

`calculate` chỉ nhận model đã validation, không đọc JSON thô. Geometry và
options được kiểm tra lại khi vào engine, kể cả model được dựng bằng
`model_construct`. Mỗi hình học có version và hash chuẩn hóa riêng.

## Kết quả và phạm vi

| Đại lượng | Rectangle đặc | Circle đặc | I/H cánh độc lập |
| --- | --- | --- | --- |
| A, perimeter, centroid, Ix/Iy/Ixy | Có | Có | Có |
| Sx+/Sx−/Sy+/Sy−, rx/ry | Có | Có | Có |
| PNA X/Y, Zx/Zy, principal inertias | Có | Có | Có |
| Saint-Venant J | Chuỗi có kiểm soát hội tụ | Công thức giải tích | `not_computed` |
| Cw, shear center, effective shear areas | `not_computed` | `not_computed` | Có · xấp xỉ thành mỏng |

Quy ước: mặt phẳng XY, X sang phải, Y lên trên, gốc O ở góc dưới trái
bounding box; moment quán tính quanh trục qua trọng tâm. Không đồng nhất
Ix/Iy với trục local CSI 1–2–3. Không có xoay, fillet hoặc composite/material
checks. RHS có góc vuông, CHS có bề dày đồng đều. Channel mở về phải, tee
có cánh trên, angle có chân dưới/trái; các mô hình không cần nhập polygon.
Chưa hỗ trợ polygon tùy ý. Cả 8 dạng có đầy đủ đặc trưng gross/elastic/plastic/
principal; J CHS = 2Ix chính xác. Các đặc trưng nâng cao RHS/U/C/T/L chưa
có solver sẽ trả `not_computed` với giá trị null và lý do.

Đơn vị mm/mm²/mm³/mm⁴/mm⁶; `Sx+` và `Sx−` luôn là hai trường riêng.
Principal inertias sắp theo lớn/nhỏ; góc của trục có moment lớn nhất đo từ X
ngược chiều kim đồng hồ, chuẩn hóa về (−90°, 90°]. Angle có Ixy khác 0
và góc trục chính tổng quát. Nếu Ix = Iy và Ixy = 0, góc không duy nhất,
nên trả `null` và `orientation_status=indeterminate`.

Mặc định tính plastic, không tính advanced. Bật `include_advanced=true` để
tính J Rectangle/Circle/CHS và Cw/tâm cắt/diện tích cắt hữu hiệu I/H; hoặc yêu cầu
các đại lượng qua `required_properties`. J của I/H vẫn chưa có solver.
`include_plastic=false` trả `properties.plastic=null`, có lý do `not_requested`
trong diagnostics. Đại lượng nâng cao có `status,value,reason,method`.
Cw là số với đơn vị mm⁶; tâm cắt là `{x,y,offset_x,offset_y}` theo mm,
diện tích cắt hữu hiệu là `{x,y}` theo mm². Ax ứng với Vx, Ay ứng với Vy.
Tọa độ tâm cắt dùng gốc hộp bao; offset tính từ trọng tâm tiết diện nguyên.
Các thuộc tính I/H mới là xấp xỉ theo đường trung bình thành mỏng Vlasov và
năng lượng cắt, không phải nghiệm đàn hồi 2D của tiết diện thành dày.
Phương pháp/giả thiết nằm trong `diagnostics.i_section_advanced`; xem công
thức và benchmark tại [đặc tả](docs/sectional-properties-v1.md).
Nếu riêng kết quả nâng cao tùy chọn vượt dải số, trả `not_computed` với
`reason=numerical_range` và giữ các đặc trưng tiết diện nguyên hợp lệ. Nếu
đại lượng đó được yêu cầu bắt buộc, trả `CALCULATION_ERROR`.
Không dùng J/Cw = 0 để biểu diễn thiếu solver. Nếu yêu cầu đại lượng bắt buộc
chưa hỗ trợ, engine ném `UnsupportedPropertyError` với code
`UNSUPPORTED_PROPERTY`; kết quả tùy chọn không hội tụ có value `null`.

J Rectangle dùng chuỗi Saint-Venant, không dùng Ix+Iy hoặc công thức gần đúng
không công bố độ chính xác. Tolerance mặc định 1e-10, tối đa 10.000 số hạng;
diagnostics có số hạng, chặn trên phần dư, ước lượng roundoff và trạng thái
hội tụ. Tolerance vượt khả năng float64 trả `numerical_precision_limit`.
Chặn sai số phần dư là giải tích; roundoff là ước lượng, chưa phải chứng nhận
interval arithmetic. Hình học có kích thước quá lớn/nhỏ làm kết quả ngoài
dải float64 bị từ chối bằng `CALCULATION_ERROR`.

PNA I/H/RHS/U/C/T/L dùng bisection diện tích, rồi refinement theo đoạn tuyến tính;
arithmetic Decimal 80 chữ số tránh triệt tiêu diện tích cánh gần bằng nhau.
Kiểm tra cân bằng diện tích tại chính tọa độ float64 được xuất. Zx/Zy tích phân
chính xác từng khối không chồng nhau quanh PNA tương ứng. Diagnostics có diện tích
hai cánh/bụng, clear web depth và PNA. Không lưu compact/noncompact/slender.

## Kiểm chứng và các mốc tiếp theo

Đặc tả, diễn giải công thức và nguồn kiểm chứng độc lập:
[docs/sectional-properties-v1.md](docs/sectional-properties-v1.md).

- **Package 01 hoàn tất:** models, validation, geometry version/hash.
- **Package 02 hoàn tất:** analytical engine, benchmarks, property-based tests,
  CLI và công cụ nghiệm thu.
- **Lưu catalog:** Laravel CRUD đã tính trên server và lưu snapshot JSON
  `sections.section_properties`, timestamp, hình học chuẩn hóa và provenance
  trong SQLite. GET trả snapshot đã lưu; import và cập nhật tính lại. Dữ liệu
  cũ không bị tự chuyển hệ trục. Lịch sử immutable revision/cache và
  PostgreSQL/JSONB vẫn là phần nâng cấp riêng chưa triển khai.
- **Package 04 tính nhanh hoàn tất:** FastAPI adapter và Laravel authenticated
  `/api/v1/sections/calculate`, `/api/v1/section-types`; có OpenAPI, error mapping
  và integration tests. CRUD lưu snapshot hiện dùng `/api/sections`;
  `/api/v1/sections/calculate` vẫn là phép tính không ghi database.
- **Package 05 tính nhanh hoàn tất:** Vue 3 + TypeScript, tab Section properties
  trong Steel Design và Concrete Design, ví dụ TC-001/002/003, hình vẽ theo tỷ lệ,
  bảng kết quả và export JSON. Lưu definition/history còn chờ Package 03.

Database website hiện là SQLite, users/projects dùng ID số; chưa có
calculation_runs/model_sections. Package 03 phải xử lý UUID và migration
PostgreSQL có đối chiếu/backup trước khi đổi kết nối. Snapshot mới là nguồn duy nhất của đặc trưng tự tính; các cột JSON
legacy chỉ giữ lại trên bản ghi chưa sửa. Không tự thay thế bản ghi cũ hoặc
map trục CSI chưa thống nhất.

## Chạy trên website

Từ `structural-platform`: `bash scripts/setup.sh` rồi `docker compose up -d --build`.
Đăng nhập, vào **Steel Design → Section properties** (tab bên cạnh Component và
Connection) hoặc **Concrete Design → Section properties**. Chọn ví dụ, nhấn
**Calculate / Tính toán**. Không cần chọn vật liệu để tính hình học.

Trong Admin → Thư viện → Tiết diện → Thêm/Sửa/Sao chép, nhóm kích thước có
minh họa tiết diện. Khi nhập đủ kích thước, form tự tính đầy đủ đặc trưng XY
cho cả 8 hình dạng. Tạo/sửa/sao chép/import lưu snapshot và thời điểm tính
trong database; A/I/S/Z/r/PNA và các đặc trưng nâng cao không nhập tay.
Bản ghi legacy chưa sửa vẫn giữ Iy/Iz/J và hệ trục nguồn.

Vue → Laravel (session, CSRF, throttle) → FastAPI → engine Python. Engine là
dịch vụ stateless, không ghi database. Nếu engine dừng, API tính trả 503 và
thư viện đã lưu vẫn đọc được. FastAPI không mở port public trong Compose.
Đặt SECTION_ENGINE_URL trong backend/laravel/.env khi chạy ngoài Compose.

Bản GitHub Pages dùng calculator TypeScript riêng để tính trong trình duyệt;
được đối chiếu với Python bằng `tests/demo-engine-parity.cjs`. Bản Docker dùng
Python. Demo giữ nguyên khóa localStorage và dữ liệu thư viện hiện có;
CRUD lưu snapshot trong localStorage, phép tính nhanh ngoài CRUD không tự lưu. Có thể export JSON kết quả. Chưa có PostgreSQL persistence
hoặc immutable revision/history cho definition; các phần đó vẫn ở Package 03.

Kiểm tra frontend: `npm run typecheck` và `npm run build` trong frontend/vue.
Kiểm tra engine: `docker compose exec -T section-engine python -m pytest -q`.
Kiểm tra parity: `ENGINE_PYTHON=/path/to/venv/bin/python node tests/demo-engine-parity.cjs`
(từ structural-platform). Kiểm tra browser: `tests/sectional-ui-smoke.cjs`,
AUTH_BASE_URL, PLAYWRIGHT_MODULE và AUTH_FIXTURES hoặc TEST_DEMO=1.
