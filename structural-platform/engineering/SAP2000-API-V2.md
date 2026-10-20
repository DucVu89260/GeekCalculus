# SAP2000-API V2 — Web / Local

Build `2026.10.20-v2-force-ready.1` · Compatible with SAP2000 v26.2.0 · Windows64-bit, Python3.11–3.13 x64.

## Cài mới / Nâng cấp từ V1 hoặc V2 local

1. Đợi tác vụ đọc/xuất hoàn tất, dừng connector cũ bằng Ctrl+C. Giữ SAP2000 mở.
2. Giải nén **toàn bộ** ZIP trực tiếp vào **`C:\geek_calculus\SAP2000-API`**. Không đặt trong thư mục con V2. Ghi đè file cùng tên; giữ `.venv` đang có. Không sao chép `.venv` từ máy khác.
3. Chạy **`install-web-launcher.cmd`** một lần với tài khoản Windows sử dụng web. Đây là bước cập nhật đăng ký protocol từ V1 sang V2, kể cả trước đây bạn đã cài launcher V1. Alias này gọi installer V2; cũng có thể chạy `install-web-launcher-v2.cmd`.
4. Mở model đã lưu trong SAP2000 **26.2.0**. Chạy analysis trước khi cần nội lực; chạy Steel Design trong SAP nếu muốn đọc kết quả thiết kế có sẵn.
5. Trên GeekCalculus bấm **SAP2000-API**, đọc hướng dẫn, bấm Tiếp tục, chấp thuận mở ứng dụng và UAC Administrator. Giữ cùng tài khoản/mức quyền với SAP.
6. Launcher mở PowerShell/connector và trang web có token tự động. Nếu trình duyệt hỏi quyền truy cập mạng local, cho phép trang GeekCalculus. Giữ cửa sổ connector chạy.
7. Quét/chọn đúng model/PID, kết nối; chọn frame trong SAP rồi đọc hồ sơ hoặc lấy nội lực trên panel.

**Địa chỉ web:** https://ducvu89260.github.io/GeekCalculus/sap2000-api/26.2.0/?lang=vi

Nếu trang vẫn hiện V1, tải lại bỏ cache (Ctrl+F5). Nếu cổng8010 bị chiếm hoặc launcher báo connector khác, dừng cửa sổ connector cũ khi không có tác vụ xuất rồi mở lại từ web. Không cần đóng SAP hay Repair. Cả V1/V2 sử dụng cổng8010, không chạy đồng thời.

## Portable giữa các máy / Portable across machines

Thư mục kit có thể sao chép nguyên bộ giữa các máy tại `C:\geek_calculus\SAP2000-API`. `.venv` chứa đường dẫn Python theo máy/tài khoản nên không phải runtime portable. Launcher nay tự kiểm tra Python thực thi, phiên bản, kiến trúc 64-bit và pip; môi trường hỏng do đường dẫn tài khoản cũ được đổi tên thành `.venv-backup-<ngày-giờ>-<mã>` rồi tạo lại tự động. Môi trường hợp lệ được giữ lại. Không cần xóa hay đổi tên `.venv` thủ công; model và `.env` không bị sửa.

- Trên mỗi máy, cài **Python 3.13 x64** kèm Python Launcher (`py`); cũng hỗ trợ 3.12/3.11 x64. Launcher chọn lần lượt **3.13 → 3.12 → 3.11**, không lấy Python 3.15 mặc định. Trường hợp có Python 3.13 dưới tài khoản Windows mới, đường dẫn của tài khoản đó được sử dụng tự động.
- Có thể cung cấp một **full Python runtime** tương thích tại `.runtime\python.exe`; cần đủ `venv` và `ensurepip`, không dùng riêng bản embeddable tối giản. ZIP không kèm Python runtime. Lần cài dependencies đầu cần Internet; đây chưa phải gói standalone/offline hoàn toàn.
- Dừng connector trước khi chuyển máy/cập nhật hoặc sửa môi trường. Nếu cổng 8010 đang bận, bootstrap không đổi tên môi trường và báo cần dừng connector cũ; không tự tắt SAP2000.
- Mỗi máy/tài khoản mới chạy `install-web-launcher.cmd` một lần. Máy đã đăng ký V2 không cần đăng ký lại chỉ vì cập nhật bản sửa Python.

The source kit is portable; virtual environments are machine-specific. Startup automatically preserves an invalid environment as `.venv-backup-*` and creates a replacement using a supported local 64-bit Python. Install Python 3.13 with `py` on each machine (3.12/3.11 also supported), or supply a full compatible `.runtime`. Python and first-install dependencies are not bundled. Old backups are kept; no model or `.env` is changed.

## Chạy thủ công

Local panel, không cần web:

```cmd
cd /d C:\geek_calculus\SAP2000-API
start-sap2000-v2.cmd
```

Mở panel web thủ công:

```cmd
cd /d C:\geek_calculus\SAP2000-API
start-sap2000-v2.cmd --web-url "https://ducvu89260.github.io/GeekCalculus/sap2000-api/26.2.0/?lang=vi"
```

Không cần nhập token nếu mở qua launcher. Nếu đang chạy thủ công bằng token ngẫu nhiên, dừng connector đó trước khi dùng launcher web (launcher có token DPAPI riêng). Cài đặt lần đầu cần Internet để tải dependencies; launcher cài cả requirements-test.lock và requirements-windows.txt.

## Bố cục và dữ liệu

- **3. Cấu kiện đã chọn:**3.1 identity/GUID/groups, sections/dimensions/properties, materials/overwrite, geometry/local axes, releases/offsets/springs/hinges, section/member modifiers;3.2 model-wide Preferences, per-member AISC360-10 overwrites, existing SAP Steel Design results.
- Nhóm cơ bản/Chọn đủ/Bỏ chọn/Đọc hồ sơ/JSON/kiểm tra DLL và2 selector giữ cơ chế chung. Preferences-only không cần chọn member; xem Model/Design data. Các nhóm member cần chọn1–200 frame.
- **4. Kết quả nội lực:** đọc lựa chọn/lấy nội lực,4.1 lọc,4.2 cực trị,4.3 tổng hợp theo tiết diện. Profile không đọc lặp tải/nội lực/chuyển vị. Bộ lọc4.1 không tự giới hạn4.2/4.3.
- Nonprismatic giữ các đoạn, section đầu/cuối, relative/absolute length và EI variation. Kích thước I đọc từ GetISection, không suy từ tên; I/J của bảng là đầu đoạn property, không mặc định đầu vật lý của frame nếu frame chỉ dùng một phần property.
- Section type key phục vụ nhận diện nhóm module, không chứng minh đã đủ điều kiện kiểm tra cường độ. Section đặc biệt/unmapped giữ manual_review; Nonprismatic component_dependent, Auto Select List selection_list, Steel Joist specialized_workflow.
- Fy/Fu từ SAP material library tại Temp0, ưu tiên material overwrite đã xác nhận; literal None nghĩa không overwrite. eFy/eFu và design Fy overwrite giữ riêng. Không suy effective program-determined values từ Value0/ProgDet.
- Releases: bảngI/J5 cột,0–5=P/V2/V3/T/M2/M3 ↔ U1/U2/U3/R1/R2/R3. true=có giải phóng, false=không giải phóng. Partial fixity tách riêng; không suy giằng/Cb chỉ từ Releases.
- Preferences35 và overwrites43 hiện chỉ ánh xạ AISC360-10. Kết quả member chưa có design: **Members have not been designed** khi getter xác nhận. Getter lỗi/không rõ availability báo riêng, không tự chạy Design.
- DatabaseTables giữ cho phát triển: inventory/getter thực từ DLL, raw table strings, display selection hiện có của SAP độc lập panel cases; default5000/max50000 records, preview200. Kiểm tra units/axes/selection trước khi dùng tính.

## Thuyết minh Symmetric I/H · AISC 360-10

Từ **Kiểm tra Steel Design** ở mục3 hoặc **Kiểm tra nhanh từ Summary** ở4.3, mở cửa sổ báo cáo3 phần: cơ sở/đầu vào, mô men-Cb, kết quả theo Frame/Combo. Chọn ASD/LRFD, nguồn chiều dài, nhập Lz và đoạn LTB rồi bấm **Kiểm tra các tổ hợp**. Có thể chọn riêng một Case/Combo. **Xem chi tiết** tự nạp dữ liệu và chạy cùng component, không tải/nạp JSON. JSON chỉ là tùy chọn trong mục thu gọn Dữ liệu nguồn.

- Cơ sở DAM và Kx=Ky=Kz=1 ghi ở đầu. K không phải thuộc tính vật liệu. Lx khống chế uốn quanh trục chính; Ly quanh trục phụ; Lz khống chế xoắn; Lb chống uốn xoắn. Không suy Lz=major hoặc Lz=Lb. Ratio Major/Minor/LTB SAP × Length giữ theo quy ước đã chọn, ProgDet/0/thiếu dữ liệu không tự thành chiều dài hữu hiệu.
- Quy ước cố định N=P, Mx=M3, My=M2, Vy=V2, Vx=V3, T=T chỉ ghi chú, không checkbox lặp lại. Giữ nguyên dấu và độ chính xác; bảng lực làm tròn2chữ số để hiển thị.
- API đọc E/G/Fy/Fu và Poisson từ thư viện SAP Temp0; material overwrite/eFy/eFu/design overwrites giữ riêng. E/G SAP hiển thị cạnh nguồn; bộ tính AISC vẫn dùng nominal E200000/G77200 MPa. Hai nguồn khác nhau được nêu rõ, không mặc định giống hoặc tự thay. Mục tiêu đối chiếu SAP cần thống nhất cơ sở này, tiêu chuẩn, ASD/LRFD, section phân tích/design, overwrites và phạm vi.
- F1-1 dùng Mmax và MA/MB/MC của cùng Frame/case-kind/case/step-type/step-number và cùng đoạn LTB. Đoạn start/end phải có chiều dài bằng Lb, nằm trong frame; không suy điểm giằng từ releases. Chỉ tự đề xuất0…L khi Lb=L. Quarters nội suy tuyến tính cùng element nếu thiếu đúng mốc, không ngoại suy; Mmax lấy tất cả station gốc trong đoạn cùng các mốc. Giả thiết người dùng đã xuất đủ station SAP bắt điểm đột biến; không coi5mốc tự xác nhận Mmax. Cb1 bảo thủ là lựa chọn riêng; console đầu tự do theo nhánh F1-1 hiện có. Cb và nguồn/moment mẫu đi thẳng vào component và kết quả JSON; sửa đầu vào component sẽ làm Cb nguồn hết hiệu lực cho tới khi tính lại từ báo cáo.
- Không kể sườn ngang/TFA mặc định được tích; đây là phạm vi lần kiểm tra, không suy từ model rằng không có sườn. Bỏ tích yêu cầu một workflow sườn được xác nhận riêng, không tự cấp kích thước mẫu.
- Kết quả gom theo Frame/Case-kind/Combo, chọn dòng có D/C đã tính lớn nhất trong các kiểm tra hiện có (không chỉ H1). Mỗi dòng giữ nguyên bộ6lực của chính nó; không ghép cực trị. Có H1, Cb, trạng thái, nguồn và chi tiết. Các dòng thiếu/ngoài đoạn/ngoài phạm vi làm nhóm chưa đầy đủ; không công bố PASS toàn member khi còn thiếu. Summary lấy các cặp Frame/Combo từ các dòng cực trị min/max đã xuất trong Summary rồi mở rộng tới tất cả station gốc, mọi step và các mốc0/¼/½/¾/1L khả dụng của chính các cặp đó; không bao phủ tổ hợp khác hay các frame đồng hạng ngoài bản xem trước. Full dùng mọi Frame/Combo đã xuất với cùng quy tắc station. Không ngoại suy mốc thiếu; xem số dòng đã tính/tổng dòng và mốc thiếu ở bảng station. Cache hình học/biểu đồ và chỉ giữ chi tiết dòng chi phối mỗi nhóm để hạn chế bộ nhớ.

Kiểm tra member dùng prismatic I/H hàn đối xứng và bộ lực concurrent. Nonprismatic có thêm **D/C tham khảo** theo bộ tính prismatic tại từng station, với giả thiết h tuyến tính theo toàn I–J, các kích thước cánh/bụng không đổi; chỉ một đoạn relative và assignment getter xác nhận total/start=0. Đây là giả thiết hình học theo yêu cầu người dùng, không phải suy luận từ EI33/EI22 hoặc xác nhận quy tắc CSI. Endpoint dimensions/Fy/Fu phải rõ nguồn và vật liệu không mâu thuẫn. Partial assignment, nhiều đoạn, thay đổi cánh/bụng, thiếu vật liệu hoặc bộ lực không đồng thời vẫn bị chặn. D/C này **không phải D/C ổn định Nonprismatic theo AISC**: luôn REVIEW_REQUIRED, không PASS/FAIL toàn cấu kiện và không chuyển vào component prismatic như member đã được xác minh. Nút Các station đã kiểm tra hiện hình học, nguồn lực, Cb, D/C và lý do/giới hạn. Rolled/asymmetric/envelope hoặc thiếu đầu vào tiếp tục được báo rõ. Không khẳng định sai số so với SAP khi chưa có kết quả design cùng tổ hợp/vị trí/cơ sở. Cần snapshot kèm Preferences/Overwrites/Steel Design và nội lực của cùng trạng thái phân tích để đối chiếu thực tế. Source-bound Cb được nối vào hàm F1-1 đã có; không đổi hệ số/công thức sức chịu tải. Mẫu bên ngoài SkyCiv/Tekla đã thử truy cập nhưng proxy403, không ghi nhận là mẫu đã xem.

Local/web dùng cùng asset canonical trong ZIP, chạy HTTPS/localhost; giữ bootstrap portable và toàn bộ các bộ lọc release. Phải giải nén toàn bộ kit mới, không chỉ panel.html. Các nhánh REVIEW_REQUIRED/INPUT_REQUIRED của bộ tính vẫn giữ. Không tự sửa model SAP hoặc chạy analysis/design.

## Vị trí cực trị / Extreme positions

`start` = x0 (đầu I), `end` = xL (đầu J), giữ nguyên các mốc chia tư và cả 5 vị trí. `release-start` / `release-end` chọn station gốc nhỏ nhất / lớn nhất riêng cho mỗi frame, case/combo và step. Dùng station trên toàn frame, không phải element station; giữ mọi dòng tại cùng station và bộ 6 nội lực gốc, không nội suy. Áp dụng cả bộ lọc nội lực4.1, cực trị và Summary. Bộ lọc4.1 dùng trực tiếp dữ liệu gốc trong trình duyệt, không cần lấy mẫu/nội suy hay cập nhật API connector. Hai vị trí có thể trùng start/end; không suy từ tên này rằng release đã được gán. Nếu SAP xuất cả đầu nút và mặt offset, thuật toán vẫn chọn biên ngoài cùng của dữ liệu đã xuất, không tự nhận diện mặt offset.

`release-start` / `release-end` use minimum / maximum original object station per frame/output/step; preserve tied rows, original vectors and signs, with no interpolation or assertion of release assignment. Update the local kit as well as the hosted UI to enable these new API options.

## Đơn vị, dữ liệu gốc và giới hạn

Các numeric reads dùng kN–m–C, giữ dấu/trục CSI. Khôi phục units và output selections sau tác vụ. Geometry chuẩn hóa mm, stress MPa bằng hệ số đơn vị rõ ràng; raw DLL fields/signatures vẫn giữ. Modifiers section/member không tự áp vào properties. Force display2 decimals; JSON/interpolation/extremes giữ full precision. Nested force dataset giữ V1 DTO để tương thích xử lý; snapshotV2 schema2/API prefixV2.

Các getter chỉ đọc được allowlist; không chạy Analysis/StartDesign hay gán đối tượng. Units/output selections có thể đổi tạm để đọc và được khôi phục. Không đổi model trong khi xuất. Missing/unsupported/unavailable không tự thay bằng0. Đọc được shape/material không đồng nghĩa module sức chịu tải/Cb đã được xác minh.

## Token / Quyền truy cập

Connector chỉ bind127.0.0.1:8010. Web chỉ được CORS cho exact GeekCalculus origins, bearer token vẫn bắt buộc, không gửi token trong query. Token web launcher được DPAPI bảo vệ riêng theo Windows user tại LocalAppData/GeekCalculus/SAP2000-API/connector-v2-token.dpapi. Fragment bị panel xóa sau khi nhận; không gửi token cho người khác. JSON chứa tên/đường dẫn và dữ liệu model; kiểm tra trước khi chia sẻ. Không mở port8010 ra Internet.

## Diagnostics

```cmd
diagnose-sap2000-v2.cmd --pid 20948 --dll "C:\Program Files\Computers and Structures\SAP2000 26\SAP2000v1.dll"
```

Thay PID ví dụ bằng PID thực nếu cần. Panel quét PID tự động; export capabilities và failed getter statuses để chẩn đoán, không gửi token. DLL phải từ thư mục cài SAP chính, không dùng NativeAPI DLL.

## Validation / English quick start

Cloud verifies synthetic SAP snapshots/auth/restoration, real CLR reflection fixtures (no SAP DLL), local/hosted browser workflows. User has verified basic/section/material reads on actual SAP. **New Windows protocol/UAC integration needs user acceptance on the target machine.** No live Windows SAP instance is available in cloud.

Extract all files to `C:\geek_calculus\SAP2000-API`, stop old connector, run `install-web-launcher.cmd` once to upgrade registration, then click SAP2000-API on GeekCalculus and approve browser/UAC/local-network prompts. Keep SAP2000 26.2.0 and connector running at matching Windows user/elevation. For local-only use run `start-sap2000-v2.cmd`.

Reference: Ephraim-Bryski/SAP-Tooltips@608415951abf7c601c3939ed0296cd1daa45eda5. Actual DLL signatures control reads; reference has older/mixed signatures. No SAP DLL/CHM/model/source-document binaries are redistributed.

## Màu section / Section bands

Bảng4.1 dùng hai màu nền luân phiên theo danh sách tên section sắp xếp từ toàn bộ dữ liệu đã xuất. Mọi Frame chung section giữ cùng màu khi lọc hoặc đổi trang; màu chỉ hỗ trợ đọc, không biểu diễn đạt/không đạt. Dòng nội suy có vạch bên trái, giữ nguồn và giá trị gốc/độ chính xác JSON.

## DAM lengths / Chiều dài thiết kế

Mặc định Hybrid: Lx nhập tay, Ly=SAP Minor ratio×Length I–J, Lb=SAP LTB ratio×Length I–J. Ratio phải đọc thành công, dương và ProgDet=false. Không chuyển0/Program Determined thành1. Nếu chưa có overwrites, mở report sẽ đọc lại hồ sơ cho đúng các Frame đã xuất, gồm geometry/material/section/preferences/overwrites và các nhóm hồ sơ trước đó. Không chạy analysis/design hoặc đổi checkbox nhóm. Có nút Đọc lại để chủ động cập nhật. Thiếu giá trị được ghi rõ; hybrid cho nhập tay dự phòng Ly/Lb với nguồn manual, không ghi là SAP. Vẫn có chế độ toàn SAP hoặc toàn nhập tay.

Lz là chiều dài khống chế mất ổn định xoắn trong nhánh E4-4 của bộ tính I/H, độc lập với K=1 theo DAM. Danh mục AISC360-10 GetOverwrite đã xác minh chỉ có Major/Minor/LTB ratios, chưa có Lz độc lập. Chọn Lz nhập tay hoặc chủ động chọn **Lz=Lb — xác nhận cùng khống chế xoắn** nếu điều kiện thực tế cho phép; nguồn được lưu `declared_Lz_equals_Lb`, không phải giá trị Lz do SAP trả về. Không tự suy Lz=Lx/Ly/Lb từ DAM.

LTB start/end là tọa độ theo local1 của hai đầu đoạn không giằng dùng để tính Cb, không phải hai bước xà gồ. Ví dụ đoạn2–4m có Lb2m, quarters tại2.5/3/3.5m. Giằng xà gồ cần đúng điều kiện khống chế cánh nén/xoắn; không coi mọi vị trí xà gồ tự động là giằng. Một ratio chỉ cho chiều dài, không cho danh sách tọa độ giằng. Giao diện hiện xét một đoạn đã khai báo mỗi Frame; nếu nhiều đoạn/khác bước thì cần xét từng đoạn, không tự lấy0…Lb làm toàn bộ phạm vi.

## Cb và kết quả chưa tính được

Cb được xử lý độc lập từ biểu đồ cùng Frame/Combo/Step/LTB, trước các điều kiện hình học/Lz/sức kháng. Nếu Cb đã tính hợp lệ, lỗi chuẩn bị D/C không được xóa Cb. Không tính Cb thiết kế từ vector envelope/modal không đồng thời; không tự đổi sang1 khi biểu đồ thiếu mốc (chỉ dùng1 khi chọn phương án bảo thủ). H1 và D/C chỉ có số khi có kiểm tra sức kháng tương ứng. Mỗi dòng lưu metric_reasons riêng; phần Lý do chưa có kết quả nằm dưới bảng gom nguyên nhân và số dòng ảnh hưởng theo Frame/Combo. Chú thích dấu* bên ngoài cả bảng tổ hợp và bảng station định nghĩa D/C đã tính, phạm vi tham khảo Nonprismatic và việc dấu—không phải0. Đây là sửa điều phối/hiển thị; không đổi công thức hay nới điều kiện chấp nhận thiết kế.

## Khai báo đoạn LTB và phạm vi Cb

Khi Lb<Length, không chọn ngầm đoạn0…Lb. Nhập start đã xác định hoặc bấm Chọn đoạn đầu0→Lb để chủ động khai báo đoạn đầu; end được đề xuất bằng start+Lb, không phải tọa độ giằng đọc từ SAP. Có thể chỉnh end hoặc dùng Cuối=đầu+Lb; thay đổi Lb giữ end nhập tay để báo sai khác thay vì âm thầm đổi tọa độ. Khi Lb=Length, giao diện tiếp tục gợi ý toàn frame0…L và ghi nguồn full_frame_length_reference. Mốc MA/MB/MC hiện ngay dưới hai tọa độ. Chỉ đang kiểm tra một đoạn cho mỗi Frame; các station ngoài đoạn vẫn ghi rõ chưa được tính, không coi là đạt toàn member.

Cb1 bảo thủ hoặc console đầu tự do do người dùng khai báo không yêu cầu start/end hay các mô men chia tư; hai ô được vô hiệu và nhánh F1-1 đã xác minh trả1. Lb vẫn cần cho sức kháng. Không tự suy điều kiện console/giằng từ Releases. Từng station luôn kiểm tra phạm vi trước khi dùng lại biểu đồ cache, kể cả cùng combo/step. Các lý do trùng nhau được gom theo nguyên nhân, liệt kê Cb/H1 D-C/D-C bị ảnh hưởng và đếm mỗi dòng nội lực một lần.

## Chiều dài lớn nhất và Cb đơn giản — thay thế luồng chính theo đoạn

Lx/Major, Ly/Minor, Lb/LTB là chiều dài thiết kế lớn nhất do người dùng xác định cho Frame. Ví dụ Frame9m với xà gồ1.5m hoặc4@1.5+3@1.0 có thể dùng Ly1.5m và Lb3/4.5/6m theo cấu tạo flying bracing do kỹ sư chọn. Web không dựng vị trí giằng từ những số này. Ưu tiên ratio Major/Minor/LTB SAP×Length I–J cho cả3; thiếu/Program Determined/không hợp lệ cho phép nhập tay từng trường với nguồn manual. Không tự biến ratio0 thành1. Chế độ hybrid/manual trước đây vẫn có.

Mặc định **Cb1 bảo thủ**, dùng cùng các chiều dài lớn nhất tại mọi station thuộc phạm vi đã chọn, không yêu cầu start/end. Các station/step/combo và bộ6 lực vẫn độc lập. Cb theo biểu đồ F1-1 là lựa chọn nâng cao riêng: cần đoạn thực, không lấy chia tư toàn Frame rồi coi là Cb cho mọi đoạn Lb nhỏ hơn. Không tự chọn giá trị Cb>1 từ giả thiết khoảng cách giằng.

Bảng chính chỉ có3 chiều dài. Lz xoắn E4 của engine được chuyển vào mục bổ sung, không đổi tên thành LTB và không tự đặt bằng Lb. Có thể nhập tay/khai báo Lz=Lb từng Frame hoặc chủ động bấm áp dụng quy ước này cho các Frame đang kiểm tra khi điều kiện thực tế cho phép; source=declared_Lz_equals_Lb, không phải SAP-provided Lz. Thiếu E4 được báo cho H1; không tạo kết quả giả. Không đổi công thức sức kháng hoặc nới phạm vi Nonprismatic tham khảo.
