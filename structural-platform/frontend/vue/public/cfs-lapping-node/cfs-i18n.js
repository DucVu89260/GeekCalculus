// Presentation only: never rerender the editor, touch input values or mutate a draft.
const pairs = [
  ['Ngôn ngữ', 'Language'],
  ['Dầm nhiều nhịp có nối chồng · Chỉnh sửa bản nháp JSON', 'Multi-span beam with laps · Independent JSON Draft Editor'],
  ['XUẤT BẢN SAO THỬ NGHIỆM', 'EXPERIMENTAL COPY EXPORT'],
  ['Đang tải Python…', 'Loading Python…'],
  ['Đang xử lý… Lần đầu cần tải Python (~12 MB).', 'Processing… The initial Python runtime download is about 12 MB.'],
  ['Python sẵn sàng · Xử lý file hoàn toàn trong trình duyệt', 'Python ready · Files are processed entirely in your browser'],
  ['01 — Sơ đồ hình học theo dữ liệu CFS', '01 — Geometry from CFS data'],
  ['02 — Chỉnh sửa JSON Draft', '02 — Edit JSON draft'],
  ['03 — Nhập mô hình CFS', '03 — Import CFS Analysis'],
  ['04 — Tra cứu file tiết diện', '04 — Section Resolver'],
  ['05 — Chính sách bảo vệ', '05 — File protection'],
  ['06 — Sao lưu và khôi phục JSON', '06 — JSON backup and restore'],
  ['Đơn vị: m- kN', 'Units: m- kN'],
  ['Cấu kiện', 'Members'], ['Nối chồng', 'Lapping'],
  ['mối nối', 'laps'], ['gối/giằng', 'supports/restraints'], ['trường hợp tải', 'load cases'],
  ['XT — giằng trung gian', 'XT — intermediate restraints'], ['XYT — gối chính', 'XYT — main bearings'],
  ['Chọn Analysis (.cfsa) và thư mục SECTIONS trên máy của bạn', 'Select a local Analysis (.cfsa) and its SECTIONS folder'],
  ['📁 Chọn file .cfsa', '📁 Choose .cfsa file'], ['Nhập .cfsa', 'Import .cfsa'],
  ['Chọn thư mục SECTIONS', 'Choose SECTIONS folder'],
  ['Chưa chọn thư mục chứa .cfss.', 'No folder containing .cfss files selected.'],
  ['Chưa chọn file .cfsa', 'No .cfsa file selected'],
  ['Nếu file đang mở trong CFS, hãy lưu model trước khi import để đọc bản mới nhất trên ổ đĩa.', 'If the file is open in CFS, save the model before importing to read the latest disk version.'],
  ['Quy ước: file Analysis ở thư mục gốc, file Section tại thư mục', 'Layout: Analysis in the project folder, section files in its'],
  ['cùng cấp. Import chỉ đọc.', 'subfolder. Import is read-only.'],
  ['Tải bản nháp', 'Load Draft'], ['Lưu bản nháp', 'Save Draft'],
  ['Xuất CFSA TEST COPY', 'Export CFSA TEST COPY'],
  ['Nhập JSON Draft', 'Import JSON Draft'], ['Xuất JSON', 'Export JSON'],
  ['Nhập JSON Draft:', 'Import JSON Draft:'], ['Xuất JSON:', 'Export JSON:'],
  ['Mở file JSON đã xuất để khôi phục bản nháp và tiếp tục chỉnh sửa. Khi xuất CFSA, cần nhập lại file .cfsa gốc cùng thư mục SECTIONS.', 'Open an exported JSON file to restore a draft and continue editing. To export CFSA, re-import the original .cfsa file and its SECTIONS folder.'],
  ['Tải bản nháp hiện tại xuống máy để sao lưu hoặc chuyển sang máy khác. JSON lưu các chỉnh sửa lap/XT, không thay thế file .cfsa và các .cfss gốc.', 'Download the current draft to back it up or transfer it to another computer. JSON saves lap/XT edits; it does not replace the original .cfsa and .cfss files.'],
  ['Chưa nhập mô hình.', 'No model imported.'], ['Chưa nhập file.', 'No file imported.'],
  ['Import file CFSA để bắt đầu.', 'Import a CFSA file to begin.'],
  ['Không bao giờ ghi đè file .cfsa gốc hoặc .cfss. Chỉ nút Export CFSA TEST COPY tạo bản .cfsa thử nghiệm mới; không thay đổi CFS Combinations. Tải trọng hiển thị theo đơn vị native, không tự quy đổi sang kN/m khi chưa hiệu chuẩn. File được xử lý trong trình duyệt, không tải lên server. Save Draft chỉ lưu trong trình duyệt theo tài khoản; Export JSON để sao lưu/chuyển máy. Chọn lại CFSA gốc và SECTIONS khi xuất bản nháp đã tải lại.', 'Original .cfsa and .cfss files are never overwritten. Export CFSA TEST COPY creates a new experimental copy and preserves CFS combinations. Loads retain native values; they are not automatically converted to kN/m without calibration. Files are processed in the browser, not uploaded. Save Draft stores a browser-local draft for the current account; Export JSON backs up or transfers it. Re-import the original CFSA and SECTIONS before exporting a restored draft.'],
  ['Lap trái', 'Lap Left'], ['Lap phải', 'Lap Right'],
  ['= gối trừ đầu Start của Member bên phải (vùng cam nở về trái).', '= bearing minus the start of the right member (orange lap extends left).'],
  ['= đầu End của Member bên trái trừ gối (vùng cam nở về phải). Hai mép chỉnh độc lập.', '= end of the left member minus bearing (orange lap extends right). Each side is independent.'],
  ['Bấm vào vùng cam / gối trên sơ đồ hoặc vào dòng bên dưới để chọn vị trí cần chỉnh.', 'Select an orange lap/bearing on the diagram or a table row to edit that joint.'],
  ['Gối / Cấu kiện', 'Gối / Members', 'Bearing / Members'],
  ['Gối X (m)', 'Bearing X (m)'], ['Lap trái (m)', 'Lap Left (m)'], ['Lap phải (m)', 'Lap Right (m)'],
  ['Tổng (m)', 'Total (m)'], ['Đầu nối chồng (m)', 'Overlap start (m)'], ['Cuối nối chồng (m)', 'Overlap end (m)'],
  ['Gối & giằng', 'Supports & Bracing'],
  ['CFS native type codes được giữ nguyên. 7 = XYT (gối chính, khóa vị trí), 5 = XT (cho phép dịch chuyển vị trí). Giữ nguyên gối XYT, bearing, K. Được thêm/xóa XT trong các nhịp có XT mẫu.', 'Native CFS type codes are preserved. 7 = XYT (locked main bearing), 5 = XT (movable restraint). XYT, bearing and K remain unchanged. Add/delete XT only in spans containing an original XT template.'],
  ['Tự động bố trí XT — Nhiều nhịp', 'Automatic XT Distribution — Multi-Span'],
  ['Nhịp', 'Span'], ['Số XT n', 'XT count n'], ['Xem trước', 'Preview'], ['Áp dụng vào bản nháp', 'Apply to Draft'],
  ['Chọn nhiều nhịp bên dưới để áp dụng cùng số n. Không sửa XYT; chỉ XT được thêm, xóa hoặc chia đều.', 'Select multiple spans below to apply the same count n. XYT is unchanged; only XT can be added, removed or evenly distributed.'],
  ['Preview để xem số XT tăng/giảm và tọa độ từng nhịp.', 'Preview shows added/deleted XT counts and positions in each span.'],
  ['Loại', 'Type'], ['Vị trí (m)', 'Location (m)'], ['Bearing gốc', 'Bearing native'], ['Liên kết', 'Fastened'],
  ['Gối XYT bị khóa trong v0.5D', 'XYT bearings are locked in v0.5D'],
  ['Thư mục:', 'Folder:'], ['Đã tìm thấy mọi file tiết diện được tham chiếu', 'All referenced sections found'],
  ['TÌM THẤY', 'FOUND'], ['THIẾU', 'MISSING'],
  ['Tiết diện (.cfss)', 'Section (.cfss)'], ['Đầu (m)', 'Start (m)'], ['Cuối (m)', 'End (m)'], ['Tệp', 'File'],
  ['Trường hợp:', 'Case:'], ['Đầu tải (native)', 'w start (native)'], ['Cuối tải (native)', 'w end (native)'], ['Góc (rad)', 'Angle (rad)'],
  ['Các biên tải được đổi sang mét tạm tính; Magnitude giữ nguyên native. Không chỉnh hệ số tổ hợp.', 'Load extents use provisional metres; magnitudes retain native values. Combination factors are unchanged.'],
  ['Đã chỉnh JSON Draft trong trình duyệt. File CFS không thay đổi.', 'Browser draft updated. The original CFS file is unchanged.'],
  ['Đã tải bản nháp trong trình duyệt; file .cfsa gốc không thay đổi', 'Browser draft loaded; the original .cfsa file is unchanged'],
  ['Đã lưu bản nháp trong trình duyệt. CFSA gốc và Combinations không thay đổi.', 'Draft saved in this browser. The original CFSA and combinations are unchanged.'],
  ['Đã hủy chọn file.', 'File selection cancelled.'],
  ['Chưa có model', 'No model'], ['Hãy nhấn Chọn file .cfsa trước.', 'Choose a .cfsa file first.'],
  ['Cần Import .cfsa trước', 'Import the original .cfsa first.'], ['Thiếu Section: không xuất được', 'Missing section files: export is blocked.'],
  ['Đang xử lý, vui lòng chờ.', 'Processing, please wait.'], ['Chọn file .cfsa tối đa 10 MB.', 'Choose a .cfsa file up to 10 MB.'],
  ['Chọn lại file CFSA gốc trước khi Import.', 'Select the original CFSA file before importing.'],
  ['Import lại CFSA gốc và SECTIONS trước khi xuất bản sao.', 'Re-import the original CFSA and SECTIONS before exporting a copy.'],
  ['Chưa có bản nháp được lưu trong trình duyệt này.', 'No saved draft in this browser.'],
  ['Thao tác không được hỗ trợ.', 'Unsupported operation.'], ['Thư mục không có file .cfss.', 'The folder contains no .cfss files.'],
  ['Tối đa 2000 file .cfss, tổng 50 MB.', 'Select up to 2000 .cfss files, totalling at most 50 MB.'],
  ['Có tên file Section bị trùng; chọn đúng thư mục SECTIONS của mô hình.', 'Duplicate section filenames; select the model’s correct SECTIONS folder.'],
  ['JSON tối đa 2 MB.', 'JSON files must be at most 2 MB.'],
  ['Python worker không khả dụng. Tải lại trang để thử lại.', 'Python worker unavailable. Reload the page to retry.'],
  ['Không khởi chạy được Python trong trình duyệt. Kiểm tra tải runtime và thử tải lại trang.', 'Unable to start browser Python. Check the runtime download and reload the page.'],
  ['CẢNH BÁO: Đây là binary exporter thử nghiệm. Chỉ tạo file _WEBTEST.cfsa MỚI, không ghi đè gốc. Chưa xác minh hoàn toàn với CFS 11.0.2. Tiếp tục?', 'WARNING: This experimental binary exporter creates a NEW _WEBTEST.cfsa copy only. It never overwrites the original and is not fully verified in CFS 11.0.2. Continue?'],
  ['Chọn ít nhất một nhịp', 'Select at least one span'], ['n phải là số nguyên từ 0 đến 12', 'n must be integer 0..12'],
  ['Thứ tự Member không hợp lệ', 'Thứ tự Member không hợp lệ', 'Invalid member order'],
  ['Vị trí restraint không hợp lệ', 'Invalid restraint position'], ['Các gối phải có tọa độ tăng dần', 'Support positions must increase'],
  ['Vùng tải không hợp lệ', 'Loading extent không hợp lệ', 'Invalid loading extent'], ['Chỉ XT được dịch chuyển', 'Only XT restraints can move'],
  ['Mỗi phía lap phải từ 0 đến 3 m', 'Each lap side must be between 0 and 3 m'],
  ['Vùng nối không được có khoảng hở giữa hai Members', 'A lap joint cannot contain a gap between members'],
  ['Định dạng CFSA không được hỗ trợ; đã dừng đọc file', 'Unknown/unsupported CFSA header; read-only parser aborted'],
  ['File CFSA bị thiếu dữ liệu', 'Truncated CFSA file'],
  ['File gốc đã thay đổi: hãy nhập lại', 'Source changed: re-import'],
  ['Hash file gốc không khớp: nhập lại CFSA và lưu bản nháp mới', 'SOURCE HASH MISMATCH: re-import original CFSA and save a new draft'],
  ['Thiếu file .cfss được tham chiếu; kiểm tra lại SECTIONS', 'Missing referenced .cfss; repair SECTIONS first'],
  ['Thiếu file tiết diện trong SECTIONS', 'Missing sections in SECTIONS'],
  ['Chưa có thay đổi so với file gốc', 'Nothing changed compared with source'],
  ['Số lượng gối không hợp lệ', 'Invalid support count'],
  ['Không được sửa tổ hợp tải', 'Combinations cannot be edited'],
  ['Không được di chuyển gối XYT chính', 'XYT main bearing moved'],
  ['Tọa độ gối phải tăng dần', 'Support coordinates must increase strictly'],
]

const dictionary = new Map()
for (const row of pairs) {
  const vi = row[0], en = row.at(-1)
  for (const source of row) dictionary.set(source, { vi, en })
}
function translate(text, locale) {
  const trimmed = text.trim()
  const match = dictionary.get(trimmed)
  if (match) return text.replace(trimmed, () => match[locale])
  const vi = locale === 'vi'
  const patterns = [
    [/^Range (.+) m · total (.+) m$/, (_, range, total) => vi ? `Phạm vi ${range} m · tổng ${total} m` : trimmed],
    [/^Coordinates (.+) m$/, (_, range) => vi ? `Tọa độ ${range} m` : trimmed],
    [/^Lap (Left|Right) tại (S\d+)$/, (_, side, support) => vi ? `Lap ${side === 'Left' ? 'trái' : 'phải'} tại ${support}` : `${side} lap at ${support}`],
    [/^Chọn gối (S\d+), chỉnh lap trái và phải$/, (_, support) => vi ? trimmed : `Select bearing ${support}, edit left and right lap`],
    [/^Gối (S\d+), XYT, vị trí (.+) m$/, (_, support, x) => vi ? trimmed : `Bearing ${support}, XYT, position ${x} m`],
    [/^Giằng XT (\d+)$/, (_, n) => vi ? trimmed : `XT restraint ${n}`],
    [/^Catalog: (\d+) sections$/, (_, n) => vi ? `Thư viện: ${n} tiết diện` : trimmed],
    [/^Section not found: (.+)$/, (_, file) => vi ? `Không tìm thấy tiết diện: ${file}` : trimmed],
    [/^No \.cfss files found in SECTIONS$/, () => vi ? 'Không có file .cfss trong SECTIONS' : trimmed],
    [/^(\d+) file \.cfss đã chọn\. Nhấn Import \.cfsa để nạp cùng mô hình \(thay thế bản nháp đang chỉnh\)\.$/, (_, n) => vi ? trimmed : `${n} .cfss files selected. Import .cfsa to load them with the model (replaces the current draft).`],
    [/^Đã chọn file: ([\s\S]+)\nNhấn Import \.cfsa để đọc mô hình\.$/, (_, file) => vi ? trimmed : `Selected file: ${file}\nClick Import .cfsa to read the model.`],
    [/^Imported (\d+) members; (\d+) support\/restraint records; (\d+) load cases\. ([\s\S]+)$/, (_, members, supports, loads, message) => vi ? `Đã nhập ${members} cấu kiện; ${supports} gối/giằng; ${loads} trường hợp tải. ${message === 'All sections found.' ? 'Đã tìm thấy mọi file tiết diện.' : message.replace('WARNING:', 'LƯU Ý:').replaceAll('Section not found:', 'Không tìm thấy tiết diện:')}` : trimmed],
    [/^Đã bố trí XT cho (\d+) nhịp\. Tổng (\d+) Supports\. Chỉ ghi JSON Draft cho đến khi Export TEST COPY\.$/, (_, spans, supports) => vi ? trimmed : `XT arranged in ${spans} spans. Total ${supports} supports. Only the JSON draft changes until Export TEST COPY.`],
    [/^Span (\d+) lacks XT template; cannot add$/, (_, span) => vi ? `Nhịp ${span} chưa có XT mẫu; không thể thêm` : trimmed],
    [/^Member (\d+) không hợp lệ$/, (_, member) => vi ? trimmed : `Invalid member ${member}`],
  ]
  for (const [pattern, render] of patterns) if (pattern.test(trimmed)) return text.replace(trimmed, () => trimmed.replace(pattern, render))
  if (trimmed.startsWith('Đã tạo bản thử: ')) {
    if (vi) return text.replace('Fields:', 'Các trường:').replace('Supports:', 'Gối:').replace('Added XT:', 'Thêm XT:').replace('Deleted XT:', 'Xóa XT:').replace('Combination bytes unchanged:', 'Byte tổ hợp tải không đổi:')
    return text.replace('Đã tạo bản thử:', 'Created test copy:').replace('Đóng/mở CFS và đối chiếu trước khi sử dụng.', 'Reopen in CFS and compare before use.')
  }
  if (vi && trimmed.includes(' • ADD ') && trimmed.includes(' • total supports ')) return text.replace(' • ADD ', ' • THÊM ').replace(' / DELETE ', ' / XÓA ').replace(' • total supports ', ' • tổng số gối ').replaceAll('(none)', '(không)')
  return text
}

let locale = new URL(location.href).searchParams.get('locale') || localStorage.getItem('geekcalculus-locale') || 'vi'
if (!['vi', 'en'].includes(locale)) locale = 'vi'
const originalText = new WeakMap()
const originalAttributes = new WeakMap()
function apply() {
  document.documentElement.lang = locale
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    // Options may derive their value from their label; never translate model data.
    if (node.parentElement?.closest('script,style,input,textarea,select,option,code,#selectedFile,[data-no-translate]')) continue
    let entry = originalText.get(node)
    if (!entry || node.nodeValue !== entry.last) entry = { source: node.nodeValue }
    entry.last = translate(entry.source, locale)
    originalText.set(node, entry)
    if (node.nodeValue !== entry.last) node.nodeValue = entry.last
  }
  for (const element of document.querySelectorAll('[aria-label],[title]')) {
    const entries = originalAttributes.get(element) || {}
    for (const attribute of ['aria-label', 'title']) {
      const value = element.getAttribute(attribute)
      if (value === null) continue
      let entry = entries[attribute]
      if (!entry || value !== entry.last) entry = { source: value }
      entry.last = translate(entry.source, locale)
      entries[attribute] = entry
      if (value !== entry.last) element.setAttribute(attribute, entry.last)
    }
    originalAttributes.set(element, entries)
  }
  for (const button of document.querySelectorAll('[data-cfs-locale]')) button.setAttribute('aria-pressed', String(button.dataset.cfsLocale === locale))
}
function setLocale(value, notify = true) {
  if (!['vi', 'en'].includes(value)) return
  locale = value
  localStorage.setItem('geekcalculus-locale', value)
  apply()
  if (notify && parent !== window) parent.postMessage({ type: 'gc-cfs-locale', locale }, location.origin)
}
for (const button of document.querySelectorAll('[data-cfs-locale]')) button.addEventListener('click', () => setLocale(button.dataset.cfsLocale))
addEventListener('message', event => {
  if (event.origin === location.origin && event.source === parent && event.data?.type === 'gc-cfs-locale') setLocale(event.data.locale, false)
})
let scheduled = false
new MutationObserver(() => {
  if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; apply() }) }
}).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] })
const nativeConfirm = window.confirm.bind(window)
window.confirm = message => nativeConfirm(translate(String(message), locale))
apply()
