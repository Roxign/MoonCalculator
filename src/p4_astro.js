/* ============================================================
   天文計算 — Meeus, Astronomical Algorithms (2nd ed.)
   月球 ch.47 (ELP-2000/82 截斷級數)、太陽 ch.25、章動 ch.22
   月面定向以 Cassini 定律用向量法直接建立月球本體座標系
   ============================================================ */
const D2R=Math.PI/180, R2D=180/Math.PI;
const sin=Math.sin,cos=Math.cos,tan=Math.tan,asin=Math.asin,acos=Math.acos,atan2=Math.atan2,
      sqrt=Math.sqrt,abs=Math.abs,flr=Math.floor,pow=Math.pow,PI=Math.PI;
const n360=x=>{x%=360;return x<0?x+360:x;};
const n180=x=>{x=n360(x);return x>180?x-360:x;};
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const V=(x,y,z)=>({x,y,z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const crs=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const len=a=>sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const unit=a=>{const l=len(a)||1;return{x:a.x/l,y:a.y/l,z:a.z/l};};

/* ---------- 儒略日 ---------- */
function jdFromUTC(y,mo,d,h,mi,s){
  let Y=y,M=mo;
  if(M<=2){Y-=1;M+=12;}
  const A=flr(Y/100), B=2-A+flr(A/4);
  return flr(365.25*(Y+4716))+flr(30.6001*(M+1))+d+B-1524.5+(h+mi/60+s/3600)/24;
}
function jdToUTC(jd){
  const z=flr(jd+0.5); let f=jd+0.5-z, A=z;
  if(z>=2299161){const a=flr((z-1867216.25)/36524.25); A=z+1+a-flr(a/4);}
  const B=A+1524, C=flr((B-122.1)/365.25), D=flr(365.25*C), E=flr((B-D)/30.6001);
  const dF=B-D-flr(30.6001*E)+f, d=flr(dF);
  let sec=Math.round((dF-d)*86400);
  const mo=(E<14)?E-1:E-13, y=(mo>2)?C-4716:C-4715;
  let h=flr(sec/3600); sec-=h*3600;
  let mi=flr(sec/60); sec-=mi*60;
  let dd=d;
  if(h>23){h-=24;dd+=1;}   /* 捨入溢位（極罕見） */
  return {y,mo,d:dd,h,mi,s:sec};
}
/* ---------- ΔT = TT − UT (Espenak & Meeus) ---------- */
function deltaT(y,m){
  const yr=y+(m-0.5)/12; let t,u;
  if(yr<-500||yr>2150){u=(yr-1820)/100;return -20+32*u*u;}
  if(yr<500){u=yr/100;return 10583.6-1014.41*u+33.78311*u**2-5.952053*u**3-0.1798452*u**4+0.022174192*u**5+0.0090316521*u**6;}
  if(yr<1600){u=(yr-1000)/100;return 1574.2-556.01*u+71.23472*u**2+0.319781*u**3-0.8503463*u**4-0.005050998*u**5+0.0083572073*u**6;}
  if(yr<1700){t=yr-1600;return 120-0.9808*t-0.01532*t*t+t**3/7129;}
  if(yr<1800){t=yr-1700;return 8.83+0.1603*t-0.0059285*t*t+0.00013336*t**3-t**4/1174000;}
  if(yr<1860){t=yr-1800;return 13.72-0.332447*t+0.0068612*t*t+0.0041116*t**3-0.00037436*t**4+0.0000121272*t**5-0.0000001699*t**6+0.000000000875*t**7;}
  if(yr<1900){t=yr-1860;return 7.62+0.5737*t-0.251754*t*t+0.01680668*t**3-0.0004473624*t**4+t**5/233174;}
  if(yr<1920){t=yr-1900;return -2.79+1.494119*t-0.0598939*t*t+0.0061966*t**3-0.000197*t**4;}
  if(yr<1941){t=yr-1920;return 21.20+0.84493*t-0.076100*t*t+0.0020936*t**3;}
  if(yr<1961){t=yr-1950;return 29.07+0.407*t-t*t/233+t**3/2547;}
  if(yr<1986){t=yr-1975;return 45.45+1.067*t-t*t/260-t**3/718;}
  if(yr<2005){t=yr-2000;return 63.86+0.3345*t-0.060374*t*t+0.0017275*t**3+0.000651814*t**4+0.00002373599*t**5;}
  if(yr<2050){t=yr-2000;return 62.92+0.32217*t+0.005589*t*t;}
  u=(yr-1820)/100;return -20+32*u*u-0.5628*(2150-yr);
}
/* ---------- 章動 / 黃赤交角 ---------- */
function nutation(T){
  const om=(125.04452-1934.136261*T+0.0020708*T*T+T**3/450000)*D2R;
  const L=(280.4665+36000.7698*T)*D2R, Lp=(218.3165+481267.8813*T)*D2R;
  return {dpsi:(-17.20*sin(om)-1.32*sin(2*L)-0.23*sin(2*Lp)+0.21*sin(2*om))/3600,
          deps:( 9.20*cos(om)+0.57*cos(2*L)+0.10*cos(2*Lp)-0.09*cos(2*om))/3600};
}
const meanObliq=T=>23.439291111-(46.8150*T+0.00059*T*T-0.001813*T**3)/3600;
/* ---------- 太陽 (ch.25) ---------- */
function sunPos(T,nut){
  const L0=n360(280.46646+36000.76983*T+0.0003032*T*T);
  const Md=n360(357.52911+35999.05029*T-0.0001537*T*T), M=Md*D2R;
  const e=0.016708634-0.000042037*T-0.0000001267*T*T;
  const C=(1.914602-0.004817*T-0.000014*T*T)*sin(M)+(0.019993-0.000101*T)*sin(2*M)+0.000289*sin(3*M);
  const v=M+C*D2R, R=1.000001018*(1-e*e)/(1+e*cos(v));
  return {lon:n360(L0+C+nut.dpsi-0.005691611/R), lat:0, r:R*149597870.7, au:R};
}
/* ---------- 月球 (ch.47) ---------- */
const MLR=[
0,0,1,0,6288774,-20905355, 2,0,-1,0,1274027,-3699111, 2,0,0,0,658314,-2955968,
0,0,2,0,213618,-569925, 0,1,0,0,-185116,48888, 0,0,0,2,-114332,-3149,
2,0,-2,0,58793,246158, 2,-1,-1,0,57066,-152138, 2,0,1,0,53322,-170733,
2,-1,0,0,45758,-204586, 0,1,-1,0,-40923,-129620, 1,0,0,0,-34720,108743,
0,1,1,0,-30383,104755, 2,0,0,-2,15327,10321, 0,0,1,2,-12528,0,
0,0,1,-2,10980,79661, 4,0,-1,0,10675,-34782, 0,0,3,0,10034,-23210,
4,0,-2,0,8548,-21636, 2,1,-1,0,-7888,24208, 2,1,0,0,-6766,30824,
1,0,-1,0,-5163,-8379, 1,1,0,0,4987,-16675, 2,-1,1,0,4036,-12831,
2,0,2,0,3994,-10445, 4,0,0,0,3861,-11650, 2,0,-3,0,3665,14403,
0,1,-2,0,-2689,-7003, 2,0,-1,2,-2602,0, 2,-1,-2,0,2390,10056,
1,0,1,0,-2348,6322, 2,-2,0,0,2236,-9884, 0,1,2,0,-2120,5751,
0,2,0,0,-2069,0, 2,-2,-1,0,2048,-4950, 2,0,1,-2,-1773,4130,
2,0,0,2,-1595,0, 4,-1,-1,0,1215,-3958, 0,0,2,2,-1110,0,
3,0,-1,0,-892,3258, 2,1,1,0,-810,2616, 4,-1,-2,0,759,-1897,
0,2,-1,0,-713,-2117, 2,2,-1,0,-700,2354, 2,1,-2,0,691,0,
2,-1,0,-2,596,0, 4,0,1,0,549,-1423, 0,0,4,0,537,-1117,
4,-1,0,0,520,-1571, 1,0,-2,0,-487,-1739, 2,1,0,-2,-399,0,
0,0,2,-2,-381,-4421, 1,1,1,0,351,0, 3,0,-2,0,-340,0,
4,0,-3,0,330,0, 2,-1,2,0,327,0, 0,2,1,0,-323,1165,
1,1,-1,0,299,0, 2,0,3,0,294,0, 2,0,-1,-2,0,8752];
const MB=[
0,0,0,1,5128122, 0,0,1,1,280602, 0,0,1,-1,277693, 2,0,0,-1,173237,
2,0,-1,1,55413, 2,0,-1,-1,46271, 2,0,0,1,32573, 0,0,2,1,17198,
2,0,1,-1,9266, 0,0,2,-1,8822, 2,-1,0,-1,8216, 2,0,-2,-1,4324,
2,0,1,1,4200, 2,1,0,-1,-3359, 2,-1,-1,1,2463, 2,-1,0,1,2211,
2,-1,-1,-1,2065, 0,1,-1,-1,-1870, 4,0,-1,-1,1828, 0,1,0,1,-1794,
0,0,0,3,-1749, 0,1,-1,1,-1565, 1,0,0,1,-1491, 0,1,1,1,-1475,
0,1,1,-1,-1410, 0,1,0,-1,-1344, 1,0,0,-1,-1335, 0,0,3,1,1107,
4,0,0,-1,1021, 4,0,-1,1,833, 0,0,1,-3,777, 4,0,-2,1,671,
2,0,0,-3,607, 2,0,2,-1,596, 2,-1,1,-1,491, 2,0,-2,1,-451,
0,0,3,-1,439, 2,0,2,1,422, 2,0,-3,-1,421, 2,1,-1,1,-366,
2,1,0,1,-351, 4,0,0,1,331, 2,-1,1,1,315, 2,-2,0,-1,302,
0,0,1,3,-283, 2,1,1,-1,-229, 1,1,0,-1,223, 1,1,0,1,223,
0,1,-2,-1,-220, 2,1,-1,-1,-220, 1,0,1,1,-185, 2,-1,-2,-1,181,
0,1,2,1,-177, 4,0,-2,-1,176, 4,-1,-1,-1,166, 1,0,1,-1,-164,
4,0,1,-1,132, 1,0,-1,-1,-119, 4,-1,0,-1,115, 2,-2,0,1,107];
function moonPos(T,nut){
  const Lp=n360(218.3164477+481267.88123421*T-0.0015786*T*T+T**3/538841-T**4/65194000);
  const D =n360(297.8501921+445267.1114034*T-0.0018819*T*T+T**3/545868-T**4/113065000);
  const M =n360(357.5291092+35999.0502909*T-0.0001536*T*T+T**3/24490000);
  const Mp=n360(134.9633964+477198.8675055*T+0.0087414*T*T+T**3/69699-T**4/14712000);
  const F =n360(93.2720950+483202.0175233*T-0.0036539*T*T-T**3/3526000+T**4/863310000);
  const A1=n360(119.75+131.849*T), A2=n360(53.09+479264.290*T), A3=n360(313.45+481266.484*T);
  const E=1-0.002516*T-0.0000074*T*T, E2=E*E;
  let sl=0,sr=0,sb=0,i,a,e,m;
  for(i=0;i<MLR.length;i+=6){
    a=(MLR[i]*D+MLR[i+1]*M+MLR[i+2]*Mp+MLR[i+3]*F)*D2R;
    m=MLR[i+1]; e=(m===0)?1:(abs(m)===1?E:E2);
    sl+=MLR[i+4]*e*sin(a); sr+=MLR[i+5]*e*cos(a);
  }
  for(i=0;i<MB.length;i+=5){
    a=(MB[i]*D+MB[i+1]*M+MB[i+2]*Mp+MB[i+3]*F)*D2R;
    m=MB[i+1]; e=(m===0)?1:(abs(m)===1?E:E2);
    sb+=MB[i+4]*e*sin(a);
  }
  sl+=3958*sin(A1*D2R)+1962*sin((Lp-F)*D2R)+318*sin(A2*D2R);
  sb+=-2235*sin(Lp*D2R)+382*sin(A3*D2R)+175*sin((A1-F)*D2R)+175*sin((A1+F)*D2R)
      +127*sin((Lp-Mp)*D2R)-115*sin((Lp+Mp)*D2R);
  return {lon:n360(Lp+sl/1e6+nut.dpsi), lat:sb/1e6, r:385000.56+sr/1000,
          gLon:n360(Lp+sl/1e6), Lp,D,M,Mp,F};
}
/* ---------- 黃道 → 赤道 ---------- */
function eclToEq(lon,lat,r,eps){
  const cl=cos(lat*D2R), ce=cos(eps*D2R), se=sin(eps*D2R);
  const x=r*cl*cos(lon*D2R), y=r*cl*sin(lon*D2R), z=r*sin(lat*D2R);
  return {x, y:y*ce-z*se, z:y*se+z*ce};
}
const rotEcl2Eq=(v,eps)=>{const c=cos(eps*D2R),s=sin(eps*D2R);
  return {x:v.x, y:v.y*c-v.z*s, z:v.y*s+v.z*c};};
const rotEq2Ecl=(v,eps)=>{const c=cos(eps*D2R),s=sin(eps*D2R);
  return {x:v.x, y:v.y*c+v.z*s, z:-v.y*s+v.z*c};};
function gmst(jdUT){
  const T=(jdUT-2451545)/36525;
  return n360(280.46061837+360.98564736629*(jdUT-2451545)+0.000387933*T*T-T**3/38710000);
}

/* ============================================================
   場景（與觀測者無關）
   ============================================================ */
const R_EARTH=6378.137, R_MOON=1737.4, R_SUN=696000, SYNODIC=29.530588853;
function buildScene(jdUT){
  const u=jdToUTC(jdUT);
  const jdTT=jdUT+deltaT(u.y,u.mo)/86400;
  const T=(jdTT-2451545)/36525;
  const nut=nutation(T);
  const eps=meanObliq(T)+nut.deps;
  const sun=sunPos(T,nut), moon=moonPos(T,nut);
  const sunEq=eclToEq(sun.lon,0,sun.r,eps);
  const moonEq=eclToEq(moon.lon,moon.lat,moon.r,eps);
  const gast=n360(gmst(jdUT)+nut.dpsi*cos(eps*D2R));
  /* --- 月球本體座標系（Cassini 定律 + 均勻自轉）--- */
  const I=1.54242*D2R;
  const Om=(n360(125.0445479-1934.1362891*T+0.0020754*T*T+T**3/467441-T**4/60616000)+nut.dpsi)*D2R;
  let zb=V(-sin(I)*sin(Om), sin(I)*cos(Om), cos(I));          /* 月球北極：黃經 Ω+90°、黃緯 90°−I */
  const nd=V(-cos(Om), -sin(Om), 0);                           /* 月球赤道升交點 */
  const zxn=crs(zb,nd), Fr=moon.F*D2R;
  let xb=V(nd.x*cos(Fr)+zxn.x*sin(Fr), nd.y*cos(Fr)+zxn.y*sin(Fr), nd.z*cos(Fr)+zxn.z*sin(Fr));
  zb=unit(rotEcl2Eq(zb,eps)); xb=unit(rotEcl2Eq(xb,eps));
  xb=unit(sub(xb,mul(zb,dot(xb,zb))));
  const yb=crs(zb,xb);                                          /* 指向月面東經 +90° */
  /* --- 相位（地心）--- */
  const mToS=unit(sub(sunEq,moonEq)), mToE=unit(mul(moonEq,-1));
  const phase=acos(clamp(dot(mToS,mToE),-1,1))*R2D;
  const k=(1+cos(phase*D2R))/2;
  const elongEcl=n360(moon.gLon-(sun.lon-nut.dpsi));
  return {jdUT,jdTT,T,nut,eps,sun,moon,sunEq,moonEq,gast,xb,yb,zb,
    phase,k,elongEcl, waxing:elongEcl<180,
    age:elongEcl/360*SYNODIC, mToS,
    subSolar:{lat:asin(sunEq.z/len(sunEq))*R2D, lon:n180(atan2(sunEq.y,sunEq.x)*R2D-gast)},
    subLunar:{lat:asin(moonEq.z/len(moonEq))*R2D, lon:n180(atan2(moonEq.y,moonEq.x)*R2D-gast)}};
}

/* ============================================================
   觀測者視角
   ============================================================ */
function observerBasis(scene,latD,lonD,hM){
  const phi=latD*D2R, lst=n360(scene.gast+lonD)*D2R, h=(hM||0);
  const uu=Math.atan(0.99664719*tan(phi));
  const rsp=0.99664719*sin(uu)+(h/6378137)*sin(phi);
  const rcp=cos(uu)+(h/6378137)*cos(phi);
  return {
    pos:V(R_EARTH*rcp*cos(lst), R_EARTH*rcp*sin(lst), R_EARTH*rsp),
    U:V(cos(phi)*cos(lst), cos(phi)*sin(lst), sin(phi)),
    E:V(-sin(lst), cos(lst), 0),
    N:V(-sin(phi)*cos(lst), -sin(phi)*sin(lst), cos(phi)), lst:lst*R2D };
}
/* Kasten–Young 大氣質量 + 蒙氣差 */
const airmass=alt=>alt<-2?40:1/(sin(clamp(alt,-2,90)*D2R)+0.50572*pow(clamp(alt,-2,90)+6.07995,-1.6364));
function refract(alt){ /* 真高度 → 視高度（度） */
  if(alt<-2)return alt;
  return alt+(1.02/tan((alt+10.3/(alt+5.11))*D2R))/60;
}
function observe(scene,latD,lonD,hM){
  const b=observerBasis(scene,latD,lonD,hM);
  const mt=sub(scene.moonEq,b.pos), st=sub(scene.sunEq,b.pos);
  const dM=len(mt), dS=len(st);
  const d=mul(mt,1/dM), sd=mul(st,1/dS);
  const altT=asin(clamp(dot(d,b.U),-1,1))*R2D;
  const alt=refract(altT);
  const az=n360(atan2(dot(d,b.E),dot(d,b.N))*R2D);
  const sAltT=asin(clamp(dot(sd,b.U),-1,1))*R2D;
  const sAlt=refract(sAltT);
  const sAz=n360(atan2(dot(sd,b.E),dot(sd,b.N))*R2D);
  /* 螢幕基底：天頂朝上 */
  let up=sub(b.U,mul(d,dot(b.U,d)));
  if(len(up)<1e-7) up=sub(b.N,mul(d,dot(b.N,d)));
  up=unit(up);
  const right=crs(d,up), w=mul(d,-1);
  const P=(v)=>V(dot(v,right),dot(v,up),dot(v,w));
  /* 太陽對月球的方向（螢幕座標） */
  const L=P(scene.mToS);
  /* 月球本體軸（螢幕座標） */
  const Xc=P(scene.xb), Yc=P(scene.yb), Zc=P(scene.zb);
  /* 地形（站心）相位 */
  const mToObs=unit(sub(b.pos,scene.moonEq));
  const phaseT=acos(clamp(dot(scene.mToS,mToObs),-1,1))*R2D;
  const kT=(1+cos(phaseT*D2R))/2;
  /* 月面中心的月面經緯（天平動） */
  const c=mul(d,-1);   /* 月球 → 觀測者 */
  const libLat=asin(clamp(dot(c,scene.zb),-1,1))*R2D;
  const libLon=atan2(dot(c,scene.yb),dot(c,scene.xb))*R2D;
  /* 亮面 / 天北極 的方位角（自天頂順時針） */
  const limbAng=n360(atan2(L.x,L.y)*R2D);
  const ncp=V(0,0,1), np=unit(sub(ncp,mul(d,dot(ncp,d)))), NP=P(np);
  const poleAng=n360(atan2(NP.x,NP.y)*R2D);
  const semi=asin(R_MOON/dM)*R2D;
  return {alt,altTrue:altT,az,sunAlt:sAlt,sunAltTrue:sAltT,sunAz:sAz,
    dist:dM,sunDist:dS,L,Xc,Yc,Zc,right,up,w,d,sd,basis:b,
    phase:phaseT,k:kT,libLon,libLat,limbAng,poleAng,
    semiDiam:semi, angDiam:semi*2*60,
    elong:acos(clamp(dot(d,sd),-1,1))*R2D,
    airmass:airmass(alt)};
}
/* ---------- 出沒（掃描 + 二分）---------- */
function riseSet(latD,lonD,jdStart,body){
  const h0=(body==='sun')?-0.8333:0.125;
  const f=jd=>{const sc=buildScene(jd),b=observerBasis(sc,latD,lonD,0);
    const t=sub(body==='sun'?sc.sunEq:sc.moonEq,b.pos);
    return asin(clamp(dot(mul(t,1/len(t)),b.U),-1,1))*R2D-h0;};
  const N=96, step=1/N, res={rise:null,set:null,transit:null};
  let prev=f(jdStart), prevJd=jdStart, best=-99, bestJd=null;
  for(let i=1;i<=N;i++){
    const jd=jdStart+i*step, v=f(jd);
    if(v>best){best=v;bestJd=jd;}
    if(prev<0&&v>=0) res.rise=res.rise??bisect(f,prevJd,jd);
    if(prev>=0&&v<0) res.set =res.set ??bisect(f,prevJd,jd);
    prev=v;prevJd=jd;
  }
  if(bestJd!==null&&best>-99){ /* 中天：在極值附近細找 */
    let lo=bestJd-step,hi=bestJd+step;
    for(let i=0;i<18;i++){const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3; if(f(m1)<f(m2))lo=m1;else hi=m2;}
    res.transit=(lo+hi)/2;
  }
  res.alwaysUp=(res.rise===null&&res.set===null&&prev>=0);
  res.alwaysDown=(res.rise===null&&res.set===null&&prev<0);
  return res;
}
function bisect(f,a,b){for(let i=0;i<17;i++){const m=(a+b)/2;if((f(a)<0)===(f(m)<0))a=m;else b=m;}return (a+b)/2;}
/* ---------- 相位名稱 ---------- */
function phaseKey(elong,k){
  if(elong<8||elong>352)return 'new';
  if(elong<82)return 'wxc'; if(elong<98)return 'fq';
  if(elong<172)return 'wxg'; if(elong<188)return 'full';
  if(elong<262)return 'wng'; if(elong<278)return 'lq';
  return 'wnc';
}
