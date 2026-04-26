// AufmaB Beta — UI interactions (addPhong, Gewerk/DN, Context Menu, S3)
// Depends on: config.js, db.js, render.js


// ============================================================
// ADD PHONG
// ============================================================
async function addPhong(){
  var ma=document.getElementById('nPhMa').value.trim();var name=document.getElementById('nPhName').value.trim();
  var tang=document.getElementById('nPhTang').value.trim();var kv=document.getElementById('nPhKV').value.trim();
  if(!ma){toast('Raum-Nr. fehlt');return;}
  await dbPut('phong',{id:tang+'_'+ma,ma_phong:ma,ten_phong:name||ma,tang:tang,khu_vuc:kv,is_new:true,synced:false});
  closeSheet('Phong');await renderS1();toast('Raum '+ma+' erstellt');
}

// ============================================================
// ADD GEWERK + DN — auto-create all materials
// ============================================================
var selectedDNsPerGew={};   // { 'Heizung': Set(['DN20','DN25']), 'Kälte': Set() }
var bsGewActiveGewerke=new Set(); // gewerke chips currently toggled ON in bsGew

// ============================================================
// GEWERK CONTEXT MENU
// ============================================================
function showGewCtx(gew,btnEl){
  gewCtxGew=gew;
  var ctx=document.getElementById('gewCtx');
  ctx.style.display='block';
  var rect=btnEl.getBoundingClientRect();
  ctx.style.top=(rect.bottom+4)+'px';
  ctx.style.right=(window.innerWidth-rect.right)+'px';
  ctx.style.left='auto';
  // Update Xóa label based on current delete mode
  var xoaItem=document.getElementById('gewCtxXoa');
  xoaItem.textContent=gewDeleteMode[gew]?'✓ Fertig (DEL beenden)':'✕ Xóa cấu kiện';
  setTimeout(function(){
    document.addEventListener('click',function cl(e){
      if(!ctx.contains(e.target)){ctx.style.display='none';document.removeEventListener('click',cl);}
    });
  },50);
}

document.getElementById('gewCtxXoa').onclick=function(){
  document.getElementById('gewCtx').style.display='none';
  gewDeleteMode[gewCtxGew]=!gewDeleteMode[gewCtxGew];
  renderS2();
};
document.getElementById('gewCtxAddDN').onclick=function(){
  document.getElementById('gewCtx').style.display='none';
  openBsGew(gewCtxGew,true);
};
document.getElementById('gewCtxAddMat').onclick=function(){
  document.getElementById('gewCtx').style.display='none';
  openNewMatSheet(gewCtxGew);
};
document.getElementById('gewCtxClone').onclick=function(){
  document.getElementById('gewCtx').style.display='none';
  toast('Nhân bản — demnächst verfügbar');
};

// ============================================================
// ADD NEW MATERIAL (from context menu → push to CONG_VIEC)
// ============================================================
var nmDonVi='Stk';

function openNewMatSheet(gew){
  document.getElementById('nmGewLabel').textContent=gew;
  document.getElementById('nmName').value='';
  nmDonVi='Stk';
  // Unit chips: m / Stk / Satz
  var c=document.getElementById('nmUnitChips');c.innerHTML='';
  ['m','Stk','Satz'].forEach(function(u){
    var chip=document.createElement('button');
    chip.className='ib '+(u===nmDonVi?'ib-hold':'ib-seg');
    chip.textContent=u;
    chip.onclick=function(e){
      e.preventDefault();nmDonVi=u;
      c.querySelectorAll('.ib').forEach(function(b){b.className='ib ib-seg';});
      chip.className='ib ib-hold';
      updateNmInfo();
    };
    c.appendChild(chip);
  });
  updateNmInfo();
  showSheet('NewMat');
  setTimeout(function(){document.getElementById('nmName').focus();},300);
}

function updateNmInfo(){
  var kieu=nmDonVi==='m'?'CO_DAI (chiều dài, mét)':'CHI_DEM (đếm số lượng)';
  document.getElementById('nmInfo').textContent='Loại tính: '+kieu;
}

async function addNewMaterial(){
  var name=document.getElementById('nmName').value.trim();
  if(!name){toast('Bitte Bauteilname eingeben');return;}
  var gew=gewCtxGew;
  var don_vi=nmDonVi;
  var kieu_tinh=(don_vi==='m')?'CO_DAI':'CHI_DEM';

  // Get all existing DNs for this gewerk in current card
  var allRecs=await dbIdx('dem_le','ma_phong',curPhong.ma_phong);
  var dnSet=new Set();
  allRecs.filter(function(r){return r.nhom===gew&&!r.deleted&&r.grosse!=='Befestigung';})
    .forEach(function(r){dnSet.add(r.grosse);});
  var dns=Array.from(dnSet);
  if(dns.length===0){toast('Keine DN für '+gew+' vorhanden');return;}

  var ma_vl='VL_NEW_'+Date.now();

  // Add to vat_lieu IndexedDB (local)
  await dbPut('vat_lieu',{ma_vl:ma_vl,nhom:gew,ten_vl_german:name,don_vi:don_vi,kieu_tinh:kieu_tinh,is_new:true});

  // Create dem_le records for each DN of this gewerk
  for(var i=0;i<dns.length;i++){
    await dbPut('dem_le',{local_id:uuid(),sheet_id:null,
      ma_phong:curPhong.ma_phong,ma_vl:ma_vl,ten_vl_german:name,
      grosse:dns[i],nhom:gew,he_so:1,values:[],
      kieu_tinh:kieu_tinh,don_vi:don_vi,ghi_chu:'',
      created_at:Date.now(),updated_at:Date.now(),
      sync_status:'pending',deleted:false,card_id:curPhong.card_id||''});
  }

  // Push to GAS
  if(IS_GAS){
    try{
      await gsRun('serverAddMaterial',JSON.stringify({nhom:gew,ten_vl_german:name,don_vi:don_vi,kieu_tinh:kieu_tinh}));
    }catch(e){console.warn('serverAddMaterial:',e);}
  }

  closeSheet('NewMat');
  await renderS2();updateBadge();
  toast(name+' → '+dns.join(', '));
}

// Open the bsGew sheet. gew=gewerk name, locked=true khi từ + DN header
function openBsGew(gew, locked){
  bsGewGewerk=gew||'';bsGewLocked=!!locked;
  selectedDNsPerGew={};bsGewActiveGewerke=new Set();
  document.getElementById('nGewDN').value='';

  var lockedDiv=document.getElementById('bsGewLocked');
  var chipsDiv=document.getElementById('bsGewChips');
  var gewFld=lockedDiv.closest('.fld');
  var cardGewerke=curPhong&&curPhong.card_gewerke;

  if(locked&&gew){
    // Locked mode (từ + DN header): chỉ 1 gewerk, không chip
    if(gewFld)gewFld.style.display='none';
    lockedDiv.style.display='none';
    chipsDiv.style.display='none';
    bsGewActiveGewerke.add(gew);
    selectedDNsPerGew[gew]=new Set();
  } else {
    // Multi-chip mode: hiện tất cả gewerk của card
    if(gewFld)gewFld.style.display='';
    lockedDiv.style.display='none';
    chipsDiv.style.display='flex';chipsDiv.innerHTML='';
    var gewerkeToShow=(cardGewerke&&cardGewerke.length>0)?cardGewerke:ALL_GEWERKE;
    // Pre-select tất cả gewerk của card
    gewerkeToShow.forEach(function(g){
      bsGewActiveGewerke.add(g);
      selectedDNsPerGew[g]=new Set();
    });
    gewerkeToShow.forEach(function(g){
      var chip=document.createElement('button');
      chip.className='gew-chip sel'; // bắt đầu tất cả đều selected
      chip.textContent=g;
      chip.onclick=function(e){
        e.preventDefault();
        if(bsGewActiveGewerke.has(g)){
          bsGewActiveGewerke.delete(g);
          chip.classList.remove('sel');
        } else {
          bsGewActiveGewerke.add(g);
          if(!selectedDNsPerGew[g])selectedDNsPerGew[g]=new Set();
          chip.classList.add('sel');
        }
        renderDNSections();
      };
      chipsDiv.appendChild(chip);
    });
  }
  renderDNSections();
  showSheet('Gew');
}

// Render one DN section per active Gewerk
function renderDNSections(){
  var container=document.getElementById('dnSections');container.innerHTML='';
  bsGewActiveGewerke.forEach(function(gew){
    if(!selectedDNsPerGew[gew])selectedDNsPerGew[gew]=new Set();
    var gwDNs=selectedDNsPerGew[gew];
    var presets=DN_PRESETS[gew]||[];
    var cls=gewCls(gew);
    // Section header — màu theo Gewerk
    var hdr=document.createElement('div');
    hdr.className='gew-hdr '+cls;
    hdr.style.cssText='padding:5px 10px;font-size:12px;font-weight:700;border-radius:6px;margin:8px 0 5px;cursor:default';
    hdr.textContent=gew;
    container.appendChild(hdr);
    // DN chip row
    var row=document.createElement('div');
    row.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:2px';
    presets.forEach(function(dn){
      var chip=document.createElement('button');chip.className='ib';
      var isSel=gwDNs.has(dn);
      chip.style.cssText='padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:2px solid '+(isSel?'#0d47a1':'transparent');
      chip.style.background=isSel?'#1565c0':'#e3f2fd';
      chip.style.color=isSel?'#fff':'#1565c0';
      chip.textContent=dn;
      chip.onclick=function(e){
        e.preventDefault();
        if(gwDNs.has(dn)){gwDNs.delete(dn);chip.style.background='#e3f2fd';chip.style.color='#1565c0';chip.style.borderColor='transparent';}
        else{gwDNs.add(dn);chip.style.background='#1565c0';chip.style.color='#fff';chip.style.borderColor='#0d47a1';}
        updateDNTotalCount();
      };
      row.appendChild(chip);
    });
    container.appendChild(row);
    // Custom DN input — để thêm kích thước mới ngoài preset
    (function(g, gwDNs){
      var addRow=document.createElement('div');
      addRow.style.cssText='display:flex;gap:5px;margin-top:5px;align-items:center';
      var dnInp=document.createElement('input');
      dnInp.type='text';dnInp.placeholder='Eigene DN...';
      dnInp.setAttribute('inputmode','text');dnInp.setAttribute('autocomplete','off');
      dnInp.style.cssText='flex:1;padding:4px 8px;border:1.5px solid #c5d8f5;border-radius:6px;font-size:12px;min-width:0';
      var addBtn=document.createElement('button');
      addBtn.textContent='+';
      addBtn.style.cssText='padding:4px 12px;background:#1565c0;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0';
      function doAddDN(){
        var dn=(dnInp.value||'').trim();if(!dn)return;
        if(!DN_PRESETS[g])DN_PRESETS[g]=[];
        if(!DN_PRESETS[g].includes(dn)){DN_PRESETS[g].push(dn);saveCustomData();}
        gwDNs.add(dn);
        renderDNSections(); // re-render để chip mới hiện
      }
      addBtn.onclick=function(e){e.preventDefault();doAddDN();};
      dnInp.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();doAddDN();}};
      addRow.appendChild(dnInp);addRow.appendChild(addBtn);
      container.appendChild(addRow);
    })(gew, gwDNs);
  });
  updateDNTotalCount();
}

function updateDNTotalCount(){
  var total=0;
  bsGewActiveGewerke.forEach(function(g){if(selectedDNsPerGew[g])total+=selectedDNsPerGew[g].size;});
  document.getElementById('dnSelectedCount').textContent=total>0?'('+total+' ausgewählt)':'';
}

// ---- S3: Material Preview state ----
// s3Items = [{ nhom, dns, mats, selectedMats }, ...]  — one per Gewerk
var s3Items=[];
var s3HaltMats=[];var s3SelectedHaltMats=new Set();

async function goToS3(){
  var manualDN=document.getElementById('nGewDN').value.trim();
  var allVL=await dbGetAll('vat_lieu');
  var items=[];
  bsGewActiveGewerke.forEach(function(gew){
    var dns=Array.from(selectedDNsPerGew[gew]||[]);
    if(manualDN&&!dns.includes(manualDN))dns.push(manualDN);
    if(dns.length===0)return; // bỏ qua gewerk không chọn DN nào
    var matching=allVL.filter(function(v){return v.nhom===gew;});
    var seen={};var unique=[];
    matching.forEach(function(v){if(!seen[v.ten_vl_german]){seen[v.ten_vl_german]=true;unique.push(v);}});
    if(unique.length===0)unique=[{ma_vl:'VL_'+gew+'_ROHR',ten_vl_german:'Rohr',don_vi:'m',kieu_tinh:'CO_DAI',nhom:gew}];
    items.push({nhom:gew,dns:dns,mats:unique,selectedMats:new Set(unique.map(function(v){return v.ma_vl||v.ten_vl_german;}))});
  });
  if(items.length===0){toast('Bitte DN auswählen');return;}

  // Halterung — hiện nếu ít nhất 1 gewerk không phải Halterung
  var hasNonHalt=items.some(function(it){return it.nhom!=='Halterung';});
  var haltMats=allVL.filter(function(v){return v.nhom==='Halterung';});
  if(haltMats.length===0)haltMats=MOCK_VL.filter(function(v){return v.nhom==='Halterung';});
  var seenH={};var uniqH=[];
  haltMats.forEach(function(v){if(!seenH[v.ten_vl_german]){seenH[v.ten_vl_german]=true;uniqH.push(v);}});

  s3Items=items;
  s3HaltMats=hasNonHalt?uniqH:[];
  s3SelectedHaltMats=new Set(uniqH.map(function(v){return v.ma_vl||v.ten_vl_german;}));

  closeSheet('Gew');showScreen('s3');
  var gewNames=items.map(function(it){return it.nhom;}).join(', ');
  var totalDN=items.reduce(function(s,it){return s+it.dns.length;},0);
  document.getElementById('s3Title').textContent=gewNames;
  document.getElementById('s3Info').textContent='\u2705 '+items.length+' Gewerk \u00b7 '+totalDN+' DN \u2014 Bỏ tick cấu kiện không cần';
  renderS3();
}

function buildS3Row(v,selSet,c){
  var key=v.ma_vl||v.ten_vl_german;
  var sel=selSet.has(key);
  var row=document.createElement('div');row.className='s3-row';
  if(!sel)row.style.opacity='0.45';
  var tog=document.createElement('button');tog.className='s3-tog '+(sel?'on':'off');
  tog.innerHTML=sel?'&#10003;':'&#9675;';
  var name=document.createElement('span');name.className='s3-name';name.textContent=v.ten_vl_german;
  var unit=document.createElement('span');unit.className='s3-unit';
  unit.textContent=v.kieu_tinh==='CO_DAI'?'\u2194 m':'# Stk';
  function doToggle(){
    if(selSet.has(key)){selSet.delete(key);tog.className='s3-tog off';tog.innerHTML='&#9675;';row.style.opacity='0.45';}
    else{selSet.add(key);tog.className='s3-tog on';tog.innerHTML='&#10003;';row.style.opacity='1';}
    updateS3Count();
  }
  row.onclick=doToggle;tog.onclick=function(e){e.stopPropagation();doToggle();};
  row.appendChild(tog);row.appendChild(name);row.appendChild(unit);
  c.appendChild(row);
}

function renderS3(){
  var c=document.getElementById('s3Body');c.innerHTML='';
  // Section per Gewerk
  s3Items.forEach(function(item){
    var cls=gewCls(item.nhom);
    var hdr=document.createElement('div');
    hdr.className='gew-hdr '+cls;
    hdr.style.cssText='padding:6px 14px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px';
    hdr.textContent=item.nhom+' \u00b7 '+item.dns.join(', ');
    c.appendChild(hdr);
    item.mats.forEach(function(v){buildS3Row(v,item.selectedMats,c);});
  });
  // Halterung / Befestigung
  if(s3HaltMats.length>0){
    var hdr2=document.createElement('div');
    hdr2.style.cssText='padding:6px 14px 4px;font-size:11px;font-weight:700;color:#e65100;background:#fff3e0;text-transform:uppercase;letter-spacing:.5px;margin-top:8px';
    hdr2.textContent='Befestigung (Halterung)';
    c.appendChild(hdr2);
    s3HaltMats.forEach(function(v){buildS3Row(v,s3SelectedHaltMats,c);});
  }
  updateS3Count();
}


function updateS3Count(){
  var totalEntries=0;
  var summary=s3Items.map(function(it){
    var entries=it.selectedMats.size*it.dns.length;
    totalEntries+=entries;
    return it.nhom+': '+it.selectedMats.size+'/'+it.mats.length+' \u00b7 '+it.dns.length+' DN';
  }).join(' | ');
  var haltCount=s3SelectedHaltMats.size;
  if(s3HaltMats.length>0){summary+=' | Halt: '+haltCount+'/'+s3HaltMats.length;totalEntries+=haltCount;}
  document.getElementById('s3Count').textContent=summary;
  document.getElementById('btnS3Ok').textContent='\u2713 '+totalEntries+' Eintr\u00e4ge erstellen';
}

function toggleAllS3(){
  var allSel=s3Items.every(function(it){return it.selectedMats.size===it.mats.length;})&&s3SelectedHaltMats.size===s3HaltMats.length;
  if(allSel){
    s3Items.forEach(function(it){it.selectedMats.clear();});
    s3SelectedHaltMats.clear();
  } else {
    s3Items.forEach(function(it){it.mats.forEach(function(v){it.selectedMats.add(v.ma_vl||v.ten_vl_german);});});
    s3HaltMats.forEach(function(v){s3SelectedHaltMats.add(v.ma_vl||v.ten_vl_german);});
  }
  renderS3();
}

function goBackFromS3(){
  showScreen('s2');
  showSheet('Gew');
}

async function confirmMaterials(){
  var btn=document.getElementById('btnS3Ok');btn.disabled=true;btn.textContent='...';
  try{
    var existing=await dbIdx('dem_le','ma_phong',curPhong.ma_phong);
    var existKeys={};existing.forEach(function(r){if(!r.deleted)existKeys[r.nhom+'|'+r.grosse+'|'+r.ten_vl_german]=true;});
    var created=0;

    // Tạo cấu kiện cho từng Gewerk + DN
    for(var ii=0;ii<s3Items.length;ii++){
      var item=s3Items[ii];
      var nhom=item.nhom;
      var dnList=item.dns;
      var selMats=item.mats.filter(function(v){return item.selectedMats.has(v.ma_vl||v.ten_vl_german);});
      for(var di=0;di<dnList.length;di++){
        var dn=dnList[di];
        for(var i=0;i<selMats.length;i++){
          var v=selMats[i];
          if(existKeys[nhom+'|'+dn+'|'+v.ten_vl_german])continue;
          await dbPut('dem_le',{local_id:uuid(),sheet_id:null,ma_phong:curPhong.ma_phong,ma_vl:v.ma_vl||'',ten_vl_german:v.ten_vl_german,grosse:dn,nhom:nhom,he_so:1,values:[],kieu_tinh:v.kieu_tinh,don_vi:v.don_vi||'',ghi_chu:'',created_at:Date.now(),updated_at:Date.now(),sync_status:'pending',deleted:false,card_id:curPhong.card_id||''});
          created++;
        }
      }
    }

    // Halterung (Befestigung) — tạo 1 lần nếu có
    var haltAdded=0;
    var hasNonHalt=s3Items.some(function(it){return it.nhom!=='Halterung';});
    if(hasNonHalt&&s3HaltMats.length>0){
      var selHalt=s3HaltMats.filter(function(v){return s3SelectedHaltMats.has(v.ma_vl||v.ten_vl_german);});
      for(var j=0;j<selHalt.length;j++){
        var h=selHalt[j];
        if(existKeys['Halterung|Befestigung|'+h.ten_vl_german])continue;
        await dbPut('dem_le',{local_id:uuid(),sheet_id:null,ma_phong:curPhong.ma_phong,ma_vl:h.ma_vl||'',ten_vl_german:h.ten_vl_german,grosse:'Befestigung',nhom:'Halterung',he_so:1,values:[],kieu_tinh:h.kieu_tinh,don_vi:h.don_vi||'',ghi_chu:'',created_at:Date.now(),updated_at:Date.now(),sync_status:'pending',deleted:false,card_id:curPhong.card_id||''});
        haltAdded++;
      }
    }

    selectedDNsPerGew={};document.getElementById('nGewDN').value='';
    showScreen('s2');await renderS2();updateBadge();
    var msg=created+' Materialien erstellt';
    if(haltAdded>0)msg+=' + Halterung ('+haltAdded+')';
    toast(msg);
  }catch(e){
    console.error('confirmMaterials:',e);
    toast('Fehler beim Erstellen: '+(e.message||e));
  }finally{
    btn.disabled=false;updateS3Count();
  }
}