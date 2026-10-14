# Connection catalog — phạm vi và trạng thái rà soát

Giao diện chia thành **Bu-lông neo & chân cột** và **Liên kết kết cấu thép**. Danh mục hiện có **53 workspace dự kiến: 12 neo/chân cột và 41 liên kết thép**. Đây là khung phát triển chức năng, chưa có phép tính sức chịu tải.

## Trạng thái nguồn

**Chưa hoàn tất rà soát toàn văn toàn bộ AISC Design Guides.** Các yêu cầu HTTPS tới danh mục Design Guides, AISC 360-22, AISC 358-22, AISC connection FAQs, nguồn ACI và SteelConstruction.info đều bị proxy trả `403 Forbidden`; không tải được nội dung. Không có PDF Design Guide có bản quyền được cung cấp trong workspace. Danh mục bên dưới được xây dựng từ phân loại kỹ thuật và các nguồn ứng viên, không phải kết quả đọc toàn bộ bộ sách.

`connection-registry.json` lưu `review_status=draft_pending_primary_source_review`, `full_text_review=pending` cho các nguồn và `reference_review=pending_primary_sources` cho từng loại. Tên Design Guide trong dữ liệu là nhãn chủ đề; tựa chính xác, edition, thay thế/hủy bỏ và điều khoản phải được kiểm tra sau khi truy cập nguồn hợp lệ. Không đánh dấu prequalified hoặc phù hợp tiêu chuẩn cho bất kỳ nút nào.

AISC 360 là Specification, không phải bộ Design Guides. Các yêu cầu neo phía bê tông cần nguồn như ACI 318 Chapter 17, ACI 355.2/355.4 hoặc tiêu chuẩn fastenings tương ứng; chỉ AISC 360 chưa đủ. AISC 341/358 phục vụ phạm vi động đất. RCSC/AWS liên quan thi công bu-lông/hàn. Phần cold-formed hoặc hệ độc quyền cần phạm vi/qualification riêng.

## Cách phân loại

- Neo/chân cột: 6 công nghệ neo, 4 cấu hình chân cột/truyền cắt, 2 hệ chôn sẵn.
- Thép–thép: chịu cắt, mô men, nối cấu kiện, giằng/giàn, HSS, cấu hình động đất và cấu kiện phụ.
- Bearing/slip-critical, bu-lông/hàn, stiffeners, continuity plates, panel zone, số hàng bu-lông và bố trí neo là biến thể hoặc chi tiết của một liên kết; tránh tạo các loại giả trùng nhau.
- Các cấu hình RBS/WUF-W/end-plate/BFP/double-tee hoặc hệ đặc biệt chỉ là workspace ứng viên. Việc prequalification phụ thuộc edition, cấu tạo, kích thước và dữ liệu hệ thống; không được suy ra từ tên nút.
- Nominally pinned là tên giả thiết cấu hình, chưa chứng minh độ cứng quay của chân cột. Neo L/J hoặc công nghệ post-installed không được coi tương đương về sức chịu lực.
- Không bao quát mọi chi tiết có thể tồn tại: bridge/fatigue riêng, steel plate shear-wall systems, các hệ proprietary có license, kết cấu vật liệu khác và mọi tổ hợp cấu hình không được quảng cáo là đã được rà hết.

## Danh sách workspace

### Bu-lông neo & chân cột

#### Các hệ bu-lông neo

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `headed_anchor` | Neo chôn sẵn đầu mũ / bản neo | Cast-in headed / plate anchors | aisc_dg1, aci318, en1992_4, as5216 |
| `hooked_anchor` | Neo chôn sẵn chữ L / J | Cast-in L / J anchors | aisc_dg1, aci318, en1992_4, as5216 |
| `expansion_anchor` | Neo nở cơ học | Expansion anchors | aci318, aci355_2, en1992_4, as5216 |
| `undercut_anchor` | Neo khóa cơ học dưới đáy | Undercut anchors | aci318, aci355_2, en1992_4, as5216 |
| `screw_anchor` | Vít neo bê tông | Concrete screw anchors | aci318, aci355_2, en1992_4, as5216 |
| `adhesive_anchor` | Neo hóa chất | Adhesive anchors | aci318, aci355_4, en1992_4, as5216 |

#### Chân cột & truyền lực cắt

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `simple_base` | Chân cột danh nghĩa khớp | Nominally pinned column base | aisc_dg1, aci318, en1992_4, as5216 |
| `moment_base` | Chân cột chịu mô men | Moment-resisting column base | aisc_dg1, aci318, en1992_4, as5216 |
| `stiffened_base` | Chân cột có sườn gia cường | Stiffened column base | aisc_dg1, aci318, en1992_4, as5216 |
| `shear_lug` | Chân cột có khóa cắt | Base plate with shear lug | aisc_dg1, aci318, en1992_4, as5216 |

#### Chi tiết chôn sẵn

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `embedded_plate` | Bản thép chôn sẵn có neo | Embedded plate with anchors | aisc_dg1, aci318, en1992_4 |
| `anchor_channel` | Ray neo chôn sẵn | Cast-in anchor channels | en1992_4, as5216 |

### Liên kết kết cấu thép

#### Liên kết chịu cắt

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `shear_tab` | Bản bụng đơn | Shear tab / fin plate | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100 |
| `double_angle_shear` | Hai thép góc chịu cắt | Double-angle shear connection | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100 |
| `single_angle_shear` | Một thép góc chịu cắt | Single-angle shear connection | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100 |
| `shear_end_plate` | Bản đầu dầm chịu cắt | Simple shear end plate | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100 |
| `unstiffened_seat` | Gối đỡ không sườn | Unstiffened seated connection | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100 |
| `stiffened_seat` | Gối đỡ có sườn | Stiffened seated connection | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100 |

#### Liên kết mô men

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `extended_end_plate` | Bản đầu dầm mở rộng | Extended end-plate moment connection | aisc_dg39, aisc_dg4, aisc_dg16, aisc358, en1993_1_8, as4100 |
| `flush_end_plate` | Bản đầu dầm bằng cánh | Flush end-plate moment connection | aisc_dg39, aisc_dg16, en1993_1_8, as4100 |
| `bolted_flange_plate` | Bản nối cánh bằng bu-lông | Bolted flange-plate connection | aisc360, aisc358, rcsc, en1993_1_8, as4100 |
| `welded_flange_plate` | Bản nối cánh hàn | Welded flange-plate connection | aisc360, aisc_dg21, aws_d11, en1993_1_8, as4100 |
| `direct_welded_moment` | Hàn trực tiếp cánh dầm | Direct welded moment connection | aisc360, aisc_dg21, aisc_dg13, aws_d11, en1993_1_8, as4100 |
| `flange_angle_moment` | Thép góc nối cánh chịu mô men | Flange-angle moment connection | aisc360, rcsc, en1993_1_8, as4100 |
| `partially_restrained` | Liên kết mô men bán cứng | Partially restrained moment connection | aisc_dg8, aisc360, en1993_1_8, as4100 |
| `haunched_frame_joint` | Nút khung có haunch / đầu gối | Haunched frame / knee joint | aisc_dg7, aisc_dg25, aisc360, en1993_1_8, as4100 |

#### Nối cấu kiện

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `bolted_beam_splice` | Nối dầm bằng bu-lông | Bolted beam splice | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100, aisc_dg21, aisc_dg24 |
| `welded_beam_splice` | Nối dầm hàn | Welded beam splice | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100, aisc_dg21, aisc_dg24 |
| `bolted_column_splice` | Nối cột bằng bu-lông | Bolted column splice | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100, aisc_dg21, aisc_dg24 |
| `welded_column_splice` | Nối cột hàn | Welded column splice | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100, aisc_dg21, aisc_dg24 |
| `hss_splice` | Nối cấu kiện HSS | HSS member splice | aisc360, rcsc, aisc_dg17, en1993_1_8, as4100, aisc_dg21, aisc_dg24 |

#### Liên kết giằng & giàn

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `brace_gusset` | Giằng liên kết bản mã | Brace gusset connection | aisc360, aisc_dg29, aisc_dg24, en1993_1_8, as4100 |
| `hss_slotted_gusset` | Giằng HSS xẻ rãnh bản mã | Slotted HSS brace-to-gusset | aisc360, aisc_dg29, aisc_dg24, en1993_1_8, as4100 |
| `clevis_pin` | Càng nối & chốt | Clevis / pin connection | aisc360, aisc_dg29, aisc_dg24, en1993_1_8, as4100 |
| `truss_node` | Nút giàn / nhiều thanh | Multi-member gusset / truss node | aisc360, aisc_dg29, aisc_dg24, en1993_1_8, as4100 |
| `cross_brace` | Nút giao hai thanh giằng | Cross-brace intersection | aisc360, aisc_dg29, aisc_dg24, en1993_1_8, as4100 |

#### Liên kết HSS

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `hss_t_y` | Nút HSS chữ T / Y | HSS T / Y joint | aisc360, aisc_dg24, en1993_1_8, as4100 |
| `hss_x` | Nút HSS chữ X | HSS X / cross joint | aisc360, aisc_dg24, en1993_1_8, as4100 |
| `hss_k_n` | Nút HSS chữ K / N | HSS K / N joint | aisc360, aisc_dg24, en1993_1_8, as4100 |
| `hss_longitudinal_plate` | Bản dọc trên HSS | Longitudinal plate-to-HSS | aisc360, aisc_dg24, en1993_1_8, as4100 |
| `hss_transverse_plate` | Bản ngang trên HSS | Transverse plate-to-HSS | aisc360, aisc_dg24, en1993_1_8, as4100 |
| `hss_through_plate` | Bản xuyên / diaphragm HSS | Through-plate / diaphragm HSS joint | aisc360, aisc_dg24, en1993_1_8, as4100 |
| `hss_face_bolted` | Bu-lông liên kết mặt HSS | Bolted HSS-face connection | aisc360, aisc_dg24, en1993_1_8, as4100 |

#### Cấu hình khung chịu động đất

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `rbs` | Liên kết giảm tiết diện dầm RBS | Reduced beam section (RBS) | aisc358, aisc341, aisc_dg12, aws_d11 |
| `wuf_w` | Hàn cánh và bụng WUF-W | Welded unreinforced flange–welded web | aisc358, aisc341, aisc_dg12, aws_d11 |
| `double_tee_moment` | Hai chữ T nối cánh dầm | Double-tee moment connection | aisc358, aisc341, aisc_dg12, aws_d11 |
| `slotted_web` | Cấu hình bụng dầm xẻ rãnh | Slotted-web moment configuration | aisc358, aisc341, aisc_dg12, aws_d11 |
| `special_moment_system` | Hệ liên kết mô men đặc biệt | Special / proprietary moment system | aisc358, aisc341, aisc_dg12, aws_d11 |

#### Liên kết cấu kiện phụ

| ID | Chức năng | Tên tiếng Anh | Nguồn ứng viên |
|---|---|---|---|
| `purlin_girt_cleat` | Liên kết xà gồ / girt bằng cleat | Purlin / girt cleat | aisc_dg7, aisc360, aisi_s100, en1993_1_8, as4100 |
| `support_bracket` | Console đỡ dầm / sàn / cầu thang | Beam / platform support bracket | aisc_dg7, aisc360, aisc_dg21, en1993_1_8, as4100 |
| `facade_attachment` | Liên kết cấu kiện mặt dựng vào thép | Facade-to-steel attachment | aisc_dg22, aisc360, en1993_1_8, as4100 |
| `hanger_connection` | Liên kết treo chịu kéo | Hanger / tension connection | aisc_manual, aisc360, rcsc, en1993_1_8 |
| `crane_rail_attachment` | Liên kết ray cầu trục | Crane-rail attachment | aisc_manual, aisc_dg7, aisc360 |

## Nguồn ứng viên cần đối chiếu

| ID | Nguồn/chủ đề | Phạm vi dự kiến |
|---|---|---|
| `aisc360` | [AISC 360 — Specification for Structural Steel Buildings](https://www.aisc.org/standards/steel-standards/) | Steel connections, bolts/welds, connecting elements, HSS connections; edition/clause mapping pending. |
| `aisc_dg1` | [AISC Design Guide 1 — Base connection design](https://www.aisc.org/publications/design-guides/) | Base plates, anchor rods, shear transfer and steel-to-concrete interfaces. |
| `aisc_dg4` | [AISC Design Guide 4 — Extended end-plate moment connections](https://www.aisc.org/publications/design-guides/) | Historical end-plate reference; check alongside DG39. |
| `aisc_dg7` | [AISC Design Guide 7 — Industrial buildings](https://www.aisc.org/publications/design-guides/) | Industrial framing, secondary supports and anchorage. |
| `aisc_dg8` | [AISC Design Guide 8 — Partially restrained composite connections](https://www.aisc.org/publications/design-guides/) | PR/composite moment connections; slab participation is a later design input. |
| `aisc_dg12` | [AISC Design Guide 12 — Modification of existing welded moment-frame connections](https://www.aisc.org/publications/design-guides/) | Seismic retrofit details; not every retrofit is prequalified. |
| `aisc_dg13` | [AISC Design Guide 13 — Stiffening wide-flange columns at moment connections](https://www.aisc.org/publications/design-guides/) | Continuity plates, column stiffeners and panel-zone details; details within a connection. |
| `aisc_dg16` | [AISC Design Guide 16 — Flush and extended multiple-row moment end-plates](https://www.aisc.org/publications/design-guides/) | Historical end-plate reference; check alongside DG39. |
| `aisc_dg17` | [AISC Design Guide 17 — High-strength bolts](https://www.aisc.org/publications/design-guides/) | Bolted connection fundamentals and execution. |
| `aisc_dg21` | [AISC Design Guide 21 — Welded connections](https://www.aisc.org/publications/design-guides/) | Welded joint details and design fundamentals. |
| `aisc_dg22` | [AISC Design Guide 22 — Facade attachments to steel-framed buildings](https://www.aisc.org/publications/design-guides/) | Secondary attachment interfaces and support brackets. |
| `aisc_dg24` | [AISC Design Guide 24 — HSS connections](https://www.aisc.org/publications/design-guides/) | Hollow-section welded nodes and plate/bolt interfaces. |
| `aisc_dg29` | [AISC Design Guide 29 — Vertical bracing connections](https://www.aisc.org/publications/design-guides/) | Gussets, bracing joints and detailing. |
| `aisc_dg39` | [AISC Design Guide 39 — End-plate moment connections](https://www.aisc.org/publications/design-guides/) | Current-edition end-plate candidate reference; exact edition and coverage pending. |
| `aisc341` | [AISC 341 — Seismic Provisions](https://www.aisc.org/standards/steel-standards/) | Seismic requirements; applies only when the selected design scope requires it. |
| `aisc358` | [AISC 358 — Prequalified Connections for Special and Intermediate Steel Moment Frames](https://www.aisc.org/standards/steel-standards/) | Prequalified connection configurations and limits; listing here does not establish qualification. |
| `rcsc` | [RCSC Specification for Structural Joints Using High-Strength Bolts](https://www.boltcouncil.org/) | Bolt installation, pretension and slip-critical/bearing joint requirements. |
| `aws_d11` | [AWS D1.1 — Structural Welding Code — Steel](https://www.aws.org/) | Welding details, procedures and acceptance; edition pending. |
| `aci318` | [ACI 318 — Anchoring to Concrete (Chapter 17)](https://www.concrete.org/topicsinconcrete/topicdetail/anchoring%20to%20concrete) | Concrete-side anchorage limit states, not covered solely by AISC 360. |
| `aci355_2` | [ACI 355.2 — Qualification of post-installed mechanical anchors](https://www.concrete.org/) | Mechanical anchor qualification; product-specific data required. |
| `aci355_4` | [ACI 355.4 — Qualification of post-installed adhesive anchors](https://www.concrete.org/) | Adhesive anchor qualification; product-specific data required. |
| `en1992_4` | [EN 1992-4 — Fastenings for use in concrete](https://eurocodes.jrc.ec.europa.eu/) | Concrete fastening reference, including applicable channel/anchor systems; edition/NA pending. |
| `en1993_1_8` | [EN 1993-1-8 — Design of joints](https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-3-design-steel-structures) | Alternative joint standard; exact edition and National Annex are future selections. |
| `as5216` | [AS 5216 — Concrete fastenings](https://store.standards.org.au/) | Australian concrete fastening reference; edition pending. |
| `as4100` | [AS 4100 — Steel structures](https://store.standards.org.au/) | Australian structural steel connection reference; edition pending. |
| `aisi_s100` | [AISI S100 — Cold-formed steel members](https://www.steel.org/steel-markets/construction/) | Only for applicable cold-formed secondary-member connections; primary-source URL/edition pending. |
| `aisc_manual` | [AISC Steel Construction Manual](https://www.aisc.org/publications/steel-construction-manual-resources/) | Bolts, welds, connecting elements, simple/FR/PR joints, braces, bases, splices, hangers, brackets and crane rails; edition and chapter mapping pending. |
| `aisc_dg25` | [AISC Design Guide 25 — Web-tapered frame design](https://www.aisc.org/publications/design-guides/) | Frame configuration reference; connection-specific applicability and exact edition/title to be verified. |

## Việc còn lại để chốt rà soát

1. Review/save/publish các domain tài liệu trong Environment Settings; kiểm tra lại truy cập thực tế. Lưu cấu hình không tự mở quyền ở runtime hiện tại.
2. Lấy danh mục Design Guides chính thức đầy đủ, edition và tình trạng hiện hành; đánh dấu các guide ngoài phạm vi liên kết thay vì bỏ qua im lặng.
3. Đọc TOC/phần liên kết của Manual, Specification và Design Guides liên quan từ bản có quyền truy cập; không vượt paywall hoặc yêu cầu gửi mật khẩu trong chat.
4. Đối chiếu từng workspace với mục/điều khoản, kiểm tra biến thể, điều kiện applicability và qualification; bổ sung những loại phổ thông còn thiếu.
5. Bump catalog version và chỉ chuyển trạng thái đã đối chiếu khi có bằng chứng tương ứng. Rà toàn văn và nghiệm thu thiết kế là hai việc riêng.

## Kiến trúc phát triển

Nguồn duy nhất của danh mục là `connection-registry.json`; frontend đọc qua `src/connections/catalog.js`. Group/family/connection IDs dùng để mở rộng workspace sau này. Sơ đồ là SVG tự dựng để nhận dạng cấu hình, không theo tỷ lệ và không phải drawing thiết kế.
Chọn nút mở placeholder tương ứng. Chưa có form tiêu chuẩn/vật liệu, công thức chịu lực hay dữ liệu tính toán ghi database. Mỗi nhóm giữ lựa chọn riêng khi đổi group/tab/ngôn ngữ. Khi phát triển engine, bổ sung schema và benchmark cho từng cấu hình thay vì gắn capacity vào nút.
