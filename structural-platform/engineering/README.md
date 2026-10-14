# Section Properties — API và benchmark

Production dùng một bộ tính TypeScript tại
[../section-properties](../section-properties/README.md). FastAPI gọi Node bundle
của package này; Laravel và demo trình duyệt nhận cùng kết quả/công thức.
Solver hiện tại 1.3.0, formula library 1.1.0. Python analytical solver được giữ
độc lập để kiểm chứng, không được dùng làm fallback khi production core lỗi.

Có 10 profile: Rectangle, Circle, CHS, SHS/RHS, Symmetric I/H, Asymmetric I/H,
Channel, Angle, Tee, Double Angle. Hai profile I/H dùng một geometry model,
nên API có 9 type và registry có 10 profile. Double Angle nhận `distance` g ≥ 0.
Tất cả loại có gross/elastic/plastic/principal, J/Cw/tâm cắt/Ax/Ay; phương pháp
và giới hạn của các mô hình nâng cao được công bố trong package README/registry.

## Local và nghiệm thu

Cần Node 24, Python >= 3.11. Từ `structural-platform`:

```sh
cd frontend/vue
npm ci
node ../../scripts/build-section-properties-core.cjs
cd ../../engineering
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-test.lock
python -m pip install --no-deps .
python -m pytest -q
python -m uvicorn structural_engine.sectional_properties.api.main:app --host 127.0.0.1 --port 8001
```

Windows PowerShell dùng `.venv\Scripts\Activate.ps1`. Build core trước khi cài
Python wheel để các file `data/section-core.mjs` và registry được đóng gói.
Có thể chạy production CLI trực tiếp:

```sh
node structural_engine/sectional_properties/data/section-core.mjs < examples/i-asymmetric.json
```

`python -m structural_engine.sectional_properties < examples/i-asymmetric.json`
chạy oracle Python cho benchmark (không có `formula_report`). Cả hai CLI trả
JSON, exit 0 khi thành công và exit 2 khi input bị từ chối. Không ghi database.

## Docker

Build context là **structural-platform**, bao gồm shared package và frontend lock:

```sh
docker build -f engineering/Dockerfile -t geekcalculus-sectional-properties:1.3.0 .
docker run --rm geekcalculus-sectional-properties:1.3.0 python -m pytest -q
docker run --rm -i geekcalculus-sectional-properties:1.3.0 node structural_engine/sectional_properties/data/section-core.mjs < engineering/examples/i-asymmetric.json
```

Docker build Node stage bundle cùng source, rồi đóng gói Node runtime và Python
adapter vào image. Compose chạy FastAPI nội bộ, không public port engine.
Không mount database Laravel vào engine. Khi cập nhật package/formulas, build
lại engine và UI cùng lúc để manifest hash khớp:

```sh
docker compose up -d --build --wait
```

Laravel `SECTION_ENGINE_URL` trỏ tới FastAPI; ngoài Compose đặt
`http://127.0.0.1:8001`. Engine lỗi thì tính/lưu trả 503; snapshot đã lưu vẫn đọc
được. Không chuyển sang một bộ công thức khác để tránh lệch kết quả.

## Contract và lưu trữ

API tính nhanh: `/v1/sections/calculate` (proxy Laravel authenticated tại
`/api/v1/sections/calculate`). `/v1/section-types` trả geometry schemas, registry
profiles và formula-library version. Input bắt buộc theo type; `profile_id`
tùy chọn xác định profile/symmetric I, `options.include_advanced=true` yêu cầu
đặc trưng nâng cao. Catalog luôn yêu cầu plastic và advanced.

Output canonical mm, gồm `properties`, `advanced`, normalized input, geometry
hash, solver version/config hash, diagnostics và `formula_report`. Report có
73 mục đặc trưng, công thức, ký hiệu, giá trị thay số, inputs, assumptions và
reference IDs. Coordinate system là XY từ góc dưới trái bounding box; không
tự chuyển Iy/Iz của catalog nguồn sang Ix/Iy. Cw 0 và tọa độ tâm cắt âm có thể
hợp lệ. Ax cho Vx, Ay cho Vy. Result unit mm/cm/m chỉ đổi hiển thị.

Thành mỏng dùng median-wall geometry. `diagnostics.advanced_model` ghi số liệu
chuẩn hóa với `normalization_length_mm`; các thuộc tính trả về vẫn là mm/mm²/
mm⁴/mm⁶. Rectangle J/Cw có kiểm tra hội tụ. Giá trị tùy chọn không tính được
là null với lý do; không dùng số 0 giả. Catalog từ chối lưu nếu thiếu thuộc tính.
Double Angle nâng cao giả thiết liên kết gót cứng lý tưởng để hai L làm việc
tổng hợp; g = 0 không tự giả định bụng hàn liên tục.

Admin tạo/sửa/sao chép/import tính lại trên server và lưu toàn bộ result vào
`sections.section_properties` + timestamp. GET đọc snapshot lịch sử không tính
lại. `$section->calculatedProperties()` và `$section->formulaReport()` dùng cho
các module sau. Import không tin các snapshot/công thức trong tệp người dùng.
Bản ghi thủ công cũ được giữ tới khi người dùng sửa/lưu. Chưa có immutable
revision/history hoặc PostgreSQL; database website hiện vẫn là SQLite.

## Kiểm chứng

Python tests gồm benchmarks độc lập, monomial/polygon references, mpmath cho
Saint-Venant J, property-based scaling/mirror/PNA và regression nâng cao.
`tests/test_advanced_models.py` kiểm tra đủ advanced cho 9 geometry models,
rectangle Fourier Cw, CHS A/2, RHS square/near-square, channel/torsion,
T/L zero warping và Double Angle gap/connection model.

```sh
# từ structural-platform
ENGINE_PYTHON=/path/to/venv/bin/python node tests/demo-engine-parity.cjs
# trong frontend/vue
npm test
npm run typecheck
# backend feature tests
# từ structural-platform
docker compose exec -T backend php artisan test --compact
```

Browser tests: `catalog-shapes-smoke.cjs` lưu/reload đủ 10 profile ở demo và
native; `catalog-section-smoke.cjs` kiểm tra snapshot/import/tự tính;
`sectional-ui-smoke.cjs` và `modules-smoke.cjs` kiểm tra UI, units và module.
Xem [../README.md](../README.md) cho cấu hình Playwright và tài khoản riêng.
Đặc tả công thức gross và benchmark lịch sử:
[docs/sectional-properties-v1.md](docs/sectional-properties-v1.md).

Bộ dữ liệu cơ học mở rộng được lưu tại `section_properties.mechanics`: đặc trưng quanh trục chính, mô đun uốn có liên kết Ixy, tích phân bậc ba, Wagner, mô đun xoắn/vênh/cắt và hệ số phân bố ứng suất. Xem [package Section Properties](../section-properties/README.md) cho định nghĩa/giả thiết; không chứa quy tắc tiêu chuẩn thiết kế.
