/* ============================================================
   介面 / 狀態
   ============================================================ */
if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    r=Math.min(r,w/2,h/2); this.moveTo(x+r,y);
    this.arcTo(x+w,y,x+w,y+h,r); this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r); this.arcTo(x,y,x+w,y,r); this.closePath(); return this;};
}
const OFFS=[-12,-11,-10,-9.5,-9,-8,-7,-6,-5,-4,-3.5,-3,-2,-1,0,1,2,3,3.5,4,4.5,5,5.5,5.75,
            6,6.5,7,8,8.75,9,9.5,10,10.5,11,12,12.75,13,14];
const $=id=>document.getElementById(id);
const root=document.documentElement;

const I18N={zh:{
 title:'月相觀測模擬器', sub:'同一時刻、不同地點，月亮長得不一樣',
 scen:'情境', share:'連結', alt:'高度', az:'方位', illum:'照明', age:'月齡',
 timeTitle:'時間（觀測點 A 當地）', drivesGeom:'· 決定日–地–月幾何',
 aDrives:'上方時間即為此處的當地時間', sameInstant:'同 A',
 yy:'年',mm:'月',dd:'日',hh:'時',mi:'分',ss:'秒',tz:'時區', now:'現在',
 setTo:'點擊設為', toA:'看 A', toB:'看 B', spin:'自轉', labels:'城市',
 subsolar:'日下點', sublunar:'月下點',
 tabSky:'天空', tabGeo:'幾何', tabTbl:'數據', tabNote:'說明',
 country:'國家 / 地區', customC:'—（自訂座標）', custom:'自訂位置',
 auto:'當地時區', autoLon:'依經度',
 copied:'連結已複製', copyFail:'無法複製，請手動複製網址', gpsFail:'無法取得定位',
 below:'地平線下', daylit:'白天（低對比）',
 dirs:['北','北北東','東北','東北東','東','東南東','東南','南南東','南','南南西','西南','西南西','西','西北西','西北','北北西'],
 ph:{new:'朔（新月）',wxc:'眉月',fq:'上弦月',wxg:'盈凸月',full:'望（滿月）',wng:'虧凸月',lq:'下弦月',wnc:'殘月'},
 rows:{obs:'觀測點',loc:'地點',coord:'座標',ltime:'當地時間',utc:'世界時 UTC',
  moon:'月亮',malt:'視高度',maz:'方位角',limb:'亮面朝向 ↻自天頂',pole:'天北極 ↻自天頂',
  ill:'照明率',agep:'月齡 / 相位',pang:'相位角',elo:'日月距角',lib:'天平動 經/緯',
  dist:'地心距 / 視直徑',rs:'月出 / 中天 / 月落',
  sky:'太陽與天色',salt:'太陽高度',saz:'太陽方位',state:'天色',vis:'可見性'},
 skies:['夜晚','天文曙暮光','航海曙暮光','民用曙暮光','白天'],
 visOK:'地平線上', visNo:'地平線下（看不到）', up:'整天在上', down:'整天在下',
 notesHtml:`<b>為什麼兩地的月亮不一樣？</b>
 <ul>
 <li><b>相位（照明率）幾乎相同</b>：月相由太陽–地球–月球的夾角決定，地球直徑只有月距的 1/30，所以全球同一時刻看到的盈虧幾乎一致。</li>
 <li><b>但「轉向」完全不同</b>：月亮的亮面朝著太陽，而你抬頭看天是以<span class="k">天頂</span>為上。各地天頂方向不同，於是同一刻的月亮在北半球與南半球上下顛倒，在赤道則像一艘「<b>船</b>」。月面圖上的 <b>Z</b>（天頂）、<b>N</b>（天北極）、<b>☉</b>（亮面方向）三個刻度就是在標示這件事。</li>
 <li><b>天平動</b>：月球自轉與公轉同步，但軌道是橢圓且轉軸微傾，我們能前後左右多看到約 ±8°，累計可見約 59% 的月面。</li>
 <li><b>可見與否</b>：同一時刻，一地月亮高掛、另一地可能還在地平線下。月出月落與天色都在「數據」頁。</li>
 <li><b>視直徑</b>：近地點與遠地點相差約 12%；在天頂看比在地平線看近約 1.7%（站心視差）。</li>
 </ul>
 <b>操作</b>
 <ul>
 <li>地球可拖曳旋轉、滾輪或雙指縮放；<b>直接點城市名稱</b>即可設為觀測點，點其他位置則設為自訂座標。放大後會顯示更多城市。</li>
 <li>上方時間決定整個日–地–月幾何；B 預設與 A 同一時刻，取消勾選可比較不同時間。</li>
 </ul>
 <b>精度與資料來源</b>
 <ul>
 <li>月球位置採 Meeus《Astronomical Algorithms》第 47 章 ELP-2000/82 截斷級數（約 10 角秒），太陽第 25 章，含章動與 ΔT。</li>
 <li>月面座標以 Cassini 定律建立本體座標系，含光學天平動（未含 &lt;0.04° 的物理天平動）。</li>
 <li>地球貼圖為 NASA Blue Marble Next Generation 衛星影像 2048×1024（無雲、含海底地形），採 mipmap LOD、分塊時間切片與 Web Worker 並行著色（不支援時自動退回單執行緒分塊）。</li>
 <li>月面貼圖來自 three.js 範例素材。所有貼圖已內嵌於本檔，離線可用。</li>
 </ul>`
},en:{
 title:'Moon View Simulator', sub:'Same moment, different places — the Moon looks different',
 scen:'Scenarios', share:'Link', alt:'Alt', az:'Az', illum:'Illum', age:'Age',
 timeTitle:'Time (local at observer A)', drivesGeom:'· drives Sun–Earth–Moon geometry',
 aDrives:'the time above is this observer’s local time', sameInstant:'Sync A',
 yy:'Year',mm:'Mon',dd:'Day',hh:'Hour',mi:'Min',ss:'Sec',tz:'Zone', now:'Now',
 setTo:'Tap sets', toA:'Go A', toB:'Go B', spin:'Spin', labels:'Cities',
 subsolar:'Subsolar', sublunar:'Sublunar',
 tabSky:'Sky', tabGeo:'Geometry', tabTbl:'Data', tabNote:'Notes',
 country:'Country / region', customC:'— (custom)', custom:'Custom location',
 auto:'Local zone', autoLon:'By longitude',
 copied:'Link copied', copyFail:'Copy failed — copy the URL manually', gpsFail:'Location unavailable',
 below:'Below horizon', daylit:'Daylight (low contrast)',
 dirs:['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'],
 ph:{new:'New Moon',wxc:'Waxing Crescent',fq:'First Quarter',wxg:'Waxing Gibbous',
     full:'Full Moon',wng:'Waning Gibbous',lq:'Last Quarter',wnc:'Waning Crescent'},
 rows:{obs:'Observer',loc:'Place',coord:'Coordinates',ltime:'Local time',utc:'UTC',
  moon:'Moon',malt:'Apparent altitude',maz:'Azimuth',limb:'Bright limb ↻from zenith',pole:'Celestial N ↻from zenith',
  ill:'Illuminated',agep:'Age / phase',pang:'Phase angle',elo:'Elongation',lib:'Libration lon/lat',
  dist:'Distance / ang. diameter',rs:'Rise / transit / set',
  sky:'Sun & sky',salt:'Sun altitude',saz:'Sun azimuth',state:'Sky',vis:'Visibility'},
 skies:['Night','Astronomical twilight','Nautical twilight','Civil twilight','Daylight'],
 visOK:'Above horizon', visNo:'Below horizon (not visible)', up:'Up all day', down:'Down all day',
 notesHtml:`<b>Why does the Moon look different in two places?</b>
 <ul>
 <li><b>The phase is essentially identical.</b> Illumination depends on the Sun–Earth–Moon angle; Earth is only 1/30 of the Earth–Moon distance across, so everyone sees the same fraction lit at a given instant.</li>
 <li><b>But the orientation is not.</b> The bright side points at the Sun while you see the sky with your <span class="k">zenith</span> up. Different places have different zenith directions, so the same Moon appears rotated — flipped between hemispheres and like a "<b>boat</b>" near the equator. The <b>Z</b> (zenith), <b>N</b> (celestial north) and <b>☉</b> (sunward) ticks around each Moon show exactly that.</li>
 <li><b>Libration.</b> Rotation is synchronous, but the orbit is elliptical and slightly tilted, so the Moon rocks by about ±8° and 59% of its surface becomes visible over time.</li>
 <li><b>Visibility.</b> At one instant the Moon can be high for one observer and below the horizon for the other. Rise/transit/set and sky brightness are on the Data tab.</li>
 <li><b>Angular size</b> varies ~12% between perigee and apogee, and ~1.7% between horizon and zenith.</li>
 </ul>
 <b>Controls</b>
 <ul>
 <li>Drag the globe to rotate, wheel/pinch to zoom. <b>Tap a city name</b> to set that observer; tap anywhere else for custom coordinates. Zooming in reveals more cities.</li>
 <li>The time above drives the whole Sun–Earth–Moon geometry. B defaults to the same instant as A; uncheck to compare different times.</li>
 </ul>
 <b>Accuracy & sources</b>
 <ul>
 <li>Moon: Meeus, <i>Astronomical Algorithms</i> ch. 47 (truncated ELP-2000/82, ~10&Prime;). Sun: ch. 25. Nutation and ΔT included.</li>
 <li>Lunar orientation from Cassini's laws (optical libration; physical libration &lt;0.04° omitted).</li>
 <li>Earth texture: NASA Blue Marble Next Generation 2048×1024 (cloud-free, with bathymetry), drawn with mipmap LOD, time-sliced chunked shading and Web&nbsp;Worker parallelism (falls back to single-threaded chunks).</li>
 <li>Moon texture from the three.js example assets. All textures are embedded in this file — works offline.</li>
 </ul>`
}};
let T=I18N.zh;

const ST={lang:'zh',target:'A',trueSize:true,play:false,speed:3600,
  playB:false,speedB:3600,syncB:true,scen:0,tab:null,
  A:{name:0,lat:25.0330,lon:121.5654,tz:'Asia/Taipei',off:'auto',y:2026,mo:1,d:1,h:20,mi:0,s:0},
  B:{name:0,lat:-33.8688,lon:151.2093,tz:'Australia/Sydney',off:'auto',y:2026,mo:1,d:1,h:23,mi:0,s:0},
  A2:{z:1,ox:0,oy:0}, B2:{z:1,ox:0,oy:0},
  view:{lat:10,lon:130,zoom:1,spin:false,labels:true,padBottom:32}};
ST.B.name=cityIndex('雪梨'); ST.A.name=cityIndex('臺北');

/* ---------- 時區 ---------- */
function tzOffAt(tz,ms){
  try{
    const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,year:'numeric',month:'2-digit',
      day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const o={}; for(const p of f.formatToParts(new Date(ms))) o[p.type]=p.value;
    let hh=+o.hour; if(hh===24)hh=0;
    return Math.round((Date.UTC(+o.year,+o.month-1,+o.day,hh,+o.minute,+o.second)-ms)/60000)/60;
  }catch(e){return null;}
}
const lonOff=v=>Math.round(v.lon/15);
function offFromLocal(v){
  if(v.off!=='auto')return +v.off;
  if(!v.tz)return lonOff(v);
  let base=Date.UTC(v.y,v.mo-1,v.d,v.h,v.mi,Math.round(v.s));
  if(v.y>=0&&v.y<100){const d=new Date(base);d.setUTCFullYear(v.y);base=d.getTime();}
  let off=0;
  for(let i=0;i<3;i++){const r=tzOffAt(v.tz,base-off*3600000); if(r===null)return lonOff(v); off=r;}
  return off;
}
function offAtJD(v,jd){
  if(v.off!=='auto')return +v.off;
  if(!v.tz)return lonOff(v);
  const r=tzOffAt(v.tz,(jd-2440587.5)*86400000);
  return r===null?lonOff(v):r;
}
const jdOf=v=>jdFromUTC(v.y,v.mo,v.d,v.h,v.mi,v.s)-offFromLocal(v)/24;
function setFromJD(v,jd){const u=jdToUTC(jd+offAtJD(v,jd)/24);
  v.y=u.y;v.mo=u.mo;v.d=u.d;v.h=u.h;v.mi=u.mi;v.s=u.s;}
function normFields(v){const u=jdToUTC(jdFromUTC(v.y,v.mo,v.d,v.h,v.mi,v.s));
  v.y=u.y;v.mo=u.mo;v.d=u.d;v.h=u.h;v.mi=u.mi;v.s=u.s;}
function applySync(){ if(ST.syncB) setFromJD(ST.B,jdOf(ST.A)); }

/* ---------- 格式 ---------- */
const p2=n=>String(n).padStart(2,'0');
const fmtT=v=>v.y+'-'+p2(v.mo)+'-'+p2(v.d)+' '+p2(v.h)+':'+p2(v.mi)+':'+p2(Math.round(v.s));
const fmtOff=o=>{const s=o<0?'−':'+',a=Math.abs(o);return 'UTC'+s+p2(Math.floor(a))+':'+p2(Math.round((a%1)*60));};
const fmtOffS=o=>{const s=o<0?'−':'+',a=Math.abs(o),m=Math.round((a%1)*60);
  return s+Math.floor(a)+(m?':'+p2(m):'');};
const fmtJD=jd=>fmtT(jdToUTC(jd));
const hm=jd=>{const u=jdToUTC(jd+0.5/1440);return p2(u.h)+':'+p2(u.mi);};
const dirName=az=>T.dirs[Math.round(n360(az)/22.5)%16];
const fmtLL=(la,lo)=>Math.abs(la).toFixed(3)+'°'+(la>=0?'N':'S')+' '+Math.abs(lo).toFixed(3)+'°'+(lo>=0?'E':'W');
const skyIdx=a=>a>=-0.833?4:a>=-6?3:a>=-12?2:a>=-18?1:0;
const cName=i=>i<0||i==null?T.custom:(ST.lang==='en'?CITIES[i][1]:CITIES[i][0]);
const coName=i=>ST.lang==='en'?COUNTRIES[i][1]:COUNTRIES[i][0];

/* ---------- 版面尺寸 ---------- */
let layoutBusy=false;
const isLand=()=>matchMedia('(min-aspect-ratio:11/10)').matches;
function fitLayout(){
  if(layoutBusy)return; layoutBusy=true;
  const gp=$('gpane').getBoundingClientRect(), land=isLand();
  const dh=land?Math.round(clamp(gp.height*0.46,150,300))
               :Math.round(clamp($('main').clientHeight*0.62,220,560));
  root.style.setProperty('--drawerh',dh+'px');
  ST.view.padBottom=32+(ST.tab&&land?Math.round(dh*0.8):0);
  const uA=$('unitA'),uB=$('unitB');
  const chA=uA.offsetHeight-$('cwA').offsetHeight-$('ugA').offsetHeight+6;
  const chB=uB.offsetHeight-$('cwB').offsetHeight-$('ugB').offsetHeight+6;
  const innerW=uA.clientWidth-16;
  let w;
  if(land){
    const avail=$('side').clientHeight-chA-chB-16;
    w=Math.min(innerW,380,Math.max(142,avail/2));
  }else{
    const avail=$('main').clientHeight*0.62-Math.max(chA,chB)-10;
    w=Math.min(innerW,380,Math.max(132,avail));
  }
  w=Math.round(w);
  const cur=parseFloat(getComputedStyle(root).getPropertyValue('--moonw'))||0;
  if(Math.abs(cur-w)>1) root.style.setProperty('--moonw',w+'px');
  layoutBusy=false;
}
function fit(cv,maxW,rect){
  const r=rect||cv.getBoundingClientRect(); if(!r.width||!r.height)return false;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  let w=Math.round(r.width*dpr), h=Math.round(r.height*dpr);
  if(maxW&&w>maxW){const k=maxW/w;w=Math.round(w*k);h=Math.round(h*k);}
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;return true;}
  return false;
}
function sizeAll(){
  dropAvoid();
  fit($('globe'),GE.mode==='worker'?1440:1100);
  fit($('moonA'),640); fit($('moonB'),640);
  if(ST.tab==='sky'){
    const p=document.querySelector('.dpanel[data-p="sky"]');
    const w=p.clientWidth-22;
    if(w>10){ for(const id of ['skyA','skyB']){ const c=$(id);
      c.style.height=Math.round(clamp(w*0.24,58,92))+'px'; c.style.width='100%'; fit(c,760); } }
  }
  if(ST.tab==='geo'){
    const wrap=$('geoWrap'), g=$('geo');
    const w=wrap.clientWidth, h=Math.round(Math.min(wrap.clientHeight, w*0.58));
    if(w>10&&h>10){ g.style.width=w+'px'; g.style.height=h+'px'; fit(g,900); }
  }
}

/* ---------- 主更新 ---------- */
let scene=null,sceneB=null,obA=null,obB=null,rsCache=null,tblT=0;
function refresh(opt){
  opt=opt||{};
  const jdA=jdOf(ST.A);
  scene=buildScene(jdA);
  obA=observe(scene,ST.A.lat,ST.A.lon,0);
  const jdB=ST.syncB?jdA:jdOf(ST.B);
  sceneB=ST.syncB?scene:buildScene(jdB);
  obB=observe(sceneB,ST.B.lat,ST.B.lon,0);
  rsCache=null;
  drawAll(opt.q);
  updateText();
  if(!opt.noHash) queueHash();
}
let AVOID=null;
const dropAvoid=()=>{AVOID=null;};
function overlayAvoid(){
  if(AVOID)return AVOID;
  const cv=$('globe'), r=cv.getBoundingClientRect(), s=cv.width/(r.width||1), out=[];
  for(const sel of ['.gov.tl','.gov.tr','#legend','#tabbar']){
    const e=document.querySelector(sel); if(!e)continue;
    const b=e.getBoundingClientRect(); if(!b.width||!b.height)continue;
    out.push({x:(b.left-r.left)*s,y:(b.top-r.top)*s,w:b.width*s,h:b.height*s});
  }
  AVOID=out; return out;
}
const marksOf=()=>{ST.view.sel=[ST.A.name,ST.B.name]; ST.view.avoid=overlayAvoid();
  return [{lat:ST.A.lat,lon:ST.A.lon,col:'#45d9e8',label:'A'},
          {lat:ST.B.lat,lon:ST.B.lon,col:'#ffb35c',label:'B'}];};
function moonOpt(t){const m=ST[t+'2'];
  return {trueSize:ST.trueSize,zoom:m.z,ox:m.ox,oy:m.oy};}
function drawMoon(t){
  renderMoon($('moon'+t),t==='A'?obA:obB,t==='A'?scene:sceneB,moonOpt(t));
  const m=ST[t+'2'], on=m.z>1.001;
  $('mzl'+t).hidden=!on; $('mzr'+t).hidden=!on;
  if(on)$('mzl'+t).textContent=m.z.toFixed(1)+'\u00d7';
  $('cw'+t).classList.toggle('pan',on);
}
function drawAll(q){
  drawMoon('A'); drawMoon('B');
  renderGlobe($('globe'),scene,ST.view,marksOf(),q,ST.lang);
  if(ST.tab==='sky'){renderSkyStrip($('skyA'),obA,scene,ST.lang);renderSkyStrip($('skyB'),obB,sceneB,ST.lang);}
  if(ST.tab==='geo')renderGeo($('geo'),scene,[{ob:obA,col:'#45d9e8',label:'A'},{ob:obB,col:'#ffb35c',label:'B'}],ST.lang);
}
const drawGlobeOnly=q=>renderGlobe($('globe'),scene,ST.view,marksOf(),q,ST.lang);
function updateText(){
  const set=(k,v)=>{const e=$(k); if(e&&e.textContent!==v)e.textContent=v;};
  for(const [t,v,ob,sc] of [['A',ST.A,obA,scene],['B',ST.B,obB,sceneB]]){
    if($('time'+t)){
      const off=offFromLocal(v);
      set('time'+t, innerWidth<640
        ? p2(v.mo)+'-'+p2(v.d)+' '+p2(v.h)+':'+p2(v.mi)+' '+fmtOffS(off)
        : fmtT(v)+'  '+fmtOff(off));
    }
    set('s'+t+'alt',ob.alt.toFixed(1)+'°');
    set('s'+t+'az',ob.az.toFixed(0)+'° '+dirName(ob.az));
    set('s'+t+'il',(ob.k*100).toFixed(1)+'%');
    set('s'+t+'age',sc.age.toFixed(1)+'d');
    const b=$('badge'+t);
    if(ob.alt<0){b.hidden=false;b.className='mbadge warn';b.textContent=T.below;}
    else if(ob.sunAlt>-0.5){b.hidden=false;b.className='mbadge';b.textContent=T.daylit;}
    else b.hidden=true;
  }
  $('gInfo').textContent='UTC '+fmtJD(scene.jdUT)+'  ·  '+(GE.stat||'…');
  const now=performance.now();
  if(ST.tab==='tbl'&&(!ST.play||now-tblT>300)){tblT=now;buildTable();}
}
function buildTable(){
  if(!scene)return;
  const R=T.rows;
  if(!rsCache&&!ST.play){
    const mk=(v,jd)=>{const off=offAtJD(v,jd),u=jdToUTC(jd+off/24);
      return {off,rs:riseSet(v.lat,v.lon,jdFromUTC(u.y,u.mo,u.d,0,0,0)-off/24,'moon')};};
    rsCache={A:mk(ST.A,jdOf(ST.A)),B:mk(ST.B,ST.syncB?jdOf(ST.A):jdOf(ST.B))};
  }
  const rsTxt=c=>{
    if(!c)return '…';
    const r=c.rs,off=c.off;
    if(r.alwaysUp)return T.up; if(r.alwaysDown)return T.down;
    const f=j=>j===null?'—':hm(j+off/24);
    return f(r.rise)+' / '+f(r.transit)+' / '+f(r.set);
  };
  const rows=[];
  const grp=t=>rows.push('<tr class="grp"><th colspan="3">'+t+'</th></tr>');
  const row=(l,a,b)=>rows.push('<tr><th>'+l+'</th><td class="a">'+a+'</td><td class="b">'+b+'</td></tr>');
  rows.push('<thead><tr><th></th><td class="a">A</td><td class="b">B</td></tr></thead>');
  grp(R.obs);
  row(R.loc,cName(ST.A.name),cName(ST.B.name));
  row(R.coord,fmtLL(ST.A.lat,ST.A.lon),fmtLL(ST.B.lat,ST.B.lon));
  row(R.ltime,fmtT(ST.A)+'<br><span style="color:var(--dim2)">'+fmtOff(offFromLocal(ST.A))+'</span>',
               fmtT(ST.B)+'<br><span style="color:var(--dim2)">'+fmtOff(offFromLocal(ST.B))+'</span>');
  row(R.utc,fmtJD(scene.jdUT),fmtJD(sceneB.jdUT));
  grp(R.moon);
  row(R.malt,obA.alt.toFixed(2)+'°',obB.alt.toFixed(2)+'°');
  row(R.maz,obA.az.toFixed(1)+'° '+dirName(obA.az),obB.az.toFixed(1)+'° '+dirName(obB.az));
  row(R.limb,obA.limbAng.toFixed(1)+'°',obB.limbAng.toFixed(1)+'°');
  row(R.pole,obA.poleAng.toFixed(1)+'°',obB.poleAng.toFixed(1)+'°');
  row(R.ill,(obA.k*100).toFixed(2)+'%',(obB.k*100).toFixed(2)+'%');
  row(R.agep,scene.age.toFixed(2)+'d<br><span style="color:var(--dim2)">'+T.ph[phaseKey(scene.elongEcl,scene.k)]+'</span>',
             sceneB.age.toFixed(2)+'d<br><span style="color:var(--dim2)">'+T.ph[phaseKey(sceneB.elongEcl,sceneB.k)]+'</span>');
  row(R.pang,obA.phase.toFixed(2)+'°',obB.phase.toFixed(2)+'°');
  row(R.elo,obA.elong.toFixed(2)+'°',obB.elong.toFixed(2)+'°');
  row(R.lib,obA.libLon.toFixed(2)+'° / '+obA.libLat.toFixed(2)+'°',
            obB.libLon.toFixed(2)+'° / '+obB.libLat.toFixed(2)+'°');
  row(R.dist,Math.round(obA.dist).toLocaleString()+' km<br><span style="color:var(--dim2)">'+obA.angDiam.toFixed(2)+"′</span>",
             Math.round(obB.dist).toLocaleString()+' km<br><span style="color:var(--dim2)">'+obB.angDiam.toFixed(2)+"′</span>");
  row(R.rs,rsTxt(rsCache&&rsCache.A),rsTxt(rsCache&&rsCache.B));
  grp(R.sky);
  row(R.salt,obA.sunAlt.toFixed(2)+'°',obB.sunAlt.toFixed(2)+'°');
  row(R.saz,obA.sunAz.toFixed(1)+'° '+dirName(obA.sunAz),obB.sunAz.toFixed(1)+'° '+dirName(obB.sunAz));
  row(R.state,T.skies[skyIdx(obA.sunAlt)],T.skies[skyIdx(obB.sunAlt)]);
  row(R.vis,obA.alt>0?T.visOK:T.visNo,obB.alt>0?T.visOK:T.visNo);
  $('cmpTbl').innerHTML=rows.join('');
}

/* ---------- 國家 / 城市 選單 ---------- */
function opt(sel,val,txt){const o=document.createElement('option');o.value=val;o.textContent=txt;sel.appendChild(o);return o;}
function fillCountries(){
  for(const t of ['A','B']){
    const s=$('ctry'+t); s.innerHTML='';
    opt(s,'-1',T.customC);
    COUNTRIES.forEach((c,i)=>opt(s,i,coName(i)));
  }
}
function fillCities(t){
  const v=ST[t], s=$('city'+t); s.innerHTML='';
  if(v.name<0||v.name==null){ opt(s,'-1',T.custom); s.value='-1'; s.disabled=true; return; }
  s.disabled=false;
  const co=CITIES[v.name][6];
  for(const ci of BY_COUNTRY[co]) opt(s,ci,cName(ci));
  s.value=String(v.name);
}
function applyCity(t,ci){
  const v=ST[t], c=CITIES[ci];
  v.name=ci; v.lat=c[2]; v.lon=c[3]; v.tz=c[4]; v.off='auto';
  if(t==='B'||ST.syncB) applySync();
  syncForm(); refresh();
}
function setCustom(t,lat,lon){
  const v=ST[t]; v.lat=clamp(lat,-90,90); v.lon=n180(lon); v.name=-1; v.tz=null;
  applySync(); syncForm(); refresh();
}

/* ---------- 表單 ---------- */
const FLD=['y','mo','d','h','mi','s'];
function fillOffsets(){
  for(const t of ['A','B']){
    const s=$('off'+t); s.innerHTML='';
    opt(s,'auto',T.auto);
    OFFS.forEach(v=>opt(s,v,fmtOff(v)));
  }
}
function syncForm(){
  for(const t of ['A','B']){
    const v=ST[t];
    $('ctry'+t).value=(v.name<0||v.name==null)?'-1':String(CITIES[v.name][6]);
    fillCities(t);
    $('lat'+t).value=v.lat.toFixed(4); $('lon'+t).value=v.lon.toFixed(4);
    const os=$('off'+t); os.value=String(v.off);
    if(os.firstChild) os.firstChild.textContent=v.tz?T.auto:T.autoLon;
  }
  const setF=(t,v)=>FLD.forEach(f=>{const e=$(f+t); if(!e)return;
    const nv=String(f==='s'?Math.round(v.s):v[f]);
    if(document.activeElement!==e&&e.value!==nv)e.value=nv;});
  setF('A',ST.A); setF('B',ST.B);
  $('syncB').checked=ST.syncB;
  $('btrow').classList.toggle('frozen',ST.syncB);
  if(ST.syncB&&ST.playB) setPlay('B',false);
  FLD.forEach(f=>{const e=$(f+'B'); if(e)e.disabled=ST.syncB;});
  ['tNowB','tPlayB','tSpeedB'].forEach(id=>{const e=$(id); if(e)e.disabled=ST.syncB;});
  document.querySelectorAll('[data-unit="B"][data-step]').forEach(b=>{b.disabled=ST.syncB;});
}
function bindForm(){
  for(const t of ['A','B']){
    $('ctry'+t).addEventListener('change',e=>{
      const i=+e.target.value;
      if(i<0){ ST[t].name=-1; ST[t].tz=null; applySync(); syncForm(); refresh(); }
      else applyCity(t,BY_COUNTRY[i][0]);
    });
    $('city'+t).addEventListener('change',e=>{const i=+e.target.value; if(i>=0)applyCity(t,i);});
    for(const f of ['lat','lon']) $(f+t).addEventListener('change',e=>{
      const x=parseFloat(e.target.value); if(isNaN(x))return;
      setCustom(t,f==='lat'?x:ST[t].lat,f==='lon'?x:ST[t].lon);
    });
    $('off'+t).addEventListener('change',e=>{ST[t].off=e.target.value;applySync();syncForm();refresh();});
    $('geo'+t).addEventListener('click',()=>{
      if(!navigator.geolocation)return toast(T.gpsFail);
      navigator.geolocation.getCurrentPosition(p=>{
        const v=ST[t]; v.lat=clamp(p.coords.latitude,-90,90); v.lon=n180(p.coords.longitude);
        v.name=-1; v.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||null; v.off='auto';
        ST.view.lat=v.lat; ST.view.lon=v.lon;
        applySync(); syncForm(); refresh();
      },()=>toast(T.gpsFail),{timeout:8000});
    });
    FLD.forEach(f=>{
      const el=$(f+t); if(!el)return;
      el.addEventListener('change',()=>{
        const x=parseInt(el.value,10); if(isNaN(x))return;
        ST[t][f]=x; normFields(ST[t]);
        if(t==='A')applySync(); else ST.syncB=false;
        syncForm(); refresh();
      });
    });
  }
  $('syncB').addEventListener('change',e=>{ST.syncB=e.target.checked;applySync();syncForm();fitLayout();sizeAll();refresh();});
  for(const t of ['A','B']){
    const sfx=(t==='A'?'':'B');
    $('tNow'+sfx).addEventListener('click',()=>{
      setFromJD(ST[t],Date.now()/86400000+2440587.5);
      if(t==='A')applySync(); syncForm(); refresh();});
    $('tSpeed'+sfx).addEventListener('change',e=>{ST[t==='A'?'speed':'speedB']=+e.target.value;});
    $('tPlay'+sfx).addEventListener('click',()=>setPlay(t,!(t==='A'?ST.play:ST.playB)));
  }
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{
    const t=b.dataset.unit||'A';
    setFromJD(ST[t],jdOf(ST[t])+(+b.dataset.step)/86400);
    if(t==='A')applySync(); syncForm(); refresh();}));
  $('tgtA').addEventListener('click',()=>setTarget('A'));
  $('tgtB').addEventListener('click',()=>setTarget('B'));
  $('gZin').addEventListener('click',()=>{ST.view.zoom=clamp(ST.view.zoom*1.4,0.55,8);drawGlobeOnly();});
  $('gZout').addEventListener('click',()=>{ST.view.zoom=clamp(ST.view.zoom/1.4,0.55,8);drawGlobeOnly();});
  $('gToA').addEventListener('click',()=>{ST.view.lat=ST.A.lat;ST.view.lon=ST.A.lon;drawGlobeOnly();});
  $('gToB').addEventListener('click',()=>{ST.view.lat=ST.B.lat;ST.view.lon=ST.B.lon;drawGlobeOnly();});
  $('gSpin').addEventListener('click',()=>{ST.view.spin=!ST.view.spin;
    $('gSpin').classList.toggle('on',ST.view.spin);
    if(ST.view.spin)startLoop();
    else if(!ST.play&&!ST.playB) drawGlobeOnly();});
  $('gLabels').addEventListener('click',()=>{ST.view.labels=!ST.view.labels;
    $('gLabels').classList.toggle('on',ST.view.labels); drawGlobeOnly();});
  $('btnLang').addEventListener('click',()=>setLang(ST.lang==='zh'?'en':'zh'));
  $('btnShare').addEventListener('click',share);
  $('btnScen').addEventListener('click',nextScenario);
  document.querySelectorAll('#tabbar .tb').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.p)));
}
function setTarget(t){ST.target=t;$('tgtA').classList.toggle('on',t==='A');$('tgtB').classList.toggle('on',t==='B');}
function setTab(p){
  ST.tab=(ST.tab===p)?null:p;
  document.querySelectorAll('#tabbar .tb').forEach(b=>b.classList.toggle('on',b.dataset.p===ST.tab));
  document.querySelectorAll('.dpanel').forEach(d=>d.classList.toggle('on',d.dataset.p===ST.tab));
  $('drawer').classList.toggle('open',!!ST.tab);
  dropAvoid(); fitLayout();
  if(ST.tab==='tbl') buildTable();          /* 不依賴 rAF，分頁隱藏時也會建表 */
  requestAnimationFrame(()=>{sizeAll();drawAll();});
  setTimeout(()=>{sizeAll();drawAll();},250);
}

/* ---------- 地球互動 ---------- */
function globeSetup(){
  const cv=$('globe'); const ptr=new Map(); let last=null,moved=0,pinch=0,z0=1;
  const geom=()=>{const r=cv.getBoundingClientRect();
    return {r,S:cv.width/(r.width||1),pad:ST.view.padBottom,
      R:Math.min(r.width,r.height-ST.view.padBottom)*0.44*ST.view.zoom};};
  cv.addEventListener('pointerdown',e=>{
    cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptr.size===1){last={x:e.clientX,y:e.clientY};moved=0;}
    else if(ptr.size===2){const a=[...ptr.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);z0=ST.view.zoom;moved=99;}
  });
  cv.addEventListener('pointermove',e=>{
    if(!ptr.has(e.pointerId))return;
    ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptr.size>=2){const a=[...ptr.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(pinch>4){ST.view.zoom=clamp(z0*d/pinch,0.55,8);drawGlobeOnly('low');} return;}
    if(!last)return;
    const dx=e.clientX-last.x, dy=e.clientY-last.y;
    moved+=Math.abs(dx)+Math.abs(dy); last={x:e.clientX,y:e.clientY};
    const R=geom().R||1;
    ST.view.lon=n180(ST.view.lon-dx/R*R2D);
    ST.view.lat=clamp(ST.view.lat+dy/R*R2D,-89.5,89.5);
    drawGlobeOnly('low');
  });
  const end=e=>{
    if(ptr.has(e.pointerId)){ if(ptr.size===1&&moved<7)pick(e); ptr.delete(e.pointerId); }
    if(ptr.size<2)pinch=0;
    if(ptr.size===0){last=null;drawGlobeOnly();}
    else{const a=[...ptr.values()];last={x:a[0].x,y:a[0].y};}
  };
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  cv.addEventListener('wheel',e=>{e.preventDefault();
    ST.view.zoom=clamp(ST.view.zoom*(e.deltaY<0?1.16:1/1.16),0.55,8);drawGlobeOnly();},{passive:false});
  function pick(e){
    const g=geom();
    const px=(e.clientX-g.r.left)*g.S, py=(e.clientY-g.r.top)*g.S;
    const ci=pickCityLabel(px,py,cv.width/(g.r.width||1));
    if(ci>=0){ applyCity(ST.target,ci); return; }
    const P=globeParams(cv,ST.view); if(!P)return;
    const q=P.unproj(px,py); if(!q)return;
    setCustom(ST.target,q.lat,q.lon);
  }
}
/* ---------- 月面縮放 / 平移 ---------- */
function moonBase(t){
  const cv=$('moon'+t), ob=(t==='A'?obA:obB); if(!ob||!cv.width)return 0;
  return moonGeom(cv,ob,{trueSize:ST.trueSize,zoom:1,ox:0,oy:0}).base;
}
function moonClamp(t){
  const m=ST[t+'2'];
  if(m.z<=1.001){m.z=1;m.ox=0;m.oy=0;return;}
  const lim=m.z-0.35;
  m.ox=clamp(m.ox,-lim,lim); m.oy=clamp(m.oy,-lim,lim);
}
function moonZoom(t,nz,px,py){
  const m=ST[t+'2'], b=moonBase(t); if(!b)return;
  nz=clamp(nz,1,5);
  const cv=$('moon'+t), W=cv.width, H=cv.height;
  if(px===undefined){px=W/2;py=H*MOON_CY;}
  const cx=W/2+m.ox*b, cy=H*MOON_CY+m.oy*b, f=nz/m.z;
  m.z=nz;
  m.ox=(px+(cx-px)*f-W/2)/b; m.oy=(py+(cy-py)*f-H*MOON_CY)/b;
  moonClamp(t); drawMoon(t);
}
function moonSetup(t){
  const cv=$('moon'+t), m=ST[t+'2'];
  const ptr=new Map(); let last=null,pinch=0,z0=1;
  const dev=e=>{const r=cv.getBoundingClientRect(),s=cv.width/(r.width||1);
    return {x:(e.clientX-r.left)*s,y:(e.clientY-r.top)*s,s};};
  cv.addEventListener('wheel',e=>{e.preventDefault();
    const p=dev(e); moonZoom(t,m.z*(e.deltaY<0?1.2:1/1.2),p.x,p.y);},{passive:false});
  cv.addEventListener('dblclick',e=>{e.preventDefault();m.z=1;m.ox=0;m.oy=0;drawMoon(t);});
  cv.addEventListener('pointerdown',e=>{
    cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptr.size===1){last={x:e.clientX,y:e.clientY};}
    else if(ptr.size===2){const a=[...ptr.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);z0=m.z;}
  });
  cv.addEventListener('pointermove',e=>{
    if(!ptr.has(e.pointerId))return;
    ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptr.size>=2){
      const a=[...ptr.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(pinch>4){const r=cv.getBoundingClientRect(),s=cv.width/(r.width||1);
        moonZoom(t,z0*d/pinch,((a[0].x+a[1].x)/2-r.left)*s,((a[0].y+a[1].y)/2-r.top)*s);}
      return;
    }
    if(!last||m.z<=1.001)return;
    const b=moonBase(t); if(!b)return;
    const r=cv.getBoundingClientRect(),s=cv.width/(r.width||1);
    m.ox+=(e.clientX-last.x)*s/b; m.oy+=(e.clientY-last.y)*s/b;
    last={x:e.clientX,y:e.clientY};
    moonClamp(t); drawMoon(t);
  });
  const end=e=>{ ptr.delete(e.pointerId); if(ptr.size<2)pinch=0;
    if(ptr.size===0)last=null; else {const a=[...ptr.values()];last={x:a[0].x,y:a[0].y};} };
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  $('mzi'+t).addEventListener('click',()=>moonZoom(t,m.z*1.5));
  $('mzo'+t).addEventListener('click',()=>moonZoom(t,m.z/1.5));
  $('mzr'+t).addEventListener('click',()=>{m.z=1;m.ox=0;m.oy=0;drawMoon(t);});
}
/* ---------- 動畫 ---------- */
let raf=null,lastT=0;
function setPlay(t,v){
  const k=(t==='A'?'play':'playB'), b=$('tPlay'+(t==='A'?'':'B'));
  ST[k]=v;
  if(b){ b.textContent=v?'❚❚':'▶'; b.classList.toggle('on',v); }
  if(v)startLoop();
  else if(!ST.play&&!ST.playB&&!ST.view.spin) refresh();   /* 暗停後補一次精繪 */
}
function startLoop(){ if(raf)return; lastT=0; raf=requestAnimationFrame(loop); }
function loop(t){
  if(!ST.play&&!ST.playB&&!ST.view.spin){raf=null;return;}
  if(!lastT)lastT=t;
  const dt=Math.min((t-lastT)/1000,0.2); lastT=t;
  if(ST.view.spin) ST.view.lon=n180(ST.view.lon+dt*7);
  let moved=false;
  if(ST.play){ setFromJD(ST.A,jdOf(ST.A)+dt*ST.speed/86400); applySync(); moved=true; }
  if(ST.playB&&!ST.syncB){ setFromJD(ST.B,jdOf(ST.B)+dt*ST.speedB/86400); moved=true; }
  if(moved){ syncForm(); refresh({q:'low',noHash:1}); }
  else drawGlobeOnly('low');
  raf=requestAnimationFrame(loop);
}
/* ---------- 情境 ---------- */
const SCEN=[
 ['北半球 vs 南半球：月亮上下顛倒','N vs S hemisphere: the Moon is flipped','臺北','雪梨',true],
 ['赤道「船形月」vs 高緯','Equator "boat moon" vs high latitude','基多（赤道）','雷克雅維克',true],
 ['美國東西岸','US east vs west coast','紐約','舊金山',true],
 ['中國東西兩端','China: far west vs east','烏魯木齊','上海',true],
 ['東西半球：一地白天、一地夜晚','Opposite sides: day vs night','倫敦','洛杉磯',true],
 ['極區：整天不落 / 整天不升','Polar: up all day / down all day','朗伊爾城','南極點',true],
 ['同地不同時：B 晚 6 小時','Same place, B is 6 hours later','臺北','臺北',false]];
function nextScenario(){
  const s=SCEN[ST.scen%SCEN.length]; ST.scen++;
  const ia=cityIndex(s[2]), ib=cityIndex(s[3]);
  const set=(v,i)=>{const c=CITIES[i];v.name=i;v.lat=c[2];v.lon=c[3];v.tz=c[4];v.off='auto';};
  set(ST.A,ia); set(ST.B,ib); ST.syncB=s[4];
  if(!s[4]) setFromJD(ST.B,jdOf(ST.A)+0.25); else applySync();
  ST.view.lat=(ST.A.lat+ST.B.lat)/2; ST.view.lon=ST.A.lon; ST.view.zoom=0.95;
  syncForm(); fitLayout(); refresh(); toast(ST.lang==='en'?s[1]:s[0]);
}
/* ---------- 分享 ---------- */
let hashT=null;
const queueHash=()=>{clearTimeout(hashT);hashT=setTimeout(writeHash,420);};
function writeHash(){
  const enc=v=>[v.lat.toFixed(4),v.lon.toFixed(4),v.off,v.tz||'',v.name==null?-1:v.name].join('~');
  const tm=v=>[v.y,v.mo,v.d,v.h,v.mi,Math.round(v.s)].join('~');
  const p=new URLSearchParams();
  p.set('a',enc(ST.A)); p.set('ta',tm(ST.A));
  p.set('b',enc(ST.B)); p.set('tb',tm(ST.B));
  p.set('sy',ST.syncB?'1':'0'); p.set('lg',ST.lang);
  try{history.replaceState(null,'','#'+p.toString());}catch(e){}
}
function readHash(){
  if(!location.hash||location.hash.length<4)return false;
  try{
    const p=new URLSearchParams(location.hash.slice(1));
    const dec=(v,k,tk)=>{
      const a=(p.get(k)||'').split('~'); if(a.length<5)return false;
      v.lat=clamp(parseFloat(a[0]),-90,90); v.lon=n180(parseFloat(a[1]));
      v.off=a[2]==='auto'?'auto':(parseFloat(a[2])||0); v.tz=a[3]||null; v.name=parseInt(a[4],10);
      if(isNaN(v.name)||v.name<0||v.name>=CITIES.length)v.name=-1;
      const t=(p.get(tk)||'').split('~').map(Number);
      if(t.length===6&&t.every(x=>!isNaN(x))){v.y=t[0];v.mo=t[1];v.d=t[2];v.h=t[3];v.mi=t[4];v.s=t[5];}
      return true;
    };
    if(!dec(ST.A,'a','ta'))return false;
    dec(ST.B,'b','tb');
    ST.syncB=p.get('sy')!=='0';
    if(p.get('lg')==='en')ST.lang='en';
    return true;
  }catch(e){return false;}
}
function share(){
  writeHash();
  const url=location.href, done=()=>toast(T.copied);
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(url).then(done).catch(()=>fb());
  else fb();
  function fb(){const ta=document.createElement('textarea');ta.value=url;document.body.appendChild(ta);
    ta.select(); try{document.execCommand('copy');done();}catch(e){toast(T.copyFail);}
    document.body.removeChild(ta);}
}
let toastT=null;
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),2400);}
/* ---------- 語言 ---------- */
function setLang(l){
  ST.lang=l; T=I18N[l];
  root.lang=(l==='en'?'en':'zh-Hant');
  document.querySelectorAll('[data-t]').forEach(e=>{const k=e.dataset.t;if(T[k]!==undefined)e.textContent=T[k];});
  $('btnLang').textContent=(l==='zh'?'EN':'中文');
  $('notes').innerHTML=T.notesHtml;
  fillCountries(); fillOffsets(); syncForm(); fitLayout(); sizeAll(); refresh();
}
/* ---------- 自我驗算（?test） ---------- */
function mvTest(){
  const out=[],ok=(n,got,exp,tol)=>{const d=Math.abs(got-exp);
    out.push({name:n,got:+got.toFixed(6),exp,diff:+d.toFixed(6),pass:d<=tol});};
  const T92=(2448724.5-2451545)/36525;
  const mn=moonPos(T92,{dpsi:0,deps:0});
  ok('Meeus 47.a lon',mn.gLon,133.162655,0.0008);
  ok('Meeus 47.a lat',mn.lat,-3.229126,0.0008);
  ok('Meeus 47.a dist',mn.r,368409.7,1.2);
  const sc=buildScene(2448724.5-deltaT(1992,4)/86400);
  const c=unit(mul(sc.moonEq,-1));
  ok('Meeus 53.a lib lon',atan2(dot(c,sc.yb),dot(c,sc.xb))*R2D,-1.206,0.02);
  ok('Meeus 53.a lib lat',asin(clamp(dot(c,sc.zb),-1,1))*R2D,4.194,0.02);
  const T87=(2446896.5-2451545)/36525,n87=nutation(T87);
  ok('Meeus 22.a dpsi" (4-term)',n87.dpsi*3600,-3.788,0.5);
  ok('Meeus 22.a deps" (4-term)',n87.deps*3600,9.443,0.5);
  ok('Meeus 22.a eps0',meanObliq(T87),23+26/60+27.407/3600,0.00002);
  const T25=(2448908.5-2451545)/36525,n25=nutation(T25),su=sunPos(T25,n25);
  ok('Meeus 25.a sun lon',su.lon,199.90895,0.002);
  ok('Meeus 25.a sun R (low-acc)',su.au,0.99760775,0.0002);
  const nm=buildScene(jdFromUTC(2000,1,6,18,14,0)-deltaT(2000,1)/86400);
  ok('new moon 2000-01-06 elong',n180(nm.elongEcl),0,0.35);
  console.table(out);
  return {pass:out.every(o=>o.pass),out};
}
window.mvTest=mvTest;
/* ---------- 啟動 ---------- */
function init(){
  MIP.earth =buildMips(TEX.earth ,3,192);
  MIP.lights=buildMips(TEX.lights,1,192);
  MIP.bump  =buildMips(TEX.bump  ,1,192);
  MIP.water =buildMips(TEX.water ,1,192);
  for(const k of ['earth','lights','bump','water']) delete TEX[k].d;
  GE.aniso=(navigator.hardwareConcurrency||2)<=2?1:2;
  initWorkers();
  setFromJD(ST.A,Date.now()/86400000+2440587.5); applySync();
  readHash();
  T=I18N[ST.lang];
  fillCountries(); fillOffsets(); bindForm(); globeSetup();
  moonSetup('A'); moonSetup('B'); setTarget('A');
  setLang(ST.lang);
  fitLayout(); sizeAll(); refresh();
  let rt=null;
  const ro=new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(()=>{fitLayout();sizeAll();drawAll();},80);});
  ro.observe($('main')); ro.observe($('gpane'));
  addEventListener('scroll',dropAvoid,true);
  addEventListener('orientationchange',()=>setTimeout(()=>{fitLayout();sizeAll();drawAll();},280));
  $('loader').classList.add('gone');
  setTimeout(()=>{const l=$('loader');if(l)l.remove();},550);
  setTimeout(()=>{ if(GE.ready&&scene){sizeAll();drawGlobeOnly();} updateText(); },1700);
  if(/(\?|&)test/.test(location.search)) setTimeout(()=>console.log(mvTest()),120);
}
Promise.all([loadTex(ASSETS.earth,'earth'),loadTex(ASSETS.lights,'lights'),
             loadTex(ASSETS.bump,'bump'),loadTex(ASSETS.water,'water'),
             loadTex(ASSETS.moon,'moon')])
  .then(init)
  .catch(e=>{$('ldtxt').textContent='貼圖載入失敗 / texture load failed: '+e.message;});
