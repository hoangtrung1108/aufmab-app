// AufmaB Beta — Screen rendering (S1, S2, buildMR God Node)
// Depends on: config.js, db.js

// ============================================================
// SCREEN 1 — MEASUREMENT CARDS (Bìa list)
// ============================================================
async function renderS1(){
  var demLes=await dbGetAll('dem_le');
  demLes=demLes.filter(function(d){return!d.deleted;});

  // Group by card: ma_phong + nhom = 1 card
  var cards={};
  demLes.forEach(function(d){
    var cardKey=(d.card_id)||(d.ma_phong+'|'+(d.nhom||''));
    if(!cards[cardKey]){
      cards[cardKey]={card_id:cardKey,ma_phong:d.ma_phong,nhom:d.nhom||'',nhomSet:new Set(),note:d.card_note||'',
        dns:new Set(),mats:{},created:d.created_at};
    }
    var card=cards[cardKey];
    if(d.nhom)card.nhomSet.add(d.nhom);
    // Gom tên DN (chỉ lấy tên, không đếm)
    if(d.grosse&&d.grosse!=='Befestigung')card.dns.add(d.grosse);
    // Gom tổng số liệu thực tế theo tên cấu kiện
    var vals=d.values||[];
    if(vals.length>0){
      var total=vals.reduce(function(a,b){return a+Number(b);},0);
      if(total>0){
        var key=d.ten_vl_german;
        if(!card.mats[key])card.mats[key]={total:0,kieu_tinh:d.kieu_tinh};
        card.mats[key].total+=total;
      }
    }
    if(d.created_at<card.created)card.created=d.created_at;
  });

  // Get phong names
  var phongs=await dbGetAll('phong');
  var phMap={};phongs.forEach(function(p){phMap[p.ma_phong]=p;});

  var c=document.getElementById('s1List');c.innerHTML='';
  var cardList=Object.values(cards).sort(function(a,b){return b.created-a.created;});

  if(cardList.length===0){
    c.innerHTML='<div style="padding:40px;text-align:center;color:#999">Keine Aufma\u00dfbl\u00e4tter.<br>Dr\u00fccke <b style="font-size:20px">+</b> um ein neues Blatt zu erstellen.<br><br><span style="font-size:12px">Jedes Blatt = 1 Raum + 1 Gewerk<br>(wie eine Kartonkarte)</span></div>';
    updateBadge();return;
  }

  cardList.forEach(function(card){
    var bl=document.createElement('div');bl.className='phong-block';
    var ph=phMap[card.ma_phong];
    var roomName=ph?(ph.ma_phong+' \u2013 '+ph.ten_phong):card.ma_phong;
    var tangStr=ph?ph.tang:'';
    // Dòng DN: chỉ tên, không số đếm
    var dnStr=Array.from(card.dns).sort().join(', ');

    // Dòng tóm tắt: tổng số liệu thực tế mỗi cấu kiện
    var matParts=Object.keys(card.mats).map(function(name){
      var m=card.mats[name];
      if(m.kieu_tinh==='CO_DAI') return (Math.round(m.total*10)/10)+'m '+name;
      return Math.round(m.total)+' '+name;
    });
    var matStr=matParts.join(' \u00b7 '); // dấu · ngăn cách

    var badgesHtml=Array.from(card.nhomSet).sort().map(function(n){return '<span class="pb-badge '+gewCls(n)+'">'+esc(n)+'</span>';}).join('');
    if(!badgesHtml)badgesHtml='<span class="pb-badge">'+esc(card.nhom)+'</span>';
    bl.innerHTML='<div class="pb-top"><span class="pb-name">'+esc(roomName)+'</span>'+
      '<div class="pb-top-right">'+
        '<span class="pb-tang">'+esc(tangStr)+'</span>'+
        '<button class="pb-act-btn dup" data-action="dup" title="Nhân bản">⧉</button>'+
        '<button class="pb-act-btn del" data-action="del" title="Xóa thẻ">🗑</button>'+
      '</div></div>'+
      '<div class="pb-summary">'+badgesHtml+(dnStr?'<span style="font-size:10px;color:#888;margin-left:5px">'+esc(dnStr)+'</span>':'')+'</div>'+
      (matStr?'<div style="font-size:11px;color:#555;margin-top:3px;line-height:1.5">'+esc(matStr)+'</div>':'<div style="font-size:11px;color:#bbb;margin-top:2px">Noch keine Daten</div>');
    // Open card on click — but NOT when tapping action buttons
    bl.onclick=function(e){
      if(e.target.closest('.pb-act-btn'))return;
      openCard(card);
    };
    // Action buttons
    bl.querySelector('[data-action="del"]').onclick=function(e){
      e.stopPropagation();
      showCardConfirm('del',card);
    };
    bl.querySelector('[data-action="dup"]').onclick=function(e){
      e.stopPropagation();
      showCardConfirm('dup',card);
    };
    c.appendChild(bl);
  });
  updateBadge();
}

// Open a card
async function openCard(card){
  var all=await dbGetAll('phong');
  var ph=all.find(function(p){return p.ma_phong===card.ma_phong;});
  // Parse card_id để lấy lại danh sách Gewerke: "035|Heizung+Kälte|note"
  var parts=(card.card_id||'').split('|');
  var gewStr=parts[1]||card.nhom||'';
  var cardGewerke=gewStr.split('+').filter(Boolean);
  if(cardGewerke.length===0)cardGewerke=[card.nhom||''];
  curPhong={ma_phong:card.ma_phong,ten_phong:ph?ph.ten_phong:card.ma_phong,tang:ph?ph.tang:'',card_nhom:cardGewerke[0],card_gewerke:cardGewerke,card_id:card.card_id};
  var tenStr=(ph&&ph.ten_phong)?(card.ma_phong+' \u2013 '+ph.ten_phong):card.ma_phong;
  document.getElementById('s2Title').textContent=tenStr+' \u00b7 '+cardGewerke.join(', ');
  photoStripOpen=false;
  showScreen('s2');
  await renderS2();
}

// ============================================================
// CARD ACTIONS — Delete & Duplicate with confirmation
// ============================================================
var _ccAction=null; // current pending action: {type:'del'|'dup', card:{...}}

function showCardConfirm(type, card){
  _ccAction={type:type, card:card};
  var icon=document.getElementById('ccIcon');
  var msg=document.getElementById('ccMsg');
  var sub=document.getElementById('ccSub');
  var yes=document.getElementById('ccYes');
  // Parse card display info
  var parts=(card.card_id||'').split('|');
  var gewStr=parts[1]||card.nhom||'';
  var cardName=card.ma_phong+(gewStr?' · '+gewStr.replace(/\+/g,', '):'');
  var roomWrap=document.getElementById('ccRoomWrap');
  var roomInp=document.getElementById('ccRoomInp');
  if(type==='del'){
    icon.textContent='🗑';
    msg.textContent='Bạn có chắc muốn xóa thẻ này không?';
    sub.textContent=cardName+' — Tất cả dữ liệu trong thẻ sẽ bị xóa.';
    yes.className='cc-yes del'; yes.textContent='Có, xóa';
    roomWrap.style.display='none';
  } else {
    icon.textContent='⧉';
    msg.textContent='Nhân bản thẻ này?';
    sub.textContent='Gewerk: '+gewStr.replace(/\+/g,', ')+' — dữ liệu trống.';
    yes.className='cc-yes dup'; yes.textContent='Nhân bản';
    roomWrap.style.display='block';
    roomInp.value=card.ma_phong;
    setTimeout(function(){roomInp.focus();roomInp.select();},150);
  }
  document.getElementById('cardConfirm').classList.add('open');
}

function closeCardConfirm(){
  document.getElementById('cardConfirm').classList.remove('open');
  _ccAction=null;
}

async function executeCardAction(){
  if(!_ccAction)return;
  var type=_ccAction.type; var card=_ccAction.card;
  closeCardConfirm();
  if(type==='del') await doDeleteCard(card);
  else if(type==='dup') await doDuplicateCard(card);
}

async function doDeleteCard(card){
  var all=await dbGetAll('dem_le');
  var toDelete=all.filter(function(d){
    return !d.deleted&&(d.card_id===card.card_id);
  });
  var now=Date.now();
  for(var i=0;i<toDelete.length;i++){
    var r=toDelete[i];
    r.deleted=true; r.updated_at=now;
    if(r.sync_status==='synced') r.sync_status='dirty';
    else r.sync_status='pending';
    await dbPut('dem_le',r);
  }
  await renderS1();
}

async function doDuplicateCard(card){
  var all=await dbGetAll('dem_le');
  var originals=all.filter(function(d){
    return !d.deleted&&(d.card_id===card.card_id);
  });
  // New card_id: (possibly new) room + same Gewerk
  var parts=(card.card_id||'').split('|');
  var rawInp=(document.getElementById('ccRoomInp').value||'').trim().toUpperCase();
  var maPhong=rawInp||parts[0]||card.ma_phong;
  var gewStr=parts[1]||card.nhom||'';
  var newCardId=maPhong+'|'+gewStr+'|copy_'+Date.now();
  var now=Date.now();
  for(var i=0;i<originals.length;i++){
    var orig=originals[i];
    var newRec={};
    for(var k in orig) if(orig.hasOwnProperty(k)) newRec[k]=orig[k];
    newRec.local_id='le_'+now+'_'+i;
    newRec.card_id=newCardId;
    newRec.ma_phong=maPhong;
    newRec.values=[]; // reset counts — nhân bản thẻ trống
    newRec.he_so=orig.he_so||1;
    newRec.ghi_chu='';
    newRec.sync_status='pending';
    newRec.sheet_id=null;
    newRec.created_at=now;
    newRec.updated_at=now;
    await dbPut('dem_le',newRec);
  }
  await renderS1();
}

// Close modal on backdrop click
document.getElementById('cardConfirm').addEventListener('click',function(e){
  if(e.target===this)closeCardConfirm();
});

// Smart search — any field triggers search, select fills all 4
var selectedRoom=null;
var activeField=null;
async function smartSearch(fieldId){
  activeField=fieldId;
  var q=(document.getElementById(fieldId).value||'').toLowerCase();
  var res=document.getElementById('ncResults');

  var phongs=await dbGetAll('phong');

  // Search based on which field user is typing in — empty = show all
  var matches=phongs.filter(function(p){
    if(!q) return true; // show all when empty
    var searchText='';
    if(fieldId==='ncRoom') searchText=p.ma_phong||'';
    else if(fieldId==='ncName') searchText=p.ten_phong||'';
    else if(fieldId==='ncTang') searchText=p.tang||'';
    else if(fieldId==='ncKV') searchText=p.khu_vuc||'';
    return searchText.toLowerCase().indexOf(q)>=0;
  });

  // Deduplicate results based on field
  var seen={};var unique=[];
  matches.forEach(function(p){
    var key=p.ma_phong+'|'+p.ten_phong;
    if(!seen[key]){seen[key]=true;unique.push(p);}
  });
  unique=unique.slice(0,15);

  res.innerHTML='';res.style.display='block';

  // Position dropdown after the active field
  var fieldEl=document.getElementById(fieldId);
  fieldEl.parentNode.after(res);

  unique.forEach(function(p){
    var item=document.createElement('div');
    item.style.cssText='padding:8px 10px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px';
    item.onpointerdown=function(e){e.preventDefault();};
    item.innerHTML='<b>'+esc(p.ma_phong)+'</b> \u2013 '+esc(p.ten_phong)+' <span style="color:#888;font-size:11px">'+esc(p.tang)+' \u00b7 '+esc(p.khu_vuc)+'</span>';
    item.onclick=function(){
      selectedRoom=p;
      document.getElementById('ncRoom').value=p.ma_phong||'';
      document.getElementById('ncName').value=p.ten_phong||'';
      document.getElementById('ncTang').value=p.tang||'';
      document.getElementById('ncKV').value=p.khu_vuc||'';
      res.style.display='none';
    };
    res.appendChild(item);
  });

  if(unique.length===0){
    res.innerHTML='<div style="padding:8px;color:#888;font-size:12px">Nicht gefunden \u2014 manuell eingeben</div>';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click',function(e){
  var res=document.getElementById('ncResults');
  if(res&&!res.contains(e.target)&&e.target.id!=='ncRoom'&&e.target.id!=='ncName'&&e.target.id!=='ncTang'&&e.target.id!=='ncKV'){
    res.style.display='none';
  }
});

// Create new card
async function createCard(){
  var roomInput=document.getElementById('ncRoom').value.trim();
  var gewerkList=Array.from(selectedGewerke);
  if(gewerkList.length===0){toast('Bitte Gewerk wählen');return;}
  var gewerk=gewerkList[0]; // Gewerk đầu tiên làm primary
  var note=document.getElementById('ncNote').value.trim();
  var nameVal=document.getElementById('ncName').value.trim();
  var tangVal=document.getElementById('ncTang').value.trim();
  var kvVal=document.getElementById('ncKV').value.trim();
  if(!roomInput){toast('Raum-Nr fehlt');return;}

  var maPhong;
  if(selectedRoom){
    maPhong=selectedRoom.ma_phong;
  } else {
    // New room — user typed manually
    maPhong=roomInput;
    await dbPut('phong',{id:(tangVal||'_')+'_'+maPhong,ma_phong:maPhong,ten_phong:nameVal||maPhong,tang:tangVal,khu_vuc:kvVal,is_new:true,synced:false});
  }
  var tenPhong=nameVal||maPhong;
  // Mã hoá tất cả Gewerke vào card_id: "035|Heizung+Kälte|note"
  var cardId=maPhong+'|'+gewerkList.join('+')+(note?'|'+note:'');
  curPhong={ma_phong:maPhong,ten_phong:tenPhong,tang:tangVal,card_nhom:gewerk,card_gewerke:gewerkList,card_id:cardId,card_note:note};
  document.getElementById('s2Title').textContent=maPhong+' \u00b7 '+gewerkList.join(', ');
  closeSheet('NewCard');selectedRoom=null;selectedGewerke.clear();
  document.getElementById('ncRoom').value='';document.getElementById('ncName').value='';
  document.getElementById('ncTang').value='';document.getElementById('ncKV').value='';document.getElementById('ncNote').value='';
  showScreen('s2');await renderS2();toast('Blatt: '+tenPhong+' \u00b7 '+gewerkList.join(', '));
}

// ============================================================
// SCREEN 2 — CARD DETAIL (DN > Materials)
// ============================================================
// Keep openPhong for backward compat but redirect to card
async function openPhong(phong){
  curPhong=phong;
  document.getElementById('s2Title').textContent=phong.ma_phong+' \u2013 '+phong.ten_phong;
  showScreen('s2');
  await renderS2();
}

async function renderS2(){
  var records=await dbIdx('dem_le','ma_phong',curPhong.ma_phong);
  records=records.filter(function(r){return!r.deleted;});

  var tree={}; // nhom -> grosse -> [records]
  records.forEach(function(r){
    var g=r.nhom||'Sonstige';var dn=r.grosse||'?';
    if(!tree[g])tree[g]={};
    if(!tree[g][dn])tree[g][dn]=[];
    tree[g][dn].push(r);
  });

  // Tính tổng theo Gewerk và grand total (raw × he_so)
  function calcGewTotal(gew){
    var t=0;
    var dns=tree[gew]||{};
    Object.keys(dns).forEach(function(dn){
      dns[dn].forEach(function(r){
        var vals=r.values||[];if(!vals.length)return;
        var raw=vals.reduce(function(a,b){return a+Number(b);},0);
        t+=raw*(r.he_so||1);
      });
    });
    return t;
  }
  function fmtTotal(t){
    if(t===0)return '';
    return t===Math.floor(t)?'\u03A3\u00a0'+t:'\u03A3\u00a0'+(Math.round(t*100)/100);
  }

  var c=document.getElementById('s2Body');c.innerHTML='';
  var gewerke=Object.keys(tree).sort();

  if(gewerke.length===0){
    c.innerHTML='<div style="padding:30px;text-align:center;color:#999">Noch keine Daten.<br>Dr\u00fccke "+ Gewerk / DN"<br>z.B. L\u00fcftung + DN100</div>';
    var gt=document.getElementById('s2GrandTotal');if(gt)gt.style.display='none';
    return;
  }

  // Grand total header badge
  var grandTotal=gewerke.reduce(function(s,g){return s+calcGewTotal(g);},0);
  var gtEl=document.getElementById('s2GrandTotal');
  if(gtEl){
    if(grandTotal>0){
      gtEl.textContent=fmtTotal(grandTotal);
      gtEl.style.display='inline';
    } else {
      gtEl.style.display='none';
    }
  }

  gewerke.forEach(function(gew){
    var sec=document.createElement('div');sec.className='gew-sec';
    var hdr=document.createElement('div');hdr.className='gew-hdr '+gewCls(gew);
    var dns=Object.keys(tree[gew]).sort();
    var dnCount=dns.length;

    // Header: [Gewerk name] [flex] [+DN] [count▼] [×]
    var hdrName=document.createElement('span');hdrName.textContent=gew;
    var hdrSpacer=document.createElement('span');hdrSpacer.style.flex='1';
    var hdrAddDN=document.createElement('button');hdrAddDN.className='gew-adddn';hdrAddDN.textContent='+ DN';
    hdrAddDN.onclick=function(e){e.stopPropagation();openBsGew(gew,true);};
    var hdrCount=document.createElement('span');hdrCount.style.cssText='font-size:11px;font-weight:400;margin:0 6px';hdrCount.textContent=dnCount+' DN \u25BC';
    // Tổng Gewerk (raw × he_so)
    var gewTotal=calcGewTotal(gew);
    var hdrTotal=document.createElement('span');
    hdrTotal.style.cssText='font-size:11px;font-weight:700;background:rgba(0,0,0,0.1);border-radius:3px;padding:1px 6px;margin:0 4px;flex-shrink:0';
    hdrTotal.textContent=gewTotal>0?fmtTotal(gewTotal):'';
    hdrTotal.style.display=gewTotal>0?'inline':'none';
    // Delete mode badge in header
    var hdrDelBadge=document.createElement('span');
    hdrDelBadge.style.cssText='font-size:10px;background:rgba(198,40,40,.25);border-radius:3px;padding:1px 5px;font-weight:700;display:'+(gewDeleteMode[gew]?'inline':'none');
    hdrDelBadge.textContent='DEL';
    var hdrMenu=document.createElement('button');hdrMenu.className='gew-menu'+(gewDeleteMode[gew]?' del-on':'');
    hdrMenu.textContent='\u00b7\u00b7\u00b7';hdrMenu.title='Optionen';
    (function(g,btn){
      btn.onclick=function(e){e.stopPropagation();showGewCtx(g,btn);};
    })(gew,hdrMenu);
    hdr.style.display='flex';hdr.style.alignItems='center';
    hdr.appendChild(hdrName);hdr.appendChild(hdrSpacer);hdr.appendChild(hdrAddDN);hdr.appendChild(hdrDelBadge);hdr.appendChild(hdrTotal);hdr.appendChild(hdrCount);hdr.appendChild(hdrMenu);
    sec.appendChild(hdr);

    // ---- DN Summary Panel (vertical, shown when collapsed) ----
    var summaryPanel=document.createElement('div');
    summaryPanel.style.cssText='display:none;padding:4px 8px 6px;background:#fafafa;border-top:1px solid #eee';

    dns.forEach(function(dn){
      var recs=tree[gew][dn];

      // Build material summary text (items with data only)
      var parts=[];
      recs.forEach(function(r){
        var vals=r.values||[];if(!vals.length)return;
        var total=vals.reduce(function(a,b){return a+Number(b);},0);
        if(total===0)return;
        if(r.kieu_tinh==='CO_DAI') parts.push(total.toFixed(1)+'m '+r.ten_vl_german);
        else parts.push(Math.round(total)+' '+r.ten_vl_german);
      });

      var card=document.createElement('div');
      card.style.cssText='margin:4px 0;background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.07);overflow:hidden;';

      // Summary row (always visible)
      var sumRow=document.createElement('div');
      sumRow.style.cssText='display:flex;align-items:center;padding:7px 10px;gap:8px;cursor:pointer;user-select:none';

      var dnLabel=document.createElement('span');
      dnLabel.style.cssText='font-size:13px;font-weight:700;color:#1565c0;min-width:42px;flex-shrink:0';
      dnLabel.textContent=dn;

      var sumText=document.createElement('span');
      sumText.style.cssText='flex:1;font-size:11px;color:#666;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4';
      sumText.textContent=parts.length?parts.join('  ·  '):'';

      var arrow=document.createElement('span');
      arrow.style.cssText='font-size:13px;color:#1565c0;flex-shrink:0;transition:transform .2s';
      arrow.textContent='\u25BC';

      sumRow.appendChild(dnLabel);sumRow.appendChild(sumText);sumRow.appendChild(arrow);

      // Detail panel (materials) — restore open state across re-renders
      var detail=document.createElement('div');
      detail.style.cssText='display:none;border-top:1px solid #eee;padding:2px 4px 4px';
      recs.forEach(function(rec){detail.appendChild(buildMR(rec));});

      var dnKey=gew+'|'+dn;
      var open=dnOpenState[dnKey]||false;
      if(open){
        detail.style.display='block';
        arrow.textContent='\u25B2';
        arrow.style.color='#e65100';
      }
      sumRow.onclick=function(e){
        e.stopPropagation();
        open=!open;
        dnOpenState[dnKey]=open; // lưu lại để renderS2() sau vẫn giữ nguyên
        if(open){
          detail.style.display='block';
          arrow.textContent='\u25B2';
          arrow.style.color='#e65100';
        } else {
          detail.style.display='none';
          arrow.textContent='\u25BC';
          arrow.style.color='#1565c0';
        }
      };

      card.appendChild(sumRow);card.appendChild(detail);
      summaryPanel.appendChild(card);
    });
    sec.appendChild(summaryPanel);

    // ---- Body with all DN blocks (shown when expanded) ----
    var body=document.createElement('div');body.className='gew-body';

    // Restore collapse state
    if(gewCollapseState[gew]){
      body.classList.add('collapsed');
      summaryPanel.style.display='block';
      hdrCount.textContent=dnCount+' DN \u25B6';
    }
    hdr.onclick=function(){
      var isCollapsed=body.classList.toggle('collapsed');
      gewCollapseState[gew]=isCollapsed;
      if(isCollapsed){
        summaryPanel.style.display='block';
        hdrCount.textContent=dnCount+' DN \u25B6';
      } else {
        summaryPanel.style.display='none';
        hdrCount.textContent=dnCount+' DN \u25BC';
      }
    };

    dns.forEach(function(dn){
      var dnBlock=document.createElement('div');dnBlock.className='dn-block';
      dnBlock.setAttribute('data-dn',dn);
      dnBlock.innerHTML='<div class="dn-title">'+esc(dn)+'</div>';
      tree[gew][dn].forEach(function(rec){dnBlock.appendChild(buildMR(rec));});
      body.appendChild(dnBlock);
    });

    sec.appendChild(body);c.appendChild(sec);
  });
  // Photo strip
  renderPhotoStrip();
}

function buildMR(rec){
  var row=document.createElement('div');row.className='mr';
  var isDec=rec.kieu_tinh==='CO_DAI';
  var unit=rec.don_vi||(isDec?'m':'Stk');

  // Nút × xóa cấu kiện — bên trái, chỉ hiện khi gewerk ở delete mode
  var del=document.createElement('button');del.className='ib ib-del';del.textContent='\u00d7';del.title='L\u00f6schen';
  del.style.display=gewDeleteMode[rec.nhom]?'':'none';
  del.onclick=async function(e){
    e.stopPropagation();
    var r=await dbGet('dem_le',rec.local_id);
    if(r){r.deleted=true;r.updated_at=Date.now();if(r.sync_status==='synced')r.sync_status='dirty';await dbPut('dem_le',r);}
    await renderS2();updateBadge();
  };
  row.appendChild(del);

  // Label
  var lbl=document.createElement('span');lbl.className='mr-label';lbl.title=rec.ten_vl_german;lbl.textContent=rec.ten_vl_german;
  row.appendChild(lbl);

  // Single formula box
  var box=document.createElement('span');box.className='mr-box';box.id='tk_'+rec.local_id;

  function renderBox(editing){
    box.innerHTML='';
    if(editing){
      // iOS fix: tạo input + focus() SYNCHRONOUSLY trong user gesture context
      // Nếu focus() nằm trong .then() callback → iOS Safari không bật keyboard
      var inp=document.createElement('input');inp.type='text';inp.className='mr-box-inp';
      inp.placeholder=isDec?'3.5*2 / 2.5+1.8':'5+3*2 / (1+2)';
      inp.setAttribute('inputmode','decimal'); // 'decimal' cho số + dấu chấm, user có thể switch sang full KB
      box.appendChild(inp);
      inp.focus(); // phải synchronous — iOS kiểm tra gesture chain
      // Sau đó mới async load giá trị cũ để pre-populate
      dbGet('dem_le',rec.local_id).then(function(r){
        var vals=(r&&r.values)||rec.values||[];
        inp.value=vals.map(function(v){return isDec?Number(v).toFixed(1):Math.round(v);}).join('+');
        var len=inp.value.length;inp.setSelectionRange(len,len);
      });
      // Evaluate math expression safely — chỉ cho phép 0-9 + - * / ( ) . space
      function parseFormula(raw){
        if(!raw.trim())return[];
        // Chỉ cho pass ký tự an toàn
        var clean=raw.replace(/[^0-9+\-*/().\s]/g,'');
        if(!clean.trim())return[];
        // Nếu chỉ có + thì giữ từng phần riêng (audit trail)
        if(/^[\d.\s+]+$/.test(clean)){
          var parts=clean.split('+').map(function(s){return isDec?parseFloat(s.trim()):parseInt(s.trim());});
          return parts.filter(function(n){return!isNaN(n)&&n>0;});
        }
        // Có - * / () → evaluate toàn bộ expression
        try{
          var result=Function('"use strict";return('+clean+')')();
          if(isFinite(result)&&result>0)return[isDec?Math.round(result*100)/100:Math.round(result)];
        }catch(e){}
        return[];
      }
      async function save(){
        var raw=inp.value.trim();
        var parts=parseFormula(raw);
        var r2=await dbGet('dem_le',rec.local_id);if(!r2)return;
        r2.values=parts;r2.updated_at=Date.now();
        if(r2.sync_status==='synced')r2.sync_status='dirty';
        else if(r2.sync_status!=='dirty')r2.sync_status='pending';
        await dbPut('dem_le',r2);
        backupToLocalStorage(); // Backup ngay sau khi nhập công thức
        await renderS2();updateBadge();
      }
      inp.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();save();}if(e.key==='Escape'){renderBox(false);}};
      inp.onblur=function(e){
        var rel=e.relatedTarget;
        if(rel&&(rel.textContent==='+5'||rel.textContent==='+1'||rel.textContent==='+m'))return;
        save();
      };
    } else {
      // Display mode: async load là OK (không cần keyboard)
      dbGet('dem_le',rec.local_id).then(function(r){
        var vals=(r&&r.values)||rec.values||[];
        var total=vals.reduce(function(a,b){return a+Number(b);},0);
        box.innerHTML='';
        if(vals.length>0){
          var txt=document.createElement('span');txt.className='mr-box-txt';
          txt.textContent=vals.map(function(v){return isDec?Number(v).toFixed(1):Math.round(v);}).join('+');
          box.appendChild(txt);
          var eq=document.createElement('span');eq.className='mr-box-eq';
          eq.textContent=' = '+(isDec?total.toFixed(1):Math.round(total))+' '+unit;
          box.appendChild(eq);
        } else {
          var ph=document.createElement('span');ph.className='mr-box-ph';
          ph.textContent=isDec?'Tippen oder +m':'Tippen oder +1';
          box.appendChild(ph);
        }
      });
    }
  }
  renderBox(false);
  // Tap box OR use _edit() to enter edit mode — set synchronously so always ready
  box.onclick=function(e){e.stopPropagation();renderBox(true);};
  box._edit=function(){renderBox(true);};
  row.appendChild(box);

  // Buttons
  var btns=document.createElement('span');btns.className='mr-btns';
  if(rec.kieu_tinh==='CHI_DEM'){
    var b5=document.createElement('button');b5.className='ib ib-hold';b5.textContent='+5';
    b5.onclick=function(){tapVal(rec.local_id,5);};
    var b1=document.createElement('button');b1.className='ib ib-tap';b1.textContent='+1';
    b1.onclick=function(){tapVal(rec.local_id,1);};
    btns.appendChild(b5);btns.appendChild(b1);
  } else {
    // CO_DAI: × label + ô nhập số hệ số
    var curHeso=pendingHeSo[rec.local_id]!==undefined?pendingHeSo[rec.local_id]:(rec.he_so||1);
    var hesoWrap=document.createElement('span');
    hesoWrap.style.cssText='display:inline-flex;align-items:center;gap:2px;flex-shrink:0';
    var hesoX=document.createElement('span');
    hesoX.textContent='\u00d7';
    hesoX.style.cssText='font-size:12px;color:#e65100;font-weight:700;line-height:1';
    var hesoInp=document.createElement('input');
    hesoInp.type='number';hesoInp.min='1';hesoInp.max='99';hesoInp.step='1';
    hesoInp.value=curHeso>1?curHeso:''; // trống nếu =1 (mặc định)
    hesoInp.placeholder='1';
    hesoInp.style.cssText='width:36px;border:1.5px solid #ffcc80;border-radius:4px;padding:2px 4px;font-size:12px;color:#e65100;background:#fff3e0;text-align:center;-moz-appearance:textfield;-webkit-appearance:none';
    hesoInp.title='H\u1ec7 s\u1ed1 nh\u00e2n';
    function applyHeso(){
      var v=Math.max(1,parseInt(hesoInp.value)||1);
      hesoInp.value=v>1?v:''; // giữ trống nếu =1
      pendingHeSo[rec.local_id]=v;
      saveHeSo(rec.local_id,v);
    }
    hesoInp.onchange=applyHeso;
    hesoInp.onblur=function(e){e.stopPropagation();applyHeso();};
    hesoInp.onclick=function(e){e.stopPropagation();};
    hesoWrap.appendChild(hesoX);hesoWrap.appendChild(hesoInp);
    btns.appendChild(hesoWrap);
  }
  row.appendChild(btns);

  // Nút 📝 nhỏ — cùng hàng với btns
  var noteBtn = document.createElement('button');
  noteBtn.className = 'mr-note-btn' + (rec.ghi_chu ? ' filled' : '');
  noteBtn.title = rec.ghi_chu || 'Notiz hinzufügen';
  noteBtn.textContent = '📝';

  // Dòng thứ 2 (ẩn mặc định) — chỉ hiện khi bấm 📝
  var noteWrap = document.createElement('div');
  noteWrap.className = 'mr-note-wrap';
  var noteInp = document.createElement('input');
  noteInp.type = 'text';
  noteInp.className = 'mr-note';
  noteInp.placeholder = 'Notiz / Ghi chú...';
  noteInp.value = rec.ghi_chu || '';
  var noteOk = document.createElement('button');
  noteOk.className = 'mr-note-ok';
  noteOk.textContent = 'Ok';
  noteWrap.appendChild(noteInp);
  noteWrap.appendChild(noteOk);

  async function saveNote() {
    var r = await dbGet('dem_le', rec.local_id);
    if (!r) return;
    var v = noteInp.value.trim();
    if ((r.ghi_chu || '') !== v) {
      r.ghi_chu = v; r.updated_at = Date.now();
      if (r.sync_status === 'synced') r.sync_status = 'dirty';
      else if (r.sync_status !== 'dirty') r.sync_status = 'pending';
      await dbPut('dem_le', r); updateBadge();
    }
    noteBtn.className = 'mr-note-btn' + (v ? ' filled' : '');
    noteBtn.title = v || 'Notiz hinzufügen';
    noteWrap.classList.remove('open');
  }

  noteBtn.onclick = function(e) {
    e.stopPropagation();
    var opening = !noteWrap.classList.contains('open');
    noteWrap.classList.toggle('open');
    if (opening) { noteInp.focus(); noteInp.setSelectionRange(noteInp.value.length, noteInp.value.length); }
  };
  noteOk.onclick = function(e) { e.stopPropagation(); saveNote(); };
  noteInp.onblur = function(e) {
    if (e.relatedTarget === noteOk) return; // Ok button sẽ xử lý
    saveNote();
  };
  noteInp.onkeydown = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveNote(); }
    if (e.key === 'Escape') { noteWrap.classList.remove('open'); }
  };

  row.appendChild(noteBtn);
  row.appendChild(noteWrap);

  return row;
}

// ---- Input handlers ----
async function tapVal(lid,val){await pVal(lid,val);if(navigator.vibrate)navigator.vibrate(30);}
async function numA(lid){var inp=document.getElementById('ni_'+lid);var v=parseFloat(inp.value);if(isNaN(v)||v<=0)return;await pVal(lid,v);inp.value='';}
function addSeg(lid){
  var box=document.getElementById('tk_'+lid);
  if(box&&box._edit)box._edit();
}
async function pVal(lid,val){
  var rec=await dbGet('dem_le',lid);if(!rec)return;
  if(!rec.values)rec.values=[];rec.values.push(val);rec.updated_at=Date.now();
  if(rec.sync_status==='synced')rec.sync_status='dirty';
  else if(rec.sync_status!=='dirty')rec.sync_status='pending';
  await dbPut('dem_le',rec);
  backupToLocalStorage(); // Backup ngay sau mỗi lần nhập số
  await renderS2();updateBadge();
}
async function saveHeSo(lid,val){
  var rec=await dbGet('dem_le',lid);if(!rec)return;
  rec.he_so=val;rec.updated_at=Date.now();
  if(rec.sync_status==='synced')rec.sync_status='dirty';
  else if(rec.sync_status!=='dirty')rec.sync_status='pending';
  await dbPut('dem_le',rec);
  delete pendingHeSo[lid]; // xóa pending sau khi DB ghi xong
  backupToLocalStorage(); // Backup ngay sau khi sửa hệ số
  updateBadge();
}

// ---- Edit token ----
async function editTk(lid,idx){
  var old=document.querySelector('.tpop');if(old)old.remove();
  var rec=await dbGet('dem_le',lid);if(!rec)return;
  var strip=document.getElementById('tk_'+lid);var tks=strip.querySelectorAll('.mr-tk');var target=tks[idx];if(!target)return;
  var pop=document.createElement('div');pop.className='tpop';
  pop.innerHTML='<input type="number" step="0.1" value="'+rec.values[idx]+'"><button class="ib ib-ok" style="padding:3px 5px;font-size:11px">\u2713</button><button class="tdel">\u2717</button>';
  target.style.position='relative';target.appendChild(pop);
  pop.style.cssText='position:absolute;top:28px;left:-4px;';
  var pinp=pop.querySelector('input');pinp.focus();pinp.select();
  pop.querySelector('.ib-ok').onclick=async function(e){e.stopPropagation();var nv=parseFloat(pinp.value);if(!isNaN(nv)&&nv>=0){rec.values[idx]=nv;rec.updated_at=Date.now();if(rec.sync_status==='synced')rec.sync_status='dirty';await dbPut('dem_le',rec);await renderS2();updateBadge();}pop.remove();};
  pop.querySelector('.tdel').onclick=async function(e){e.stopPropagation();rec.values.splice(idx,1);rec.updated_at=Date.now();if(rec.sync_status==='synced')rec.sync_status='dirty';await dbPut('dem_le',rec);await renderS2();updateBadge();pop.remove();};
  setTimeout(function(){document.addEventListener('click',function cl(ev){if(!pop.contains(ev.target)&&ev.target!==target){pop.remove();document.removeEventListener('click',cl);}});},100);
}

function goS1(){showScreen('s1');renderS1();gewCollapseState={};dnOpenState={};gewDeleteMode={};}