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
  BTCT chữ nhật, BTCT tròn và Double Angle. Mỗi loại hiển thị các trường thông số tương ứng.
- **Tiết diện cụ thể**: kích thước, vật liệu, loại tiết diện, nguồn dữ liệu và
  kích thước hình học để tự tính đặc trưng. Loại tiết diện định nghĩa mẫu; các giá trị A/I/J
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

Thông số tiết diện nhập: h/b/D/t/tw/tf theo hình dạng; I/H có chế độ cánh
trên/dưới độc lập. Khi nhập đủ kích thước, form tự tính và hiển thị Section
Properties. Khi tạo/sửa, Laravel gọi API sử dụng bộ logic Section Properties chung và lưu kết quả chính thức
vào `sections.section_properties` (JSON), cùng
`section_properties_calculated_at`; không nhận A/I/S/Z/r/PNA nhập tay.
Chuẩn ký hiệu là XY của package: A, P, x̄, ȳ, Ix/Iy/Ixy, Sx+/Sx−/Sy+/Sy−,
Zx/Zy, rx/ry, PNAx/PNAy, Imax/Imin, J, Cw, tâm cắt và Ax/Ay.
Kết quả gross chưa áp dụng hệ số hiệu chỉnh hoặc cốt thép. Các hệ số, lớp
bảo vệ, diện tích cốt thép, đường kính thanh/đai và bước đai vẫn là input phụ.

Solver 1.3.0 dùng một package [section-properties](section-properties/README.md)
cho trình duyệt, Admin CRUD và API native. Danh sách chung có 10 lựa chọn:
Rectangle, Circle, CHS, SHS/RHS, Symmetric I/H, Asymmetric I/H, Channel,
Angle, Tee và Double Angle. Hai loại I/H dùng cùng geometry model; catalog
cũ giữ nguyên các khóa `i`, `rectangular_hollow`, `circular_hollow` qua alias.
SHS là trường hợp b = h; RHS vẫn được hỗ trợ trong cùng lựa chọn.

Mọi loại đều có J, Cw, tâm cắt và Ax/Ay. Đặc trưng gross được tích phân
chính xác theo mô hình góc vuông; đặc trưng nâng cao của tiết diện thành mỏng
có phương pháp/giả thiết riêng. Cw bằng 0 của circle/CHS và T/L trong mô hình
thành mỏng là kết quả hợp lệ. Thuộc tính không hội tụ hoặc ngoài dải số trả
`not_computed` với lý do; catalog từ chối lưu nếu thiếu đặc trưng bắt buộc.
Double Angle gồm hai L đối lưng, chân ngang dưới hướng ra ngoài, khoảng cách
thông thủy g ≥ 0. Phần nâng cao giả thiết liên kết gót cứng lý tưởng để làm
việc tổng hợp; không tự giả định đường hàn liên tục khi g = 0.

Snapshot giữ đơn vị mm và các lũy thừa tương ứng, hình học chuẩn hóa,
geometry hash, solver version/config hash và giả thiết. GET thư viện trả lại
snapshot đã lưu, không tính lại khi đọc. Ví dụ dùng trong tính kết cấu:
`section.section_properties.properties.elastic.ix`,
`section.section_properties.properties.plastic.zx`,
`section.section_properties.advanced.warping_constant_cw` (kiểm tra `status`
trước khi dùng). Snapshot có `formula_report`: công thức theo ký hiệu dimension, giá trị thay
số, phương pháp, giả thiết, nguồn tham khảo và version/hash thư viện công thức.
Trong Laravel, `$section->formulaReport()` lấy báo cáo này;
`$section->calculatedProperties()` trả nhóm
đặc trưng chuẩn hoặc `null` với dữ liệu cũ chưa có snapshot. Không tự ánh xạ
Ix/Iy sang các khóa catalog y/z vì quy ước trục nguồn có thể khác.

Migration chỉ bổ sung cột, giữ nguyên bản ghi cũ. Dữ liệu cũ có số nhập tay
được hiển thị theo quy ước nguồn cho đến lần sửa/lưu tiếp theo; lần đó hệ
thống tính từ hình học. Tạo/sửa/sao chép/import đều tính lại. Import nhận tệp
v1 cũ và bỏ qua snapshot đính kèm khi ghi, chống kết quả giả hoặc lỗi thời.
Nếu engine lỗi/kết quả không hợp lệ, bản ghi không thay đổi; import lỗi sẽ
rollback toàn bộ lượt nhập. Demo tính cùng công thức và lưu snapshot trong
localStorage, còn Laravel lưu SQLite.

Các trường BTCT hiện mô tả tiết diện gross đàn hồi và thông tin cốt thép cơ bản;
chưa có bố trí từng thanh, phân tích nứt/phi tuyến hoặc kiểm toán tiêu chuẩn.

### Geometry Models / Analytical Engine

**Section Properties**, **Steel Design**, **Concrete Design** và Admin editor
đều dùng cùng component, registry và bộ tính. Chọn một trong 10 loại, nhập
kích thước theo sơ đồ, xem kết quả tự tính và công thức có thể mở rộng/xuất JSON.
Result unit đổi mm/cm/m cho toàn bộ kết quả, gồm Cw (L⁶), I/J (L⁴), S/Z (L³),
A/Ax/Ay (L²), tọa độ và độ lệch (L). JSON/database giữ canonical mm;
`display_unit` chỉ ghi lựa chọn hiển thị, không làm thay đổi số đã lưu.

Entrypoint public: `section-properties/index.ts` → `calculateSectionProperties`.
Registry/formulas: `section-properties/section-registry.json`. Các entrypoint
Geometry Models/Analytical Engine trước đây giữ làm facade tương thích, không
chứa một bộ công thức tính riêng. API native chạy bundle của cùng package;
Python solver chỉ làm reference độc lập cho benchmark/parity.

Quy ước: gốc ở góc dưới trái bounding box, +x sang phải, +y lên trên;
Ix quanh trục ngang qua trọng tâm, Iy quanh trục đứng, Ixy theo tích tọa độ.
Góc trục chính lớn đo ngược chiều kim đồng hồ từ X, trong (−90°, 90°].
Hai quán tính chính bằng nhau cho góc `null` với trạng thái indeterminate.
CHS/hộp dùng kích thước ngoài và bề dày đồng đều; góc hộp vuông lý tưởng.
Channel mở sang phải, Tee có cánh trên, Angle có chân dưới/trái.
Không tự chuyển trục catalog Y/Z sang XY. Không xét fillet, cốt thép hoặc
kiểm toán tiêu chuẩn. Tính nhanh chỉ giữ trong phiên; Admin lưu snapshot.

Bộ kiểm tra từ chối dimension không hữu hạn/không dương, thành rỗng kín,
cánh giao nhau và khoảng cách Double Angle âm. Chu vi rỗng gồm biên ngoài
và trong; g = 0 của Double Angle dùng chu vi biên hợp hai góc tiếp xúc.
Các công thức, mô hình cắt/xoắn và cách mở rộng được ghi trong
[package README](section-properties/README.md).

Schema, giới hạn và đơn vị: `database/seeds/engineering-schema.json`.
Seed ban đầu: `database/seeds/engineering-data.json`; cấu trúc DB nằm trong
migrations Laravel. Baseline hiện có 4 vật liệu, 9 loại (10 profile do I/H có hai chế độ); không có tiết diện
số mặc định; admin tạo tiết diện từ kích thước thực và ghi nguồn hình học.

Các bảng chính: `users` (role), `materials` (properties JSON), `section_types`,
`sections` (khóa ngoại vật liệu/loại), `projects` (user_id), `locales`,
`catalog_options`, `catalog_option_translations`, `library_seed_state`.
Nhãn vật liệu/tiết diện có `name_vi`/`name_en`; UI và schema đều song ngữ.

## Giữ thư viện đã nhập và chuyển từ web demo sang Docker

Trong **Quản trị dữ liệu → Thư viện kỹ thuật → Sao lưu và chuyển thư viện**,
admin có thể **Xuất JSON** và **Nhập thư viện** trên cả demo web lẫn Laravel.
Xuất toàn bộ vật liệu, loại tiết diện, tiết diện cụ thể, thông số, nguồn và
tên VI/EN. Tệp bao gồm snapshot Section Properties đã lưu (nếu có); không chứa tài khoản,
mật khẩu hoặc dự án. Khi nhập, snapshot được tính lại từ hình học.
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
- sections: `material_id,section_type_id,source,properties` (geometry + input phụ).
  Server trả và lưu `section_properties` + `section_properties_calculated_at`.
  Snapshot hoặc đặc trưng dẫn xuất do client gửi không được dùng để ghi.

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
`tests/catalog-section-smoke.cjs` kiểm tra tự tính khi nhập kích thước, bỏ
trường dẫn xuất nhập tay, lưu/reload snapshot, sửa hình học và import bỏ qua
snapshot giả. Chạy với `CATALOG_DEMO_URL=<địa chỉ demo>`.
`tests/catalog-shapes-smoke.cjs` tạo/lưu qua editor đủ 10 profile, gồm I/H
bất đối xứng và Ixy của L; dùng `AUTH_BASE_URL=<địa chỉ>` và tài khoản test
riêng, hoặc `TEST_DEMO=1` trên bản demo. Các test này chạy được với build
GitHub Pages tại `/GeekCalculus/`, không cần đường dẫn source của Vite.
Laravel feature tests kiểm tra snapshot chính thức, lỗi/rollback, dữ liệu cũ
và payload của đủ 10 profile; benchmark polygon và parity nằm ở engineering.

## Chạy native (không dùng Docker)

Cần PHP >= 8.3 với pdo_sqlite, mbstring, XML, curl; Composer 2; Node 24.
Trong `backend/laravel`: `composer install`, tạo `.env` từ `.env.example` nếu
chưa có, tạo APP_KEY nếu trống, tạo SQLite nếu thiếu rồi `php artisan migrate
--seed`. Tạo tài khoản bằng `php artisan app:create-user ...`; chạy `php artisan
serve --host=127.0.0.1 --port=8000`. Trong terminal khác, ở `frontend/vue`,
chạy `npm ci` và `npm run dev -- --host 127.0.0.1 --port 5173`.
CRUD cần engine: cài Python theo `engineering/README.md`, chạy
`python -m uvicorn structural_engine.sectional_properties.api.main:app --host
127.0.0.1 --port 8001` trong venv và đặt
`SECTION_ENGINE_URL=http://127.0.0.1:8001` trong `.env` của Laravel.

Section Properties 1.3.0 có bộ tính TypeScript dùng chung, FastAPI/Laravel
adapter và Vue UI; Python giữ vai trò benchmark độc lập. Tất cả 10 profile
có đặc trưng gross/elastic/plastic/principal và J/Cw/tâm cắt/Ax/Ay theo mô hình
đã công bố. Form Admin tự tính và lưu kết quả cùng `formula_report` vào catalog.
Không có immutable revision/history hoặc PostgreSQL trong bước này.

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
- Section properties: tính đủ 10 profile trong danh sách chung;
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

Nền ngoài của mọi trang dùng navy nhạt `#cbd5e1`, panel/bảng dùng `#eae5dd`,
trường nhập `#f1ede6`; nền ấm và dịu ở cả admin và giao diện sử dụng.
Vùng phụ và hàng xen kẽ dùng `#e3ddd4`, đường viền sáng `#e1e7ef`.
Vùng nội dung chính của tất cả các trang dùng nền trắng xám ấm `#faf9f6`:
đăng nhập, chọn giao diện, trang chủ/dự án, Admin, các module và hộp chỉnh sửa.
Khung trang chủ, Admin và module có bo góc và khoảng cách với nền navy nhạt
bên ngoài để tăng tương phản; các panel bên trong vẫn giữ nền beige dịu.
Trang đăng nhập có khung form sáng trên nền navy nhạt, giữ nguyên ảnh cover.
Khung rộng tối đa 1280 px; dropdown (cả menu Design Code) và thẻ thông số
vật liệu/tiết diện trong Steel Design dùng cùng nền `#faf9f6`.
Navy `#23395d` với chữ trắng vẫn dùng cho hover; các tab đang chọn giữ màu navy.
Chữ phụ `#4d5966` giữ tương phản trên nền mới. Ảnh cover được giữ nguyên.

Toàn bộ cỡ chữ được tăng thêm 2 px, gồm các nhãn và chú thích sơ đồ.
Button có hover và dropdown có viền navy `#23395d`, kể cả menu Design Code.
Font Calibri, nền sáng bên trong/navy nhạt bên ngoài và hover navy giữ nguyên.

Bộ dữ liệu cơ học mở rộng được lưu tại `section_properties.mechanics`: đặc trưng quanh trục chính, mô đun uốn có liên kết Ixy, tích phân bậc ba, Wagner, mô đun xoắn/vênh/cắt và hệ số phân bố ứng suất. Xem [package Section Properties](section-properties/README.md) cho định nghĩa/giả thiết; không chứa quy tắc tiêu chuẩn thiết kế.
