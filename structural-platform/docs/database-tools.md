# Docker và công cụ quản trị database

Website hiện dùng **SQLite**, file `backend/laravel/database/database.sqlite`.
SQLite Web trong Docker và DB Browser for SQLite trên Windows đều mở file này.
Không tạo database PostgreSQL thứ hai hoặc reset dữ liệu đang có.

## Windows tại D:\GEEK\GeekCalculus\GeekCalculus

Môi trường Codex cloud không thể cài phần mềm trực tiếp trên máy Windows của bạn.
Script sau cài Docker Desktop và DB Browser for SQLite qua WinGet, giữ kiểm tra
hash/signature của trình cài đặt. Chạy PowerShell trên máy Windows, với quyền
Administrator nếu trình cài đặt yêu cầu:

```powershell
cd D:\GEEK\GeekCalculus\GeekCalculus
git pull origin main
powershell -ExecutionPolicy RemoteSigned -File .\structural-platform\scripts\install-windows-tools.ps1
```

Docker Desktop dùng **Linux containers / WSL2**. Hoàn tất màn hình thiết lập đầu
và khởi động lại Windows nếu được yêu cầu. Nếu WinGet chưa có, cài/cập nhật
Microsoft **App Installer** trong Microsoft Store. Nếu WSL2 chưa có, dùng
`wsl --install` trong PowerShell Administrator và khởi động lại khi yêu cầu.
Máy phải bật hỗ trợ virtualization; Docker Desktop sẽ báo nếu còn thiếu.

Trong terminal mới, kiểm tra:

```powershell
docker version
docker compose version
```

Nếu chưa chạy website local hoặc file SQLite chưa có, khởi tạo ứng dụng bằng
script PowerShell (không cần cài PHP, Node hoặc Composer trên Windows):

```powershell
powershell -ExecutionPolicy RemoteSigned -File .\structural-platform\scripts\setup-windows-local.ps1
```

Script giữ `.env`, APP_KEY và SQLite đã có; migration/seed chỉ bổ sung cần thiết,
không dùng migrate:fresh. Nó khởi động website, Python engine và SQLite Web.
Không tạo tài khoản admin/mật khẩu thật mặc định. Tạo admin bằng prompt riêng:

```powershell
cd structural-platform
docker compose exec backend php artisan app:create-user YOUR_EMAIL --role=admin --name=Administrator
```

Các script Windows được chuẩn bị và kiểm tra tĩnh; chưa thể thực thi trên máy
Windows từ cloud. Docker, SQLite Web và launcher đã chạy và kiểm chứng trên cloud.

## Mở SQLite Web

Khi database đã có, từ `structural-platform`:

```powershell
powershell -ExecutionPolicy RemoteSigned -File .\scripts\start-db-tools.ps1
```

Hoặc Linux/macOS/WSL:

```sh
bash scripts/start-db-tools.sh
```

Mở trình duyệt trên **máy chạy Docker**, nhập `http://localhost:8080`.
Có thể xem bảng `materials`, `section_types`, `sections`, `projects`, `users`;
lọc dữ liệu, xem cấu trúc, chạy SQL và insert/update/delete, import/export.
Website local chạy ở `http://localhost:5173`.

Tool là Compose project riêng, không tự khởi động khi chạy website thông thường:

```sh
docker compose -f compose.db-tools.yaml ps
docker compose -f compose.db-tools.yaml logs --tail 30 database-ui
docker compose -f compose.db-tools.yaml down
```

Chỉ bind `127.0.0.1`; không xuất database quản trị lên GitHub Pages/public web.
Đổi cổng: đặt `DB_TOOLS_PORT=8081` trong `.env` ở `structural-platform` hoặc
biến môi trường. Mật khẩu tùy chọn: `DB_TOOLS_PASSWORD` trong `.env` riêng
(không commit); khi đặt, UI yêu cầu đăng nhập. Linux/macOS dùng LOCAL_UID/GID
của tài khoản đang chạy, giống cấu hình website. Khởi động qua các script trên
để tạo thư mục backup với quyền phù hợp trước khi Docker mount.

## Mở bằng DB Browser for SQLite

Trên Windows, mở **DB Browser for SQLite → Open Database** và chọn:

```text
D:\GEEK\GeekCalculus\GeekCalculus\structural-platform\backend\laravel\database\database.sqlite
```

Tab **Database Structure** xem bảng/schema; **Browse Data** xem/sửa bản ghi;
**Execute SQL** chạy câu lệnh; **Write Changes** ghi thay đổi. Chọn **Open
Database** để mở file có sẵn. SQLite không cần host, username hoặc password DB.
Không cần cài PostgreSQL để mở SQLite này.

## Sao lưu và dữ liệu đã nhập

Mỗi lần SQLite Web khởi động, launcher dùng SQLite Backup API để tạo bản sao
nhất quán vào `backend/laravel/storage/app/private/database-backups/`, rồi kiểm
tra `integrity_check`. Backup bao gồm cả tài khoản/dự án/thư viện, được loại khỏi
Git. Tool từ chối file thiếu/rỗng, không âm thầm tạo DB mới. Dừng/restart container
không xóa database. Kết nối UI bật foreign keys, synchronous=FULL và busy timeout
5 giây; tránh mặc định synchronous=OFF của image upstream. Image pin bằng digest.

Để khôi phục, dừng website backend và SQLite Web, giữ bản sao file hiện tại,
rồi dùng file backup thay cho `database.sqlite` và xử lý các sidecar WAL/SHM
của file cũ khi tất cả kết nối đã đóng. Nếu chỉ chuyển thư viện, dùng JSON Export /
Import trong giao diện Admin để giữ tham chiếu theo mã ổn định.

**Web demo GitHub Pages lưu dữ liệu trong localStorage của trình duyệt**, khác
với SQLite. Muốn mang thư viện đã nhập trên demo về local: Admin → Thư viện →
Export JSON; đăng nhập Admin local → Import JSON. Không cần nhập lại từng dòng.
Git pull chỉ cập nhật code, không chuyển database hoặc localStorage.

Các dữ liệu vật liệu/tiết diện nên nhập qua CRUD Admin để được validation và
quy ước đơn vị. SQL GUI cho phép thao tác trực tiếp ngoài lớp validation của
Laravel; kiểm tra dữ liệu và dùng backup khi chỉnh trực tiếp.
