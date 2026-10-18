# SAP2000-API V2 — Web / Local

Build `2026.10.18-v2-web.1` · Compatible with SAP2000 v26.2.0 · Windows64-bit, Python3.11+.

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
