# API_IF_SAP26.2.0_V1 — API nội lực SAP2000 26.2.0

Luồng: mở SAP2000 trên Windows → chạy analysis → chọn frame objects → đọc danh sách Output Cases → chọn cases/combinations → trích xuất → extreme / xuất cho liên kết.

Tên contract: **API_IF_SAP26.2.0_V1**. Phiên bản mục tiêu: **SAP2000 26.2.0**. Connector kiểm tra `SapModel.GetVersion()` trước mỗi thao tác; phiên bản khác bị từ chối. Cb theo AISC 360-10 thuộc module tính riêng bên trong, không thuộc API nội lực; xem [module nội bộ](CB-AISC360-10.md).

Connector .NET DLL/PID chạy **cùng máy và cùng phiên đăng nhập Windows với SAP2000**. Backend cloud không thể truy cập COM của máy người dùng. Không tự chạy analysis, mở/lưu model hoặc đổi lựa chọn cấu kiện. Connector tạm đổi đơn vị và Output Cases để đọc; khôi phục cả hai khi hoàn tất hoặc có lỗi. Không thao tác model trong lúc xuất. Một worker và khóa tuần tự bảo vệ các yêu cầu trong connector; không chạy nhiều connector cho cùng SAP2000.

## Chọn web hay local?

**Dùng giao diện web, connector chạy local trên máy Windows có SAP2000.** Bản sơ bộ phục vụ panel trực tiếp từ connector trên cùng máy. Trình duyệt và connector cùng origin, không cần cấu hình CORS, không mở cổng public và không gửi model/nội lực lên cloud. Có thể mở website GeekCalculus song song và bấm **SAP2000 · Nội lực (local)** trên thanh đầu của các trang module để mở panel local trong tab khác.

Website cloud không thể trực tiếp gọi SAP2000 COM của máy người dùng. Nhúng panel vào trang cloud hoặc để trang HTTPS gọi localhost sẽ cần cơ chế ghép nối, origin/CORS cho domain được phép và quyền truy cập local network của trình duyệt; các cơ chế đó chưa được triển khai ở bản này. Nút trên website hiện mở tab local, không gọi COM từ server cloud.

## Cài đặt một lần trên Windows

1. Cần SAP2000 **26.2.0**, Python **64-bit >= 3.11** và Internet để tải dependencies. Khi cài Python, bật Python Launcher (`py`). Chạy connector cùng tài khoản/phiên desktop với SAP2000; không cần chạy administrator nếu SAP2000 không chạy elevated.
2. Đặt bản mã có các thay đổi API này trên máy Windows, thư mục cố định `C:\SAP2000-Forces`. Không sao chép `.venv`, dependencies hoặc build cache từ Linux sang Windows.
3. Trong Explorer, mở `C:\SAP2000-Forces`, nhấp đúp **`start-sap2000-panel.cmd`**. Script tạo venv, cài dependencies theo lock và chạy connector. Lần đầu có thể mất vài phút. Giữ cửa sổ console đang chạy.
4. Launcher tự mở trình duyệt và ghép nối panel bằng mã giữ trong phiên tab. Không cần tự nhập token. Mã không đưa vào query/HTTP access log và được xóa khỏi fragment địa chỉ sau khi trang đọc. Token giữ trong sessionStorage của tab để tải lại trang vẫn kết nối được; restart connector sinh token mới nếu không cấu hình token môi trường cố định.

Nếu muốn chạy bằng PowerShell thay vì nhấp đúp:

```powershell
cd C:\SAP2000-Forces
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
cd /d C:\SAP2000-Forces
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

- Giải nén toàn bộ bộ API vào **`C:\SAP2000-Forces`**. Launcher và công cụ chẩn đoán kiểm tra vị trí này; nếu sai thư mục sẽ hướng dẫn chuyển bộ API trước khi chạy. Giữ `.venv` khi cập nhật.
- Chỉ mở **một tiến trình `SAP2000.exe`** trong lúc dùng API. Launcher mặc định bỏ PID môi trường cũ; `--pid` vẫn là lựa chọn nâng cao rõ ràng.
- Nhấp đúp `start-sap2000-panel.cmd`, không cần tra hoặc nhập PID. Connector dùng Windows `tasklist` có filter chính xác `SAP2000.exe`, không cần thêm thư viện dò process.
- Mỗi lần kết nối/đọc sẽ quét lại PID nếu đang ở chế độ tự động. Không có SAP thì yêu cầu mở, nhiều SAP thì yêu cầu đóng bớt; không chọn ngẫu nhiên tiến trình đầu tiên.
- Panel và `/model` trả PID thực tế đã gắn. Quét PID không mở/sửa/chạy phân tích model. Sau khi đổi file, vẫn làm mới model và xác nhận tên file trước khi xuất.
- Chạy `diagnose-sap2000.cmd` không tham số để chẩn đoán theo cùng chế độ Auto PID. Không cần lưu PID cố định vào file.

Cơ chế tasklist được kiểm thử ở biên subprocess với đầu ra Windows mô phỏng (không có/một/nhiều tiến trình, PID đổi sau restart, lỗi và timeout). Cần chạy bản mới trên Windows để xác nhận việc dò process thực tế.

## Chọn nhiều model local — build 2026.10.17-instance-picker.1

Bản này thay quy ước chỉ mở một phiên SAP2000: có thể mở nhiều phiên và chọn file qua danh sách PID + tên model. Thư mục API vẫn cố định `C:\SAP2000-Forces`. Không yêu cầu đổi tên thư mục, cài thêm dependency hoặc tìm PID trong Task Manager.

`GET /API_IF_SAP26.2.0_V1/instances` quét tasklist rồi gắn từng PID bằng DLL để đọc version, tên file, đường dẫn và trạng thái khóa. Không mở file, chạy analysis, đổi units/selection hoặc tự đổi PID đã cấu hình khi quét. Nếu một PID không đọc được, kết quả vẫn có dòng PID đó với `available:false` và lỗi tương ứng; model chưa lưu cũng chưa thể chọn để xuất.

Panel hiển thị mọi phiên tìm được, yêu cầu chọn khi có nhiều phiên, rồi gửi `PUT /connection` với `{pid, expected_model, dll_path}`. `expected_model` là đường dẫn đầy đủ đã quét. Các thao tác đọc từ đó được ghim vào đúng PID/file; nếu file trong PID đổi, API yêu cầu quét và chọn lại. Thay lựa chọn hoặc quét lại sẽ xóa kết quả/cases/extreme cũ trên panel, tránh trộn dữ liệu. File JSON/CSV đã tải về không bị xóa.

Sau khi đóng/mở lại SAP2000, bấm Quét để lấy PID mới. Chỉ model đã chọn mới được dùng cho Output Cases, selection và FrameForce. Việc quét tên file cần connector cùng tài khoản/mức quyền với các SAP2000 đang mở. Các tên và đường dẫn chỉ đọc trên local, không gửi cloud.

Bộ kiểm thử mô phỏng nhiều model có thêm phiên không truy cập được, chọn PID thứ hai, chuyển model, giữ lựa chọn khi reload, xuất Case/Combo, reset kết quả và chặn file đã đổi. Chưa nghiệm thu quét nhiều phiên SAP2000 thật trên Windows.

### Cổng 8010 đang được sử dụng / nhiều model

Nếu launcher báo WinError 10048, connector mới chưa chạy. Khi không có tác vụ xuất đang chạy, dùng `stop-sap2000-panel.cmd` cùng mức quyền Administrator rồi chạy lại `start-sap2000-panel.cmd`. Lệnh dừng chỉ nhận diện tiến trình Python đang chạy module connector trên cổng 8010; từ chối tiến trình khác và không dừng SAP2000.

Build 2026.10.17.2 đọc từng PID qua một Python worker riêng, cùng cách nạp DLL .NET như lệnh CMD đã kết nối thành công. Mỗi thao tác giữ nguyên PID/model đã chọn. Chẩn đoán attach có thông tin mức quyền và phiên Windows. Worker xuất nội lực không bị timeout cưỡng bức để có thể khôi phục đơn vị và Output Cases. Cần kiểm chứng kết nối trên Windows/SAP2000 thật.
