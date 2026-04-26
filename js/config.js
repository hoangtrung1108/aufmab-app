// AufmaB Beta — Config & Global State
// Do NOT modify load order — loaded first

// ============================================================
// AUFMASS BETA v2 LOCAL — with mock data for testing
// ============================================================

// ---- MOCK DATA from Google Sheet ----
var MOCK_PHONG = [
  {id:"EG_041",ma_phong:"041",ten_phong:"Reinigungszentrale",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_040",ma_phong:"040",ten_phong:"Technik",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_039",ma_phong:"039",ten_phong:"Besprechungsraum Plus",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_038",ma_phong:"038",ten_phong:"Pausenraum Zteam 12",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_037",ma_phong:"037",ten_phong:"Pauseraum Team 11",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_036",ma_phong:"036",ten_phong:"Pauseraum Team10",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_035",ma_phong:"035",ten_phong:"Pausenraum Team09",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_034",ma_phong:"034",ten_phong:"Pauseraum Team08",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_033",ma_phong:"033",ten_phong:"Pausenraum Team07",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_005",ma_phong:"005",ten_phong:"BOS",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_006",ma_phong:"006",ten_phong:"4G / 5G",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_055",ma_phong:"055",ten_phong:"Büro Logistikleitstand",tang:"EG",khu_vuc:"Randbau West"},
  {id:"EG_067",ma_phong:"067",ten_phong:"BOS",tang:"EG",khu_vuc:"Randbau Ost"},
  {id:"EG_069",ma_phong:"069",ten_phong:"BMA",tang:"EG",khu_vuc:"Randbau Ost"},
  {id:"EG_Q65",ma_phong:"Q65",ten_phong:"Büro Logistikleitstand",tang:"EG",khu_vuc:"Warm Halle"},
  {id:"1.OG_101",ma_phong:"101",ten_phong:"Karosseriefertigung Büro",tang:"1.OG",khu_vuc:"Randbauwest"},
  {id:"1.OG_102",ma_phong:"102",ten_phong:"Besprechungsraum",tang:"1.OG",khu_vuc:"Randbauwest"},
  {id:"1.OG_105",ma_phong:"105",ten_phong:"Umkleide AT1 (m)",tang:"1.OG",khu_vuc:"Randbauwest"},
  {id:"1.OG_108",ma_phong:"108",ten_phong:"Umkleide Intern (m)",tang:"1.OG",khu_vuc:"Randbauwest"},
  {id:"1.OG_111",ma_phong:"111",ten_phong:"Pumi",tang:"1.OG",khu_vuc:"Randbauwest"},
  {id:"2.OG_Z1",ma_phong:"2.OG Z1",ten_phong:"2.OG_Zone1_Lüf",tang:"2.OG",khu_vuc:"Randbau West"},
  {id:"2.OG_Z2",ma_phong:"2.OG Z2",ten_phong:"2.OG_Zone2_Lüf",tang:"2.OG",khu_vuc:"Randbau West"},
  {id:"2.OG_Z3",ma_phong:"2.OG Z3",ten_phong:"2.OG_Zone3_Lüf",tang:"2.OG",khu_vuc:"Randbau West"},
];

var MOCK_VL = [
  // Heizung — từ CONG_VIEC sheet
  {ma_vl:"VL_HZG_0",nhom:"Heizung",ten_vl_german:"Bogen 45°",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_1",nhom:"Heizung",ten_vl_german:"Bogen 90°",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_2",nhom:"Heizung",ten_vl_german:"Muffe / Verbinder",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_3",nhom:"Heizung",ten_vl_german:"Reduzierung",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_4",nhom:"Heizung",ten_vl_german:"Rohrschelle",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_5",nhom:"Heizung",ten_vl_german:"Stahl Rohr - Geschweißt",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_HZG_6",nhom:"Heizung",ten_vl_german:"T - Stück - Geschweißt",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_7",nhom:"Heizung",ten_vl_german:"Ventil",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_HZG_8",nhom:"Heizung",ten_vl_german:"Conlit",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  // Kälte — từ CONG_VIEC sheet
  {ma_vl:"VL_KAL_0",nhom:"Kälte",ten_vl_german:"Bogen 45°",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_1",nhom:"Kälte",ten_vl_german:"Bogen 90°",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_2",nhom:"Kälte",ten_vl_german:"Muffe / Verbinder",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_3",nhom:"Kälte",ten_vl_german:"Reduzierung",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_4",nhom:"Kälte",ten_vl_german:"Rohrschelle",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_5",nhom:"Kälte",ten_vl_german:"Stahl Rohr - Geschweißt",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_KAL_6",nhom:"Kälte",ten_vl_german:"T - Stück - Geschweißt",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_7",nhom:"Kälte",ten_vl_german:"Ventil",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_KAL_8",nhom:"Kälte",ten_vl_german:"Conlit",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  // Befestigung (Halterung) — từ CONG_VIEC sheet
  {ma_vl:"VL_BEF_0",nhom:"Halterung",ten_vl_german:"Dübel",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_BEF_1",nhom:"Halterung",ten_vl_german:"Gewindestange",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_BEF_2",nhom:"Halterung",ten_vl_german:"Schiene M21",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_BEF_3",nhom:"Halterung",ten_vl_german:"Schiene M41",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_BEF_4",nhom:"Halterung",ten_vl_german:"Schiene M72",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_BEF_5",nhom:"Halterung",ten_vl_german:"MQA",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_BEF_6",nhom:"Halterung",ten_vl_german:"MQZ",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_BEF_7",nhom:"Halterung",ten_vl_german:"Gewindestift",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  // Lüftung — từ CONG_VIEC sheet
  {ma_vl:"VL_LUF_0",nhom:"Lüftung",ten_vl_german:"Bogen",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_1",nhom:"Lüftung",ten_vl_german:"Zwickfall Rohr",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_2",nhom:"Lüftung",ten_vl_german:"Scheller",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_3",nhom:"Lüftung",ten_vl_german:"T-Stück",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_4",nhom:"Lüftung",ten_vl_german:"VSR-K",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_5",nhom:"Lüftung",ten_vl_german:"Schalldämpfer",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_6",nhom:"Lüftung",ten_vl_german:"BSK",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_LUF_7",nhom:"Lüftung",ten_vl_german:"Reduzierung",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  // Abwasser
  {ma_vl:"VL_ABW_0",nhom:"Abwasser",ten_vl_german:"Rohr",don_vi:"m",kieu_tinh:"CO_DAI"},
  {ma_vl:"VL_ABW_1",nhom:"Abwasser",ten_vl_german:"Bogen 90°",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_ABW_2",nhom:"Abwasser",ten_vl_german:"Bogen 45°",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_ABW_3",nhom:"Abwasser",ten_vl_german:"T-Stück",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_ABW_4",nhom:"Abwasser",ten_vl_german:"Panco Verbinder",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  {ma_vl:"VL_ABW_5",nhom:"Abwasser",ten_vl_german:"Revisionsöffnung",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
  // Brandschutz
  {ma_vl:"VL_BRAND_0",nhom:"Brandschutz",ten_vl_german:"Conlit Brandschutz",don_vi:"Stk",kieu_tinh:"CHI_DEM"},
];

// DN presets per gewerk
var DN_PRESETS = {
  'Lüftung': ['DN100','DN125','DN160','DN200','DN250','DN315'],
  'Heizung': ['DN15','DN20','DN25','DN32','DN40','DN50','DN65'],
  'Kälte': ['DN15','DN20','DN25','DN32','DN40','DN50','DN65'],
  'Abwasser': ['DN50','DN70','DN90','DN100','DN110','DN125','DN150','DN200'],
  'Halterung': ['M10','M41','M42','M72'],
  'Brandschutz': ['DN100','DN125','DN150','DN200'],
  'Sanitär': ['DN10','DN15','DN20','DN25','DN32','DN40','DN50','DN65','DN80','DN100'],
  'Elektro': ['M16','M20','M25','M32','M50','M63'],
};

// ---- STATE ----
var DB_NAME='AufmaBV3';var DB_VER=1;var db=null;
var curPhong=null;
var gewCollapseState={}; // gew -> true=collapsed
var dnOpenState={};      // gew+'|'+dn -> true=open (trong summaryPanel)
var gewDeleteMode={};    // gew -> true = delete mode (show × on material rows)
var pendingHeSo={};      // local_id -> he_so value đang chờ lưu (tránh race condition blur→renderS2)
var selectedGewerke=new Set(); // cho New Card multi-select
var ALL_GEWERKE=['Lüftung','Heizung','Kälte','Abwasser','Halterung','Brandschutz','Sanitär','Elektro'];
// bsGew state
var bsGewGewerk='';      // currently selected gewerk in bsGew
var bsGewLocked=false;   // true when called from a specific gewerk's + DN button
// context menu state
var gewCtxGew='';
