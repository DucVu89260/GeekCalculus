# GeekCalculus · Structural Platform

Khung website kỹ thuật kết cấu chạy local: **Laravel 12 + SQLite + Vue 3/Vite**.
UI có nút **VI / EN**, danh mục đa ngôn ngữ từ database và form tạo/lưu dự án.

## Chạy local bằng Docker

Cần Docker Engine/Desktop với Docker Compose v2 và Bash (Windows dùng WSL).
Từ repository GeekCalculus:

```sh
cd structural-platform
bash scripts/setup.sh
docker compose up -d --wait
```

Mở trình duyệt trên máy local tại `http://localhost:5173`. API tại
`http://localhost:8000/api/health`. Các cổng chỉ được bind vào loopback của máy.
Onboarding cloud không cung cấp preview công khai; muốn chạy trên máy của bạn,
hãy đưa mã nguồn về máy và chạy các lệnh trên.

Dừng dịch vụ bằng `docker compose down`. Dự án được lưu trong
`backend/laravel/database/database.sqlite`, không bị xóa khi dừng container.
Script setup dùng lockfile, giữ `.env`/APP_KEY hiện có, và seed có thể chạy lại
mà không xóa dự án. Database, `.env`, dependencies và build outputs không được
lưu vào Git. Không dùng `migrate:fresh` trên database có dữ liệu cần giữ.

Trên Linux/macOS nếu UID/GID khác 1000, chạy lệnh với:

```sh
export LOCAL_UID=$(id -u)
export LOCAL_GID=$(id -g)
bash scripts/setup.sh
docker compose up -d --wait
```

Có thể sao chép `.env.example` thành `.env` ở thư mục này để đổi cổng Compose.
Cấu hình Laravel nằm riêng tại `backend/laravel/.env`.

## Chạy không dùng Docker

Cần PHP >= 8.3 (pdo_sqlite, mbstring, XML, curl), Composer 2 và Node 24.

```sh
cd backend/laravel
composer install
cp .env.example .env # chỉ khi chưa có .env
php artisan key:generate # chỉ khi APP_KEY chưa có
touch database/database.sqlite
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Trong terminal khác, từ `structural-platform`:

```sh
cd frontend/vue
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Vite proxy `/api` đến Laravel; Compose tự đổi đích thành `http://backend:8000`.
`BACKEND_PROXY_TARGET` cho phép đổi đích khi chạy frontend riêng.

## Chức năng hiện có

- Dashboard responsive, trạng thái API, danh sách dự án có phân trang.
- Form tên dự án và dropdown: loại công trình, mô-đun kết cấu, tiêu chuẩn,
  vật liệu và hệ đơn vị; tạo dự án thật qua API và lưu SQLite.
- 6 mô-đun: dầm/cột/sàn BTCT, thép, móng, tải gió.
- TCVN 5574:2018, 5575:2024, 2737:2023, Eurocode 2, ACI 318-19.
- 4 lựa chọn vật liệu, 2 hệ đơn vị, 3 loại công trình.
- Nút VI/EN đổi nhãn UI và danh mục, nhớ lựa chọn ở localStorage.

Các lựa chọn là danh mục ban đầu, chưa áp dụng quy tắc tương thích giữa tiêu
chuẩn/vật liệu/mô-đun và không chứa thông số thiết kế đã được kiểm chứng.
Chưa có tính toán, báo cáo, sửa/xóa dự án, đăng nhập hoặc phân quyền;
SAP2000/ETABS hiển thị trạng thái đang phát triển. Đây là bản phát triển local.

## Database đa ngôn ngữ

Một database, các bảng:

- `locales`: `vi`, `en`.
- `catalog_options`: mã ổn định, nhóm danh mục, thứ tự hiển thị.
- `catalog_option_translations`: tên theo ngôn ngữ, khóa duy nhất `(option_code, locale)`.
- `projects`: tên người dùng nhập, mã danh mục có khóa ngoại, trạng thái và thời gian.

Dữ liệu seed: [`database/seeds/catalog.json`](database/seeds/catalog.json).
Cập nhật danh mục/bản dịch ở đây rồi chạy `php artisan db:seed` trong backend
(hoặc `docker compose exec backend php artisan db:seed`). Không tự động dịch tên
người dùng nhập. Thêm ngôn ngữ mới cần bổ sung locale/seed, validation locale
trong API và dictionary UI tương ứng.

API:

| Method | Đường dẫn | Công dụng |
| --- | --- | --- |
| GET | `/api/health` | Kiểm tra API và kết nối database |
| GET | `/api/catalog?locale=vi` | Dropdown theo locale `vi` hoặc `en` |
| GET | `/api/projects?locale=en&page=1` | Dự án, 50 mục/trang và metadata |
| POST | `/api/projects?locale=vi` | Tạo dự án; trả lỗi 422 khi dữ liệu không hợp lệ |

POST dùng JSON `{name, project_type, module, standard, material, unit}`; các
lựa chọn phải là mã trong đúng nhóm. API dùng `Accept: application/json`.

## Kiểm tra

```sh
docker compose run --rm --no-deps backend php artisan test --compact
docker compose exec -T frontend npm run build
curl --fail http://localhost:5173/api/health
```

Smoke test trình duyệt nằm tại `tests/ui-smoke.cjs`; dùng Playwright với Chromium
đã cài, có thể truyền đường dẫn module và browser qua biến môi trường.
Test tạo một dự án `UI smoke ...` để kiểm tra lưu dữ liệu, cần dọn bản ghi đó
sau chạy nếu không muốn giữ trong database phát triển.

## Cấu trúc

`backend/laravel` chứa API; `frontend/vue` chứa UI; `database/seeds` chứa danh mục.
`engineering/api`, `engineering/structural_engine`, `csi-agent`, `docker` và
`tests` giữ vị trí cho các thành phần tiếp theo. Laravel dùng image Composer
có PHP/SQLite cho phát triển; chưa thiết lập image production.

## Tham khảo và giả định

Tham khảo các nhóm công cụ kết cấu và phong cách dashboard tối của
[tinhketcau.com](https://tinhketcau.com/); không sao chép thương hiệu hoặc tài sản
của trang. Bản thiết kế UI và danh mục này dựa trên cấu trúc dự án trong ngữ cảnh
hiện tại; chưa có nội dung chi tiết của cuộc trò chuyện GeekCalculus trước đó.
Luna max hỗ trợ phần Vue; backend, tích hợp và kiểm thử được thực hiện trong task.

Composer lock dùng endpoint archive chính thức `codeload.github.com` với commit
được pin vì proxy cloud không cho tải qua GitHub API. Setup giữ kiểm tra TLS,
và trong môi trường proxy sử dụng CA bundle của máy nếu có.
