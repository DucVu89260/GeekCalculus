# Đặc tả và nghiệm thu SectionalProperties v1

Nguồn yêu cầu: nội dung người dùng gửi lại từ cuộc trò chuyện
“Định hướng nền tảng kết cấu”. Các quyết định dưới đây được cố định cho
schema 1.0, geometry model 1.0.0 và analytical solver 1.2.0 (mở rộng đủ 8 hình dạng catalog).

## Geometry → validation → analytical result

- Rectangle đặc: width/height > 0, variant `solid`.
- Circle đặc: diameter > 0, variant `solid`.
- I/H: depth, top/bottom flange widths, top/bottom flange thicknesses,
  web thickness > 0; variant bắt buộc `sharp_corner`.
- RHS: width/height/thickness, variant `sharp_corner`, 2t < min(b,h).
- CHS: diameter/thickness, variant `uniform_wall`, 2t < D.
- U/C và T: depth/width/web_thickness/flange_thickness, `sharp_corner`;
  tw < b, h > 2tf (U/C), h > tf (T).
- L: depth/width/thickness, `sharp_corner`, t < min(b,h).
- I/H: h > tt + tb; tw <= min(bt, bb); mọi dimension hữu hạn, không bool/string.
- Không xoay. I/H đối xứng qua đường giữa đứng, không ép đối xứng trên/dưới.
- Plane XY, X phải/Y lên; O tại góc dưới trái bounding box; Ix/Iy centroidal.
  Ixy = integral((x-xc)(y-yc)dA). I/H/U/C/T đối xứng một trục có Ixy=0;
  L có Ixy khác 0. U/C mở phải; T có cánh trên; L có chân dưới/trái.
- mm bắt buộc ở CLI và HTTP API.

Các input không được thay đổi sau validation. Canonical definition chứa
type, variant, geometry_model_version và dimensions; hash SHA-256 bao gồm
units mm và serialization JSON sắp khóa. Giá trị integer/float tương đương
chuẩn hóa về cùng geometry. Config hash riêng gồm các flags/tolerance/max
terms/required properties, để Package 03 không tái sử dụng kết quả khác cấu hình.

## Công thức lõi

Rectangle: A=bh, P=2(b+h), centroid=(b/2,h/2), Ix=bh³/12,
Iy=hb³/12, Zx=bh²/4, Zy=hb²/4. Circle: A=πD²/4,
P=πD, Ix=Iy=πD⁴/64, Zx=Zy=D³/6, J=πD⁴/32.

I/H phân thành ba hình chữ nhật không chồng lấn; hw=h-tt-tb.
Ab=bb*tb, Aw=tw*hw, At=bt*tt; xb=xw=xt=max(bt,bb)/2.
yb=tb/2, yw=tb+hw/2, yt=h-tt/2. A=Ab+Aw+At,
yc=sum(Ai*yi)/A. Ix=sum(bi*hi³/12 + Ai*(yi-yc)²),
Iy=(tt*bt³+hw*tw³+tb*bb³)/12; P=2(bt+bb+h-tw).

Sx+=Ix/(h-yc), Sx−=Ix/yc; Sy+=Iy/(width-xc), Sy−=Iy/xc.
rx=sqrt(Ix/A), ry=sqrt(Iy/A). Các khoảng cách tới biên phải lấy toàn
bounding box, kể cả khi cánh trên nhỏ hơn cánh dưới.

PNA Y chia diện tích bằng nhau qua bisection, có thể ở cánh dưới, bụng hoặc
cánh trên; refinement tuyến tính trên band chứa PNA. Zx là tổng tích phân
|y-yp|dA từng khối. xp=xc=max(bt,bb)/2,
Zy=(tt*bt²+hw*tw²+tb*bb²)/4. Plastic là geometric cho vật liệu đồng nhất;
không tính composite hoặc tương tác lực dọc.

RHS lấy hiệu hình chữ nhật ngoài và trong để có A/I, chu vi là tổng hai
biên; Z được tích phân từ các dải chữ nhật không chồng nhau. CHS với
d=D−2t có A=π(D²−d²)/4, Ix=Iy=π(D⁴−d⁴)/64, Zx=Zy=(D³−d³)/6,
P=π(D+d), J=2Ix chính xác. U/C/T/L phân rã thành các hình chữ nhật không
chồng nhau, dùng định lý trục song song cho Ix/Iy/Ixy, giải PNA theo diện
tích và tích phân Z quanh từng PNA. Perimeter dùng biên toàn tiết diện.

Principal moments = (Ix+Iy)/2 ± hypot((Ix−Iy)/2,Ixy). Tensor quán tính
dùng off-diagonal −Ixy; góc axis-major chuẩn hóa về (−90°,90°]. Với
Ix=Iy và Ixy=0 góc không xác định và được trả null. Tham chiếu polygon
shoelace, clipping theo PNA và kiểm tra residual tensor độc lập tại
`tests/test_seeded_geometries.py`.

### Rectangle J và độ chính xác

Với a=max(b,h), c=min(b,h), dùng lời giải Fourier của bài toán
Saint-Venant cho thanh chữ nhật đặc:

```text
J = a*c³/3 * [1 - 192*c/(π⁵*a) * sum(n odd, n>=1)
                                      tanh(n*π*a/(2*c))/n⁵]
```

Sau N số hạng, n_last=2N−1. Vì tanh<=1 và f(x)=x⁻⁵ giảm,
phần dư tổng trên lưới số lẻ <= integral(n_last..∞) x⁻⁵ dx / 2
= 1/(8*n_last⁴). J_N là upper estimate; J_true >= J_N−B_N.
Hội tụ được so sánh ở dạng normalized trước khi nhân a*c³ để tránh
underflow của absolute error tạo báo cáo convergence giả.

Kahan summation, ước lượng roundoff riêng và ulp(base) được xét;
đây là error estimate float64 cộng tail bound giải tích, không phải
interval-arithmetic certificate. Không trả estimate chưa hội tụ dưới nhãn
computed. Không thay J bằng polar moment; I/H chưa tính J; Cw dùng xấp xỉ Vlasov thành mỏng như mô tả dưới đây.

Nguồn phương pháp: lời giải thanh chữ nhật của Saint-Venant/Prandtl trong
S. P. Timoshenko & J. N. Goodier, *Theory of Elasticity*, 3rd edition.
Không nhập số catalogue có fillet rồi coi là benchmark sharp-corner.

### I/H: Cw, tâm cắt và diện tích cắt hữu hiệu thành mỏng

Ba thuộc tính này dùng **mô hình đường trung bình thành mỏng**, với cánh nằm
trên hai đường ngang và bụng trên trục đối xứng đứng. Đây là xấp xỉ hình học
cho I/H hở; không phải lời giải đàn hồi 2D thành dày. Không xét fillet, độ
cứng vật liệu/composite, biến dạng méo tiết diện hoặc hiệu chỉnh Poisson.
Các đặc trưng tiết diện nguyên A/I/S/Z vẫn tính bằng ba hình chữ nhật không
chồng lấn; centroid của mô hình thành mỏng được lưu riêng trong diagnostics.

Đặt `yb=tb/2`, `yt=h-tt/2`, `h0=yt-yb`, `Ib=tb*bb³/12`, `It=tt*bt³/12`.
Với `B=max(bt,bb)`, tâm cắt và hằng số vênh là:

```text
xs = B/2
ys = (Ib*yb + It*yt)/(Ib+It)
Cw = h0²*Ib*It/(Ib+It)
Δx = xs-xc_gross, Δy = ys-yc_gross
```

Đây là cực Vlasov thỏa `∫ω*x*dA=0`; `ω=(yf-ys)*x` trên cánh và bằng 0
trên bụng. Tích phân `∫ω²*dA` cho Cw. I/H đối xứng có `ys=h/2` và
`Cw=h0²*(Ib+It)/4`. Góc/trục tọa độ theo quy ước XY của engine.

Diện tích cắt hiệu dụng được định nghĩa từ năng lượng với lực cắt đơn vị:
`As=1/∫(q/V)²/t ds`, không phải diện tích hình học của bụng/cánh.
Với cắt ngang Vx:

```text
Ax = (Ib+It)² / (tb*bb⁵/120 + tt*bt⁵/120)
```

Với cắt đứng Vy, đặt `Ab=bb*tb`, `At=bt*tt`, `Aw=tw*h0`,
`ym=(yb+yt)/2` và centroid của mô hình đường trung bình
`c=(Ab*yb+Aw*ym+At*yt)/(Ab+Aw+At)`:

```text
Ix_line = Ab*(yb-c)² + At*(yt-c)² + tw*(h0³/12+h0*(ym-c)²)
Q(y) = At*(yt-c) + tw/2*((yt-c)²-(y-c)²)
Ey = integral(yb..yt, Q(y)²/tw dy) + Ib*(yb-c)² + It*(yt-c)²
Ay = Ix_line² / Ey
```

Solver dùng Decimal80 và Gauss–Legendre 3 điểm cho tích phân đa thức bậc 4;
benchmark độc lập dùng quadrature mpmath 70 chữ số. Các kiểm tra gồm đối xứng,
đảo cánh, tỷ lệ kích thước (Cw: L⁶, tâm cắt: L, As: L²), tải yêu cầu bắt buộc
và trạng thái số vượt phạm vi.

Ví dụ TC-003: Cw≈861248554913.2948 mm⁶; `(xs,ys)=(125,115.098265896)` mm;
`Δy≈−53.283986664` mm; `Ax≈5125.267574279`, `Ay≈2949.784859511` mm².
Phương pháp trả qua `method=vlasov_thin_wall_i_section` hoặc
`method=thin_wall_shear_energy_i_section`, kèm giả thiết trong diagnostics.

Cơ sở phương pháp: V. Z. Vlasov, *Thin-Walled Elastic Beams* (1961),
sectorial coordinates/warping pole; A. Gjelsvik, *The Theory of Thin Walled
Bars* (1981), shear-flow energy. Benchmark ở đây kiểm chứng mô hình đã công
bố, không thay cho kiểm chứng FEM/elasticity của tiết diện thành dày.

## Fixtures và kiểm chứng độc lập

| Fixture | Đối chiếu |
| --- | --- |
| TC-001 Rectangle 200×400 | A=80000; Ix=1066666666.666…; Iy=266666666.666…; Zx=8000000; Zy=4000000 |
| TC-002 Circle D200 | A=31415.9265359…; Ix=Iy=78539816.3397…; J=157079632.679…; Zx=Zy=1333333.333… |
| TC-003 I/H 400, bt200, bb250, tw8, tt12, tb16 | A=9376; yc=168.3822525597…; Ix=262854651.340159…; Iy=28849205.333…; yp=102; Zx=1433568; Zy=375952 |
| TC-004 I/H symmetric 400, b200, tw8, tf12 | So sánh outer rectangle trừ voids, closed-form Zx và yc=yp=h/2 |
| TC-005 h100, bt40, bb100, tw4, tt4, tb40 | PNA nằm trong cánh dưới: yp=21.92; Zx=62863.36; đảo cánh yp=78.08, Zx giữ nguyên |

Fixtures TC-001/002/003 từ đặc tả được rà soát bằng phép tính riêng.
`tests/references.py` không dùng production solver để sinh expected:

1. Tích phân monomial theo bounds bằng Decimal 60 chữ số cho A, first/raw
   second moments, rồi shift to centroid; PNA bằng đảo hàm diện tích trên
   từng band; Zx bằng antiderivative của absolute first moment.
2. Reference J ở mpmath 70 digits dùng full odd sum `(31/32)*zeta(5)`
   trừ correction hội tụ theo hàm mũ, thay cho chuỗi partial sum production.
3. Unit-square J được đối chiếu thêm từ Prandtl Poisson PDE qua double sine
   series: J=256/π⁶ * sum_odd_m,n 1/[m²*n²*(m²+n²)]. Đây chỉ là reference
   test, không triển khai numerical/FEM solver sản phẩm.

Tolerance geometric/property tests rtol=1e-10; fixtures tham chiếu chính xác
dùng 1e-12 tùy lượng. PNA area imbalance <=1e-10 tại coordinate được xuất.
Reference J kiểm tra actual error nằm trong error budget công bố. So sánh
PDE truncated có tolerance riêng 1e-6. Không so sánh chuỗi UI đã làm tròn.

Property-based tests gồm scaling A~k²/I~k⁴/Z~k³, swap rectangle,
circle symmetry, I/H mirror, positivity, bounding box, PNA balance,
raw coordinate references, determinism và J swap/scaling. Regression tests
gồm PNA ở flange/web interface, gần trùng diện tích cánh với web rất mỏng,
subnormal torsion, precision limit và không hội tụ.

## Contract, trạng thái và nghiệm thu theo giai đoạn

Output nhóm geometric, elastic, plastic, principal, advanced; kèm units,
normalized_input, schema/solver/geometry_model versions, hashes và diagnostics.
Unsupported advanced properties: status=not_computed, value=null,
reason=solver_not_implemented. Optional J không được yêu cầu: not_requested;
required unsupported: UNSUPPORTED_PROPERTY. I/H Cw/center/area tùy chọn ngoài
dải số: numerical_range; nếu bắt buộc: CALCULATION_ERROR. Required J không hội tụ:
CALCULATION_ERROR/ConvergenceError. Domain errors không gắn với HTTP layer.

- [x] Geometry input/schema và validation.
- [x] Tám analytical solvers, PNA theo dải và benchmark polygon độc lập.
- [x] J Rectangle/Circle có báo cáo phương pháp/độ chính xác.
- [x] Unsupported properties không dùng giá trị 0 giả.
- [x] Benchmarks, independent references và property-based tests.
- [x] CLI chạy bằng JSON, không ghi database và không in traceback cho lỗi đã xử lý.
- [ ] PostgreSQL/JSONB, section definitions/revisions/property sets.
- [ ] UUID migration/backfill tương thích users/projects hiện tại, backup/import thư viện.
- [ ] Cache persistent theo geometry/solver/config version.
- [ ] Laravel authentication/ownership: private/project/public và revision conflict.
- [x] FastAPI/Laravel API, OpenAPI và integration tests khi service tắt.
- [x] CRUD SQLite lưu snapshot canonical XY, timestamp, hash/solver/config;
  GET không tính lại, import tính trên server, lỗi rollback; giữ legacy chưa sửa.
- [ ] Vue 3 TypeScript, dynamic inputs, hình tiết diện, units/signs S+/S−,
  history/export và module references đến immutable revisions.

Các mục database/API/UI trong checklist người dùng cung cấp là yêu cầu nghiệm
thu tương lai, không được coi là đã pass chỉ vì đánh dấu trong tài liệu tham
khảo. CRUD snapshot hiện bổ sung hai cột nullable vào SQLite mà không
backfill/đổi trục dữ liệu cũ; lịch sử immutable revision và PostgreSQL vẫn
chưa triển khai.
