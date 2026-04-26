// AufmaB Beta — App init (entry point)
// Depends on: all above

// ============================================================
// INIT
// ============================================================
async function init(){
  try{await openDB();}catch(e){console.error('DB:',e);return;}

  // MERGE restore: luôn kiểm tra localStorage backup — không chỉ khi IndexedDB trống
  // Fix bug: nếu IndexedDB có dữ liệu cũ (từ Sheet), các record pending/dirty trong backup vẫn cần restore
  var demCheck=await dbGetAll('dem_le');
  var bkStr=localStorage.getItem('aufmab_dem_le_bk');
  if(bkStr){
    try{
      var bkObj=JSON.parse(bkStr);
      var bkList=bkObj.data||[];
      var age=Math.round((Date.now()-(bkObj.ts||0))/60000);
      // Build map của các local_id đang có trong IndexedDB
      var existingIds={};
      demCheck.forEach(function(d){existingIds[d.local_id]=true;});
      // Lọc: chỉ restore record pending/dirty CHƯA có trong IndexedDB
      var toMerge=bkList.filter(function(d){
        return !existingIds[d.lid] && (d.ss==='pending'||d.ss==='dirty'||!d.ss);
      });
      if(toMerge.length>0){
        var merged=0;
        for(var i=0;i<toMerge.length;i++){
          var d=toMerge[i];
          await dbPut('dem_le',{
            local_id:d.lid||uuid(),sheet_id:d.sid||null,
            ma_phong:d.mp,nhom:d.nhom||'',
            ten_vl_german:d.vl,grosse:d.gs||'',
            he_so:d.heso||1,values:d.v||[],
            kieu_tinh:d.ks||'CHI_DEM',don_vi:d.du||'',
            ghi_chu:d.ghi||'',card_id:d.cid||'',
            sync_status:'pending',deleted:false,
            created_at:d.ca||Date.now(),updated_at:Date.now()
          });
          merged++;
        }
        toast('♻️ '+merged+' Einträge aus Backup wiederhergestellt! (vor '+age+' Min.)');
      } else if(demCheck.length===0){
        // IndexedDB trống hoàn toàn — restore tất cả
        var n=await restoreFromLocalStorage();
        if(n>0)toast('♻️ '+n+' Einträge wiederhergestellt (vor '+age+' Min.)');
      }
    }catch(e){console.error('init restore:',e);}
  }
  // Restore phong backup nếu cần
  var phongCheck=await dbGetAll('phong');
  if(phongCheck.length===0){
    try{var pb=localStorage.getItem('aufmab_phong_bk');if(pb){var pl=JSON.parse(pb);for(var i=0;i<pl.length;i++)await dbPut('phong',pl[i]);}}
    catch(e){console.log('phong restore err:',e);}
  }

  // Auto-backup alle 30 Sekunden + beim Schließen
  setInterval(backupToLocalStorage,30000);
  window.addEventListener('beforeunload',backupToLocalStorage);

  var phongs=await dbGetAll('phong');
  if(phongs.length===0){
    try{await doSync();}catch(e){console.error('init doSync:',e);} // first run: pull data
  } else {
    await renderS1();
    // Background pull if AppScript — update phong, vat_lieu AND dem_le từ Sheet
    if(IS_GAS){try{
      var js=await gsRun('serverPull');var data=JSON.parse(js);
      if(data.success){
        for(var i=0;i<(data.phong||[]).length;i++){var p=data.phong[i];var ex=await dbGet('phong',p.id);if(!ex||ex.synced!==false){p.synced=true;p.is_new=false;await dbPut('phong',p);}}
        for(var i=0;i<(data.vat_lieu||[]).length;i++){data.vat_lieu[i].is_new=false;await dbPut('vat_lieu',data.vat_lieu[i]);}
        // Quan trọng: cũng cập nhật dem_le từ Sheet — fix dữ liệu sai sau refresh iPad
        await processDemApp(data.dem_app||[]);
        await renderS1();
      }
    }catch(e){console.log('bg pull:',e);}}
  }
}
loadCustomData(); // Nạp Gewerk & DN tự tạo từ localStorage trước khi init
init();