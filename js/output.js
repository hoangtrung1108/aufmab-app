// AufmaB Beta — Output: Photo, Excel export, localStorage backup, Repair
// Depends on: config.js, db.js


// ============================================================
// PHOTO
// ============================================================
function makePhotoFilename(ma_phong,tang,ten_phong,seq){
  var d=new Date();
  var ds=d.getFullYear().toString()+(d.getMonth()+1).toString().padStart(2,'0')+d.getDate().toString().padStart(2,'0');
  function san(s){return (s||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');}
  var seq3=seq.toString().padStart(3,'0');
  return ds+'_AufmaB_'+san(tang)+'_'+san(ma_phong)+'_'+san(ten_phong)+'_'+seq3+'.jpg';
}
async function capturePhoto(event){
  var file=event.target.files&&event.target.files[0];if(!file)return;
  var allA=await dbGetAll('anh');
  var roomCount=allA.filter(function(a){return a.ma_phong===curPhong.ma_phong;}).length;
  var filename=makePhotoFilename(curPhong.ma_phong,curPhong.tang||'',curPhong.ten_phong||curPhong.ma_phong,roomCount+1);
  var reader=new FileReader();
  reader.onload=async function(e){
    await dbPut('anh',{anh_id:uuid(),ma_phong:curPhong.ma_phong,filename:filename,data:e.target.result,drive_url:null,sync_status:'pending'});
    toast('Foto gespeichert');updateBadge();
    photoStripOpen=true; // auto-mở strip khi có ảnh mới
    await renderPhotoStrip();
  };
  reader.readAsDataURL(file);event.target.value='';
}

// ============================================================
// PHOTO STRIP — collapsible thumbnail bar in S2
// ============================================================
var photoStripOpen=false;
async function renderPhotoStrip(){
  if(!curPhong)return;
  var strip=document.getElementById('s2PhotoStrip');
  var grid=document.getElementById('s2PhotoGrid');
  var countEl=document.getElementById('s2PhotoCount');
  if(!strip||!grid||!countEl)return;

  var allA=await dbGetAll('anh');
  var photos=allA.filter(function(a){return a.ma_phong===curPhong.ma_phong;});
  photos.sort(function(a,b){return (a.filename||'').localeCompare(b.filename||'');});

  if(photos.length===0){strip.style.display='none';return;}

  countEl.textContent=photos.length;
  strip.style.display='block';

  // Rebuild grid
  grid.innerHTML='';
  photos.forEach(function(a){
    var src=a.data||a.drive_url;if(!src)return;
    var wrap=document.createElement('div');
    wrap.style.cssText='flex-shrink:0;width:72px;height:72px;border-radius:6px;overflow:hidden;border:1.5px solid #90caf9;cursor:pointer;background:#e3f2fd;position:relative';
    var img=document.createElement('img');
    img.src=src;
    img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
    img.onerror=function(){img.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect fill="%23ccc" width="72" height="72"/><text x="36" y="40" text-anchor="middle" font-size="28">📷</text></svg>';};
    wrap.appendChild(img);
    // Badge: unsynced dot
    if(a.sync_status==='pending'){
      var dot=document.createElement('div');
      dot.style.cssText='position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:#ff5722;border:1px solid #fff';
      wrap.appendChild(dot);
    }
    wrap.onclick=function(){showPhotoModal(a);};
    grid.appendChild(wrap);
  });

  // Respect collapsed state
  grid.style.display=photoStripOpen?'flex':'none';
  var bbar=document.getElementById('bbarPhotoArrow');
  if(bbar)bbar.textContent=photoStripOpen?'\u25b2':'\u25bc';
}

function togglePhotoStrip(){
  photoStripOpen=!photoStripOpen;
  var grid=document.getElementById('s2PhotoGrid');
  var bbar=document.getElementById('bbarPhotoArrow');
  if(grid)grid.style.display=photoStripOpen?'flex':'none';
  if(bbar)bbar.textContent=photoStripOpen?'\u25b2':'\u25bc';
}

function showPhotoModal(a){
  var existing=document.getElementById('photoModal');if(existing)existing.remove();
  var src=a.data||a.drive_url;if(!src)return;
  var ov=document.createElement('div');ov.id='photoModal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px';
  // Close on tap outside image
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  // Top bar
  var bar=document.createElement('div');
  bar.style.cssText='width:100%;display:flex;align-items:center;gap:8px;margin-bottom:10px';
  var fname=document.createElement('span');fname.style.cssText='flex:1;font-size:11px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  fname.textContent=a.filename||'Foto';
  var closeBtn=document.createElement('button');
  closeBtn.textContent='✕';closeBtn.style.cssText='background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0 4px;flex-shrink:0';
  closeBtn.onclick=function(){ov.remove();};
  bar.appendChild(fname);bar.appendChild(closeBtn);ov.appendChild(bar);
  // Image
  var img=document.createElement('img');
  img.src=src;img.style.cssText='max-width:100%;max-height:80vh;border-radius:8px;object-fit:contain;touch-action:pinch-zoom';
  ov.appendChild(img);
  // Filename + status
  var info=document.createElement('div');
  info.style.cssText='margin-top:10px;font-size:11px;color:#aaa;text-align:center';
  info.textContent=(a.sync_status==='pending'?'⬆ Ausstehend (nicht synchronisiert)':'✓ Synchronisiert');
  ov.appendChild(info);
  document.body.appendChild(ov);
}


// ============================================================
// REPAIR — gộp thẻ bị tách + xóa record trùng
// ============================================================
async function repairCardIds(){
  var all=await dbGetAll('dem_le');
  var active=all.filter(function(d){return!d.deleted;});

  // Nhóm theo ma_phong
  var byRoom={};
  active.forEach(function(d){
    if(!byRoom[d.ma_phong])byRoom[d.ma_phong]=[];
    byRoom[d.ma_phong].push(d);
  });

  var fixedIds=0,removed=0;

  for(var maPhong in byRoom){
    var recs=byRoom[maPhong];

    // Bước 1: Tìm card_id "tốt nhất" cho phòng này
    // = card_id có nhiều Gewerk nhất (nhiều dấu + nhất trong phần [1])
    var bestCardId='';var bestScore=-1;
    recs.forEach(function(d){
      var parts=(d.card_id||'').split('|');
      var score=(parts[1]||'').split('+').filter(Boolean).length;
      if(score>bestScore){bestScore=score;bestCardId=d.card_id||'';}
    });

    // Nếu không có card_id multi-gewerk → tự tạo từ tất cả Gewerk trong phòng
    if(bestScore<=1){
      var gews=[];
      recs.forEach(function(d){
        var g=d.nhom||'';
        if(g&&g!=='Halterung'&&!gews.includes(g))gews.push(g);
      });
      if(gews.length>0)bestCardId=maPhong+'|'+gews.join('+');
    }
    if(!bestCardId)continue;

    // Bước 2: Dedup — cùng (nhom+grosse+ten_vl_german) → giữ record có tổng cao nhất
    var seen={};
    for(var i=0;i<recs.length;i++){
      var d=recs[i];
      var key=(d.nhom||'')+'|'+(d.grosse||'')+'|'+(d.ten_vl_german||'');
      var total=(d.values||[]).reduce(function(a,b){return a+Number(b);},0);
      if(!seen[key]){
        seen[key]={rec:d,total:total};
      } else if(total>seen[key].total){
        // Record hiện tốt hơn — xóa record cũ
        var old=seen[key].rec;
        old.deleted=true;old.sync_status='dirty';old.updated_at=Date.now();
        await dbPut('dem_le',old);removed++;
        seen[key]={rec:d,total:total};
      } else {
        // Record hiện là bản sao — xóa đi
        d.deleted=true;d.sync_status='dirty';d.updated_at=Date.now();
        await dbPut('dem_le',d);removed++;
      }
    }

    // Bước 3: Cập nhật card_id cho tất cả records còn lại
    for(var k in seen){
      var rec=seen[k].rec;
      if(!rec.deleted&&rec.card_id!==bestCardId){
        rec.card_id=bestCardId;rec.updated_at=Date.now();
        if(rec.sync_status==='synced')rec.sync_status='dirty';
        await dbPut('dem_le',rec);fixedIds++;
      }
    }
  }

  await renderS1();updateBadge();
  toast('🔧 Repair xong: '+fixedIds+' cards gộp, '+removed+' bản sao xóa');
}

async function updateBadge(){
  var allD=await dbGetAll('dem_le');var p=allD.filter(function(r){return!r.deleted&&r.sync_status!=='synced';}).length;
  var allA=await dbGetAll('anh');p+=allA.filter(function(a){return a.sync_status==='pending';}).length;
  var b=document.getElementById('syncBadge');
  if(p>0){b.textContent=p;b.style.display='inline';}else{b.style.display='none';}
  // Offline badge
  var ob=document.getElementById('offlineBadge');
  if(ob)ob.style.display=(!navigator.onLine&&IS_GAS)?'inline':'none';
}
// Cập nhật offline badge khi thay đổi trạng thái mạng
window.addEventListener('online',updateBadge);
window.addEventListener('offline',updateBadge);

// ============================================================
// EXCEL EXPORT — inline XLSX writer (no external lib, works offline)
// ============================================================
(function(){
  var crcT=(function(){var t=[];for(var i=0;i<256;i++){var c=i;for(var j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}return t;})();
  function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=(c>>>8)^crcT[(c^b[i])&0xFF];return(c^0xFFFFFFFF)>>>0;}
  function u16(n){return[n&0xff,(n>>8)&0xff];}
  function u32(n){return[n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff];}
  function toUTF8(s){var b=[];for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<0x80)b.push(c);else if(c<0x800){b.push(0xC0|(c>>6));b.push(0x80|(c&0x3F));}else if(c<0x10000){b.push(0xE0|(c>>12));b.push(0x80|((c>>6)&0x3F));b.push(0x80|(c&0x3F));}else{b.push(0xF0|(c>>18));b.push(0x80|((c>>12)&0x3F));b.push(0x80|((c>>6)&0x3F));b.push(0x80|(c&0x3F));}}return b;}
  function buildZip(files){
    var entries=[];var off=0;
    files.forEach(function(f){
      var nb=toUTF8(f.name);var db=toUTF8(f.data);var crc=crc32(db);var sz=db.length;
      var lh=[0x50,0x4B,0x03,0x04].concat(u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0)).concat(nb);
      entries.push({lo:off,lh:lh,db:db,nb:nb,crc:crc,sz:sz});
      off+=lh.length+db.length;
    });
    var cdOff=off;var cd=[];
    entries.forEach(function(e){
      var r=[0x50,0x4B,0x01,0x02].concat(u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(e.crc),u32(e.sz),u32(e.sz),u16(e.nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(e.lo)).concat(e.nb);
      cd=cd.concat(r);
    });
    var eocd=[0x50,0x4B,0x05,0x06].concat(u16(0),u16(0),u16(entries.length),u16(entries.length),u32(cd.length),u32(cdOff),u16(0));
    var all=[];entries.forEach(function(e){all=all.concat(e.lh,e.db);});
    return new Uint8Array(all.concat(cd,eocd));
  }
  function xe(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  window.buildXLSXBytes=function(headers,rows){
    var strs=[];var sm={};
    function si(s){s=String(s||'');if(sm[s]===undefined){sm[s]=strs.length;strs.push(s);}return sm[s];}
    var cols='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var wsRows=[headers].concat(rows);
    var wsXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    wsRows.forEach(function(row,ri){
      wsXml+='<row r="'+(ri+1)+'">';
      row.forEach(function(v,ci){
        var addr=cols[ci]+(ri+1);
        if(typeof v==='number'&&!isNaN(v)){wsXml+='<c r="'+addr+'"><v>'+v+'</v></c>';}
        else{wsXml+='<c r="'+addr+'" t="s"><v>'+si(v)+'</v></c>';}
      });
      wsXml+='</row>';
    });
    wsXml+='</sheetData></worksheet>';
    var ssXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+strs.length+'" uniqueCount="'+strs.length+'">';
    strs.forEach(function(s){ssXml+='<si><t xml:space="preserve">'+xe(s)+'</t></si>';});
    ssXml+='</sst>';
    var ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>';
    var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    var wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>';
    var wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="AufmaB" sheetId="1" r:id="rId1"/></sheets></workbook>';
    return buildZip([
      {name:'[Content_Types].xml',data:ct},
      {name:'_rels/.rels',data:rels},
      {name:'xl/workbook.xml',data:wb},
      {name:'xl/_rels/workbook.xml.rels',data:wbr},
      {name:'xl/worksheets/sheet1.xml',data:wsXml},
      {name:'xl/sharedStrings.xml',data:ssXml}
    ]);
  };
})();

async function exportExcel(){
  try{
    toast('Wird exportiert…');
    var demLes=await dbGetAll('dem_le');
    demLes=demLes.filter(function(d){return!d.deleted;});
    var phongs=await dbGetAll('phong');
    var phMap={};phongs.forEach(function(p){phMap[p.ma_phong]=p;});
    var headers=['Etage','Raum-Nr','Raumname','Gewerk','DN / Gruppe','Cấu kiện','Einheit','Gesamt'];
    var rows=[];
    demLes.forEach(function(d){
      var ph=phMap[d.ma_phong];
      var vals=d.values||[];
      var total=vals.reduce(function(a,b){return a+Number(b);},0);
      if(total===0)return;
      var menge=d.kieu_tinh==='CO_DAI'?Math.round(total*100)/100:Math.round(total);
      rows.push([
        ph?ph.tang:'',
        d.ma_phong||'',
        ph?ph.ten_phong:'',
        d.nhom||'',
        d.grosse||'',
        d.ten_vl_german||'',
        d.don_vi||'Stk',
        menge
      ]);
    });
    rows.sort(function(a,b){
      var ka=(a[0]+'|'+a[1]+'|'+a[3]+'|'+a[4]).toLowerCase();
      var kb=(b[0]+'|'+b[1]+'|'+b[3]+'|'+b[4]).toLowerCase();
      return ka<kb?-1:ka>kb?1:0;
    });
    if(rows.length===0){toast('Keine Daten zum Exportieren');return;}
    var bytes=window.buildXLSXBytes(headers,rows);
    var blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var d=new Date();
    var fname='AufmaB_'+d.getFullYear()+(d.getMonth()+1).toString().padStart(2,'0')+d.getDate().toString().padStart(2,'0')+'.xlsx';
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download=fname;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1500);
    toast('Excel gespeichert: '+fname+' ('+rows.length+' Zeilen)');
  }catch(ex){
    console.error('exportExcel:',ex);
    toast('Export Fehler: '+ex.message);
  }
}

// ============================================================
// FIX 3: localStorage Backup — chống mất dữ liệu khi iOS Safari xóa IndexedDB
// ============================================================
async function backupToLocalStorage(){
  try{
    var all=await dbGetAll('dem_le');
    var compact=all.filter(function(d){return!d.deleted;}).map(function(d){
      return{lid:d.local_id,sid:d.sheet_id,mp:d.ma_phong,nhom:d.nhom,
        vl:d.ten_vl_german,gs:d.grosse,v:d.values,ks:d.kieu_tinh,
        du:d.don_vi,cid:d.card_id,ss:d.sync_status,ca:d.created_at,
        heso:d.he_so||1,ghi:d.ghi_chu||''};
    });
    if(compact.length>0)localStorage.setItem('aufmab_dem_le_bk',JSON.stringify({ts:Date.now(),data:compact}));
    // Backup phong — để tên phòng không mất khi iOS xóa IndexedDB
    var phongs=await dbGetAll('phong');
    if(phongs.length>0)localStorage.setItem('aufmab_phong_bk',JSON.stringify(phongs));
  }catch(e){console.log('backup err:',e);}
}

async function restoreFromLocalStorage(){
  try{
    var bk=localStorage.getItem('aufmab_dem_le_bk');if(!bk)return 0;
    var obj=JSON.parse(bk);var list=obj.data||[];
    var restored=0;
    for(var i=0;i<list.length;i++){
      var d=list[i];
      // Mark as 'dirty' so they get pushed to Sheet on next sync
      var ss2=d.ss==='synced'?'dirty':d.ss||'pending';
      await dbPut('dem_le',{
        local_id:d.lid||uuid(),sheet_id:d.sid||null,
        ma_phong:d.mp,nhom:d.nhom||'',
        ten_vl_german:d.vl,grosse:d.gs||'',
        he_so:d.heso||1,values:d.v||[],
        kieu_tinh:d.ks||'CHI_DEM',don_vi:d.du||'',
        ghi_chu:d.ghi||'',card_id:d.cid||'',
        sync_status:ss2,deleted:false,
        created_at:d.ca||Date.now(),updated_at:Date.now()
      });
      restored++;
    }
    return restored;
  }catch(e){console.error('restore err:',e);return 0;}
}