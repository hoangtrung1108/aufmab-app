// ============================================================
// projects.js — Quản lý đa dự án / đa công trình
// STATUS: in future (chưa triển khai)
// ============================================================
//
// Kế hoạch:
//   - Mỗi công trình có 1 Google Sheet riêng (khác Sheet ID)
//   - Màn hình chọn dự án trước khi vào app chính
//   - Lưu danh sách dự án trong localStorage
//   - GAS_API giữ nguyên endpoint, chỉ truyền thêm sheetId parameter
//
// Thay đổi trong config.js khi triển khai:
//   - GAS_API không đổi
//   - Thêm var ACTIVE_SHEET_ID (dynamic, không hardcode)
//
// Phụ thuộc vào: config.js, db.js, auth.js
// Các file phụ thuộc vào projects.js: app.js (chọn project trước init)
// ============================================================
