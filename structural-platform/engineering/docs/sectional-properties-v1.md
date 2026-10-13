# Đặc tả và nghiệm thu SectionalProperties v1

Nguồn yêu cầu: nội dung người dùng gửi lại từ cuộc trò chuyện
“Định hướng nền tảng kết cấu”. Các quyết định dưới đây được cố định cho
schema 1.0, geometry model 1.0.0 và analytical solver 1.0.0.

## Geometry → validation → analytical result

- Rectangle đặc: width/height > 0, variant `solid`.
- Circle đặc: diameter > 0, variant `solid`.
- I/H: depth, top/bottom flange widths, top/bottom flange thicknesses,
  web thickness > 0; variant bắt buộc `sharp_corner`.
- h > tt + tb; tw <= min(bt, bb); mọi dimension hữu hạn, không bool/string.
- Không xoay. I/H đối xứng qua đường giữa đứng, không ép đối xứng trên/dưới.
- Plane XY, X phải/Y lên; O tại góc dưới trái bounding box; Ix/Iy centroidal.
  Ixy = integral((x-xc)(y-yc)dA), bằng 0 do đối xứng trong v1.
- mm bắt buộc ở CLI; future HTTP API cũng chỉ nhận mm ở v1.

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

Principal moments là max/min của Ix/Iy ở v1 vì Ixy=0. Góc axis-major
0°/90°; với Ix=Iy góc không xác định và được trả null.

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
computed. Không thay J bằng polar moment; v1 I/H không tính J/Cw.

Nguồn phương pháp: lời giải thanh chữ nhật của Saint-Venant/Prandtl trong
S. P. Timoshenko & J. N. Goodier, *Theory of Elasticity*, 3rd edition.
Không nhập số catalogue có fillet rồi coi là benchmark sharp-corner.

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
required unsupported: UNSUPPORTED_PROPERTY. Required J không hội tụ:
CALCULATION_ERROR/ConvergenceError. Domain errors không gắn với HTTP layer.

- [x] Geometry input/schema và validation.
- [x] Ba analytical solvers, PNA trong cả ba bands.
- [x] J Rectangle/Circle có báo cáo phương pháp/độ chính xác.
- [x] Unsupported properties không dùng giá trị 0 giả.
- [x] Benchmarks, independent references và property-based tests.
- [x] CLI chạy bằng JSON, không ghi database và không in traceback cho lỗi đã xử lý.
- [ ] PostgreSQL/JSONB, section definitions/revisions/property sets.
- [ ] UUID migration/backfill tương thích users/projects hiện tại, backup/import thư viện.
- [ ] Cache persistent theo geometry/solver/config version.
- [ ] Laravel authentication/ownership: private/project/public và revision conflict.
- [ ] FastAPI/Laravel API, OpenAPI và integration tests khi service tắt.
- [ ] Vue 3 TypeScript, dynamic inputs, hình tiết diện, units/signs S+/S−,
  history/export và module references đến immutable revisions.

Các mục database/API/UI trong checklist người dùng cung cấp là yêu cầu nghiệm
thu tương lai, không được coi là đã pass chỉ vì đánh dấu trong tài liệu tham
khảo. Packages 01–02 không sửa schema/data thư viện website hiện tại.
