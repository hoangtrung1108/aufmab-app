// AufmaB Beta — IndexedDB helpers + UI utilities
// Depends on: config.js

// ---- IndexedDB ----
function openDB(){
  return new Promise(function(ok,fail){
    var r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=function(e){
      var d=e.target.result;
      if(!d.objectStoreNames.contains('phong'))d.createObjectStore('phong',{keyPath:'id'});
      if(!d.objectStoreNames.contains('vat_lieu')){var s=d.createObjectStore('vat_lieu',{keyPath:'ma_vl'});s.createIndex('nhom','nhom',{unique:false});}
      if(!d.objectStoreNames.contains('dem_le')){var s=d.createObjectStore('dem_le',{keyPath:'local_id'});s.createIndex('ma_phong','ma_phong',{unique:false});s.createIndex('sync_status','sync_status',{unique:false});}
      if(!d.objectStoreNames.contains('anh')){var s=d.createObjectStore('anh',{keyPath:'anh_id'});s.createIndex('ma_phong','ma_phong',{unique:false});}
    };
    r.onsuccess=function(e){db=e.target.result;ok(db);};
    r.onerror=function(e){fail(e.target.error);};
  });
}
function dbPut(s,d){return new Promise(function(ok,fail){var tx=db.transaction(s,'readwrite');tx.objectStore(s).put(d);tx.oncomplete=ok;tx.onerror=function(e){fail(e.target.error);}});}
function dbGetAll(s){return new Promise(function(ok,fail){var tx=db.transaction(s,'readonly');var r=tx.objectStore(s).getAll();r.onsuccess=function(){ok(r.result);};r.onerror=function(e){fail(e.target.error);}});}
function dbGet(s,k){return new Promise(function(ok,fail){var tx=db.transaction(s,'readonly');var r=tx.objectStore(s).get(k);r.onsuccess=function(){ok(r.result);};r.onerror=function(e){fail(e.target.error);}});}
function dbIdx(s,idx,v){return new Promise(function(ok,fail){var tx=db.transaction(s,'readonly');var r=tx.objectStore(s).index(idx).getAll(v);r.onsuccess=function(){ok(r.result);};r.onerror=function(e){fail(e.target.error);}});}
function uuid(){return 'xxxx-xxxx-xxxx'.replace(/x/g,function(){return(Math.random()*16|0).toString(16)});}
function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2000);}
function initGewerkChips(){
  selectedGewerke.clear();
  document.getElementById('ncGewCount').textContent='';
  document.getElementById('ncCustomGewInp').value='';
  var c=document.getElementById('ncGewChips');c.innerHTML='';
  ALL_GEWERKE.forEach(function(g){
    var chip=document.createElement('button');chip.className='gew-chip';chip.textContent=g;
    chip.onclick=function(e){
      e.preventDefault();
      if(selectedGewerke.has(g)){selectedGewerke.delete(g);chip.classList.remove('sel');}
      else{selectedGewerke.add(g);chip.classList.add('sel');}
      var cnt=selectedGewerke.size;
      document.getElementById('ncGewCount').textContent=cnt>0?'('+cnt+' ausgewählt)':'';
    };
    c.appendChild(chip);
  });
}

// Tự lưu/load Gewerk và DN tự tạo vào localStorage
function saveCustomData(){
  var BUILTIN_GEW=['Lüftung','Heizung','Kälte','Abwasser','Halterung','Brandschutz','Sanitär','Elektro'];
  var BUILTIN_DN={'Lüftung':['DN100','DN125','DN160','DN200','DN250','DN315'],
    'Heizung':['DN15','DN20','DN25','DN32','DN40','DN50','DN65'],
    'Kälte':['DN15','DN20','DN25','DN32','DN40','DN50','DN65'],
    'Abwasser':['DN50','DN70','DN90','DN100','DN110','DN125','DN150','DN200'],
    'Halterung':['M10','M41','M42','M72'],'Brandschutz':['DN100','DN125','DN150','DN200'],
    'Sanitär':['DN10','DN15','DN20','DN25','DN32','DN40','DN50','DN65','DN80','DN100'],
    'Elektro':['M16','M20','M25','M32','M50','M63']};
  var extraGew=ALL_GEWERKE.filter(function(g){return!BUILTIN_GEW.includes(g);});
  var extraDN={};
  Object.keys(DN_PRESETS).forEach(function(g){
    var def=BUILTIN_DN[g]||[];
    var extra=(DN_PRESETS[g]||[]).filter(function(dn){return!def.includes(dn);});
    if(extra.length>0)extraDN[g]=extra;
  });
  localStorage.setItem('aufmab_custom',JSON.stringify({gewerke:extraGew,dns:extraDN}));
}

function loadCustomData(){
  try{
    var saved=JSON.parse(localStorage.getItem('aufmab_custom')||'{}');
    (saved.gewerke||[]).forEach(function(g){if(!ALL_GEWERKE.includes(g))ALL_GEWERKE.push(g);});
    Object.keys(saved.dns||{}).forEach(function(g){
      if(!DN_PRESETS[g])DN_PRESETS[g]=[];
      (saved.dns[g]||[]).forEach(function(dn){if(!DN_PRESETS[g].includes(dn))DN_PRESETS[g].push(dn);});
    });
  }catch(e){console.warn('loadCustomData:',e);}
}

function addCustomGewerk(){
  var name=(document.getElementById('ncCustomGewInp').value||'').trim();
  if(!name){toast('Bitte Gewerk eingeben');return;}
  var c=document.getElementById('ncGewChips');
  if(ALL_GEWERKE.includes(name)){
    // Đã tồn tại — chỉ cần select chip tương ứng
    selectedGewerke.add(name);
    c.querySelectorAll('.gew-chip').forEach(function(ch){if(ch.textContent===name)ch.classList.add('sel');});
    toast(name+' ausgewählt');
  } else {
    // Tạo mới — thêm vào ALL_GEWERKE và thêm chip
    ALL_GEWERKE.push(name);
    saveCustomData();
    var chip=document.createElement('button');chip.className='gew-chip sel';chip.textContent=name;
    chip.onclick=function(e){
      e.preventDefault();
      if(selectedGewerke.has(name)){selectedGewerke.delete(name);chip.classList.remove('sel');}
      else{selectedGewerke.add(name);chip.classList.add('sel');}
      document.getElementById('ncGewCount').textContent=selectedGewerke.size>0?'('+selectedGewerke.size+' ausgewählt)':'';
    };
    c.appendChild(chip);
    selectedGewerke.add(name);
    toast('✓ '+name+' erstellt');
  }
  document.getElementById('ncGewCount').textContent='('+selectedGewerke.size+' ausgewählt)';
  document.getElementById('ncCustomGewInp').value='';
}
function showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}
function showSheet(n){document.getElementById('ov'+n).classList.add('show');document.getElementById('bs'+n).classList.add('show');}
function closeSheet(n){document.getElementById('ov'+n).classList.remove('show');document.getElementById('bs'+n).classList.remove('show');}
function gewCls(nhom){var n=(nhom||'').toLowerCase();if(n.indexOf('luft')>=0||n.indexOf('lüft')>=0)return'luft';if(n.indexOf('heiz')>=0)return'heiz';if(n.indexOf('kält')>=0||n.indexOf('kalt')>=0||n.indexOf('käl')>=0)return'kalt';if(n.indexOf('abw')>=0)return'abw';if(n.indexOf('halt')>=0||n.indexOf('befest')>=0)return'halt';if(n.indexOf('brand')>=0)return'brand';return'other';}
