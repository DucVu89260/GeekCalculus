# API_IF_SAP26.2.0_V1 — API nội lực SAP2000 26.2.0

Luồng: mở SAP2000 trên Windows → chạy analysis → chọn frame objects → đọc danh sách Output Cases → chọn cases/combinations → trích xuất → extreme / xuất cho liên kết.

Tên contract: **API_IF_SAP26.2.0_V1**. Phiên bản mục tiêu: **SAP2000 26.2.0**. Connector kiểm tra `SapModel.GetVersion()` trước mỗi thao tác; phiên bản khác bị từ chối. Cb theo AISC 360-10 thuộc module tính riêng bên trong, không thuộc API nội lực; xem [module nội bộ](CB-AISC360-10.md).

Connector .NET DLL/PID chạy **cùng máy và cùng phiên đăng nhập Windows với SAP2000**. Backend cloud không thể truy cập COM của máy người dùng. Không tự chạy analysis, mở/lưu model hoặc đổi lựa chọn cấu kiện. Connector tạm đổi đơn vị và Output Cases để đọc; khôi phục cả hai khi hoàn tất hoặc có lỗi. Không thao tác model trong lúc xuất. Một worker và khóa tuần tự bảo vệ các yêu cầu trong connector; không chạy nhiều connector cho cùng SAP2000.

## Chọn web hay local?

**Dùng giao diện web, connector chạy local trên máy Windows có SAP2000.** Bản sơ bộ phục vụ panel trực tiếp từ connector trên cùng máy. Trình duyệt và connector cùng origin, không cần cấu hình CORS, không mở cổng public và không gửi model/nội lực lên cloud. Có thể mở website GeekCalculus song song và bấm **SAP2000 · Nội lực (local)** trên thanh đầu của các trang module để mở panel local trong tab khác.

Website cloud không thể trực tiếp gọi SAP2000 COM của máy người dùng. Nhúng panel vào trang cloud hoặc để trang HTTPS gọi localhost sẽ cần cơ chế ghép nối, origin/CORS cho domain được phép và quyền truy cập local network của trình duyệt; các cơ chế đó chưa được triển khai ở bản này. Nút trên website hiện mở tab local, không gọi COM từ server cloud.

## Cài đặt một lần trên Windows

1. Cần SAP2000 **26.2.0**, Python **64-bit >= 3.11** và Internet để tải dependencies. Khi cài Python, bật Python Launcher (`py`). Chạy connector cùng tài khoản/phiên desktop với SAP2000; không cần chạy administrator nếu SAP2000 không chạy elevated.
2. Đặt bản mã có các thay đổi API này trên máy Windows, thư mục cố định `C:\geek_calculus\SAP2000-API`. Không sao chép `.venv`, dependencies hoặc build cache từ Linux sang Windows.
3. Trong Explorer, mở `C:\geek_calculus\SAP2000-API`, nhấp đúp **`start-sap2000-panel.cmd`**. Script tạo venv, cài dependencies theo lock và chạy connector. Lần đầu có thể mất vài phút. Giữ cửa sổ console đang chạy.
4. Launcher tự mở trình duyệt và ghép nối panel bằng mã giữ trong phiên tab. Không cần tự nhập token. Mã không đưa vào query/HTTP access log và được xóa khỏi fragment địa chỉ sau khi trang đọc. Token giữ trong sessionStorage của tab để tải lại trang vẫn kết nối được; restart connector sinh token mới nếu không cấu hình token môi trường cố định.

Nếu muốn chạy bằng PowerShell thay vì nhấp đúp:

```powershell
cd C:\geek_calculus\SAP2000-API
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-test.lock -r requirements-windows.txt
.\.venv\Scripts\python -m structural_engine.member_forces.run_connector
```

Không cần Node cho panel/connector nội lực. Cửa sổ launcher phải tiếp tục chạy; dùng Ctrl+C để dừng sau khi xuất xong. Chỉ bind `127.0.0.1:8010`. Không mở firewall/public host.

## Thao tác hằng ngày bằng panel

1. **SAP2000:** mở và lưu file `.sdb`, chạy **Analyze → Run Analysis** cho các cases cần dùng. Sau khi hoàn tất, giữ model khóa. Có thể mở nhiều phiên SAP2000; mỗi PID được quét kèm file model đang hoạt động để chọn trên panel.
2. **Panel:** launcher tự mở trang **Xuất nội lực cấu kiện**. Nếu đang ở website GeekCalculus, dùng nút **SAP2000 · Nội lực (local)** để mở panel; tab mới chưa ghép nối sẽ yêu cầu token. Thuận tiện nhất là quay lại tab đã được launcher mở. Tải lại cùng tab sẽ giữ token. Nếu đã restart connector hoặc đóng tab và mất token, dùng tab mới do launcher mở để nhận mã mới.
3. Bấm **Quét SAP2000 đang mở**. Trong danh sách **File SAP2000 / PID**, chọn đúng tên file và đường dẫn (hai file trùng tên vẫn phân biệt bằng PID/đường dẫn), rồi bấm **Kết nối / Làm mới model**. Một phiên duy nhất có thể được chọn tự động; nhiều phiên thì phải chọn rõ ràng. Không cần nhập PID thủ công. Phiên không đọc được có thông báo riêng và không thể chọn, nhưng không chặn quét các phiên khác. Kiểm tra PID, tên file và trạng thái khóa trước khi xuất.
4. Ở **Output Cases**, tìm theo tên và đánh dấu cases/combinations muốn xuất. Có thể chọn các mục đang hiển thị hoặc bỏ chọn tất cả. Case chưa có kết quả sẽ bị vô hiệu hóa; combinations được kiểm tra khi trích xuất.
5. Quay sang **SAP2000**, chọn một hoặc nhiều **frame objects**. Joint/area objects không thuộc phạm vi API này.
6. Quay lại panel. Có thể bấm **Đọc lựa chọn hiện tại** để kiểm tra danh sách; sau đó bấm **Lấy nội lực cấu kiện đang chọn**. Lệnh xuất luôn đọc lại selection tại thời điểm bấm, không dùng danh sách preview cũ. Giữ nguyên model trong lúc đang đọc.
7. Xem bảng nội lực, phân trang theo 100 dòng. **Tải dữ liệu JSON** giữ toàn bộ kết quả và metadata. **Xuất liên kết CSV** xuất các bộ nội lực đồng thời; envelope/modal bị từ chối làm action liên kết. Không tự đổi dấu, trục hay offsets cho phần mềm đích.
8. Chọn phạm vi **Theo từng cấu kiện** hoặc **Toàn bộ nhóm đã xuất**, bấm **Xác định Min / Max / Absolute**. Tải **extreme JSON** để xem cả bộ lực tại từng dòng chi phối và mọi dòng đồng hạng.
9. Đổi file SAP2000 thì bấm **Kết nối / Làm mới model** và chọn lại cases. Panel gửi `expected_model`; nếu file hoạt động khác file đã xác nhận, API từ chối xuất. Dataset đã tải là snapshot, không tự cập nhật khi chạy lại analysis.

Cb nằm ở module riêng, không nằm trong panel/API nội lực. Panel hiện chưa có thao tác release/assign/edit/check design như các nút khác trong ảnh tham khảo.

### Khi gặp lỗi

Nếu trang đã mở nhưng `/model` trả 503, chạy `diagnose-sap2000.cmd` trong cùng thư mục. Script chỉ đọc: phiên bản/bitness Python, khả năng attach .NET theo PID, kết quả GetVersion, tên file và trạng thái khóa. Không chạy analysis, sửa model hoặc in token. Gửi lại các dòng kết quả chẩn đoán, đặc biệt tên bước lỗi và HRESULT. Console connector cũng in lỗi cụ thể sau mỗi 503. Không kết luận lỗi phiên bản hay lỗi phân tích chỉ từ HTTP 503.

- **Không mở được trang/không kết nối connector:** kiểm tra cửa sổ launcher còn chạy và cổng 8010 không bị một connector cũ chiếm. Chỉ chạy một connector cho một SAP2000.
- **Không tìm thấy SAP2000:** mở SAP2000 trước, cùng tài khoản Windows và cùng mức quyền với connector. Bấm Quét SAP2000 đang mở và chọn lại file/PID. Kiểm tra DLL cài đặt và quyền truy cập của phiên không đọc được. Bản này nạp Helper trực tiếp qua pythonnet, không yêu cầu ProgID Helper có sẵn trong Registry và không cần Repair.
- **Sai phiên bản:** API chỉ chấp nhận 26.2.0, không tự coi bản 26 khác là tương thích.
- **Chưa có kết quả/không có lựa chọn:** chạy analysis cho cases cần lấy; chọn frame objects rồi thử lại.
- **File đã đổi:** kết nối lại và kiểm tra tên model trước khi xuất.
- **Không xuất được CSV envelope:** tải JSON dữ liệu gốc để kiểm tra hoặc chọn các cases/bước đồng thời thay cho envelope/spectrum/modal.

## Sử dụng HTTP/CLI trực tiếp

Các endpoint cần `Authorization: Bearer <SAP2000_CONNECTOR_TOKEN>`. Launcher sinh token ngẫu nhiên nếu biến này chưa có. Với tích hợp riêng, đặt token của bạn trong môi trường rồi chạy launcher với `--no-browser`; không lưu token vào source hoặc dataset. Không bật CORS mặc định. Ví dụ CLI `python -m structural_engine.member_forces.example_workflow` dùng token từ môi trường, liệt kê cases, nhận lựa chọn và lưu JSON; dùng cùng phiên môi trường đã cấu hình token.

## Endpoints

| Method | Connector Windows | Dữ liệu |
|---|---|---|
| GET | `/API_IF_SAP26.2.0_V1/instances` | Danh sách `{pid, filename, model, locked, available, error}` cho từng phiên SAP2000 local; yêu cầu bearer token |
| GET/PUT | `/API_IF_SAP26.2.0_V1/connection` | Xem/cấu hình `pid`, `dll_path`; yêu cầu bearer token; lưu trong bộ nhớ connector |
| GET | `/API_IF_SAP26.2.0_V1/model` | File/đường dẫn model đang hoạt động, phiên bản và trạng thái khóa |
| GET | `/API_IF_SAP26.2.0_V1/output-cases` | Danh sách Load Cases và Response Combinations, `name`, `kind`, trạng thái analysis |
| GET | `/API_IF_SAP26.2.0_V1/selection` | `frames`: các object loại frame đang được chọn |
| POST | `/API_IF_SAP26.2.0_V1/frame-forces` | Nội lực tại mọi output station/bước do SAP trả về |
| POST | `/API_IF_SAP26.2.0_V1/extremes` | Min/max/absolute từng thành phần, theo cấu kiện hoặc toàn bộ nhóm |
| POST | `/API_IF_SAP26.2.0_V1/connection-export` | JSON/CSV giữ nguyên bộ nội lực cùng dòng |

Hai endpoint xử lý cũng có trên API engineering nội bộ, và qua Laravel tại `/api/API_IF_SAP26.2.0_V1/...` với session/CSRF và quyền đăng nhập hiện có. Không truyền token connector Windows lên cloud. Không có proxy từ cloud đến URL máy người dùng. Dataset được truyền trong request; chưa lưu lịch sử/database. Mỗi dòng giữ nguyên case/bước; không trộn các bộ nội lực khác thời điểm.

### Quét cases và trích xuất

`GET /API_IF_SAP26.2.0_V1/output-cases` trả `data: [{name, kind, analysis_status, results_available}]`. `kind` là `case` hoặc `combination`. Case status `4` là finished. Combination không có run status độc lập nên hai trường status/availability là `null`; API kiểm tra các case thành phần khi trích xuất.

```json
{
  "expected_model": "C:\\Work\\model.sdb",
  "output_cases": [
    {"name": "DEAD", "kind": "case"},
    {"name": "ULS1", "kind": "combination"}
  ],
  "frames": ["12", "15"]
}
```

`expected_model` là tùy chọn cho HTTP client và được panel gửi tự động; phải khớp đường dẫn model đang mở. Bỏ `frames` để lấy các cấu kiện đang chọn trong SAP2000. Không bỏ `output_cases`. Tối đa 1000 cấu kiện, 2000 outputs, 100000 dòng/lượt; không cắt cụt âm thầm. Không có kết quả cho bất kỳ cặp frame/output được yêu cầu thì trả lỗi, không trả dataset thiếu mà báo thành công.

Kết quả dataset:

```json
{
  "api_name": "API_IF_SAP26.2.0_V1",
  "sap2000_version": "26.2.0",
  "schema_version": "1.0",
  "source": "SAP2000",
  "model": "model.sdb",
  "extracted_at": "2026-10-16T00:00:00+00:00",
  "units": "kN_m_C",
  "axes": "SAP2000_local_123",
  "rows": [{
    "record_id": "1", "frame": "12", "element": "12-1",
    "station": 0.0, "element_station": 0.0,
    "output_case": "ULS1", "case_kind": "combination",
    "step_type": "", "step_num": 0.0, "concurrency": "concurrent",
    "P": -100.0, "V2": 20.0, "V3": 0.0,
    "T": 0.0, "M2": 0.0, "M3": 50.0
  }]
}
```

`station` là ObjSta theo object (m), `element_station` là ElmSta (m); lực kN, mô men kN.m. Giữ nguyên dấu và trục local SAP, không tự đổi sang quy ước phần mềm liên kết. `record_id` chỉ duy nhất trong một dataset. API không suy ra section symmetric I/H hay vị trí giằng từ frame label.

`concurrency` do connector phân loại: case static/history có thể đồng thời theo một bước; modal/spectrum, envelope, absolute/SRSS/range và linear-add chứa các dạng đó là `nonconcurrent`. Linear-add chỉ chấp nhận các case static đã hoàn tất hoặc nested linear-add tương đương. `unknown` mặc định khi nguồn nhập không khai báo; không đủ điều kiện xuất action cho liên kết. Không tự khẳng định một tuple envelope là đồng thời.

### Extreme case

```json
{"dataset": "THAY_BANG_OBJECT_DATASET", "scope": "per_frame", "components": ["P", "M2", "M3"], "frames": ["12"], "output_cases": ["ULS1"]}
```

Thay chuỗi placeholder bằng object dataset, không phải tên file. Bỏ `frames`/`output_cases` để dùng toàn bộ dữ liệu. `scope: global` tìm trên cả nhóm. Mỗi thành phần trả `min`, `max`, `absolute`, giá trị và tất cả `record_ids` đồng hạng, `tie_count` và tối đa 20 `rows` mẫu chứa **đầy đủ P/V2/V3/T/M2/M3**, vị trí, case và bước. `rows_truncated: true` báo còn dòng đồng hạng; dùng danh sách IDs để xuất đầy đủ, không mất tie. Dùng `record_id` của dòng chi phối để xuất liên kết; không ghép P cực đại và M cực đại từ các dòng khác nhau. Với envelope, kết quả chỉ là extrema số của dữ liệu envelope, không là bộ action đồng thời. Min/max giới hạn tại stations/steps đã xuất, không chứng minh cực trị liên tục giữa các stations.

### Xuất liên kết

```json
{"dataset": "THAY_BANG_OBJECT_DATASET", "record_ids": ["1"], "format": "json"}
```

`format: csv` trả attachment CSV; bỏ `record_ids` để xuất tất cả dòng đã lọc. Envelope/modal/unknown bị từ chối. File giữ metadata nguồn, units, trục và cả vector lực. CSV bảo vệ tên bắt đầu bằng ký tự công thức spreadsheet bằng dấu nháy đơn; JSON giữ tên chính xác.

Đây là interchange trung gian, chưa phải định dạng import IDEA StatiCa/RAM/giải pháp liên kết cụ thể. Trước khi chuyển phải ánh xạ trục local, dấu mặt cắt đầu/cuối, điểm đặt lực, end offsets và đơn vị. Không tự đổi section-cut forces thành joint actions; các stations ở đầu/cuối element chưa chắc là mặt liên kết mong muốn.

## Kiểm thử và nghiệm thu SAP2000 thực

```sh
# Từ engineering
.venv/bin/python -m pytest -q
# Từ structural-platform, backend đang chạy
docker compose exec -T backend php artisan test --filter=MemberForceApiTest
```

Linux/cloud kiểm tra algorithms, API contracts, auth và adapter bằng fake SAP interface và bộ chuyển đổi CLR. **Chưa nghiệm thu trực tiếp SAP2000 trên Windows.** Không suy diễn fake COM thành bằng chứng tương thích mọi phiên bản SAP2000. Khi có máy SAP2000:

1. Chạy một dầm có nghiệm kiểm chứng; chọn 1 rồi nhiều frame, kể cả object chia nhiều elements.
2. So sánh từng tuple tại từng ObjSta/ElmSta với bảng `Element Forces - Frames`, cùng kN/m và cùng output settings. Kiểm tra local axes và offsets.
3. Thử static case, linear-add combo, envelope, history và spectrum. Xác nhận step type/num, combo classification; envelope không được xuất concurrent action.
4. Đổi đơn vị ban đầu, chọn vài Outputs khác, trích xuất rồi xác nhận tất cả trạng thái được khôi phục; thử chưa analyze/không có selection/không có results.

Nếu phiên bản có .NET signature khác, adapter trả lỗi có kiểm soát; cần kiểm tra metadata của DLL đang dùng trước khi điều chỉnh. Không bỏ qua CSI return codes để lấy kết quả.

## Kiểm thử panel bằng trình duyệt (SAP mô phỏng)

Từ `engineering`: `PYTHONPATH=. .venv/bin/python tests/sap_panel_server.py`. Ở terminal khác, từ `structural-platform`: `node tests/sap2000-panel-smoke.cjs` (cần Playwright và Chromium theo quy ước smoke tests hiện có). Fixture chỉ giả lập SAP2000, không kết nối model thật.

## Bản .NET/PID — build 2026.10.16-dotnet-pid.1

Đã xác nhận từ máy người dùng: pythonnet 3.2.1 nạp được DLL cài đặt, `GetObjectProcess` gắn được SAP2000 theo PID; GetVersion .NET trả `(0, '26.2.0', 26.2)` và model locked=True. Adapter đọc metadata CLR để điền tham số ref/out, chuyển enum/mảng và chuẩn hóa kết quả theo contract nội bộ. Không áp dụng quy tắc COM cũ trực tiếp cho tuple .NET.

Khởi động với PID từ CMD (thay bằng PID đang dùng):

```cmd
cd /d C:\geek_calculus\SAP2000-API
start-sap2000-panel.cmd --pid 20948
```

Hoặc nhấp đúp launcher và nhập PID trong panel. Đường dẫn DLL có thể đổi trong panel hoặc qua `--dll "C:\...\SAP2000v1.dll"`. PID được chọn rõ ràng sẽ không tự fallback sang model khác khi PID không còn tồn tại. Không lưu PID cố định vào source.

Chẩn đoán cùng PID:

```cmd
diagnose-sap2000.cmd --pid 20948
```

Linux/cloud kiểm tra trên CLR thực bằng fixture .NET được sinh trong bộ nhớ, gồm ref/out, enum, mảng, thuộc tính và optional parameters. Cần pythonnet và .NET runtime; chạy `SAP_TEST_CLR=1 PYTHONNET_RUNTIME=coreclr DOTNET_ROOT=/path/to/dotnet .venv/bin/python -m pytest -q tests/test_dotnet_clr.py`. Mặc định các kiểm thử CLR được đánh dấu skipped nếu không bật. Đây chưa phải nghiệm thu FrameForce trên SAP2000 thật; vẫn đối chiếu kết quả với bảng SAP theo checklist.

## Build 2026.10.16-dotnet-pid.2 — sửa xuất Combo

Sửa tên hàm loại Combo thành `RespCombo.GetTypeOAPI(Name, ref ComboType)`. `LoadCases.GetTypeOAPI` có signature riêng (case type và subtype); không dùng chung mock hay xử lý tuple giữa hai interface. Bộ kiểm thử bổ sung nhiều Case/Combo cùng lúc, Combo lồng nhau, Envelope/Absolute/SRSS/Range, lỗi API và khôi phục selection/units. Có kiểm thử CLR thực cho GetTypeOAPI/GetCaseList qua .NET proxy và kiểm thử panel chọn đồng thời Case + Combo.

Nếu cập nhật từ build .1: dừng connector, thay file bằng ZIP mới, giữ .venv, khởi động lại và kiểm tra đầu panel hiện `build 2026.10.16.2`. PID và DLL không thay đổi cách nhập. Envelope/statistical Combo vẫn được xuất JSON và xét extrema; không coi đó là action đồng thời để xuất liên kết CSV. Cần đối chiếu nội lực Combo với bảng SAP2000 thật.

## Quy ước local — build 2026.10.16-dotnet-pid.3 (Auto PID)

- Giải nén toàn bộ bộ API vào **`C:\geek_calculus\SAP2000-API`**. Launcher và công cụ chẩn đoán kiểm tra vị trí này; nếu sai thư mục sẽ hướng dẫn chuyển bộ API trước khi chạy. Giữ `.venv` khi cập nhật.
- Chỉ mở **một tiến trình `SAP2000.exe`** trong lúc dùng API. Launcher mặc định bỏ PID môi trường cũ; `--pid` vẫn là lựa chọn nâng cao rõ ràng.
- Nhấp đúp `start-sap2000-panel.cmd`, không cần tra hoặc nhập PID. Connector dùng Windows `tasklist` có filter chính xác `SAP2000.exe`, không cần thêm thư viện dò process.
- Mỗi lần kết nối/đọc sẽ quét lại PID nếu đang ở chế độ tự động. Không có SAP thì yêu cầu mở, nhiều SAP thì yêu cầu đóng bớt; không chọn ngẫu nhiên tiến trình đầu tiên.
- Panel và `/model` trả PID thực tế đã gắn. Quét PID không mở/sửa/chạy phân tích model. Sau khi đổi file, vẫn làm mới model và xác nhận tên file trước khi xuất.
- Chạy `diagnose-sap2000.cmd` không tham số để chẩn đoán theo cùng chế độ Auto PID. Không cần lưu PID cố định vào file.

Cơ chế tasklist được kiểm thử ở biên subprocess với đầu ra Windows mô phỏng (không có/một/nhiều tiến trình, PID đổi sau restart, lỗi và timeout). Cần chạy bản mới trên Windows để xác nhận việc dò process thực tế.

## Chọn nhiều model local — build 2026.10.17-instance-picker.1

Bản này thay quy ước chỉ mở một phiên SAP2000: có thể mở nhiều phiên và chọn file qua danh sách PID + tên model. Thư mục API vẫn cố định `C:\geek_calculus\SAP2000-API`. Không yêu cầu đổi tên thư mục, cài thêm dependency hoặc tìm PID trong Task Manager.

`GET /API_IF_SAP26.2.0_V1/instances` quét tasklist rồi gắn từng PID bằng DLL để đọc version, tên file, đường dẫn và trạng thái khóa. Không mở file, chạy analysis, đổi units/selection hoặc tự đổi PID đã cấu hình khi quét. Nếu một PID không đọc được, kết quả vẫn có dòng PID đó với `available:false` và lỗi tương ứng; model chưa lưu cũng chưa thể chọn để xuất.

Panel hiển thị mọi phiên tìm được, yêu cầu chọn khi có nhiều phiên, rồi gửi `PUT /connection` với `{pid, expected_model, dll_path}`. `expected_model` là đường dẫn đầy đủ đã quét. Các thao tác đọc từ đó được ghim vào đúng PID/file; nếu file trong PID đổi, API yêu cầu quét và chọn lại. Thay lựa chọn hoặc quét lại sẽ xóa kết quả/cases/extreme cũ trên panel, tránh trộn dữ liệu. File JSON/CSV đã tải về không bị xóa.

Sau khi đóng/mở lại SAP2000, bấm Quét để lấy PID mới. Chỉ model đã chọn mới được dùng cho Output Cases, selection và FrameForce. Việc quét tên file cần connector cùng tài khoản/mức quyền với các SAP2000 đang mở. Các tên và đường dẫn chỉ đọc trên local, không gửi cloud.

Bộ kiểm thử mô phỏng nhiều model có thêm phiên không truy cập được, chọn PID thứ hai, chuyển model, giữ lựa chọn khi reload, xuất Case/Combo, reset kết quả và chặn file đã đổi. Chưa nghiệm thu quét nhiều phiên SAP2000 thật trên Windows.

### Cổng 8010 đang được sử dụng / nhiều model

Nếu launcher báo WinError 10048, connector mới chưa chạy. Khi không có tác vụ xuất đang chạy, dùng `stop-sap2000-panel.cmd` cùng mức quyền Administrator rồi chạy lại `start-sap2000-panel.cmd`. Lệnh dừng chỉ nhận diện tiến trình Python đang chạy module connector trên cổng 8010; từ chối tiến trình khác và không dừng SAP2000.

Build 2026.10.17.2 đọc từng PID qua một Python worker riêng, cùng cách nạp DLL .NET như lệnh CMD đã kết nối thành công. Mỗi thao tác giữ nguyên PID/model đã chọn. Chẩn đoán attach có thông tin mức quyền và phiên Windows. Worker xuất nội lực không bị timeout cưỡng bức để có thể khôi phục đơn vị và Output Cases. Cần kiểm chứng kết nối trên Windows/SAP2000 thật.

### Giao diện 5 vùng — build 2026.10.17.3

Kết nối model nằm ngang phía trên. Output Cases & Combos ở cột trái; cột phải lần lượt là cấu kiện đã chọn, bảng nội lực và Extreme Cases & Combos. Màn hình hẹp tự chuyển thành một cột theo thứ tự 1–5. Hướng dẫn thao tác có thể mở ở cuối panel.

Sau khi cập nhật ZIP vào `C:\geek_calculus\SAP2000-API`, dừng connector cũ khi không xuất dữ liệu rồi chạy lại launcher; tải lại trình duyệt và kiểm tra build 2026.10.17.3. Không cần cài lại `.venv`.

### Lỗi kiểm tra dữ liệu khi xuất nhiều Case/Combo — build 2026.10.17.4

Cho phép tối đa 2.000 Output Cases/Combos và 100.000 dòng cho mỗi lần xuất. Khi SAP trả về dữ liệu không đáp ứng schema, panel báo `SAP2000_RESULT_INVALID` cùng tên Case/Combo, frame, chỉ số dòng, tên trường và giá trị gây lỗi. Không tự bỏ qua Case/Combo hoặc thay dữ liệu lỗi bằng số 0. Đơn vị và lựa chọn Output được khôi phục cả khi kiểm tra dữ liệu thất bại. Nếu nhận thông báo này, gửi nguyên văn để xác định trường hợp thực tế; lệnh diagnose chỉ kiểm tra kết nối, không tái tạo dữ liệu xuất.

### StepType null từ SAP2000 — build 2026.10.17.5

Ở ranh giới nhận dữ liệu SAP2000, `StepType = null` được chuyển thành chuỗi rỗng (không có nhãn bước). Các nhãn Max/Min/Mode/Step, StepNum và cả sáu thành phần nội lực được giữ nguyên. Thay đổi này không chuyển kết quả envelope/modal thành bộ lực đồng thời; quy tắc xuất CSV vẫn áp dụng. Schema JSON vẫn dùng chuỗi cho step_type.

### Output không có kết quả — build 2026.10.17.6

Các Case chưa có kết quả hoàn tất và Combo chứa Case như vậy được trả trong `missing_results`, với `result: null`, tên output và lý do. Mục thiếu cho toàn bộ output có `frame: null`; nếu SAP trả 0 dòng cho riêng một cấu kiện, mục thiếu ghi rõ frame. Không diễn giải việc thiếu kết quả là tải bằng 0. `rows` chỉ chứa nội lực hợp lệ; các output còn lại tiếp tục được xuất. Dependency được kiểm tra cho mọi loại Combo và Combo lồng nhau. Lỗi API, vòng lặp Combo và dữ liệu sai vẫn báo lỗi.

Nếu tất cả output đều thiếu, `rows: []` và JSON vẫn tải được. Panel hiển thị các mục none; CSV và cực trị chỉ dùng rows hợp lệ, bị vô hiệu hóa nếu không có rows. CSV không chứa dòng nội lực giả cho mục none; tải JSON để xem danh sách đầy đủ.

### Hiển thị mục thiếu và Envelope — build 2026.10.17.7

Thông báo none và Case/Combo thiếu trong danh sách chọn dùng chữ đậm màu da cam. Màu được cập nhật sau mỗi lần xuất và xóa khi đổi model hoặc bắt đầu xuất lại; Case đã biết chưa có kết quả vẫn giữ dấu hiệu none. Envelope có thể xem trong bảng, tải JSON và tìm cực trị trên các dòng đã xuất. CSV liên kết chặn envelope/modal và nhãn Max/Min vì không bảo đảm các thành phần lực đồng thời. Một Combo thiếu kết quả do Case thành phần chưa phân tích là trường hợp none, khác với hạn chế CSV của Envelope.

### Section, Nonprismatic và bộ lọc — build 2026.10.17.8

- `GET /API_IF_SAP26.2.0_V1/members`: đọc các frame đang chọn ở PID/model đã kết nối. Cần Bearer token như các endpoint khác. Trả `model`, `pid`, `data` chứa thông tin từng frame. Endpoint chỉ đọc, giữ nguyên đơn vị SAP2000; mỗi member có `units_code` để giải thích chiều dài tuyệt đối.
- `POST /API_IF_SAP26.2.0_V1/frame-forces`: dữ liệu JSON bổ sung `members` bên cạnh `rows` và `missing_results`. Tên frame liên kết hai danh sách. Metadata được đọc cùng lần xuất, ở đơn vị kN–m–C (`units_code: 6`); đơn vị SAP cũ được khôi phục kể cả khi đọc metadata thất bại. JSON cũ không có `members` vẫn được chấp nhận.
- Mỗi member gồm `frame`, `section`, `auto_select_list`, `section_type_code`, `section_type`, `units_code`, `components`. Loại section lấy từ enum `eFramePropType` của DLL đang nạp, không dùng mã số phỏng đoán. Section prismatic thông thường có `components: []`.
- Với Nonprismatic, `components` theo đúng thứ tự đoạn của `PropFrame.GetNonPrismatic`: `index`, `start_section`, `end_section`, `start_type`, `end_type`, `length`, `length_type`, `ei33_variation`, `ei22_variation`. `length_type = 1` là tỷ lệ tương đối, `2` là chiều dài tuyệt đối theo units_code. EI giữ mã CSI (1 tuyến tính, 2 parabolic, 3 cubic). Không tự nội suy thành section tương đương tại station.
- CSV liên kết thêm cột `section`, `section_type`; đầy đủ thành phần Nonprismatic nằm trong JSON. Các quy tắc lực đồng thời và Envelope vẫn giữ nguyên.
- Mục 4 có bộ lọc Cấu kiện, Section, Loại section, Case/Combo, Loại output và Step. Các điều kiện kết hợp bằng AND; thay bộ lọc sẽ về trang đầu. Nút Xóa bộ lọc trả toàn bộ dòng. Bộ lọc chỉ tác động bảng hiển thị; tải JSON/CSV và mục 5 vẫn dùng toàn bộ dữ liệu đã xuất, được ghi rõ trên panel.
- Bấm Đọc lựa chọn hiện tại hoặc Lấy nội lực, rồi mở Section và thành phần Nonprismatic để xem cấu tạo từng đoạn. Cần đối chiếu trên Windows/SAP2000 26.2.0 thật; kiểm thử cloud dùng fixture API và CLR, không có DLL/SAP2000 thật.

### Sửa nhận diện Variable / Nonprismatic — build 2026.10.17.9

SAP2000 26.2.0 trả enum `Variable` cho section được định nghĩa trong hộp thoại Nonprismatic. Adapter nhận diện cả `Variable` và tên `Nonprismatic` để gọi GetNonPrismatic, thay vì để components rỗng. Giữ nguyên section_type gốc trong JSON/CSV. Panel hiển thị EI33/EI22 bằng nhãn Linear/Parabolic/Cubic; JSON vẫn giữ mã CSI nguyên bản. Kiểm thử tái tạo RF1 với section đầu 1200212810, cuối 1000212810, Length=1 Variable, EI33=Parabolic, EI22=Linear.

### Lọc vị trí I–J phục vụ chuẩn bị dữ liệu Cb — build 2026.10.17.10

Bộ lọc Loại section được thay bằng Vị trí dọc cấu kiện: Tất cả station, Cả 5 vị trí, End I, 1/4 L, 1/2 L, 3/4 L, End J. Bảng bổ sung cột Vị trí I–J. L là chiều dài hình học của từng frame, tính từ `FrameObj.GetPoints` và tọa độ Cartesian Global của hai PointObj; không lấy station lớn nhất làm chiều dài. Metadata members thêm `length`, `point_i`, `point_j`; chiều dài theo units_code và luôn là m trong dataset trích xuất.

Mỗi station được đối chiếu với L nhân 0, 0.25, 0.5, 0.75, 1; dung sai chỉ để xử lý sai số số thực: max(1e-6 m, L*1e-8). Không nội suy, không làm tròn sang station gần nhất, không ghép hoặc trung bình các dòng khác element/case/step cùng station. Tại ranh giới phần tử có thể có nhiều dòng cùng mốc; giữ nguyên để kiểm tra lực hai phía.

Nếu thiếu station, panel nêu mốc thiếu theo từng frame/output/step trong phạm vi các bộ lọc khác. Kiểm tra Output Stations ở SAP2000 và xuất lại; API không tự sửa output station hoặc chạy analysis. Dataset cũ thiếu length vẫn mở được nhưng không giả định chiều dài từ rows, cần xuất lại để dùng bộ lọc vị trí.

Các vị trí này theo toàn frame I–J, chưa phải các điểm chia tư của một đoạn không giằng Lb do người dùng xác định. API chưa tính Cb; cần xác định Lb, trục mômen và Mmax của đúng đoạn trong module tính riêng. Bộ lọc vẫn chỉ áp dụng cho bảng; JSON/CSV và mục 5 giữ toàn bộ dữ liệu trích xuất.

### Panel rộng và nội suy tuyến tính có dấu — build 2026.10.17.11

Panel dùng toàn chiều ngang cửa sổ; cột trái thu gọn, tên Combo dài tự xuống dòng và bảng hiển thị số với 7 chữ số có nghĩa. Số nhỏ vẫn dùng ký pháp khoa học để không biến thành 0; JSON giữ đầy đủ số thực gốc. Màn hình nhỏ vẫn cuộn bảng khi cần.

Sau khi xuất SAP, panel tự gọi `POST /API_IF_SAP26.2.0_V1/position-samples` với body `{ "dataset": ... }`. Endpoint xử lý dữ liệu trong bộ nhớ, không gọi hoặc sửa SAP2000; cần Bearer token. Chọn L/4, L/2, 3L/4 hoặc Cả 5 vị trí để xem các dòng gốc/nội suy. Dòng nội suy có nhãn nguồn và nền riêng; rê chuột để xem record nguồn và trọng số. Nút Tải vị trí / nội suy JSON tải toàn bộ 5 mốc, gồm `data`, `source_rows`, `members`, `missing_results`, thời điểm trích xuất và hệ trục/đơn vị. JSON gốc và CSV liên kết vẫn lấy dataset SAP gốc; cực trị ở mục 5 cũng dùng dataset gốc.

Thuật toán nhóm theo frame, loại output, tên output, StepType và StepNum. Có station đích (dung sai max(1e-6 m,L*1e-8)) thì giữ các dòng SAP gốc, kể cả hai phía khác element tại cùng tọa độ. Chỉ nội suy ba mốc chia tư còn thiếu; không ngoại suy End I/J. Lấy hai station gần nhất kẹp x; chúng phải có một nhánh element chung duy nhất và mỗi đầu có một dòng trên nhánh đó. Không vượt qua station trung gian, không chọn tùy ý giữa các dòng trùng nguồn và không lấy trung bình qua gián đoạn. Nếu không đủ điều kiện, trả `method: unavailable`, `rows: []` cùng lý do.

Với t=(x-x1)/(x2-x1), từng thành phần P,V2,V3,T,M2,M3 được nội suy bằng (1-t)*F1+t*F2; giữ dấu đại số, không lấy trị tuyệt đối. `method: linear` kèm `source_record_ids`, `weight` và dòng kết quả. `method: original` giữ giá trị/ID gốc. `source_rows` cho phép đối chiếu độc lập; dữ liệu nguồn không bị thay đổi. Envelope/modal vẫn giữ concurrency và StepType gốc, không thành bộ lực đồng thời. Giới hạn 100.000 samples mỗi lần xử lý, cần giảm số frame/output nếu vượt.

Mốc theo toàn frame I–J; module Cb riêng cần xác định đúng đoạn Lb, trục mômen và Mmax. Nội suy tuyến tính là xấp xỉ giữa các station xuất, không tự bổ sung tải hoặc chạy lại mô hình.

### Chọn Case/Combo theo dải và đọc tên dài — build 2026.10.17.12

- Cột Output Cases & Combos rộng khoảng 330 px trên desktop; giao diện nhỏ vẫn một cột. Danh sách giữ tên trên một dòng và có thanh cuộn ngang bên dưới.
- Bộ lọc loại: Case & Combo / Chỉ Load Cases / Chỉ Load Combinations, kết hợp với tìm tên không phân biệt hoa thường. Bộ lọc giữ các lựa chọn đã có, kể cả khi chúng đang bị ẩn. Nút Chọn các mục đang hiển thị chỉ thêm những mục khớp cả hai bộ lọc; Bỏ chọn tất cả xóa cả mục bị ẩn.
- Bấm mục đầu, giữ Shift rồi bấm mục cuối để chọn dải liên tiếp trong danh sách đang hiển thị. Shift+bỏ chọn mục cuối để bỏ chọn cả dải. Hỗ trợ chọn ngược chiều và Shift+Space khi checkbox có focus. Đổi bộ lọc hoặc model sẽ xóa mốc neo của dải để không chọn nhầm; tên Case trùng Combo vẫn là hai mục riêng.
- Rê chuột lên mục để xem tooltip tên đầy đủ; tên cũng hiển thị ở ô bên dưới danh sách khi hover hoặc focus bàn phím. Mục không có kết quả vẫn giữ chữ đậm màu cam.

Các thay đổi chỉ thuộc thao tác panel; không thay đổi tính toán nội lực, nội suy hoặc cấu hình output SAP2000.

### Cực trị theo vị trí local của frame — build 2026.10.17.13

Mục 5 tách hai bộ lọc: (1) Theo từng cấu kiện / Theo toàn bộ nhóm đã xuất, (2) Vị trí khảo sát: Tất cả station gốc, End I, End J, 1/4 L, 1/2 L, 3/4 L hoặc Cả 5 vị trí. Có thêm lựa chọn thành phần P, V2, V3, T, M2, M3 hoặc tất cả. Mục 5 độc lập với bộ lọc bảng mục 4. Thay điều kiện sẽ xóa kết quả cũ, cần bấm Xác định lại.

`POST /API_IF_SAP26.2.0_V1/extremes` thêm `position` mặc định `all`; các giá trị hợp lệ: `all`, `end_i`, `quarter`, `mid`, `three_quarter`, `end_j`, `five`. `scope` vẫn là `per_frame` hoặc `global`, `components` là danh sách thành phần như trước. `all` xét mọi dòng SAP gốc. Các vị trí khác dùng thuật toán lấy mẫu/nội suy có dấu của position-samples; không ngoại suy End I/J, không trộn element/case/step. Trường hợp thiếu vị trí trả trong `unavailable_positions`; nếu toàn bộ thiếu, `data: []`, không tạo cực trị bằng 0.

Mỗi min/max/absolute thêm `locations`, song song tối đa 20 dòng `rows` preview: frame, element, station (m theo local 1 từ I), element_station, relative_station=x/L, nhãn vị trí, method, source_record_ids và weight. `source_rows` kèm các dòng nguồn của các mốc khảo sát. `absolute.value` vẫn là độ lớn dương tương thích API cũ; dấu lực nằm trong rows[...][component]. Bảng hiển thị cả giá trị có dấu và độ lớn. Trường hợp đồng hạng giữ đủ record_ids, preview 20 bộ lực, có cờ rows_truncated như trước.

Bảng có riêng dòng Min, Max, |Max| cho mỗi nhóm/thành phần, kèm frame, Case/Combo, Step, element, x local 1, x/L, vị trí và nguồn SAP/nội suy. Mở Bộ lực / Đồng hạng để xem P,V2,V3,T,M2,M3 tại từng dòng chi phối, không ghép các cực trị độc lập thành vector liên kết. Dấu và trục 1–2–3 giữ nguyên theo SAP, chưa chuyển dấu mặt đầu hoặc quy về lực nút. L vẫn theo toàn frame I–J, chưa thay cho đoạn Lb.

Ví dụ tìm M3 lớn nhất ở đâu: chọn Theo toàn bộ nhóm đã xuất → Tất cả station gốc → M3. Ví dụ phục vụ liên kết đầu I: chọn Theo từng cấu kiện → End I → Tất cả thành phần, rồi mở bộ lực ở dòng chi phối để chọn các bộ lực thiết kế. Envelope/modal vẫn mang cờ nonconcurrent, không được xem như bộ lực đồng thời.

### GeekCalculus web entry — build 2026.10.17.14

Trong Steel Structure, SAP2000-API nằm ngay sau CFS Design và mở tab mới tới `sap2000-api/26.2.0/`, đúng base path của bản native hoặc GitHub Pages. Reuse panel từ ZIP, không đổi CSS/bố cục. Tiêu đề/nhãn theo `?lang=vi` hoặc `?lang=en` từ nút VI/EN của GeekCalculus. Dòng đầu luôn ghi Compatible with SAP2000v26.2.0. Phiên bản hiện tại cố định 26.2.0; thư mục theo version để có thể bổ sung phiên bản khác độc lập sau này.

Website chỉ phục vụ HTML và ZIP Windows source-only (không .venv). Chạy SAP2000/connector trên Windows cùng mức quyền như trước. Panel web gọi trực tiếp `http://127.0.0.1:8010`, không gửi model qua Laravel hoặc server web. Cần token connector; CORS chỉ chấp nhận các origin GeekCalculus được khai báo trong connector.py, không dùng wildcard, vẫn yêu cầu Bearer token cho mọi dữ liệu. Nếu trình duyệt hỏi quyền truy cập mạng local, cho phép đối với GeekCalculus. Native panel localhost vẫn chạy như trước.

Để mở web panel kèm token mà không sao chép token thủ công, dùng launcher trong CMD tại C:\geek_calculus\SAP2000-API:

```cmd
start-sap2000-panel.cmd --web-url "http://geekcalculus.com/sap2000-api/26.2.0/?lang=vi"
```

Hoặc Pages:

```cmd
start-sap2000-panel.cmd --web-url "https://ducvu89260.github.io/GeekCalculus/sap2000-api/26.2.0/?lang=en"
```

--web-url chỉ chấp nhận trang versioned trên các origin đã duyệt, không nhận URL tùy ý. Token đi qua fragment, được xóa khỏi thanh địa chỉ ngay khi panel tải, không đưa vào HTTP request/URL log; chỉ giữ trong sessionStorage của tab đó. Nếu mở một tab web mới chưa có token, dùng launcher với --web-url để mở phiên được xác thực. Không đưa token vào chat, Git hoặc query string. Native launcher không tham số vẫn mở localhost.

Tài liệu đầu vào: SAP2000_26.2.0-API.zip; panel, connector và processing khớp nguồn force API trước tích hợp. Manifest versioned ghi SHA256 đầu vào và bản source-only phân phối. Cần kiểm chứng trên Windows/SAP2000 thực; kiểm thử cloud dùng fake SAP và browser CORS thực.

### Extreme table section — build 2026.10.18.15

The extreme table includes the governing member's assigned Section next to Frame;
missing metadata displays an em dash. Each expanded tie also identifies its own
member's section. Nonprismatic sections retain their assigned name (e.g. RF1);
this column does not infer a local interpolated section.

When moving the website to a new domain, change `--web-url` to the actual deployed
HTTPS panel URL and add its exact origin to `WEB_ORIGINS` in the connector, then
distribute the updated kit. The local connector remains necessary on the SAP2000
Windows machine. Buying a domain alone does not deploy the website.

### Website launcher — build 2026.10.18.16

Fixed directory: `C:\geek_calculus\SAP2000-API`. Stop the old connector before
updating. Recreate `.venv` when moving from another path; virtual environments
are not portable across directory moves. Run `install-web-launcher.cmd` once
per Windows user. It registers `geekcalculus-sap2000` under HKCU. The website
button invokes the handler with only version 26.2.0 and language vi/en. UAC consent
is requested, then the connector opens the fixed GitHub Pages panel with a token
fragment. Browser and UAC prompts cannot be silently bypassed. PowerShell execution
policy override applies only to the launcher process, not the system policy.

The reusable token is current-user DPAPI-encrypted at
`%LOCALAPPDATA%\GeekCalculus\SAP2000-API\connector-token.dpapi`. Repeat clicks
reuse a matching authenticated connector. Unknown listeners are never stopped;
stop the old connector safely with Ctrl+C first. Keep the connector window open.
To unregister remove only `HKCU\Software\Classes\geekcalculus-sap2000`.
Windows registration/UAC/DPAPI need verification on a Windows machine.

### Restart token correction — build 2026.10.18.17

The .16 launcher wrote serialized DPAPI text with a trailing newline and read it
without trimming. The next launch could fail while decoding the saved token. .17
trims legacy file whitespace, writes new values without newline, preserves the
existing token and reports startup stage/line without dumping token data. Replace
`open-sap2000-web.ps1` at the same fixed installation path, or overlay the new kit
while the connector is stopped. Keep `.venv` and the saved DPAPI file; no protocol
reinstallation is necessary. Regression: run
`pwsh -NoProfile -File tests/test_sap_launcher_token.ps1`. Cross-platform token
serialization is checked; Windows-specific DPAPI/UAC remains a device check.

### Panel interaction — build 2026.10.18.19

The top heading is SAP2000-API with live VI/EN controls. Switching language updates
the tab URL without reloading and retains extraction data, selection and filters.
Extreme rows use a View forces button opening a centered native dialog. Its table
shows each governing/tied row with section, case, step, location, all six forces
and concurrency. Close or Escape returns to the unchanged results. Large tie sets
retain the existing 20-row preview cap and complete record IDs in JSON.
All force displays use exactly two decimal places without scientific notation;
rounded negative zero is shown as 0.00. Large positive values are not clamped.
This formatting does not mutate extraction, interpolation, extremes or exports.

### Selected-member extreme scope — build 2026.10.18.20

Per member evaluates every exported member separately. Selected members opens a
searchable checkbox list labelled Frame and assigned Section; one or several
members can be selected. The existing API per_frame scope with a frames filter
evaluates each chosen member separately. Empty selection disables calculation.
Changing selection clears old extrema; a new extraction/model resets selection.
Section4 filters remain independent. The entire exported group option is retained.
Selected frames are recorded in the downloaded extreme JSON as selected_frames.
