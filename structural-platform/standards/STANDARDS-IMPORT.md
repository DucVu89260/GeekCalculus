# Import PDF và mục lục cho nhiều bộ tiêu chuẩn

Hai lệnh dùng chung đọc `edition_code` trong JSON, không cố định AISC/ASCE:

- `standards:import-pdf PDF JSON`: lưu PDF riêng qua Laravel và nhập mục lục.
- `standards:import-outline JSON`: chỉ nhập mục lục; không tạo/copy PDF.

Phiên bản phải có trong `standard_editions`. Registry hiện có AISC360-10/16/22
và ASCE7-10/16/22. Mỗi phiên bản cần JSON trích từ đúng tài liệu của nó;
không dùng JSON 2010 cho PDF 2016/2022. Importer không tự tạo phiên bản,
không OCR/phiên âm công thức và không phê duyệt công thức thiết kế.

## Ví dụ ASCE 7-10 trên local

Sau khi pull main, từ `structural-platform` (Docker backend đang chạy):

```sh
docker compose cp "/duong/dan/ASCE 7-10.pdf" backend:/tmp/asce7-10.pdf
docker compose cp "/duong/dan/asce7-10.json" backend:/tmp/asce7-10.json
docker compose exec -T backend php artisan standards:import-pdf /tmp/asce7-10.pdf /tmp/asce7-10.json
docker compose exec -T backend rm /tmp/asce7-10.pdf /tmp/asce7-10.json
```

Nếu chỉ cần nhập JSON, dùng:

```sh
docker compose cp "/duong/dan/asce7-10.json" backend:/tmp/asce7-10.json
docker compose exec -T backend php artisan standards:import-outline /tmp/asce7-10.json
docker compose exec -T backend rm /tmp/asce7-10.json
```

Nếu đã pull repo, không cần tải JSON riêng: đường dẫn bên trong backend là
`/app/standards/asce7-10-library.json`. Lệnh rút gọn cũ cũng vẫn hoạt động:

```sh
docker compose exec -T backend php artisan standards:import-asce710-pdf /tmp/asce7-10.pdf
```

Các lệnh AISC cũ giữ nguyên cách gọi. Làm mới trình duyệt sau import.
Main và test local hiện dùng chung database nên chỉ cần import một lần.

## Định dạng JSON

Hai biến thể được chấp nhận, không trộn trong cùng tệp:

| Trường | AISC legacy | Dạng clauses (ASCE hiện có) |
| --- | --- | --- |
| Phiên bản | `edition_code` | `edition_code` |
| SHA-256 PDF | `source_sha256` (64 ký tự hex thường) | Như legacy |
| Tổng trang PDF | `pdf_page_count` | `page_count` hoặc `pdf_page_count` |
| Mục lục | `bookmarks` | `clauses` |
| Cha | `parent_code`, cùng `kind` | `parent_id` tham chiếu `id` trong JSON |

Mỗi mục có `code`, `title`, `kind` (`normative`, `commentary`, `front_matter`)
và `pdf_page` (số trang vật lý, từ 1 đến tổng số trang). `printed_page` là tùy
chọn, phải là số nguyên dương nếu có. Cha có thể bỏ trống/null. Dạng clauses
cần `id` duy nhất nếu có mục khác tham chiếu; đây là ID nguồn để ánh xạ,
không phải ID database local.

`equation_candidates` là tùy chọn: mỗi mục có `label`, `clause_code` của một
mục normative trong manifest và `pdf_page`. Chỉ nhập mã/trang với trạng thái
candidate; không nhập biểu thức, khóa thực thi hay trạng thái xác minh từ JSON.
Mảng `equations` của ASCE library không được nhập — đọc công thức trực tiếp
trong PDF theo yêu cầu. Nội dung đã có trong database không bị xóa.

## Bảo toàn dữ liệu và giới hạn

Importer kiểm tra schema, phiên bản, mã trùng, trang vượt giới hạn, cha bị thiếu,
cha khác loại và chu trình trước khi ghi. Khi nhập PDF, chữ ký và SHA-256 phải
khớp JSON; số trang được kiểm tra theo khai báo manifest, không chạy trình phân
tích PDF để đếm lại. Hash khớp không xác minh tính đúng đắn kỹ thuật của JSON.

Các thay đổi database nằm trong transaction. Nhập lỗi chỉ xóa tệp PDF mới do
lần nhập đó tạo; không ghi đè kho PDF bị khác hash. Nhập lặp không tạo thêm bản
ghi cùng edition/kind/code hoặc edition/hash. Không xóa mục vắng trong JSON.
Giữ các mục/phương trình đã qua review, biểu thức đã lưu và metadata full corpus.
Mục index_only/candidate có thể cập nhật trang từ cùng nguồn; không tự đổi liên
kết điều khoản sang tài liệu có hash khác. Xung đột này bị từ chối và hoàn tác.

Import JSON trước PDF vẫn dùng được: mục mới chưa có tài liệu sẽ được liên kết
khi nhập PDF + cùng JSON sau đó. JSON-only không tự chứng minh có PDF ở local.
Không cần migrate/reset/reseed để nâng cấp importer này. Lệnh chỉ hoạt động
trong Laravel local/native; GitHub Pages không có database/import backend.

## AISC engineering-review integration

Shared/legacy manifests continue to create unapproved indexes for registered
editions. AISC360-10 schema-v2 manifests additionally use actual-file inspection
and the source-version registry before formula review. Neither importer accepts
manifest-supplied verification/implementation claims as approval. Reviewed and
manual formula records are protected on shared re-import as well. See
[formula digitization and source gates](../docs/AISC36010_FORMULA_DIGITIZATION.md).
