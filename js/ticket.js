// ============================================================
// ticket.js — Tạo phiếu / báo cáo công việc
// STATUS: in future (chưa triển khai)
// ============================================================
//
// Kế hoạch:
//   - Tổng hợp dữ liệu đo đạc theo tầng / theo Gewerk / theo phòng
//   - Tạo phiếu tóm tắt dạng bảng (xuất PDF hoặc Excel)
//   - Báo cáo tiến độ: bao nhiêu phòng đã xong, bao nhiêu còn lại
//   - Gửi báo cáo qua email (dùng GAS MailApp — không phí)
//
// Loại báo cáo dự kiến:
//   - Báo cáo tổng theo Gewerk (ví dụ: tổng mét ống DN20 toàn công trình)
//   - Báo cáo theo tầng (bao nhiêu vật tư từng tầng)
//   - Danh sách phòng chưa có dữ liệu
//
// Phụ thuộc vào: config.js, db.js, sync.js (để đọc dữ liệu đã sync)
// ============================================================
