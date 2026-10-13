# GeekCalculus · Structural Platform

Laravel 12 + SQLite + Vue 3/Vite. Trang đăng nhập có ảnh nền kết cấu, nút VI/EN
và phân quyền **admin/user**. Trang sử dụng gồm sáu nhóm chức năng trên nền xanh
xám dịu; trang quản trị có thư viện kỹ thuật và quản lý tài khoản.

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

**Design Code:** cột thị trường của vật liệu và loại tiết diện, dropdown
`EN`, `AISC/ACI`, `AS`, `VN`. Có thể để **Chưa phân loại**; database lưu `null`.
Phân loại của bản ghi cũ và seed được giữ nguyên để người dùng tự lựa chọn.
Metadata không tự chọn tiêu chuẩn tính toán, chứng nhận sự phù hợp của vật
liệu hoặc đổi đơn vị.

Dropdown Design Code hiển thị cờ SVG: **EN → EU**, **AISC/ACI → Mỹ**,
**AS → Úc**, **VN → Việt Nam**. Icon xuất hiện trong từng lựa chọn, giá trị
đã chọn và cột Design Code; hoạt động trên Windows không phụ thuộc emoji.
Có thể chọn bằng chuột hoặc Arrow Up/Down, Home/End, Enter/Space; Escape
hủy lựa chọn đang trỏ, Tab hoặc click bên ngoài đóng danh sách.
**Chưa phân loại** là giá trị đang lưu, không phải danh sách bị thiếu VN:
mở dropdown → chọn VN → lưu thay đổi để gán cho bản ghi. Nếu trang vẫn
hiển thị giao diện cũ sau GitHub Pages deploy, dùng Ctrl+F5 để tải lại.

**Region type:** cột nhóm catalog nhỏ hơn trên loại tiết diện, ví dụ W, H,
IPE, HEA, UB, UC. Form cho nhập nhãn riêng (tối đa 64 ký tự) và có gợi ý theo
Design Code/hình dạng. Các nhãn là gợi ý phân loại, chưa có catalog kích thước
chuẩn hoặc tiết diện số được nạp tự động. Ví dụ: tạo loại mã `aisc_w`, hệ
**Thép**, hình dạng **I/H**, Design Code **AISC/ACI**, Region type **W**;
sau đó thêm các tiết diện cụ thể và số liệu đã kiểm chứng thuộc loại đó.
BTCT vẫn có thể điền Region type riêng, không bị ép dùng nhóm tiết diện thép.

Tiết diện cụ thể lấy Design Code/Region type từ loại tiết diện đang tham chiếu,
không lưu thêm bản sao dễ lệch dữ liệu. Bảng thư viện có cột/bộ lọc phân loại,
Steel Design có lọc thị trường/nhóm catalog; mặc định xem tất cả để dữ liệu
cũ chưa phân loại vẫn hiện. Phân loại không thay đổi hình học hoặc thông số.
Các ảnh SAP2000 người dùng đưa là tham khảo cấu trúc dữ liệu; không tự nạp
các trị số trong ảnh, vốn có thể dùng hệ đơn vị/trục khác schema của ứng dụng.

Mỗi tab có tạo/xem/sửa/xóa, tìm kiếm, bộ lọc, xác nhận xóa và lỗi có nhãn đơn vị.
Admin có nút **Sao chép / Copy** trên từng bản ghi của cả ba tab. Nút mở form
**Tạo mới từ bản sao** với tên VI/EN, nguồn, Design Code, Region type,
thông số cơ lý và liên kết vật liệu/loại tiết diện của bản gốc. Không sao chép
ID hoặc ghi đè bản gốc. Mã mới được gợi ý dạng `ma_copy`, `ma_copy_2`…;
có thể đổi mã và các giá trị trước khi nhấn **Tạo mục / Create record**.
Chọn Copy chưa ghi dữ liệu; hủy form giữ nguyên thư viện. Mã trùng bị từ chối.
G và bán kính quán tính được suy ra lại từ thông số của bản mới. User chỉ
xem không có nút Copy; sao chép dùng cùng API tạo mới và quyền admin hiện có.
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
trục địa phương y/z của nguồn. Thư viện lưu các số liệu tiết diện người dùng
nhập; seed S235/B25/B30/CB400 là ví dụ có ghi nguồn minh họa.
Các trường BTCT hiện mô tả tiết diện gross đàn hồi và thông tin cốt thép cơ bản;
chưa có bố trí từng thanh, phân tích nứt/phi tuyến hoặc kiểm toán tiêu chuẩn.

### Geometry Models / Analytical Engine

Mô hình kiểm thử hình học nằm trong **Section Properties / Đặc trưng tiết diện**.
Tab **Section properties** trong **Steel design** và **RC design** dùng chung
component với trang này: cùng 5 mô hình hình học, kiểm tra kích thước, hình
minh họa và đổi đơn vị kết quả mm/cm/m. Chuyển tab thiết kế giữ kết quả trong
phiên hiện tại. Mục mở rộng **I/H bất đối xứng và đặc trưng nâng cao** giữ bộ
tính dùng chung Python/demo với tính xoắn và xuất JSON. Trong Steel/RC, mục
nâng cao chỉ chọn I/H không đối xứng (cánh trên/dưới nhập độc lập). Có bộ chọn
**Result unit** mm/cm/m cho toàn bộ kết quả, gồm Cw (L⁶), tọa độ/độ lệch tâm
cắt (L) và diện tích cắt hữu hiệu Ax/Ay (L²). Ba thuộc tính I/H nâng cao dùng
xấp xỉ thành mỏng được ghi rõ trên UI và trong metadata. JSON xuất giữ đơn
vị gốc mm, kèm `display_unit` để xác định đơn vị hiển thị.
Package 01 định nghĩa input schema phiên bản 1 và `GeometryDefinition`; Package 02 tính A, chu vi,
trọng tâm, Ix/Iy/Ixy, mô đun chống uốn đàn hồi Sx/Sy theo phía dương/âm, mô đun
dẻo Zx/Zy, rx/ry, trục trung hòa dẻo và mô men/trục quán tính chính.
Entrypoint public của hai package là `frontend/vue/src/geometry-models.js` và
`frontend/vue/src/analytical-engine.js`.

Input nhận hình chữ nhật đặc (b, h), hình tròn đặc (D), I/H đối xứng góc
vuông (b, h, tw, tf), CHS — ống tròn (D, t), và SHS/RHS — hộp vuông/chữ nhật
(b, h, t). D/b/h là kích thước ngoài; t là bề dày thành đồng đều. SHS là trường
hợp b = h của mô hình hộp. Góc hộp hiện là góc vuông, chưa xét bán kính lượn.
Tất cả kích thước trong một định nghĩa dùng chung một đơn vị chiều dài: mm, cm,
m hoặc in. Kết quả giữ đơn vị đó với số mũ tương ứng cho
diện tích, quán tính và mô đun. Bộ chọn **Đơn vị kết quả / Result unit** đổi
mm/cm/m ngay sau tính, không đổi kích thước/đơn vị input và không cần tính lại.
API `convertSectionProperties(properties, targetUnit)` chuyển toàn bộ kết quả
với số mũ đúng (chiều dài 1, diện tích 2, S/Z 3, I 4), giữ nguyên góc trục
và không sửa đối tượng gốc. Chu vi tiết diện rỗng là tổng biên ngoài và biên
trong. Bộ kiểm tra từ chối kích thước không hữu hạn,
không dương, bụng I/H rộng bằng/rộng hơn cánh, cánh giao nhau, hoặc 2t lớn
bằng/lớn hơn D (ống tròn) hay min(b, h) (hộp); engine báo lỗi
khi kết quả vượt phạm vi số máy có thể biểu diễn.

Quy ước trục của engine: gốc tại góc dưới trái hộp bao, +x sang phải theo bề
rộng, +y hướng lên theo chiều cao. Ix là mô men quanh trục ngang x và Iy quanh
trục đứng y. Góc trục quán tính chính lớn đo ngược chiều kim đồng hồ từ +x,
theo modulo 180°. Hình tròn và hình vuông có hai mô men chính bằng nhau nên
hướng trục chính không xác định. Nếu nguồn dùng trục y theo chiều cao và z theo
bề rộng thì Ix tương ứng Iz nguồn, Iy tương ứng Iy nguồn; cần kiểm tra quy ước
trục của từng catalog trước khi sao chép số liệu vào thư viện.

Các kết quả này là đặc trưng tiết diện nguyên đồng nhất; chưa xét bán kính lượn,
lỗ bổ sung ngoài lòng rỗng CHS/SHS/RHS, tiết diện bất đối xứng, cốt thép,
mô hình vật liệu, hoặc kiểm tra theo tiêu chuẩn. Workbench không ghi kết quả
vào thư viện. Benchmark thuần Node nằm tại
`frontend/vue/tests/geometry/` và chạy bằng `npm test` trong `frontend/vue/`.

Schema, giới hạn và đơn vị: `database/seeds/engineering-schema.json`.
Seed ban đầu: `database/seeds/engineering-data.json`; cấu trúc DB nằm trong
migrations Laravel. Baseline hiện có 4 vật liệu, 8 loại; không có tiết diện
số mặc định vì đặc trưng cần được nhập từ nguồn phù hợp.

Các bảng chính: `users` (role), `materials` (properties JSON), `section_types`,
`sections` (khóa ngoại vật liệu/loại), `projects` (user_id), `locales`,
`catalog_options`, `catalog_option_translations`, `library_seed_state`.
Nhãn vật liệu/tiết diện có `name_vi`/`name_en`; UI và schema đều song ngữ.

## Giữ thư viện đã nhập và chuyển từ web demo sang Docker

Trong **Quản trị dữ liệu → Thư viện kỹ thuật → Sao lưu và chuyển thư viện**,
admin có thể **Xuất JSON** và **Nhập thư viện** trên cả demo web lẫn Laravel.
Xuất toàn bộ vật liệu, loại tiết diện, tiết diện cụ thể, thông số, nguồn và
tên VI/EN. Tệp không chứa tài khoản, mật khẩu, dự án hoặc kết quả tính toán.
Đơn vị giữ nguyên theo schema; không chuyển đổi đơn vị tự động.
Tệp phiên bản 1 nay mang thêm `materials.design_code`,
`section_types.design_code` và `section_types.region_type`. Tệp cũ thiếu các
trường này vẫn nhập được; khi cập nhật mã đã có, trường bị thiếu không xóa
phân loại hiện tại. Truyền `null` rõ ràng để xóa phân loại. Demo giữ nguyên
khóa localStorage và các dữ liệu trước khi bổ sung cột.

1. Sau mỗi buổi nhập/sửa thư viện, **Xuất JSON**, kiểm tra tệp đã tải xuống và
   lưu thêm một bản ngoài trình duyệt (ví dụ thư mục sao lưu hoặc ổ đĩa khác).
2. Khi chuyển sang Docker, đăng nhập admin → chọn tệp JSON → kiểm tra số mục
   → **Nhập thư viện**. Không phải nhập lại từng vật liệu/tiết diện.
3. Mặc định **Bỏ qua mục đã có (mặc định)**; muốn cập nhật dữ liệu đã sửa ở cùng mã,
   chọn **Ghi đè mục cùng mã**. Các bản ghi không nằm trong tệp vẫn được giữ.
   Mã vật liệu/loại dùng để nối tiết diện, không dùng ID từ máy cũ.

Trước mỗi lần nhập, UI tạo lượt tải bản JSON của thư viện hiện tại để có thể
khôi phục. Hãy giữ tệp backup đó; trình duyệt không thể xác nhận bạn đã lưu
an toàn lên ổ đĩa. Chọn tệp chỉ xem trước; nhấn nhập mới thay đổi thư viện.
Nếu nhập gặp lỗi, thư viện hiện có không bị cập nhật dở dang. Nhập tối đa 10 MB, 20.000 bản ghi mỗi nhóm;
kiểm tra thông số và liên kết theo cùng quy tắc CRUD. Chặn đổi loại/hệ vật
liệu đã được tiết diện tham chiếu. Import không thay thế các bản ghi khác
hoặc thực hiện xóa hàng loạt; phục hồi dữ liệu đã sửa bằng chế độ cập nhật mã.

**Web demo chỉ lưu trong localStorage của đúng trình duyệt/domain đó.**
Mở tab/refresh/cập nhật mã nguồn không chủ động reset dữ liệu. Tuy nhiên,
xóa dữ liệu trình duyệt, đổi trình duyệt/domain, chế độ ẩn danh hoặc cơ chế
dọn bộ nhớ của trình duyệt có thể khiến mất bản lưu này. Tệp JSON bên ngoài
trình duyệt là cách giữ công sức nhập liệu; dữ liệu không tự đồng bộ vào Git
hoặc SQLite. Cập nhật demo dùng nguyên khóa lưu trữ hiện có.

**Docker:** dữ liệu SQLite nằm trong `backend/laravel/database/database.sqlite`
trên host qua bind mount, nên stop/rebuild/down không xóa dữ liệu. Sao lưu
toàn bộ database (tài khoản/dự án/thư viện) bằng cách dừng backend trước khi
copy cả database và các tệp `database.sqlite-wal`/`database.sqlite-shm` nếu có;
giữ cấu hình `.env` riêng và không commit vào Git. Khởi động lại sau khi
copy xong. Khi đổi máy, mang theo database và `.env`, hoặc dùng JSON nếu
chỉ cần chuyển thư viện sang một hệ thống đã có tài khoản/dự án riêng.

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
| GET | `/api/library/export` | Admin; `{data:archive}` chứa thư viện JSON phiên bản 1 |
| POST | `/api/library/import` | Admin + CSRF; `{archive,mode:"skip"\|"overwrite"}`, kết quả `{data:{created,updated,skipped}}` |
| POST/PATCH/DELETE | `/api/materials`, `/api/section-types`, `/api/sections` (PATCH/DELETE thêm `/{id}`) | Admin |
| GET/POST/PATCH/DELETE | `/api/admin/users` (PATCH/DELETE thêm `/{id}`) | Admin |

POST/PATCH thư viện gửi `code,name_vi,name_en` và:
- materials: `category,source,properties`, tùy chọn `design_code`.
- section-types: `category,shape`, tùy chọn `design_code,region_type`.
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

Đây chỉ là mô phỏng UI: dữ liệu nằm trong localStorage có thể sửa, đăng nhập demo
được chia sẻ giữa các tab bằng localStorage, không phải xác thực/ phân quyền server.
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
`tests/library-transfer-smoke.cjs` kiểm tra xuất từ demo → nhập vào demo khác
và Laravel, giữ thông số/tham chiếu, backup trước nhập, trùng mã, rollback,
VI/EN và mobile; cần demo server qua `TRANSFER_DEMO_URL` và backend/Vite
qua `TRANSFER_LOCAL_URL`, cùng `AUTH_FIXTURES` riêng cho hai tài khoản test.
Test tạo/xóa chỉ những mã fixture duy nhất do chính lượt chạy tạo.

## Chạy native (không dùng Docker)

Cần PHP >= 8.3 với pdo_sqlite, mbstring, XML, curl; Composer 2; Node 24.
Trong `backend/laravel`: `composer install`, tạo `.env` từ `.env.example` nếu
chưa có, tạo APP_KEY nếu trống, tạo SQLite nếu thiếu rồi `php artisan migrate
--seed`. Tạo tài khoản bằng `php artisan app:create-user ...`; chạy `php artisan
serve --host=127.0.0.1 --port=8000`. Trong terminal khác, ở `frontend/vue`,
chạy `npm ci` và `npm run dev -- --host 127.0.0.1 --port 5173`.

SectionalProperties v1 đã có engine Python, FastAPI/Laravel API tính nhanh và
Vue 3 + TypeScript. Mở **Steel Design → Section properties** bên cạnh Component
và Connection; **Concrete Design** dùng cùng module hình học. Chọn ví dụ và nhấn
Tính toán để xem A, trọng tâm, Ix/Iy/Ixy, Sx+/Sx−/Sy+/Sy−, r, PNA, Z, trục chính.
J có cho chữ nhật/tròn đặc; J I/H và Cw/tâm cắt/diện tích cắt trả `not_computed`.
Admin editor có sơ đồ kích thước và vùng kết quả XY riêng, giữ nguyên catalog
nhập tay. Tính nhanh chưa lưu definition/revision vào PostgreSQL.

Xem [engineering/README.md](engineering/README.md) để chạy và kiểm chứng.

## Các trang chức năng và Steel Design

Sáu thẻ chức năng trên trang chính mở **tab trình duyệt mới**. Các trang dùng
hash URL `#/modules/steel`, `concrete`, `analysis`, `loads`, `library`, `future`
để chạy được trên GitHub Pages mà không cần server routing. Tab mới có thanh
điều hướng đủ sáu nhóm; các liên kết trên thanh này chuyển trang trong cùng tab.
Đăng nhập được chia sẻ giữa các tab; đăng xuất/đổi tài khoản đồng bộ các tab.
Với Laravel, session vẫn là cookie HttpOnly; không lưu token đăng nhập thật vào
localStorage. Demo chỉ chia sẻ ID tài khoản mô phỏng trong browser.

Steel Design gồm **Component**, **Connection** và **Section properties**:
- Component: dầm/cột/giằng, tiêu chuẩn, vật liệu và tiết diện thép từ database.
  Tiết diện lọc theo vật liệu đang chọn; hiển thị thông số và đơn vị đã lưu.
- Connection: dầm–cột/nối cấu kiện/bản đế/bản mã; bu lông/hàn/hỗn hợp,
  cấp bền 4.6/8.8/10.9 và hàn góc/giáp mối.
- Section properties: tính hình học Rectangle, Circle và I/H có cánh độc lập;
  dùng chung với Concrete Design, không cần vật liệu.

Các lựa chọn tiêu chuẩn và liên kết là sơ bộ, chưa có tính toán/kiểm tra thiết
kế. Những nhóm chưa triển khai có dropdown để chuẩn bị chức năng. Engineering
Library tiếp tục cho người dùng xem database; sửa dữ liệu trong giao diện admin.
Hover các tab và thẻ điều hướng dùng nền `#23395d`, chữ trắng ở cả hai giao diện.

Ảnh nền đăng nhập là ảnh cầu do người dùng cung cấp. Tệp tải lên có tên `.svg`
nhưng dữ liệu thực là JPEG; lưu nguyên byte với đuôi `.jpg` để đúng MIME.
`tests/modules-smoke.cjs` kiểm tra ảnh, hover, mở tab, navigation, dropdown,
VI/EN, mobile và đăng xuất giữa các tab. Dùng `TEST_DEMO=1` với
`MODULE_BASE_URL` cho demo, hoặc `AUTH_FIXTURES` riêng cho backend thật.

## Màu nền dịu mắt

Nền trang dùng xám pha beige `#ded8cf`, panel/bảng/hộp chỉnh sửa `#eae5dd`,
trường nhập `#f1ede6`; nền ấm và dịu ở cả admin và giao diện sử dụng.
Vùng phụ và hàng xen kẽ dùng `#e3ddd4`, đường viền `#c2b9ad`.
Khung nội dung các trang module dùng nền trắng xám ấm `#faf9f6`, bo góc
và có khoảng cách với nền beige bên ngoài để tăng tương phản.
Khung rộng tối đa 1280 px; dropdown (cả menu Design Code) và thẻ thông số
vật liệu/tiết diện trong Steel Design dùng cùng nền `#faf9f6`.
Navy `#23395d` với chữ trắng vẫn dùng cho hover; các tab đang chọn giữ màu navy.
Chữ phụ `#4d5966` giữ tương phản trên nền mới. Ảnh cover được giữ nguyên.

Cỡ chữ giao diện tăng nhẹ 1 px; các chữ nhỏ từ 10 px trở xuống tăng 2 px
để dễ đọc hơn. Font Calibri, màu nền và hover navy giữ nguyên.
