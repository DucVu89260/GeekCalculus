# Module nội bộ Cb — Symmetric I/H, AISC 360-10 F1-1

```json
{
  "dataset": "THAY_BANG_OBJECT_DATASET",
  "frame": "12", "output_case": "ULS1", "case_kind": "combination",
  "step_type": "", "step_num": 0,
  "moment_component": "M3",
  "start": 0, "end": 6,
  "section": "symmetric_i", "standard": "AISC_360_10",
  "moment_diagram": "quarter_points_and_all_extrema",
  "braced_segment_confirmed": true,
  "loading_through_shear_center": true,
  "both_ends_braced": true,
  "major_axis_confirmed": true
}
```

`start`/`end` là ObjSta hai điểm giằng (m), không tự coi toàn chiều dài cấu kiện là Lb. Người dùng xác nhận section đối xứng kép, trục uốn chính, tải qua shear center và hai đầu đoạn được giằng. Công thức:

`Cb = 12.5 Mmax / (2.5 Mmax + 3 MA + 4 MB + 3 MC)`

M dùng trị tuyệt đối trong **cùng case và bước**, MA/MB/MC ở Lb/4, Lb/2, 3Lb/4. Không áp cap chung tùy tiện. Mọi mô men bằng 0 trả `not_applicable`, `Cb: null`.

Hai chế độ dữ liệu:

- `quarter_points_and_all_extrema`: người dùng cam kết dataset có tất cả cực trị trong đoạn; Module yêu cầu stations chính xác tại hai đầu và ba điểm 1/4. Nếu trạm chia lẻ có sai số floating-point, chuẩn hóa dữ liệu đã kiểm chứng trước khi gửi; module không tự lấy station gần nhất.
- `piecewise_linear`: người dùng cam kết biểu đồ mô men thực sự tuyến tính từng đoạn giữa các stations. Module nội suy tại điểm 1/4 và biên đoạn; Mmax lấy các đỉnh nằm trong đoạn. Không dùng chế độ này để giả tuyến tính biểu đồ parabol do tải phân bố. Chỉ có vài samples không chứng minh giả thiết này.

Thiếu dữ liệu, không phủ đủ đoạn, nhiều mô men khác nhau tại cùng station hoặc kết quả không đồng thời thì phát sinh lỗi xác thực/tính toán. Chưa hỗ trợ cantilever đầu tự do, tải lệch shear center, tiết diện không đối xứng kép hoặc xác định giằng tự động. Đây là module Cb riêng; chưa tự thay giá trị Cb bảo thủ trong UI Steel Design hoặc thực hiện kiểm toán LTB/capacity.


Module này nằm tại `structural_engine.design.aisc360_10.cb`, độc lập với contract `API_IF_SAP26.2.0_V1`. Không có endpoint HTTP Cb trong connector, engineering API hoặc Laravel. Dữ liệu input ở ví dụ trên là object Python/JSON dành cho module nội bộ, không phải request API nội lực.

```python
from structural_engine.design.aisc360_10.cb import CbRequest, calculate_cb
result = calculate_cb(CbRequest.model_validate(payload))
```
