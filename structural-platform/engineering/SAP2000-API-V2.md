# SAP2000-API V2 — Web / Local

Build `2026.10.19-v2-report.1` · Compatible with SAP2000 v26.2.0 · Windows64-bit, Python3.11–3.13 x64.

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
- Kết quả gom theo Frame/Case-kind/Combo, chọn dòng có D/C đã tính lớn nhất trong các kiểm tra hiện có (không chỉ H1). Mỗi dòng giữ nguyên bộ6lực của chính nó; không ghép cực trị. Có H1, Cb, trạng thái, nguồn và chi tiết. Các dòng thiếu/ngoài đoạn/ngoài phạm vi làm nhóm chưa đầy đủ; không công bố PASS toàn member khi còn thiếu. Summary chỉ bao phủ các dòng chi phối xem trước; Full bao phủ dữ liệu đã xuất, không phải mọi vị trí chưa xuất. Cache hình học/biểu đồ và chỉ giữ chi tiết dòng chi phối mỗi nhóm để hạn chế bộ nhớ.

Prismatic I/H hàn đối xứng và lực concurrent là phạm vi hiện tại. Nonprismatic/rolled/asymmetric/envelope hoặc thiếu đầu vào được báo rõ, không thay bằng tiết diện đều. Không khẳng định sai số so với SAP khi chưa có kết quả design cùng tổ hợp/vị trí/cơ sở. Cần snapshot kèm Preferences/Overwrites/Steel Design và nội lực của cùng trạng thái phân tích để đối chiếu thực tế. Source-bound Cb được nối vào hàm F1-1 đã có; không đổi hệ số/công thức sức chịu tải. Mẫu bên ngoài SkyCiv/Tekla đã thử truy cập nhưng proxy403, không ghi nhận là mẫu đã xem.

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
