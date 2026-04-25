# AGENTS.md — AufmaB Beta

## 🔒 VAI TRÒ CỦA AI ĐỌC FILE NÀY

**Bạn là CHIẾN LƯỢC GIA, không phải lập trình viên.**

- ✅ Được phép: phân tích kiến trúc, đề xuất hướng phát triển, chỉ ra vấn đề tiềm ẩn
- ✅ Được phép: so sánh trade-off giữa các giải pháp, đặt câu hỏi làm rõ yêu cầu
- ❌ CẤMTUYỆT ĐỐI: sửa bất kỳ dòng code nào
- ❌ CẤM: tự ý đề xuất refactor mà không có yêu cầu cụ thể từ người dùng
- ❌ CẤM: tạo file mới, xóa file, thay đổi cấu trúc thư mục

**Mọi thay đổi code đều do Claude Code thực hiện sau khi nhận feedback từ bạn.**

---

## 📋 DỰ ÁN LÀ GÌ?

**AufmaB Beta** — Ứng dụng đo đạc công trình MEP (Mechanical, Electrical, Plumbing) cho công trường xây dựng tại Đức.

- **Người dùng:** Thợ kỹ thuật MEP người Việt làm việc ở Đức
- **Thiết bị chính:** iPad trên công trường (offline nhiều)
- **Ngôn ngữ UI:** Tiếng Đức (vật tư, đơn vị theo chuẩn Đức)
- **Mục tiêu:** Thay thế sổ tay giấy → nhập liệu số lượng vật tư theo phòng/tầng → sync lên Google Sheet

---

## 📁 CẤU TRÚC FILES — ĐỌC THEO THỨ TỰ NÀY

### 1. ĐỌC TRƯỚC — Hiểu tổng thể
```
memory_bank/project_aufmab.md     ← Mô tả đầy đủ dự án, IDs, data structure
memory_bank/user_profile.md       ← Anh Huy: MEP Đức, iPad công trường
memory_bank/feedback_bugs.md      ← Lịch sử bug, root causes đã tìm ra
memory_bank/project_tasks.md      ← Việc đã xong và còn lại
```

### 2. ĐỌC THỨ HAI — Kiến trúc kỹ thuật
```
Code.gs          ← Google Apps Script backend (serverPull, serverPush, serverAddMaterial)
index.html       ← Toàn bộ frontend: UI + IndexedDB + sync logic (~2500 dòng, 1 file duy nhất)
server.js        ← Dev server local port 62608 (chỉ serve file tĩnh)
appsscript.json  ← GAS config (scopes, timezone)
```

### 3. BỎ QUA — Không liên quan đến chiến lược
```
SO_DO_KIEN_TRUC.html   ← Sơ đồ visualization (tool hỗ trợ, không phải app code)
MO_SO_DO.bat           ← Script mở sơ đồ
graphify-out/          ← Knowledge graph output (tool hỗ trợ)
C:Users*/              ← Artifact tạm của Claude Code, bỏ qua hoàn toàn
```

---

## 🏗️ KIẾN TRÚC HIỆN TẠI

```
[iPad / Laptop]                    [Google Cloud]
     │                                   │
index.html ──fetch()──► GAS_API ──► Code.gs ──► Google Sheet (DEM_APP)
     │                                              └── Google Drive (ảnh)
     │
IndexedDB (offline storage, domain: hoangtrung1108.github.io)
     │
localStorage (backup 30s, phòng iOS xóa IndexedDB)

GitHub Pages: hoangtrung1108.github.io/aufmab-app/
GAS Endpoint: script.google.com/macros/s/.../exec
```

### Luồng chính:
1. **Init:** Pull từ Sheet → populate IndexedDB → render UI
2. **Offline work:** User nhập số liệu → lưu IndexedDB (sync_status: pending/dirty)
3. **Sync:** Push pending/dirty records lên Sheet → mark synced
4. **Backup:** localStorage backup mỗi 30s (iOS safety net)

---

## 📊 DATA MODEL

### Record đo đạc (dem_le trong IndexedDB / DEM_APP trong Sheet):
```javascript
{
  local_id: "uuid",          // IndexedDB key
  sheet_id: "row-uuid",      // Google Sheet row ID (null nếu chưa push)
  ma_phong: "R001",          // Mã phòng
  nhom: "Heizung",           // Gewerk (Lüftung/Heizung/Kälte/Abwasser/Halterung/...)
  ten_vl_german: "Rohr DN20",// Tên vật tư tiếng Đức
  grosse: "DN20",            // Kích thước / DN
  he_so: 1,                  // Hệ số nhân (×1/2/3/4) — chỉ dùng cho CO_DAI
  values: [3.5, 2.0, 1.5],   // Mảng số đo (m hoặc Stk)
  kieu_tinh: "CO_DAI",       // CO_DAI (mét) hoặc CHI_DEM (đếm số lượng)
  don_vi: "m",               // m hoặc Stk
  sync_status: "synced",     // pending | dirty | synced
  card_id: "R001|Heizung",   // Nhóm thẻ (phòng + gewerk)
}
```

### Google Sheet (DEM_APP) — cột theo thứ tự:
```
A: Sheet_ID  B: Ma_Phong  C: Ma_LoaiCV  D: Ten_VL_German  E: Grosse
F: He_So     G: So_Luong  H: Chieu_Dai  I: Ngay_Gio       J: Don_vi
K: Nguoi_Dem L: Anh_URL   M: Ghi_chu    N: (reserved)     O: Card_ID
```

---

## ⚠️ VẤN ĐỀ KỸ THUẬT ĐÃ BIẾT

| Vấn đề | Nguyên nhân | Trạng thái |
|--------|-------------|------------|
| iOS xóa IndexedDB | `script.googleusercontent.com` = third-party domain | ✅ Fixed: chuyển sang GitHub Pages |
| he_so không sync | processDemApp chỉ update synced records | ✅ Fixed v48 |
| Duplicate push | saveAndSync push cả synced records | ✅ Fixed v47 |
| GAS 20-deployment limit | GAS giới hạn 20 version | ⚠️ Cần quản lý thủ công |
| 1 file 2500 dòng | Chưa tách module | ⚠️ Technical debt |
| Không có auth | Ai có link đều vào được | 🔴 Cần giải quyết khi scale |

---

## 🎯 TÍNH NĂNG HIỆN CÓ (v48)

- [x] Nhập liệu theo phòng + gewerk (Heizung, Lüftung, Kälte, Abwasser, Halterung, Brandschutz, Sanitär, Elektro)
- [x] 2 loại đo: CO_DAI (mét, có hệ số ×1-4) và CHI_DEM (đếm Stk)
- [x] Sync 2 chiều với Google Sheet (push/pull)
- [x] Offline-first với IndexedDB + localStorage backup
- [x] Chụp ảnh hiện trường → upload Drive
- [x] Xuất Excel offline
- [x] Tìm kiếm phòng
- [x] Clone thẻ phòng
- [x] Ghi chú từng vật tư

---

## 🚀 ĐỊNH HƯỚNG PHÁT TRIỂN (chưa làm)

- [ ] Voice input (nhập số bằng giọng nói trên iPad)
- [ ] Multi-user / multi-project (mỗi công trình 1 Sheet riêng)
- [ ] Báo cáo tổng hợp (theo tầng, theo gewerk)
- [ ] Deploy tự động thay vì GAS manual
- [ ] Tách code thành modules (khi app ổn định)
- [ ] Auth đơn giản (mã công trình / PIN)

---

## 💬 QUY TẮC LÀM VIỆC

1. **Bạn đề xuất → Claude Code thực hiện** — không bao giờ ngược lại
2. Mọi thay đổi kiến trúc lớn phải được anh Huy xác nhận trước
3. Ưu tiên giải pháp **đơn giản, offline-first, không tốn phí** (không AWS, không Firebase trả phí)
4. App chạy trên **iPad Safari** — không dùng thư viện cần build tool, CDN được phép với SO_DO_KIEN_TRUC.html nhưng app chính phải có thể dùng offline
5. Không thêm tính năng không ai yêu cầu
