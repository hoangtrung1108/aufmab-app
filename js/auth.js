// ============================================================
// auth.js — Xác thực người dùng
// STATUS: in future (chưa triển khai)
// ============================================================
//
// Kế hoạch:
//   - PIN đơn giản hoặc mã công trình (không cần server auth)
//   - Mỗi công trình có 1 mã, nhập đúng mới vào được
//   - Lưu session trong localStorage (tự logout sau 24h)
//   - Không dùng OAuth / Firebase Auth (offline-first)
//
// Phụ thuộc vào: config.js, db.js
// Các file phụ thuộc vào auth.js: app.js (gọi checkAuth trước init)
// ============================================================
