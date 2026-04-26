// ============================================================
// pdf.js — Xem và xử lý bản vẽ PDF tầng / phòng
// STATUS: in future (chưa triển khai)
// ============================================================
//
// Kế hoạch:
//   - Upload bản vẽ PDF lên Google Drive (1 lần, không phải mỗi session)
//   - Render PDF bằng PDF.js (CDN hoặc inline — cần eval offline tradeoff)
//   - Hiển thị bản vẽ tầng dưới dạng canvas trong app
//   - Dùng cùng layout.js để vẽ đè annotation lên bản vẽ
//
// Dependency quan trọng:
//   - PDF.js từ Mozilla (https://mozilla.github.io/pdf.js/)
//   - Cần test kỹ trên iPad Safari (PDF rendering khác Chrome)
//
// Phụ thuộc vào: config.js
// Các file phụ thuộc vào pdf.js: layout.js (dùng canvas của pdf.js)
// ============================================================
