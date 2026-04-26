// ============================================================
// layout.js — Vẽ annotation / layout đè lên bản vẽ PDF
// STATUS: in future (chưa triển khai)
// ============================================================
//
// Kế hoạch:
//   - Canvas layer chồng lên PDF canvas (từ pdf.js)
//   - Cho phép chấm điểm, vẽ đường, ghi chú trực tiếp trên bản vẽ
//   - Liên kết annotation với record đo đạc (ma_phong + gewerk)
//   - Lưu annotation trong IndexedDB (offline) + sync lên Sheet (column M Ghi_chu)
//
// Tool vẽ dự kiến:
//   - Pen (tay tự do) — dùng PointerEvent trên iPad
//   - Marker phòng (tap để tag phòng trên bản vẽ)
//   - Text overlay
//
// Phụ thuộc vào: config.js, db.js, pdf.js
// ============================================================
