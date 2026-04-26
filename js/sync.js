// AufmaB Beta — Sync engine (saveAndSync, gsRun, doSync, processDemApp)
// Depends on: config.js, db.js

// ============================================================
// SAVE & SYNC — Push current phong's data to Google Sheet
// ============================================================
// PULL ONLY — ↓ kéo dữ liệu từ Sheet về, không push lên
// ============================================================
async function pullOnly(){
  if(IS_GAS&&!navigator.onLine){
    toast('📡 Đang offline — không thể pull từ Sheet');
    return;
  }
  var btn=document.getElementById('btnPull');
  if(btn){btn.disabled=true;btn.textContent='...';}
  try{
    if(IS_GAS){
      var js=await gsRun('serverPull');var data=JSON.parse(js);
      if(!data.success)throw new Error('Pull failed');
      for(var i=0;i<(data.phong||[]).length;i++){var p=data.phong[i];var ex=await dbGet('phong',p.id);if(!ex||ex.synced!==false){p.synced=true;p.is_new=false;await dbPut('phong',p);}}
      for(var i=0;i<(data.vat_lieu||[]).length;i++){data.vat_lieu[i].is_new=false;await dbPut('vat_lieu',data.vat_lieu[i]);}
      var dem=data.dem_app||[];
      var codaiHS=dem.filter(function(r){return r.kieu_tinh==='CO_DAI'&&r.he_so>1;});
      await processDemApp(dem);
      await renderS2();
      toast('\u2193 Pull OK: '+dem.length+' records, CO_DAI\u00d7>1: '+codaiHS.length);
    } else {toast('Pull: offline mode');}
  }catch(e){toast('Pull Fehler: '+(e.message||e));}
  finally{if(btn){btn.disabled=false;btn.textContent='\u2193';}}
}

// ============================================================
async function saveAndSync(){
  // Offline check — không để treo nút
  if(IS_GAS&&!navigator.onLine){
    toast('📡 Đang offline — dữ liệu đã lưu local, sync khi có mạng');
    return;
  }
  var btn=document.getElementById('btnSave');
  btn.disabled=true;btn.textContent='Saving...';
  try{
    if(IS_GAS){
      // Step 1: Upload pending images first, collect Drive URLs
      var allA=await dbGetAll('anh');
      var pendA=allA.filter(function(a){return a.ma_phong===curPhong.ma_phong&&a.sync_status==='pending'&&a.data;});
      var anhUrls=[];
      btn.textContent='Uploading '+pendA.length+' Fotos...';
      for(var i=0;i<pendA.length;i++){
        try{
          var a=pendA[i];
          var b64=a.data;if(b64.indexOf(',')>=0)b64=b64.split(',')[1];
          var ijs=await gsRun('serverUploadImage',JSON.stringify({ma_phong:a.ma_phong,filename:a.filename,data:b64}));
          var ires=JSON.parse(ijs);
          if(ires.success){
            a.drive_url=ires.drive_url;a.sync_status='synced';
            await dbPut('anh',a);
            anhUrls.push({drive_url:ires.drive_url,filename:ires.filename});
          }
        }catch(ie){console.error('Img:',ie);}
      }
      // Include already-synced images — EXCLUDE ones just uploaded above (they're already in anhUrls)
      var justUploadedIds=new Set(pendA.map(function(a){return a.anh_id;}));
      var syncedA=allA.filter(function(a){return a.ma_phong===curPhong.ma_phong&&a.sync_status==='synced'&&a.drive_url&&!justUploadedIds.has(a.anh_id);});
      var allAnh=anhUrls.concat(syncedA.map(function(a){return{drive_url:a.drive_url,filename:a.filename};}));

      // Step 2: Build dem_le records
      btn.textContent='Syncing data...';
      var allD=await dbIdx('dem_le','ma_phong',curPhong.ma_phong);
      // Chỉ push pending/dirty — KHÔNG push synced (tránh tạo row trùng trong Sheet)
      var toP=allD.filter(function(r){
        if(r.deleted)return false;
        if(r.sync_status==='synced')return false; // đã sync rồi, bỏ qua
        var vals=r.values||[];
        if(vals.length===0)return false;
        var total=vals.reduce(function(a,b){return a+Number(b);},0);
        return total>0;
      });

      // Sort: oldest card first, then nhom → grosse → ten_vl_german
      var _cm2={};
      toP.forEach(function(r){var cid=r.card_id||r.ma_phong;if(!_cm2[cid]||r.created_at<_cm2[cid])_cm2[cid]=r.created_at||0;});
      toP.sort(function(a,b){
        var ca=a.card_id||a.ma_phong,cb=b.card_id||b.ma_phong;
        var ta=_cm2[ca]||0,tb=_cm2[cb]||0;
        if(ta!==tb)return ta-tb;
        if(ca!==cb)return ca.localeCompare(cb);
        var nc=(a.nhom||'').localeCompare(b.nhom||'');if(nc)return nc;
        var gc=(a.grosse||'').localeCompare(b.grosse||'');if(gc)return gc;
        return(a.ten_vl_german||'').localeCompare(b.ten_vl_german||'');
      });

      // Build anh_urls_by_room for this single room
      var anhUrlsByRoom2={};
      anhUrlsByRoom2[curPhong.ma_phong]=allAnh;

      var payload={
        dem_le: toP.map(function(r){
          return {
            local_id: r.local_id,
            sheet_id: r.sheet_id,
            ma_phong: r.ma_phong,
            nhom: r.nhom||'',
            ma_vl: r.ma_vl,
            ten_vl_german: r.ten_vl_german,
            grosse: r.grosse||'',
            values: r.values||[],
            kieu_tinh: r.kieu_tinh,
            don_vi: r.don_vi||'',
            he_so: pendingHeSo[r.local_id]!==undefined?pendingHeSo[r.local_id]:(r.he_so||1),
            ghi_chu: r.ghi_chu||'',
            card_id: r.card_id||''
          };
        }),
        anh_urls_by_room: anhUrlsByRoom2,
        vat_lieu_new:[],
        phong_new:[]
      };

      if(toP.length===0&&pendA.length===0){
        toast('✓ Không có dữ liệu mới — đã đồng bộ hết rồi');
      } else {
        var pjs=await gsRun('serverPush',JSON.stringify(payload));
        var res=JSON.parse(pjs);
        if(res.success){
          var mapped=res.mapped_ids||{};
          for(var i=0;i<toP.length;i++){
            var fresh=await dbGet('dem_le',toP[i].local_id)||toP[i];
            fresh.sync_status='synced';
            if(mapped[toP[i].local_id])fresh.sheet_id=mapped[toP[i].local_id];
            await dbPut('dem_le',fresh);
          }
          toast('✓ Đã lưu '+toP.length+' dòng mới lên Google Sheet');
        } else {
          throw new Error(res.error||'Push failed');
        }
      }
    } else {
      // Local mock
      var allD=await dbIdx('dem_le','ma_phong',curPhong.ma_phong);
      for(var i=0;i<allD.length;i++){allD[i].sync_status='synced';await dbPut('dem_le',allD[i]);}
      toast('[Mock] Đã lưu '+allD.length+' dòng ✓');
    }
    updateBadge();
  }catch(err){
    console.error('Save:',err);toast('Lỗi: '+(err.message||err));
  }finally{
    btn.disabled=false;btn.innerHTML='&#8593;';
  }
}

// ============================================================
// SYNC ENGINE — fetch() → GAS API (GitHub Pages) + mock fallback (local preview)
// ============================================================
var GAS_API = 'https://script.google.com/macros/s/AKfycbyEFk4tESM5s8bRfCx7krOVu54OFJqUC9-TUW5VxkDToRs6xL3sI109zqhSIMEp5jFB/exec';
var IS_GAS = (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');

// Pull dem_app records from Sheet into IndexedDB (shared between doSync & init refresh)
// Rules: import new records; update card_id always; update values only if local is 'synced'
async function processDemApp(demAppData){
  if(!demAppData||demAppData.length===0)return 0;
  var allLocal=await dbGetAll('dem_le');
  var bySheetId={};
  allLocal.forEach(function(d){if(d.sheet_id)bySheetId[d.sheet_id]=d;});
  var count=0;
  for(var i=0;i<demAppData.length;i++){
    var row=demAppData[i];
    if(!row.sheet_id||!row.ma_phong||!row.ten_vl_german)continue;
    if((row.values||[]).length===0)continue;
    var local=bySheetId[row.sheet_id];
    if(!local){
      var newRec={
        local_id:uuid(),sheet_id:row.sheet_id,
        ma_phong:row.ma_phong,nhom:row.nhom||'',
        ten_vl_german:row.ten_vl_german,grosse:row.grosse||'',
        he_so:row.he_so||1,values:row.values,
        kieu_tinh:row.kieu_tinh,don_vi:row.don_vi||'',
        ghi_chu:row.ghi_chu||'',card_id:row.card_id||row.ma_phong+'|'+(row.nhom||''),
        card_note:'',sync_status:'synced',deleted:false,
        created_at:Date.now(),updated_at:Date.now()
      };
      await dbPut('dem_le',newRec);
      bySheetId[row.sheet_id]=newRec;count++;
    } else {
      var changed=false;
      // card_id — luôn update từ Sheet (giữ đúng multi-gewerk grouping)
      var sheetCardId=row.card_id||'';
      if(sheetCardId&&sheetCardId!==(local.card_id||'')){local.card_id=sheetCardId;changed=true;}
      // kieu_tinh — quan trọng cho hiển thị decimal vs integer
      if(row.kieu_tinh&&row.kieu_tinh!==local.kieu_tinh){local.kieu_tinh=row.kieu_tinh;changed=true;}
      // don_vi (m/Stk) — đơn vị đo
      var sheetDonVi=row.don_vi||'';
      if(sheetDonVi&&sheetDonVi!==(local.don_vi||'')){local.don_vi=sheetDonVi;changed=true;}
      // he_so — update ngay cả khi dirty/pending, nếu local vẫn là mặc định (1)
      // Lý do: record bị push với he_so=1 (bug cũ) thì local=1, nhưng Sheet có thể có =2
      // Chỉ không ghi đè khi user đã đặt he_so > 1 cục bộ
      var sheetHeSo=row.he_so||1;
      if(sheetHeSo!==(local.he_so||1)){
        if(local.sync_status==='synced'||(local.he_so||1)===1){
          local.he_so=sheetHeSo;changed=true;
        }
      }
      // values + ghi_chu — chỉ update nếu local đã synced (không ghi đè thay đổi đang chờ)
      if(local.sync_status==='synced'){
        var sheetTotal=(row.values||[]).reduce(function(a,b){return a+b;},0);
        var localTotal=(local.values||[]).reduce(function(a,b){return a+Number(b);},0);
        if(Math.abs(sheetTotal-localTotal)>0.001){local.values=row.values;changed=true;}
        var sheetGhi=row.ghi_chu||'';
        if(sheetGhi!==(local.ghi_chu||'')){local.ghi_chu=sheetGhi;changed=true;}
      }
      if(changed){local.updated_at=Date.now();await dbPut('dem_le',local);count++;}
    }
  }
  return count;
}

function gsRun(fn,arg){
  // Dùng fetch() → GAS API (chạy từ GitHub Pages, không cần google.script.run)
  return new Promise(function(ok,fail){
    var done=false;
    var timer=setTimeout(function(){if(!done){done=true;fail(new Error('Timeout 15s — kiểm tra mạng'));}},15000);
    function wrap(cb){return function(v){if(!done){done=true;clearTimeout(timer);cb(v);}};}
    var url,opts;
    if(fn==='serverPull'){
      url=GAS_API+'?action=pull';
      opts={method:'GET'};
    } else {
      url=GAS_API;
      // Không set Content-Type để tránh CORS preflight
      opts={method:'POST',body:JSON.stringify({action:fn,payload:arg})};
    }
    fetch(url,opts)
      .then(function(r){return r.text();})
      .then(wrap(ok))
      .catch(wrap(fail));
  });
}

async function doSync(){
  if(IS_GAS&&!navigator.onLine){
    toast('📡 Offline — dữ liệu an toàn trong máy');
    return;
  }
  var btn=document.getElementById('syncBtn');
  if(btn){btn.disabled=true;btn.textContent='Sync...';}

  try{
    if(IS_GAS){
      // ---- PULL from Google Sheet ----
      var js=await gsRun('serverPull');
      var data=JSON.parse(js);
      if(!data.success)throw new Error('Pull failed');
      for(var i=0;i<(data.phong||[]).length;i++){
        var p=data.phong[i];var ex=await dbGet('phong',p.id);
        if(!ex||ex.synced!==false){p.synced=true;p.is_new=false;await dbPut('phong',p);}
      }
      for(var i=0;i<(data.vat_lieu||[]).length;i++){data.vat_lieu[i].is_new=false;await dbPut('vat_lieu',data.vat_lieu[i]);}

      // ---- PULL dem_le từ DEM_APP (sync 2 chiều: Sheet → Device) ----
      // Nếu Sheet bị xóa (trống) → mark tất cả local records là dirty để force push lại
      if((data.dem_app||[]).length===0){
        var allLocalCheck=await dbGetAll('dem_le');
        var hadSynced=allLocalCheck.filter(function(d){return!d.deleted&&d.sync_status==='synced';});
        if(hadSynced.length>0){
          for(var i=0;i<hadSynced.length;i++){hadSynced[i].sync_status='dirty';await dbPut('dem_le',hadSynced[i]);}
          toast('Sheet trống — sẽ đẩy lại '+hadSynced.length+' records...');
        }
      }
      var pulled=await processDemApp(data.dem_app||[]);
      if(pulled>0)console.log('Pulled '+pulled+' records from Sheet');

      // ---- PUSH to Google Sheet ----
      var allD=await dbGetAll('dem_le');
      var toP=allD.filter(function(r){return!r.deleted&&(r.sync_status==='pending'||r.sync_status==='dirty');});

      // Fix 1: Sort — oldest card first, then nhom → grosse → ten_vl_german
      var _cmin={};
      toP.forEach(function(r){var cid=r.card_id||r.ma_phong;if(!_cmin[cid]||r.created_at<_cmin[cid])_cmin[cid]=r.created_at||0;});
      toP.sort(function(a,b){
        var ca=a.card_id||a.ma_phong,cb=b.card_id||b.ma_phong;
        var ta=_cmin[ca]||0,tb=_cmin[cb]||0;
        if(ta!==tb)return ta-tb;
        if(ca!==cb)return ca.localeCompare(cb);
        var nc=(a.nhom||'').localeCompare(b.nhom||'');if(nc)return nc;
        var gc=(a.grosse||'').localeCompare(b.grosse||'');if(gc)return gc;
        return(a.ten_vl_german||'').localeCompare(b.ten_vl_german||'');
      });

      var allV=await dbGetAll('vat_lieu');var newV=allV.filter(function(v){return v.is_new;});
      var allPh=await dbGetAll('phong');var newPh=allPh.filter(function(p){return p.is_new;});

      // Fix 4: Upload images FIRST so Drive URLs go into Sheet rows
      var allA=await dbGetAll('anh');
      var pendA=allA.filter(function(a){return a.sync_status==='pending'&&a.data;});
      var anhUrlsByRoom={};
      for(var i=0;i<pendA.length;i++){
        try{
          var a=pendA[i];var b64=a.data;if(b64.indexOf(',')>=0)b64=b64.split(',')[1];
          var ijs=await gsRun('serverUploadImage',JSON.stringify({ma_phong:a.ma_phong,filename:a.filename,data:b64}));
          var ires=JSON.parse(ijs);
          if(ires.success){
            a.drive_url=ires.drive_url;a.sync_status='synced';await dbPut('anh',a);
            if(!anhUrlsByRoom[a.ma_phong])anhUrlsByRoom[a.ma_phong]=[];
            anhUrlsByRoom[a.ma_phong].push({drive_url:ires.drive_url,filename:ires.filename});
          }
        }catch(ie){console.error('Img:',ie);}
      }
      // Also include already-synced images (not just uploaded now)
      var justUploadedIds=new Set(pendA.map(function(a){return a.anh_id;}));
      allA.filter(function(a){return a.sync_status==='synced'&&a.drive_url&&!justUploadedIds.has(a.anh_id);}).forEach(function(a){
        if(!anhUrlsByRoom[a.ma_phong])anhUrlsByRoom[a.ma_phong]=[];
        anhUrlsByRoom[a.ma_phong].push({drive_url:a.drive_url,filename:a.filename});
      });

      if(toP.length>0||newV.length>0||newPh.length>0){
        var payload={
          dem_le:toP.map(function(r){return{local_id:r.local_id,sheet_id:r.sheet_id,ma_phong:r.ma_phong,nhom:r.nhom,ma_vl:r.ma_vl,ten_vl_german:r.ten_vl_german,grosse:r.grosse,values:r.values,he_so:pendingHeSo[r.local_id]!==undefined?pendingHeSo[r.local_id]:(r.he_so||1),kieu_tinh:r.kieu_tinh,don_vi:r.don_vi,ghi_chu:r.ghi_chu,card_note:r.card_note||'',card_id:r.card_id||''};}),
          vat_lieu_new:newV,
          phong_new:newPh.map(function(p){return{id:p.id,ma_phong:p.ma_phong,ten_phong:p.ten_phong,tang:p.tang,khu_vuc:p.khu_vuc};}),
          anh_urls_by_room:anhUrlsByRoom
        };
        var pjs=await gsRun('serverPush',JSON.stringify(payload));
        var res=JSON.parse(pjs);
        if(res.success){
          var mapped=res.mapped_ids||{};
          for(var i=0;i<toP.length;i++){var fresh2=await dbGet('dem_le',toP[i].local_id)||toP[i];fresh2.sync_status='synced';if(mapped[toP[i].local_id])fresh2.sheet_id=mapped[toP[i].local_id];await dbPut('dem_le',fresh2);}
          for(var i=0;i<newV.length;i++){newV[i].is_new=false;await dbPut('vat_lieu',newV[i]);}
          for(var i=0;i<newPh.length;i++){newPh[i].is_new=false;newPh[i].synced=true;await dbPut('phong',newPh[i]);}
        }
      }
      toast('Sync OK!');
    } else {
      // ---- LOCAL MOCK ----
      for(var i=0;i<MOCK_PHONG.length;i++){var p=MOCK_PHONG[i];p.synced=true;p.is_new=false;var ex=await dbGet('phong',p.id);if(!ex||ex.synced!==false)await dbPut('phong',p);}
      for(var i=0;i<MOCK_VL.length;i++){MOCK_VL[i].is_new=false;await dbPut('vat_lieu',MOCK_VL[i]);}
      toast('Mock sync OK — '+MOCK_PHONG.length+' Räume');
    }
    await renderS1();
  }catch(err){
    console.error('Sync:',err);toast('Sync Fehler: '+(err.message||err));
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='&#8635;';}updateBadge();
  }
}
