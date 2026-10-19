# SAP2000-API V2 — Web / Local

Build `2026.10.19-v2-release-filter.1` · Compatible with SAP2000 v26.2.0 · Windows64-bit, Python3.11–3.13 x64.

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

## Steel Design — Chuẩn bị đầu vào / Input review

Sau khi đọc hồ sơ và xuất nội lực cùng model, bấm **Kiểm tra Steel Design** ở mục3; hoặc tạo Summary ở4.3 rồi bấm **Kiểm tra nhanh từ Summary**. Bảng giữa màn hình cho chọn AISC360-10, component I/H đối xứng, ASD/LRFD, chế độ nhanh/đầy đủ, nguồn chiều dài SAP/nhập tay. Component I/H bất đối xứng hiển thị nhưng chưa hỗ trợ; family khác giữ yêu cầu kiểm tra thủ công.

Mỗi Frame có bảng hình học, vật liệu, Length và unbraced lengths kèm đơn vị/nguồn/trạng thái, thông số còn thiếu. Nonprismatic giữ kích thước section con và segment gốc, không tự áp công thức sức chịu tải prismatic. Ratio SAP chỉ dùng khi getter OK, ProgDet=false, giá trị dương và người dùng xác nhận chiều dài I–J tham chiếu; không suy Program Determined. Nhập tay lưu độc lập từng frame.

Chế độ đầy đủ giữ mọi member/dòng gốc đã xuất cùng các mốc5 vị trí khả dụng; chế độ nhanh chỉ giữ các dòng chi phối xem trước trong Summary, không đại diện mọi combo hoặc toàn bộ đồng hạng. Mỗi bộ lực giữ đủ6 thành phần, dấu, step, station, nguồn nội suy/gốc và trạng thái đồng thời; bảng xem trước100 dòng, JSON chứa toàn bộ đầu vào đã chuẩn bị. Thiếu snapshot hoặc dữ liệu sai model/đơn vị hay kết quả dẫn xuất cũ được báo lỗi.

Bấm **Tải đầu vào / Download prepared job JSON** để kiểm tra. Đây là bước chuẩn bị đầu vào, chưa gọi bộ tính sức chịu tải, chưa tính Cb hay đưa ra D/C/PASS/FAIL. Dữ liệu model/token không được tải lên server trong bước này. Cần cập nhật kit local để có module JS và route phục vụ panel local.

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
