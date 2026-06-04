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
      (data.vat_lieu||[]).forEach(function(v){if(v.nhom&&!ALL_GEWERKE.includes(v.nhom))ALL_GEWERKE.push(v.nhom);});
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
        var total=vals.reduce(function(a,b){return a+evalVal(b);},0);
        return total>0;
      });

      // Sort: Gewerk (ALL_GEWERKE order) → Große (numeric giảm dần) → Ten_VL_German (CONG_VIEC order)
      var _vlArr=await dbGetAll('vat_lieu');
      var _vlMap={};_vlArr.forEach(function(v,i){_vlMap[(v.nhom||'')+'|'+(v.ten_vl_german||'')]=i;});
      toP.sort(function(a,b){
        var ai=ALL_GEWERKE.indexOf(a.nhom||'');if(ai<0)ai=999;
        var bi=ALL_GEWERKE.indexOf(b.nhom||'');if(bi<0)bi=999;
        if(ai!==bi)return ai-bi;
        var ag=_grNum(a.grosse),bg=_grNum(b.grosse);if(ag!==bg)return bg-ag;
        var ak=_vlMap[(a.nhom||'')+'|'+(a.ten_vl_german||'')]||999;
        var bk=_vlMap[(b.nhom||'')+'|'+(b.ten_vl_german||'')]||999;
        return ak-bk;
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

      // Auto re-push: nếu toP rỗng nhưng room có data synced → kiểm tra sheet
      // Trường hợp: sheet bị xóa tay nhưng local vẫn synced → cần push lại
      if(toP.length===0&&pendA.length===0){
        var _hasData=allD.filter(function(r){
          if(r.deleted||r.sync_status!=='synced')return false;
          var vals=r.values||[];
          return vals.length>0&&vals.reduce(function(a,b){return a+evalVal(b);},0)>0;
        });
        if(_hasData.length>0){
          btn.textContent='Checking sheet...';
          try{
            var _chkJs=await gsRun('serverPull');
            var _chkData=JSON.parse(_chkJs);
            var _sheetRoom=(_chkData.dem_app||[]).filter(function(r){return r.ma_phong===curPhong.ma_phong;});
            if(_sheetRoom.length===0){
              // Sheet trống cho room này — reset + re-push tất cả
              for(var _i=0;_i<_hasData.length;_i++){
                _hasData[_i].sync_status='dirty';_hasData[_i].sheet_id=null;
                await dbPut('dem_le',_hasData[_i]);
              }
              toP=_hasData;
              // Re-sort
              toP.sort(function(a,b){
                var ai=ALL_GEWERKE.indexOf(a.nhom||'');if(ai<0)ai=999;
                var bi=ALL_GEWERKE.indexOf(b.nhom||'');if(bi<0)bi=999;
                if(ai!==bi)return ai-bi;
                var ag=_grNum(a.grosse),bg=_grNum(b.grosse);if(ag!==bg)return bg-ag;
                var ak=_vlMap[(a.nhom||'')+'|'+(a.ten_vl_german||'')]||999;
                var bk=_vlMap[(b.nhom||'')+'|'+(b.ten_vl_german||'')]||999;
                return ak-bk;
              });
              toast('⚡ Sheet trống — re-push '+toP.length+' records...');
            }
          }catch(_e){console.log('sheet check:',_e);}
        }
      }

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
  // Index 1: by sheet_id (existing synced records)
  var bySheetId={};
  allLocal.forEach(function(d){if(d.sheet_id)bySheetId[d.sheet_id]=d;});
  // Index 2: by combo key (pending/dirty records without sheet_id) — dùng để merge thay vì tạo duplicate
  var byCombo={};
  allLocal.forEach(function(d){
    if(!d.sheet_id&&!d.deleted){
      var k=d.ma_phong+'|'+(d.nhom||'')+'|'+(d.grosse||'')+'|'+(d.ten_vl_german||'');
      if(!byCombo[k])byCombo[k]=d; // giữ record đầu tiên
    }
  });
  var count=0;
  for(var i=0;i<demAppData.length;i++){
    var row=demAppData[i];
    if(!row.sheet_id||!row.ma_phong||!row.ten_vl_german)continue;
    if((row.values||[]).length===0)continue;
    var local=bySheetId[row.sheet_id];
    if(!local){
      // Không tìm thấy qua sheet_id — kiểm tra pending local record cùng material/phòng/DN
      var comboKey=row.ma_phong+'|'+(row.nhom||'')+'|'+(row.grosse||'')+'|'+row.ten_vl_german;
      var pendingLocal=byCombo[comboKey];
      if(pendingLocal){
        // MERGE: gán sheet_id cho pending record thay vì tạo mới → tránh duplicate
        pendingLocal.sheet_id=row.sheet_id;
        pendingLocal.card_id=row.card_id||pendingLocal.card_id||'';
        if(row.kieu_tinh)pendingLocal.kieu_tinh=row.kieu_tinh;
        if(row.don_vi)pendingLocal.don_vi=row.don_vi;
        if(row.he_so&&(pendingLocal.he_so||1)===1)pendingLocal.he_so=row.he_so;
        // Nếu local chưa có data → lấy từ sheet; nếu đã có data → giữ nguyên (user's input)
        var localTotal=(pendingLocal.values||[]).reduce(function(a,b){return a+evalVal(b);},0);
        if(localTotal===0)pendingLocal.values=row.values;
        // Chỉ mark synced nếu local values = sheet values (tức là chưa thay đổi)
        var sheetTotal=(row.values||[]).reduce(function(a,b){return a+evalVal(b);},0);
        var newLocalTotal=(pendingLocal.values||[]).reduce(function(a,b){return a+evalVal(b);},0);
        if(Math.abs(sheetTotal-newLocalTotal)<0.001)pendingLocal.sync_status='synced';
        pendingLocal.updated_at=Date.now();
        await dbPut('dem_le',pendingLocal);
        bySheetId[row.sheet_id]=pendingLocal;
        delete byCombo[comboKey]; // đã merge rồi, không merge lần nữa
        count++;
      } else {
        // Không có local pending nào → tạo record mới từ sheet
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
      }
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
        var sheetTotal=(row.values||[]).reduce(function(a,b){return a+evalVal(b);},0);
        var localTotal=(local.values||[]).reduce(function(a,b){return a+evalVal(b);},0);
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
      (data.vat_lieu||[]).forEach(function(v){if(v.nhom&&!ALL_GEWERKE.includes(v.nhom))ALL_GEWERKE.push(v.nhom);});

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

      // Sort: Gewerk (ALL_GEWERKE order) → Große (numeric giảm dần) → Ten_VL_German (CONG_VIEC order)
      var _vlArr2=await dbGetAll('vat_lieu');
      var _vlMap2={};_vlArr2.forEach(function(v,i){_vlMap2[(v.nhom||'')+'|'+(v.ten_vl_german||'')]=i;});
      toP.sort(function(a,b){
        var ai=ALL_GEWERKE.indexOf(a.nhom||'');if(ai<0)ai=999;
        var bi=ALL_GEWERKE.indexOf(b.nhom||'');if(bi<0)bi=999;
        if(ai!==bi)return ai-bi;
        var ag=_grNum(a.grosse),bg=_grNum(b.grosse);if(ag!==bg)return bg-ag;
        var ak=_vlMap2[(a.nhom||'')+'|'+(a.ten_vl_german||'')]||999;
        var bk=_vlMap2[(b.nhom||'')+'|'+(b.ten_vl_german||'')]||999;
        return ak-bk;
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
