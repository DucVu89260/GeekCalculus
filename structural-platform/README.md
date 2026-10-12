# GeekCalculus · Structural Platform

Laravel 12 + SQLite + Vue 3/Vite. Trang đăng nhập có ảnh nền kết cấu, nút VI/EN
và phân quyền **admin/user**. Trang sử dụng gồm sáu nhóm chức năng trên nền xanh
nhạt; trang quản trị có thư viện kỹ thuật và quản lý tài khoản.

## Chạy local

Cần Docker Engine/Desktop, Docker Compose v2 và Bash (Windows: WSL).

```sh
cd structural-platform
bash scripts/setup.sh
docker compose up -d --wait
```

Giao diện: `http://localhost:5173`; health API: `http://localhost:8000/api/health`.
Các cổng chỉ bind loopback. Có thể đổi cổng bằng `.env` ở thư mục này;
cấu hình Laravel nằm riêng trong `backend/laravel/.env`.

Không tạo tài khoản hoặc mật khẩu backend mặc định. Tạo admin đầu tiên:

```sh
docker compose exec backend php artisan app:create-user admin@example.com --role=admin --name="Administrator"
```

Nhập mật khẩu riêng tại prompt (ít nhất 12 ký tự, tối đa 72 byte UTF-8). Thay email bằng email của bạn.
Sau khi đăng nhập, admin vào **Quản trị dữ liệu → Người dùng** để tạo/sửa/xóa
tài khoản và gán vai trò. Có thể tạo user qua CLI bằng `--role=user`.
Không đưa mật khẩu vào mã nguồn, lệnh command-line hoặc Git.

Với UID/GID khác 1000 trên Linux/macOS:

```sh
export LOCAL_UID=$(id -u)
export LOCAL_GID=$(id -g)
bash scripts/setup.sh
docker compose up -d --wait
```

`docker compose down` dừng dịch vụ, không xóa SQLite tại
`backend/laravel/database/database.sqlite`. Setup giữ `.env`/APP_KEY và dữ liệu
hiện có. Seed thư viện ban đầu chỉ chạy một lần; dữ liệu sửa/xóa bằng CRUD
không bị phục hồi khi restart hoặc chạy seed lại. Không chạy `migrate:fresh`
trên database cần giữ. `.env`, SQLite, dependencies và build outputs local
không được lưu vào Git.

## Đăng nhập và phân quyền

| Vai trò | Sau đăng nhập | Quyền |
| --- | --- | --- |
| Admin | Chọn giao diện quản trị hoặc sử dụng | CRUD thư viện/tài khoản, xem tất cả dự án; chuyển giao diện khi cần |
| User | Vào thẳng giao diện sử dụng | Xem thư viện, tạo/xem dự án của mình |
| Chưa đăng nhập | Màn hình đăng nhập | Không truy cập database/dự án/tài khoản |

Backend dùng session cookie HttpOnly, CSRF cho thao tác ghi và giới hạn lượt
đăng nhập. Password được hash bằng Laravel. Quyền được kiểm tra ở server,
không dựa vào việc ẩn nút trên UI. Chặn tự xóa/hạ quyền tài khoản admin đang
đăng nhập và bảo vệ admin cuối cùng. Dự án legacy không có chủ sở hữu chỉ admin
nhìn thấy. Tên người dùng nhập không được tự dịch.

## Database kỹ thuật và CRUD

Admin quản lý ba tab; user mở **Engineering Library / Thư viện kỹ thuật** để xem:

- **Vật liệu**: thép kết cấu, bê tông, thép cốt; mã, tên VI/EN, nguồn và thông số.
- **Loại tiết diện**: mẫu hình học I/H, U/C, L, T, hộp chữ nhật, ống tròn,
  BTCT chữ nhật và BTCT tròn. Mỗi loại hiển thị các trường thông số tương ứng.
- **Tiết diện cụ thể**: kích thước, vật liệu, loại tiết diện, nguồn dữ liệu và
  đặc trưng tiết diện bằng số. Loại tiết diện định nghĩa mẫu; các giá trị A/I/J
  thuộc từng tiết diện cụ thể, không gán một giá trị chung cho mọi kích thước.

Mỗi tab có tạo/xem/sửa/xóa, tìm kiếm, bộ lọc, xác nhận xóa và lỗi có nhãn đơn vị.
Vật liệu mới/sửa tên được đồng bộ với dropdown dự án. Không thể xóa vật liệu
đang được tham chiếu bởi tiết diện hoặc dự án; không thể xóa loại đang dùng.
Chặn đổi mã/hệ vật liệu/hình dạng nếu làm mất tính hợp lệ của tham chiếu.

**Đơn vị chuẩn:** chiều dài mm, diện tích mm², quán tính/xoắn mm⁴, mô đun chống
uốn mm³, vênh mm⁶, ứng suất MPa, khối lượng riêng kg/m³.

Thông số vật liệu: E, ν, ρ, giãn nở nhiệt α, tỷ số cản ξ; fy/fu với thép,
fc/ft/εcu với bê tông; cường độ thiết kế bê tông tùy chọn. G được suy ra bằng
`E / (2 × (1 + ν))` và hiển thị chỉ đọc.

Thông số tiết diện: h/b/D/t/tw/tf theo hình dạng; A, Iy, Iz, J, Wy, Wz, Ay, Az;
tùy chọn Iw, Wpy/Wpz, tọa độ tâm cắt, hệ số hiệu chỉnh diện tích/quán tính/xoắn,
khối lượng/trọng lượng. Với BTCT: lớp bảo vệ, diện tích cốt thép dọc, đường kính
thanh/đai và bước đai tùy chọn. Bán kính quán tính ry/rz được suy ra từ I/A.

Nhập các đặc trưng tiết diện theo catalog/nguồn đã kiểm chứng và thống nhất
trục địa phương y/z của nguồn. Hiện chưa tự tính A/I/J từ hình học hoặc chứng
nhận dữ liệu thiết kế; seed S235/B25/B30/CB400 là ví dụ có ghi nguồn minh họa.
Các trường BTCT hiện mô tả tiết diện gross đàn hồi và thông tin cốt thép cơ bản;
chưa có bố trí từng thanh, phân tích nứt/phi tuyến hoặc kiểm toán tiêu chuẩn.

Schema, giới hạn và đơn vị: `database/seeds/engineering-schema.json`.
Seed ban đầu: `database/seeds/engineering-data.json`; cấu trúc DB nằm trong
migrations Laravel. Baseline hiện có 4 vật liệu, 8 loại; không có tiết diện
số mặc định vì đặc trưng cần được nhập từ nguồn phù hợp.

Các bảng chính: `users` (role), `materials` (properties JSON), `section_types`,
`sections` (khóa ngoại vật liệu/loại), `projects` (user_id), `locales`,
`catalog_options`, `catalog_option_translations`, `library_seed_state`.
Nhãn vật liệu/tiết diện có `name_vi`/`name_en`; UI và schema đều song ngữ.

## API

Các request dùng `Accept: application/json`. API ứng dụng cần session đăng nhập.
Vite proxy `/api` tới Laravel; Compose đặt `BACKEND_PROXY_TARGET=http://backend:8000`.
Client lấy CSRF token, gửi cookie và header `X-CSRF-TOKEN` cho thao tác ghi.

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/api/health`, `/api/auth/csrf`, `/api/auth/me` | Public; me trả null nếu chưa đăng nhập |
| POST | `/api/auth/login`, `/api/auth/logout` | Session + CSRF |
| GET | `/api/catalog?locale=vi`, `/api/projects?locale=en&page=1` | Đăng nhập; dự án phân trang 50 mục |
| POST | `/api/projects` | Đăng nhập; dự án gắn với tài khoản hiện tại |
| GET | `/api/library/schema`, `/api/materials`, `/api/section-types`, `/api/sections` | Đăng nhập |
| POST/PATCH/DELETE | `/api/materials`, `/api/section-types`, `/api/sections` (PATCH/DELETE thêm `/{id}`) | Admin |
| GET/POST/PATCH/DELETE | `/api/admin/users` (PATCH/DELETE thêm `/{id}`) | Admin |

POST/PATCH thư viện gửi `code,name_vi,name_en` và:
- materials: `category,source,properties`.
- section-types: `category,shape`.
- sections: `material_id,section_type_id,source,properties`.

GET danh sách trả `{data:[...]}`; POST/PATCH `{data:record}`; DELETE `{data:null}`.
Lỗi 401 chưa đăng nhập, 403 sai quyền, 409 tham chiếu/xung đột, 422 dữ liệu sai.
PATCH thư viện gửi đầy đủ các trường của bản ghi; password tài khoản được bỏ
qua khi để trống trong form sửa. Không tự đăng ký tài khoản công khai.

## Thử trên web: GitHub Pages

`docs/` ở gốc repo chứa build demo. Bật **Settings → Pages → Deploy from a branch
→ main /docs → Save**. Sau khi GitHub deploy:
`https://ducvu89260.github.io/GeekCalculus/`.

Tại màn hình đăng nhập demo, có nút điền tài khoản:
- Admin: `admin@demo.geekcalculus.test`
- User: `user@demo.geekcalculus.test`
- Mật khẩu demo cho cả hai: `demo`

Đây chỉ là mô phỏng UI: dữ liệu nằm trong localStorage có thể sửa, đăng nhập
được lưu trong sessionStorage của tab, không phải xác thực/ phân quyền server.
Demo có thể thử CRUD và hai luồng giao diện, nhưng không bảo vệ dữ liệu thật,
không đồng bộ giữa trình duyệt/người dùng. Không dùng thông tin đăng nhập thật
trên demo. Laravel không chứa các tài khoản demo này.

Build lại từ gốc repository sau khi sửa UI/schema:

```sh
bash structural-platform/scripts/build-web-demo.sh
git add docs structural-platform
git commit -m "Update web demo"
git push origin main
```

Để có database dùng chung trên web, cần hosting PHP/database cho Laravel,
HTTPS, `APP_DEBUG=false`, secure session cookies và cấu hình domain phù hợp.
GitHub Pages chỉ phục vụ frontend tĩnh; task này chưa deploy Laravel lên hosting.

## Kiểm tra

```sh
docker compose run --rm --no-deps backend php artisan test --compact
docker compose exec -T frontend npm run build
```

`tests/auth-library-smoke.cjs` kiểm tra đăng nhập, chọn chế độ admin, CRUD cả ba
resource, người dùng chỉ xem, session/logout và mobile. Dùng Playwright với
Chromium; `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH` cho phép chỉ định đường dẫn.

Với backend thật: truyền `AUTH_FIXTURES` trỏ tới tệp JSON riêng chứa tài khoản
kiểm thử `{email,password,role}` cho admin và user. Không commit tệp đó.
Với demo: `TEST_DEMO=1 AUTH_BASE_URL=<địa chỉ demo>`; không cần tài khoản backend.
Các test tạo bản ghi `browser_fixture_*` và xóa sau khi chạy thành công; dọn
chúng nếu test bị ngắt. `tests/ui-smoke.cjs` kiểm tra dự án; `tests/demo-smoke.cjs`
kiểm tra lưu trữ demo riêng cho mỗi trình duyệt và không gọi server API.

## Chạy native (không dùng Docker)

Cần PHP >= 8.3 với pdo_sqlite, mbstring, XML, curl; Composer 2; Node 24.
Trong `backend/laravel`: `composer install`, tạo `.env` từ `.env.example` nếu
chưa có, tạo APP_KEY nếu trống, tạo SQLite nếu thiếu rồi `php artisan migrate
--seed`. Tạo tài khoản bằng `php artisan app:create-user ...`; chạy `php artisan
serve --host=127.0.0.1 --port=8000`. Trong terminal khác, ở `frontend/vue`,
chạy `npm ci` và `npm run dev -- --host 127.0.0.1 --port 5173`.

Các thư mục engineering/CSI vẫn là khung; chưa có tính toán, báo cáo hoặc
kết nối SAP2000/ETABS. Composer lock dùng archive chính thức codeload GitHub
với commit pin; setup giữ TLS verification và sử dụng CA bundle của máy.
