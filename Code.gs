// ============================================================
// AUFMASS BETA — AppScript Backend
// Sheet ID: 1Q9AQdT6K8zxsKUMk1mzm5JS1tgBXi_BbV45BpoP7aTM
// Drive Folder: 1W1aM9cSVX2u1PXtjEhPN0OxC4329OE1u
// ============================================================

var SHEET_ID = "1Q9AQdT6K8zxsKUMk1mzm5JS1tgBXi_BbV45BpoP7aTM";
var DRIVE_FOLDER_ID = "1W1aM9cSVX2u1PXtjEhPN0OxC4329OE1u";

// Sheet DEM_APP — output của app (A-N, 14 cột):
// A:ID  B:Ma_Phong  C:Ma_LoaiCV  D:Ten_VL_German  E:Große
// F:He_So  G:So_Luong  H:Chieu_Dai  I:Ngay_Gio  J:Don_vi
// K:Nguoi_Dem  L:Anh_Hien_Truong  M:Ghi_Chu  N:Ten_Anh_Mong_Muon
//
// Sheet DEM_LE — backup thủ công, app KHÔNG ghi vào đây

// ---- doGet: serve app hoặc API (từ GitHub Pages) ----
function doGet(e) {
  // Nếu có action param → trả JSON (GitHub Pages gọi API)
  if(e && e.parameter && e.parameter.action) {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    try {
      if(e.parameter.action === 'pull') {
        output.setContent(serverPull());
      } else {
        output.setContent(JSON.stringify({success:false,error:'Unknown action'}));
      }
    } catch(err) {
      output.setContent(JSON.stringify({success:false,error:err.message}));
    }
    return output;
  }
  // Không có action → serve HTML app (backward compat)
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('AufmaB Beta')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

// ---- doPost: nhận lệnh từ GitHub Pages (fetch API) ----
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var payload = body.payload;
    if(action === 'serverPush') {
      output.setContent(serverPush(payload));
    } else if(action === 'serverAddMaterial') {
      output.setContent(serverAddMaterial(payload));
    } else if(action === 'serverUploadImage') {
      output.setContent(serverUploadImage(payload));
    } else {
      output.setContent(JSON.stringify({success:false,error:'Unknown action: '+action}));
    }
  } catch(err) {
    output.setContent(JSON.stringify({success:false,error:err.message}));
  }
  return output;
}

// ---- Server functions called via google.script.run OR doPost ----

function serverPull() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Read PHONG
  var phongSheet = ss.getSheetByName("PHONG");
  var phongData = [];
  if (phongSheet && phongSheet.getLastRow() > 1) {
    var phongRows = phongSheet.getRange(2, 1, phongSheet.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < phongRows.length; i++) {
      var r = phongRows[i];
      if (!r[0] && !r[1]) continue;
      phongData.push({
        id: String(r[0]),
        ma_phong: String(r[1]),
        ten_phong: String(r[2]),
        tang: String(r[3]),
        khu_vuc: String(r[4])
      });
    }
  }

  // Read CONG_VIEC (cols A=ID, B=STT, C=Gewerk, D=ten_vl_german, E=don_vi, F=kieu_tinh)
  var cvSheet = ss.getSheetByName("CONG_VIEC");
  var vlData = [];
  if (cvSheet && cvSheet.getLastRow() > 1) {
    var numCols = Math.max(cvSheet.getLastColumn(), 4);
    var cvRows = cvSheet.getRange(2, 1, cvSheet.getLastRow() - 1, numCols).getValues();
    for (var i = 0; i < cvRows.length; i++) {
      var r = cvRows[i];
      var ten_vl_german = String(r[3] || '').trim();
      var nhom = String(r[2] || '').trim();
      if (!ten_vl_german || !nhom) continue;
      var don_vi = numCols >= 5 ? String(r[4] || '').trim() : '';
      var kieu_tinh = numCols >= 6 ? String(r[5] || '').trim() : '';
      if (!don_vi || !kieu_tinh) {
        var inf = inferUnit(ten_vl_german);
        if (!don_vi) don_vi = inf.don_vi;
        if (!kieu_tinh) kieu_tinh = inf.kieu_tinh;
      }
      vlData.push({
        nhom: nhom,
        ma_vl: nhom + '_' + i,
        ten_vl_german: ten_vl_german,
        don_vi: don_vi,
        kieu_tinh: kieu_tinh
      });
    }
  }

  // Read DEM_APP — để sync ngược về device khác (laptop ↔ iPad)
  var demAppSheet = ss.getSheetByName("DEM_APP");
  var demAppData = [];
  if (demAppSheet && demAppSheet.getLastRow() > 1) {
    var nCols = Math.max(demAppSheet.getLastColumn(), 15);
    var nDataRows = demAppSheet.getLastRow() - 1;
    var demRows     = demAppSheet.getRange(2, 1, nDataRows, nCols).getValues();
    var demFormulas = demAppSheet.getRange(2, 1, nDataRows, nCols).getFormulas();
    for (var i = 0; i < demRows.length; i++) {
      var r = demRows[i];
      var f = demFormulas[i];
      var sheetId = String(r[0] || '').trim();
      var maPhong = String(r[1] || '').trim();
      if (!sheetId || !maPhong) continue;

      // Parse values: formula (=5+1+1 or =3.5+2.0) → array; fallback to single number
      var fG = String(f[6] || '').trim(); // col G formula (CHI_DEM)
      var fH = String(f[7] || '').trim(); // col H formula (CO_DAI)
      var vals = [];
      var isCoDai = false;
      if (fH && fH.charAt(0) === '=') {
        // CO_DAI with formula: =3.5+2.0+1.0
        isCoDai = true;
        vals = fH.slice(1).split('+').map(function(s){ return parseFloat(s.trim()); })
                 .filter(function(n){ return !isNaN(n) && n > 0; });
      } else if (fG && fG.charAt(0) === '=') {
        // CHI_DEM with formula: =5+1+1 hoặc =3.5+2.5
        vals = fG.slice(1).split('+').map(function(s){ return parseFloat(s.trim()); })
                 .filter(function(n){ return !isNaN(n) && n > 0; });
      } else {
        // Legacy: plain numbers in cells
        var chieuDaiNum = Number(r[7]) || 0;
        var soLuongNum  = Number(r[6]) || 0;
        if (chieuDaiNum > 0) { vals = [chieuDaiNum]; isCoDai = true; }
        else if (soLuongNum > 0) { vals = [soLuongNum]; }
      }

      var nhom = String(r[2] || '').trim();
      var storedCardId = nCols >= 15 ? String(r[14] || '').trim() : '';

      // He_So: CO_DAI → đọc cột G (So_Luong = hesoVal khi write) vì cột F có thể trống ở data cũ
      //        CHI_DEM → đọc cột F (He_So), col G chứa tổng đo không phải hệ số
      var hesoVal;
      if (isCoDai) {
        var hF = Number(r[5]) || 0;
        var hG = Math.round(Number(r[6])) || 0; // So_Luong = hesoVal for CO_DAI
        hesoVal = hF > 1 ? hF : (hG > 0 ? hG : 1); // ưu tiên col F nếu > 1, fallback col G
        if (hesoVal < 1 || hesoVal > 99) hesoVal = 1;
      } else {
        hesoVal = Number(r[5]) || 1;
      }

      demAppData.push({
        sheet_id:      sheetId,
        ma_phong:      maPhong,
        nhom:          nhom,
        ten_vl_german: String(r[3] || '').trim(),
        grosse:        String(r[4] || '').trim(),
        he_so:         hesoVal,
        kieu_tinh:     isCoDai ? 'CO_DAI' : 'CHI_DEM',
        don_vi:        String(r[9] || '').trim(),
        ghi_chu:       String(r[12] || '').trim(),
        values:        vals,
        card_id:       storedCardId || (maPhong + '|' + nhom)
      });
    }
  }

  return JSON.stringify({ success: true, phong: phongData, vat_lieu: vlData, dem_app: demAppData });
}

// Infer don_vi/kieu_tinh from material name when cols E/F are absent
function inferUnit(name) {
  var t = (name || '').toLowerCase();
  // Ausnahmen: enthalten "rohr" aber sind Stückzahl-Artikel (keine Längenmaße)
  // Rohrschelle, Rohrbogen, Rohrhalter, Rohrverbinder, Rohrkupplung, Rohrkappe
  if (t.indexOf('schelle') >= 0 || t.indexOf('bogen') >= 0 ||
      t.indexOf('halter') >= 0 || t.indexOf('verbinder') >= 0 ||
      t.indexOf('kupplung') >= 0 || t.indexOf('kappe') >= 0 ||
      t.indexOf('muffe') >= 0 || t.indexOf('clip') >= 0) {
    return { don_vi: 'Stk', kieu_tinh: 'CHI_DEM' };
  }
  // Längenmaße: Rohr, Kanal, Stange, Schiene
  if (t.indexOf('rohr') >= 0 || t.indexOf('kanal') >= 0 ||
      t.indexOf('stange') >= 0 || t.indexOf('schiene') >= 0) {
    return { don_vi: 'm', kieu_tinh: 'CO_DAI' };
  }
  return { don_vi: 'Stk', kieu_tinh: 'CHI_DEM' };
}

// Insert new material into CONG_VIEC after last row of same Gewerk group
function serverAddMaterial(jsonStr) {
  try {
    var body = JSON.parse(jsonStr);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("CONG_VIEC");
    if (!sheet) return JSON.stringify({ success: false, error: 'CONG_VIEC sheet not found' });

    var nhom = body.nhom;
    var ten_vl_german = body.ten_vl_german;
    var don_vi = body.don_vi;
    var kieu_tinh = body.kieu_tinh;

    var lastRow = sheet.getLastRow();
    var insertAfter = lastRow; // default: append
    var stt = 1;

    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      var maxStt = 0;
      var lastGroupRow = -1;
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][2]).trim() === nhom) {
          lastGroupRow = i + 2; // 1-indexed sheet row
          var s = parseInt(data[i][1]) || 0;
          if (s > maxStt) maxStt = s;
        }
      }
      if (lastGroupRow > 0) {
        insertAfter = lastGroupRow;
        stt = maxStt + 1;
      } else {
        // nhom not found — append at end
        insertAfter = lastRow;
        stt = 1;
      }
    }

    if (insertAfter < lastRow) {
      sheet.insertRowAfter(insertAfter);
      sheet.getRange(insertAfter + 1, 1, 1, 6).setValues([[
        '', stt, nhom, ten_vl_german, don_vi, kieu_tinh
      ]]);
    } else {
      sheet.appendRow(['', stt, nhom, ten_vl_german, don_vi, kieu_tinh]);
    }

    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

function serverPush(jsonStr) {
  try {
    var body = JSON.parse(jsonStr);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var mappedIds = {};

    if (body.dem_le && body.dem_le.length > 0) {
      // Support new room-based format (anh_urls_by_room) or legacy array (anh_urls)
      var anhData = body.anh_urls_by_room || null;
      if (!anhData && body.anh_urls && body.anh_urls.length > 0) {
        // Legacy: all photos go to first room
        anhData = {};
        var firstRoom = body.dem_le[0].ma_phong;
        if (firstRoom) anhData[firstRoom] = body.anh_urls;
      }
      mappedIds = writeDemLe(ss, body.dem_le, anhData || {});
    }
    if (body.vat_lieu_new && body.vat_lieu_new.length > 0) {
      writeVatLieuNew(ss, body.vat_lieu_new);
    }
    if (body.phong_new && body.phong_new.length > 0) {
      writePhongNew(ss, body.phong_new);
    }

    return JSON.stringify({ success: true, mapped_ids: mappedIds });
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

function serverUploadImage(jsonStr) {
  try {
    var body = JSON.parse(jsonStr);
    var parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var subFolderName = "AufmaBeta_" + body.ma_phong;
    var subFolder = getOrCreateSubfolder(parentFolder, subFolderName);

    var decoded = Utilities.base64Decode(body.data);
    var blob = Utilities.newBlob(decoded, "image/jpeg", body.filename);
    var file = subFolder.createFile(blob);

    // Rename to desired format if provided
    if (body.ten_mong_muon) {
      file.setName(body.ten_mong_muon);
    }

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return JSON.stringify({
      success: true,
      drive_url: file.getUrl(),
      filename: file.getName()
    });
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

// ---- Write DEM_LE ----
// Columns A-O (15 cols):
// A:ID  B:Ma_Phong  C:Ma_LoaiCV  D:Ten_VL_German  E:Große
// F:He_So  G:So_Luong  H:Chieu_Dai  I:Ngay_Gio  J:Don_vi
// K:Nguoi_Dem  L:Anh_Hien_Truong  M:Ghi_Chu  N:Ten_Anh_Mong_Muon  O:Card_ID
//
// Card_ID (col O) lưu card_id gốc từ app (vd "040|Heizung+Kälte|note")
// → dùng khi pull về để ghép đúng multi-gewerk thẻ
function writeDemLe(ss, records, anhUrlsByRoom) {
  // anhUrlsByRoom: {ma_phong: [{drive_url, filename}]}
  // Each room's photos are assigned sequentially to that room's records
  var sheet = ss.getSheetByName("DEM_APP");
  if (!sheet) {
    sheet = ss.insertSheet("DEM_APP");
    sheet.appendRow([
      "ID", "Ma_Phong", "Ma_LoaiCV", "Ten_VL_German", "Große",
      "He_So", "So_Luong", "Chieu_Dai", "Ngay_Gio", "Don_vi",
      "Nguoi_Dem", "Anh_Hien_Truong", "Ghi_Chu", "Ten_Anh_Mong_Muon", "Card_ID"
    ]);
    sheet.setFrozenRows(1);
  } else {
    // Đảm bảo header cột O tồn tại (backward compat với sheet cũ chưa có cột này)
    var lastCol = sheet.getLastColumn();
    if (lastCol < 15) {
      sheet.getRange(1, 15).setValue("Card_ID");
    }
  }

  var mapped = {};
  var now = new Date().toISOString();

  // Build ID-to-row index for upsert
  var existingIds = {};
  if (sheet.getLastRow() > 1) {
    var idCol = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < idCol.length; i++) {
      if (idCol[i][0]) existingIds[String(idCol[i][0])] = i + 2;
    }
  }

  // Per-room photo index — photos are assigned sequentially within each room
  var roomPhotoIdx = {};

  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    var sheetId = rec.sheet_id || generateId(rec.ma_phong);

    // Calculate So_Luong and Chieu_Dai from values array
    // Multi-value → write as formula "=5+1+1" so Sheet shows sum but formula is visible on click
    var soLuong = "";
    var chieuDai = "";
    var vals = rec.values || [];
    var hesoVal = rec.he_so || 1;
    if (vals.length > 0) {
      if (rec.kieu_tinh === "CHI_DEM") {
        if (vals.length === 1) {
          // Giữ nguyên số thập phân — không Math.round
          var n = Number(vals[0]);
          soLuong = (n === Math.floor(n)) ? Math.floor(n) : Math.round(n * 100) / 100;
        } else {
          soLuong = '=' + vals.map(function(v){
            var n = Number(v);
            return (n === Math.floor(n)) ? Math.floor(n) : Math.round(n * 100) / 100;
          }).join('+');
        }
      } else if (rec.kieu_tinh === "CO_DAI") {
        if (vals.length === 1) {
          chieuDai = Math.round(Number(vals[0]) * 10) / 10;
        } else {
          chieuDai = '=' + vals.map(function(v){ return Math.round(Number(v)*100)/100; }).join('+');
        }
        soLuong = hesoVal; // số lượng tuyến (×1/2/3/4)
      }
    }
    // Skip rows with no data (safety net — frontend already filters)
    if (soLuong === "" && chieuDai === "") continue;

    // Fix 4: Assign photo URL by room — photos from room A go only to room A's records
    var anhUrl = "";
    var tenAnh = "";
    var roomPhotos = (anhUrlsByRoom && anhUrlsByRoom[rec.ma_phong]) || [];
    var pIdx = roomPhotoIdx[rec.ma_phong] || 0;
    if (pIdx < roomPhotos.length) {
      anhUrl = roomPhotos[pIdx].drive_url || "";
      tenAnh = roomPhotos[pIdx].filename || "";
      roomPhotoIdx[rec.ma_phong] = pIdx + 1;
    }

    var rowData = [
      sheetId,                    // A: ID
      rec.ma_phong,               // B: Ma_Phong
      rec.nhom || "",             // C: Ma_LoaiCV (Heizung, Lüftung...)
      rec.ten_vl_german,          // D: Ten_VL_German
      rec.grosse || "",           // E: Große (DN20...)
      hesoVal,                    // F: He_So (×1/2/3/4 cho CO_DAI)
      soLuong,                    // G: So_Luong (count, CHI_DEM only)
      chieuDai,                   // H: Chieu_Dai (meters, CO_DAI only)
      now,                        // I: Ngay_Gio
      rec.don_vi || "",           // J: Don_vi
      "Admin",                    // K: Nguoi_Dem (hardcoded for now)
      anhUrl,                     // L: Anh_Hien_Truong (Drive link)
      rec.ghi_chu || "",          // M: Ghi_Chu
      tenAnh,                     // N: Ten_Anh_Mong_Muon
      rec.card_id || ""           // O: Card_ID (vd "040|Heizung+Kälte|note")
    ];

    var existingRow = existingIds[sheetId];
    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, 15).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    mapped[rec.local_id] = sheetId;
  }

  return mapped;
}

function writeVatLieuNew(ss, items) {
  var sheet = ss.getSheetByName("VAT_LIEU");
  if (!sheet) return;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    sheet.appendRow([
      item.nhom || "", item.ma_vl || "", item.size || "",
      item.ten_vl || "", item.ten_vl_german || "",
      item.don_vi || "", item.kieu_tinh || ""
    ]);
  }
}

function writePhongNew(ss, items) {
  var sheet = ss.getSheetByName("PHONG");
  if (!sheet) return;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    sheet.appendRow([
      item.id || "", item.ma_phong || "", item.ten_phong || "",
      item.tang || "", item.khu_vuc || ""
    ]);
  }
}

function getOrCreateSubfolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function generateId(maPhong) {
  return maPhong + "_" + Date.now();
}
