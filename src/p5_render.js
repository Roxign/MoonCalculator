/* ============================================================
   繪圖：地球 / 月面 / 天空全景 / 幾何示意

   地球管線（取兩版各自最佳）：
     貼圖  NASA Blue Marble 2048×1024 + 高程 2048 + 海陸遮罩 1024 + 夜燈 1024
     取樣  逐像素解析 LOD（螢幕→經緯雅可比）→ 三線性 + 2 取樣各向異性
           經度環繞取樣（無接縫）、極區自動收斂
     著色  線性光空間 Lambert(wrap) + 高程法線擾動 + 海面鏡面反光
           + 城市燈 + 大氣散射（盤面藍霾／晨昏暖色／球外光環）
     排程  粗繪採「固定像素預算」低解析度（拖曳成本與畫布大小無關）
           精繪全解析度，Web Worker 並行或 rAF 分塊時間切片
   月面：可縮放／平移，貼圖 1224×1080（6 像素/度）
   ============================================================ */
const TEX={}, MIP={earth:[],lights:[],bump:[],water:[]};
const GLOBE_LABELS=[];
const GLOW=1.17;                       /* 大氣光環外緣（球半徑倍數） */
const scaleOf=cv=>clamp(cv.width/(cv.clientWidth||cv.width),1,3);
const fnt=(w,px)=>w+' '+px.toFixed(1)+'px ui-sans-serif,system-ui,sans-serif';
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const rgbs=c=>'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')';
const lerp3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rnd=(()=>{let s=20260926;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};})();
const STARS=[]; for(let i=0;i<520;i++) STARS.push([rnd(),rnd(),0.2+rnd()*0.8]);
const log2=Math.log2||(x=>Math.log(x)/Math.LN2);

function loadTex(src,key){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      const c=document.createElement('canvas'); c.width=im.width; c.height=im.height;
      const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(im,0,0);
      TEX[key]={w:im.width,h:im.height,d:x.getImageData(0,0,im.width,im.height).data};
      res();
    };
    im.onerror=()=>rej(new Error(key)); im.src=src;
  });
}
function buildMips(t,ch,minW){
  const lv=[], n=t.w*t.h, p0=new Uint8Array(n*ch);
  for(let i=0,j=0;i<n;i++){const o=i*4;
    if(ch===3){p0[j++]=t.d[o];p0[j++]=t.d[o+1];p0[j++]=t.d[o+2];} else p0[j++]=t.d[o];}
  lv.push({w:t.w,h:t.h,p:p0});
  while(lv[lv.length-1].w>minW&&lv.length<6){
    const s=lv[lv.length-1], nw=s.w>>1, nh=s.h>>1, q=new Uint8Array(nw*nh*ch);
    for(let y=0;y<nh;y++){
      const r0=(2*y)*s.w, r1=(2*y+1)*s.w;
      for(let x=0;x<nw;x++){
        const a=(r0+2*x)*ch,b=a+ch,c=(r1+2*x)*ch,d=c+ch,o=(y*nw+x)*ch;
        for(let k=0;k<ch;k++) q[o+k]=(s.p[a+k]+s.p[b+k]+s.p[c+k]+s.p[d+k]+2)>>2;
      }
    }
    lv.push({w:nw,h:nh,p:q});
  }
  return lv;
}

/* ---------- 球面著色核心（主執行緒與 Worker 共用同一份原始碼） ---------- */
const SPHERE_SRC=`
var S2L=null,L2S=null;
function initLUT(){
 if(S2L)return;
 S2L=new Float32Array(256);
 for(var i=0;i<256;i++){var c=i/255;S2L[i]=c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
 L2S=new Uint8Array(4098);
 for(var k=0;k<=4097;k++){var l=k/4096;var s=l<=0.0031308?l*12.92:1.055*Math.pow(l,1/2.4)-0.055;
  L2S[k]=Math.max(0,Math.min(255,Math.round(s*255)));}
}
function fillSphere(out,J,E,LI,BU,WA,yA,yB){
 initLUT();
 var cx=J.cx,cy=J.cy,R=J.R,bx0=J.bx0,bw=J.bw,by0=J.by0,bh=J.bh,st=J.step,q=J.q,invR=1/R;
 var Ex=J.Ex,Ey=J.Ey,Ez=J.Ez,Kx=J.Kx,Ky=J.Ky,Kz=J.Kz,Cx=J.Cx,Cy=J.Cy,Cz=J.Cz;
 var Sx=J.Sx,Sy=J.Sy,Sz=J.Sz,bxM=bx0+bw,byM=by0+bh;
 var lmin=J.lmin,lmaxE=E.length-1,W0=J.W0,H0=W0*0.5;
 var GL=J.glow,GL2=GL*GL,TAU=6.283185307179586,PIc=3.141592653589793;
 var offB=J.offB,offW=J.offW,offL=J.offL;
 var nB=BU?BU.length:0,nW=WA?WA.length:0,nL=LI?LI.length:0;
 var LG2=Math.log2||function(v){return Math.log(v)/0.6931471805599453;};
 var acc=new Float64Array(3), grd=new Float64Array(2);
 function texRGB(t,fu,fv,wgt){
  var W=t.w,H=t.h,p=t.p;
  var xx=fu*W-0.5,yy=fv*(H-1);
  var x0=Math.floor(xx),fx=xx-x0,y0=Math.floor(yy),fy=yy-y0;
  if(y0<0){y0=0;fy=0;}else if(y0>H-2){y0=H-2;fy=1;}
  var xa=x0%W; if(xa<0)xa+=W; var xb=xa+1; if(xb>=W)xb=0;
  var r0=y0*W,r1=r0+W;
  var i00=(r0+xa)*3,i10=(r0+xb)*3,i01=(r1+xa)*3,i11=(r1+xb)*3;
  var a0=(1-fx)*(1-fy)*wgt,a1=fx*(1-fy)*wgt,a2=(1-fx)*fy*wgt,a3=fx*fy*wgt;
  acc[0]+=p[i00]*a0+p[i10]*a1+p[i01]*a2+p[i11]*a3;
  acc[1]+=p[i00+1]*a0+p[i10+1]*a1+p[i01+1]*a2+p[i11+1]*a3;
  acc[2]+=p[i00+2]*a0+p[i10+2]*a1+p[i01+2]*a2+p[i11+2]*a3;
 }
 function texL(t,fu,fv){
  var W=t.w,H=t.h,p=t.p;
  var xx=fu*W-0.5,yy=fv*(H-1);
  var x0=Math.floor(xx),fx=xx-x0,y0=Math.floor(yy),fy=yy-y0;
  if(y0<0){y0=0;fy=0;}else if(y0>H-2){y0=H-2;fy=1;}
  var xa=x0%W; if(xa<0)xa+=W; var xb=xa+1; if(xb>=W)xb=0;
  var r0=y0*W,r1=r0+W;
  return (p[r0+xa]*(1-fx)+p[r0+xb]*fx)*(1-fy)+(p[r1+xa]*(1-fx)+p[r1+xb]*fx)*fy;
 }
 function bumpGrad(t,fu,fv){
  var W=t.w,H=t.h,p=t.p;
  var xi=Math.round(fu*W-0.5),yi=Math.round(fv*(H-1));
  if(yi<1)yi=1; else if(yi>H-2)yi=H-2;
  var xc=xi%W; if(xc<0)xc+=W;
  var xm=xc-1; if(xm<0)xm=W-1;
  var xp=xc+1; if(xp>=W)xp=0;
  var r=yi*W;
  grd[0]=(p[r+xp]-p[r+xm])*0.5;
  grd[1]=(p[r+W+xc]-p[r-W+xc])*0.5;
 }
 for(var y=yA;y<yB;y+=st){
  var ny=(cy-y+0.5)*invR;
  for(var x=bx0;x<bxM;x+=st){
   var nx=(x-cx+0.5)*invR, r2=nx*nx+ny*ny;
   if(r2>GL2) continue;
   var Rr,Gg,Bb,AL;
   if(r2<=1.0){
    var cov=(1-Math.sqrt(r2))*R+0.5; if(cov>1)cov=1; else if(cov<0.004) continue;
    var tt=1-r2, nz=tt>1e-8?Math.sqrt(tt):1e-4;
    var wx=nx*Ex+ny*Kx+nz*Cx, wy=nx*Ey+ny*Ky+nz*Cy, wz=nx*Ez+ny*Kz+nz*Cz;
    var cl=Math.sqrt(wx*wx+wy*wy); if(cl<1e-6)cl=1e-6;
    var lat=Math.asin(wz<-1?-1:(wz>1?1:wz)), lon=Math.atan2(wy,wx);
    var fu=0.5+lon/TAU, fv=0.5-lat/PIc;
    var lv=J.fastLv,frac=0,taps=1,mju=0,mjv=0,lodI=J.fastLv;
    if(q>0){
     var f1=nx/nz,f2=ny/nz;
     var ax=Ex-f1*Cx,ay=Ey-f1*Cy,az=Ez-f1*Cz;
     var bx2=Kx-f2*Cx,by2=Ky-f2*Cy,bz2=Kz-f2*Cz;
     var cl2=cl*cl;
     var dlaX=az/cl,dlaY=bz2/cl;
     var dloX=(wx*ay-wy*ax)/cl2,dloY=(wx*by2-wy*bx2)/cl2;
     var fuX=dloX/TAU*invR, fvX=-dlaX/PIc*invR;
     var fuY=dloY/TAU*invR, fvY=-dlaY/PIc*invR;
     var txX=fuX*W0,tyX=fvX*H0, txY=fuY*W0,tyY=fvY*H0;
     var lenX=Math.sqrt(txX*txX+tyX*tyX), lenY=Math.sqrt(txY*txY+tyY*tyY);
     var maj,mn;
     if(lenX>=lenY){maj=lenX;mn=lenY;mju=fuX;mjv=fvX;}else{maj=lenY;mn=lenX;mju=fuY;mjv=fvY;}
     if(mn<1e-7)mn=1e-7;
     var amx=cl<0.30?J.aniso*(cl/0.30):J.aniso; if(amx<1)amx=1;
     var an=maj/mn; if(an>amx)an=amx; if(an<1)an=1;
     var base=maj/an; if(base<1e-7)base=1e-7;
     var lod=LG2(base); if(lod<0)lod=0;
     taps=Math.round(an); if(taps<1)taps=1;
     lv=Math.floor(lod); frac=lod-lv; lodI=lod;
     if(lv<lmin){lv=lmin;frac=0;} else if(lv>=lmaxE){lv=lmaxE;frac=0;}
    }
    acc[0]=0;acc[1]=0;acc[2]=0;
    if(taps>1){
     var iv=1/taps;
     for(var ti=0;ti<taps;ti++) texRGB(E[lv],fu+((ti+0.5)*iv-0.5)*mju,fv+((ti+0.5)*iv-0.5)*mjv,iv);
    }else if(frac>0.02){
     texRGB(E[lv],fu,fv,1-frac); texRGB(E[lv+1],fu,fv,frac);
    }else texRGB(E[lv],fu,fv,1);
    var ar=S2L[(acc[0]+0.5)|0],ag=S2L[(acc[1]+0.5)|0],ab=S2L[(acc[2]+0.5)|0];
    var nbx=wx,nby=wy,nbz=wz,wat=0;
    if(q>0){
     if(nW){var lw=Math.round(lodI-offW); if(lw<0)lw=0; else if(lw>nW-1)lw=nW-1;
       wat=texL(WA[lw],fu,fv)*0.00392157;}
     if(nB&&J.bump>0){
      var lb=Math.round(lodI-offB); if(lb<0)lb=0; else if(lb>nB-1)lb=nB-1;
      var pf=(cl-0.10)/0.28; if(pf<0)pf=0; else if(pf>1)pf=1; pf=pf*pf*(3-2*pf);
      var bs=J.bump*(1-wat)*pf*(lb<2?1:(lb<3?0.6:0.25));
      if(bs>0.0004){
       bumpGrad(BU[lb],fu,fv);
       var clq=cl<0.5?0.5:cl;
       var gu=grd[0]/clq*bs, gv=grd[1]*bs;
       var ex=-wy/cl,ey=wx/cl;
       var pnx=-wz*wx/cl,pny=-wz*wy/cl,pnz=cl;
       nbx=wx-gu*ex+gv*pnx; nby=wy-gu*ey+gv*pny; nbz=wz+gv*pnz;
       var nl2=Math.sqrt(nbx*nbx+nby*nby+nbz*nbz);
       nbx/=nl2;nby/=nl2;nbz/=nl2;
      }
     }
    }
    var nlg=wx*Sx+wy*Sy+wz*Sz;
    var nl=nbx*Sx+nby*Sy+nbz*Sz;
    var wr=J.wrap, dw=(nl+wr)/(1+wr); if(dw<0)dw=0;
    var dq=(nlg+0.10)/0.22; if(dq<0)dq=0; else if(dq>1)dq=1;
    var dayf=dq*dq*(3-2*dq);
    var kd=dw*dayf*J.sunI+J.amb;
    var lr=ar*kd,lg=ag*kd,lb=ab*kd;
    if(q>0&&wat>0.12&&nlg>0){
     var hx=Sx+Cx,hy=Sy+Cy,hz=Sz+Cz;
     var hl=1/Math.sqrt(hx*hx+hy*hy+hz*hz); hx*=hl;hy*=hl;hz*=hl;
     var nh=nbx*hx+nby*hy+nbz*hz;
     if(nh>0){
      var sp=nh*nh; sp*=sp; sp*=sp; sp*=sp; sp*=sp; sp*=sp;           /* nh^64 */
      var nv=wx*Cx+wy*Cy+wz*Cz; if(nv<0)nv=0;
      var fr=1-nv,fr2=fr*fr,F=0.02+0.98*fr2*fr2*fr;
      var sv=sp*F*wat*J.specI*dayf;
      lr+=sv; lg+=sv*0.96; lb+=sv*0.90;
     }
    }
    var nf=1-dayf;
    if(nf>0.002){
     if(nL){
      var ll=Math.round(lodI-offL); if(ll<0)ll=0; else if(ll>nL-1)ll=nL-1;
      var li=texL(LI[ll],fu,fv)*0.00392157;
      var gl2=li*li*Math.sqrt(li)*nf*J.lightI;
      lr+=gl2; lg+=gl2*0.76; lb+=gl2*0.36;
     }
     var nb2=nf*0.010;
     lr+=ar*nb2; lg+=ag*nb2; lb+=ab*nb2;
    }
    var edg=1-nz, path=edg*edg;
    var hz2=path*dayf*J.hazeI;
    lr+=hz2*0.17; lg+=hz2*0.32; lb+=hz2*0.74;
    var td=(nlg-0.01)/0.095, tw=Math.exp(-td*td)*J.twI*(0.15+0.85*edg*edg);
    lr+=tw*0.62; lg+=tw*0.25; lb+=tw*0.07;
    Rr=lr<=0?0:(lr>=1?255:L2S[(lr*4096)|0]);
    Gg=lg<=0?0:(lg>=1?255:L2S[(lg*4096)|0]);
    Bb=lb<=0?0:(lb>=1?255:L2S[(lb*4096)|0]);
    AL=cov*255;
   }else{
    var rr=Math.sqrt(r2), tg=(rr-1)/(GL-1); if(tg>1)tg=1;
    var gx=nx/rr,gy=ny/rr;
    var lwx=gx*Ex+gy*Kx,lwy=gx*Ey+gy*Ky,lwz=gx*Ez+gy*Kz;
    var il=lwx*Sx+lwy*Sy+lwz*Sz;
    var dens=Math.exp(-tg*4.3)*(1-tg);
    var d1=(il+0.30)/0.42; if(d1<0)d1=0; else if(d1>1)d1=1; d1=d1*d1*(3-2*d1);
    var d2=(il+0.05)/0.35; if(d2<0)d2=0; else if(d2>1)d2=1; d2=d2*d2*(3-2*d2);
    var a=dens*(0.04+0.96*d1)*J.glowI;
    if(a<=0.004) continue;
    if(a>1)a=1;
    var cr=0.82*(1-d2)+0.20*d2, cg2=0.34*(1-d2)+0.46*d2, cb2=0.14*(1-d2)+0.95*d2;
    Rr=L2S[(cr*4096)|0]; Gg=L2S[(cg2*4096)|0]; Bb=L2S[(cb2*4096)|0]; AL=a*255;
   }
   var yM=y+st,xM=x+st;
   if(yM>yB)yM=yB; if(yM>byM)yM=byM; if(xM>bxM)xM=bxM;
   for(var yy=y;yy<yM;yy++){
    var o=((yy-by0)*bw+(x-bx0))*4;
    for(var xx2=x;xx2<xM;xx2++,o+=4){out[o]=Rr;out[o+1]=Gg;out[o+2]=Bb;out[o+3]=AL;}
   }
  }
 }
}`;
const fillSphere=new Function(SPHERE_SRC+';return fillSphere;')();

/* ---------- Worker 池 ---------- */
const WORKER_SRC=SPHERE_SRC+`
var T={e:[],l:[],b:[],w:[]};
var BMP=(typeof createImageBitmap==='function'&&typeof ImageData==='function');
onmessage=function(ev){
 var m=ev.data;
 if(m.t==='ping'){postMessage({t:'pong'});return;}
 if(m.t==='tex'){T[m.kind][m.lv]={w:m.w,h:m.h,p:new Uint8Array(m.buf)};return;}
 if(m.t==='job'){
  if(!T.e[m.J.lmin]){postMessage({t:'fail',id:m.id});return;}
  var J={},k; for(k in m.J)J[k]=m.J[k];
  J.by0=m.yA; J.bh=m.yB-m.yA;
  var out=new Uint8ClampedArray(J.bw*J.bh*4);
  fillSphere(out,J,T.e,T.l,T.b,T.w,m.yA,m.yB);
  var jid=m.id,yA=m.yA,bw=J.bw,bh=J.bh;
  if(BMP){
   try{
    createImageBitmap(new ImageData(out,bw,bh)).then(function(b){
      postMessage({t:'bmp',id:jid,yA:yA,bmp:b},[b]);
    },function(){postMessage({t:'band',id:jid,yA:yA,bh:bh,buf:out.buffer},[out.buffer]);});
    return;
   }catch(e){}
  }
  postMessage({t:'band',id:jid,yA:yA,bh:bh,buf:out.buffer},[out.buffer]);
 }
};`;
const GE={wk:[],mode:'chunk',ready:false,job:0,pend:null,fade:null,raf:0,
  stat:'',lastMs:0,aniso:2};
function initWorkers(){
  const hc=navigator.hardwareConcurrency||2, mem=navigator.deviceMemory||4;
  const n=Math.min(mem>=8?4:3,hc-1);
  if(n<2){GE.stat='chunk';GE.ready=true;return;}
  let url=null;
  try{
    url=URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'}));
    let pong=0,done=false;
    const fin=ok=>{ if(done)return; done=true;
      if(ok){GE.mode='worker';GE.stat='w'+GE.wk.length;
        /* 預先推送貼圖，避免首次精繪卡在資料傳輸 */
        setTimeout(()=>{GE.wk.forEach(o=>{ensureAll(o,'e',0);ensureAll(o,'l');ensureAll(o,'b');ensureAll(o,'w');});},300);}
      else{GE.wk.forEach(o=>{try{o.w.terminate();}catch(e){}});GE.wk=[];GE.mode='chunk';GE.stat='chunk';}
      GE.ready=true; };
    for(let i=0;i<n;i++){
      const w=new Worker(url);
      w.onerror=()=>fin(false);
      w.onmessage=ev=>{ if(ev.data&&ev.data.t==='pong'){ if(++pong===n)fin(true); return;} onBand(ev.data); };
      GE.wk.push({w,lv:{}});
    }
    GE.wk.forEach(o=>o.w.postMessage({t:'ping'}));
    setTimeout(()=>fin(pong===n),1500);
  }catch(e){ GE.wk=[]; GE.mode='chunk'; GE.stat='chunk'; GE.ready=true; }
  finally{ if(url) setTimeout(()=>URL.revokeObjectURL(url),3000); }
}
const CHAIN={e:'earth',l:'lights',b:'bump',w:'water'};
function ensureLv(o,kind,lv){
  const key=kind+lv; if(o.lv[key])return; o.lv[key]=1;
  const s=MIP[CHAIN[kind]][lv]; if(!s)return;
  const buf=s.p.slice().buffer;
  o.w.postMessage({t:'tex',kind,lv,w:s.w,h:s.h,buf},[buf]);
}
function ensureAll(o,kind,from){
  const m=MIP[CHAIN[kind]];
  for(let i=from||0;i<m.length;i++) ensureLv(o,kind,i);
}
function onBand(m){
  const S=GE.pend; if(!S||!m||m.id!==S.id)return;
  if(m.t==='fail'){S.need--; if(S.need<=0){GE.mode='chunk';GE.stat='chunk';} return;}
  if(m.t==='bmp'){
    LY.fc.drawImage(m.bmp,0,m.yA-S.p.by0);
    if(m.bmp.close)m.bmp.close();
  }else{
    const h=m.bh||1;
    LY.fc.putImageData(new ImageData(new Uint8ClampedArray(m.buf),S.p.bw,h),0,m.yA-S.p.by0);
  }
  if(--S.need<=0){GE.lastMs=performance.now()-S.t0; startFade(S);}
}

/* ---------- 地球參數 ---------- */
function globeParams(cv,view){
  const W=cv.width,H=cv.height; if(!W||!H||!MIP.earth.length)return null;
  const S=scaleOf(cv), pad=(view.padBottom||0)*S;
  const cx=W/2, cy=(H-pad)/2;
  const R=Math.min(W,H-pad)*0.44*view.zoom;
  const p0=view.lat*D2R,l0=view.lon*D2R;
  const C=V(cos(p0)*cos(l0),cos(p0)*sin(l0),sin(p0));
  const K=V(-sin(p0)*cos(l0),-sin(p0)*sin(l0),cos(p0));
  const E=V(-sin(l0),cos(l0),0);
  const RG=R*GLOW;
  const bx0=Math.max(0,flr(cx-RG-1)), bx1=Math.min(W,Math.ceil(cx+RG+1));
  const by0=Math.max(0,flr(cy-RG-1)), by1=Math.min(H,Math.ceil(cy+RG+1));
  const W0=MIP.earth[0].w;
  const lodC=log2(W0/(2*PI*R));
  const lmin=clamp(flr(lodC),0,MIP.earth.length-1);
  const proj=(lat,lon)=>{const la=lat*D2R,lo=lon*D2R;
    const p=V(cos(la)*cos(lo),cos(la)*sin(lo),sin(la));
    return {x:cx+R*dot(p,E),y:cy-R*dot(p,K),z:dot(p,C)};};
  const unproj=(x,y)=>{const sx=(x-cx)/R, sy=-(y-cy)/R, q=sx*sx+sy*sy;
    if(q>1)return null; const nz=sqrt(1-q);
    const w=V(sx*E.x+sy*K.x+nz*C.x, sx*E.y+sy*K.y+nz*C.y, sx*E.z+sy*K.z+nz*C.z);
    return {lat:asin(clamp(w.z,-1,1))*R2D, lon:n180(atan2(w.y,w.x)*R2D)};};
  return {W,H,S,cx,cy,R,C,K,E,bx0,by0,bw:Math.max(0,bx1-bx0),bh:Math.max(0,by1-by0),
          W0,lmin,lodC,proj,unproj};
}
const sunDir=scene=>{const s=scene.subSolar;
  return V(cos(s.lat*D2R)*cos(s.lon*D2R),cos(s.lat*D2R)*sin(s.lon*D2R),sin(s.lat*D2R));};
function jobOf(P,SD,step,q,sc){
  sc=sc||1;
  const W0=P.W0;
  return {cx:P.cx*sc,cy:P.cy*sc,R:P.R*sc,
    bx0:Math.round(P.bx0*sc),by0:Math.round(P.by0*sc),
    bw:Math.max(1,Math.round(P.bw*sc)),bh:Math.max(1,Math.round(P.bh*sc)),
    step,q,glow:GLOW,W0,lmin:q>0?P.lmin:0,
    fastLv:clamp(Math.round(log2(W0/(2*PI*P.R*sc))),0,MIP.earth.length-1),
    offB:log2(W0/MIP.bump[0].w), offW:log2(W0/MIP.water[0].w), offL:log2(W0/MIP.lights[0].w),
    aniso:GE.aniso, bump:0.018, sunI:1.42, amb:0.016, wrap:0.13, specI:1.75,
    lightI:0.95, hazeI:0.20, twI:0.085, glowI:0.62,
    Ex:P.E.x,Ey:P.E.y,Ez:P.E.z,Kx:P.K.x,Ky:P.K.y,Kz:P.K.z,Cx:P.C.x,Cy:P.C.y,Cz:P.C.z,
    Sx:SD.x,Sy:SD.y,Sz:SD.z};
}
/* ---------- 分層離屏：星空 / 粗繪 / 精繪 / 疊圖 ----------
   合成只用 drawImage（GPU blit），避免每次精繪把整張 ImageData 灌回畫布 */
const LY={sky:null,skyc:null,coarse:null,cc:null,fine:null,fc:null,ov:null,oc:null,W:0,H:0};
function mkCv(w,h,ro){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  return {c,x:c.getContext('2d',ro?{willReadFrequently:true}:undefined)};
}
function layers(P){
  if(LY.W===P.W&&LY.H===P.H&&LY.sky)return;
  LY.W=P.W; LY.H=P.H;
  const a=mkCv(P.W,P.H); LY.sky=a.c; LY.skyc=a.x;
  const s=LY.skyc;
  s.fillStyle='#03050b'; s.fillRect(0,0,P.W,P.H);
  for(const st of STARS){
    s.globalAlpha=st[2]*0.7; s.fillStyle='#cfd8ee';
    const r=st[2]*1.2*P.S; s.fillRect(st[0]*P.W,st[1]*P.H,r,r);
  }
  s.globalAlpha=1;
  const o=mkCv(P.W,P.H); LY.ov=o.c; LY.oc=o.x;
}
function composite(ctx,P,alpha,skipOv){
  ctx.globalAlpha=1;
  ctx.drawImage(LY.sky,0,0);
  if(LY.coarse) ctx.drawImage(LY.coarse,0,0,LY.coarse.width,LY.coarse.height,P.bx0,P.by0,P.bw,P.bh);
  if(alpha>0&&LY.fine){ctx.globalAlpha=alpha;ctx.drawImage(LY.fine,P.bx0,P.by0);ctx.globalAlpha=1;}
  if(!skipOv&&LY.ov) ctx.drawImage(LY.ov,0,0);
}
/* ---------- 主繪製 ---------- */
function renderGlobe(cv,scene,view,marks,quality,lang){
  const P=globeParams(cv,view); if(!P)return null;
  const ctx=cv.getContext('2d');
  const SD=sunDir(scene);
  cancelRefine();
  layers(P);
  if(P.bw>0&&P.bh>0){
    /* 粗繪：固定像素預算 → 拖曳成本與畫布大小無關 */
    /* 粗繪像素預算：拖曳時再省一點，放手用 140k（不會多出長幀），精繪隨後淡入 */
    const sc=clamp(Math.sqrt((quality==='low'?115000:140000)/(P.bw*P.bh)),0.14,0.60);
    const J=jobOf(P,SD,1,0,sc);
    if(!LY.coarse||LY.coarse.width!==J.bw||LY.coarse.height!==J.bh){
      const a=mkCv(J.bw,J.bh,true); LY.coarse=a.c; LY.cc=a.x;
    }
    const img=LY.cc.createImageData(J.bw,J.bh);
    fillSphere(img.data,J,MIP.earth,MIP.lights,MIP.bump,MIP.water,J.by0,J.by0+J.bh);
    LY.cc.putImageData(img,0,0);
  }
  LY.oc.clearRect(0,0,P.W,P.H);
  drawGlobeOverlay(LY.oc,P,scene,marks,view,quality,lang);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  composite(ctx,P,0);
  if(quality!=='low'&&P.bw>0&&P.bh>0) startRefine(cv,ctx,P,SD);
  return P;
}
function cancelRefine(){ if(GE.raf){cancelAnimationFrame(GE.raf);GE.raf=0;} GE.pend=null; GE.fade=null; }
function startRefine(cv,ctx,P,SD){
  const id=++GE.job;
  if(!LY.fine||LY.fine.width!==P.bw||LY.fine.height!==P.bh){
    const a=mkCv(P.bw,P.bh); LY.fine=a.c; LY.fc=a.x;
  }else LY.fc.clearRect(0,0,P.bw,P.bh);
  const nw=Math.max(1,GE.wk.length);
  const nb=(GE.mode==='worker')
    ? clamp(Math.round(P.bh/150),nw,12)
    : Math.max(1,Math.min(40,Math.ceil(P.bh/32)));   /* 無 Worker 時切更細，單幀不超時 */
  const ed=[]; for(let i=0;i<=nb;i++) ed.push(P.by0+Math.round(P.bh*i/nb));
  GE.pend={id,p:P,ctx,cv,need:nb,t0:performance.now()};
  const J=jobOf(P,SD,1,1,1);
  if(GE.mode==='worker'&&GE.wk.length){
    GE.wk.forEach(o=>{ensureAll(o,'e',P.lmin);ensureAll(o,'l');ensureAll(o,'b');ensureAll(o,'w');});
    for(let i=0;i<nb;i++){
      const o=GE.wk[i%GE.wk.length];
      o.w.postMessage({t:'job',id,J,yA:ed[i],yB:ed[i+1]});
    }
    setTimeout(()=>{ if(GE.pend&&GE.pend.id===id&&GE.pend.need>0){
      GE.mode='chunk';GE.stat='chunk'; cancelRefine(); startRefine(cv,ctx,P,SD); } },4000);
  }else{
    let i=0;
    const step=()=>{
      const S=GE.pend; if(!S||S.id!==id)return;
      const t0=performance.now();
      while(i<nb&&performance.now()-t0<5){
        const h=ed[i+1]-ed[i];
        const bJ={}; for(const k in J)bJ[k]=J[k];
        bJ.by0=ed[i]; bJ.bh=h;
        const bi=LY.fc.createImageData(P.bw,h);
        fillSphere(bi.data,bJ,MIP.earth,MIP.lights,MIP.bump,MIP.water,ed[i],ed[i+1]);
        LY.fc.putImageData(bi,0,ed[i]-P.by0);
        i++;
      }
      S.need=nb-i;
      if(i>=nb){GE.lastMs=performance.now()-S.t0; startFade(S);}
      else GE.raf=requestAnimationFrame(step);
    };
    GE.raf=requestAnimationFrame(step);
  }
}
/* 精繪完成後淡入，避免模糊→銳利的瞬間跳動 */
function startFade(S){
  GE.pend=null; GE.raf=0;
  const P=S.p, ctx=S.ctx, id=S.id;
  GE.fade={id,t:0};
  const step=()=>{
    const f=GE.fade; if(!f||f.id!==id)return;
    f.t+=0.24;
    const a=f.t>=1?1:f.t*f.t*(3-2*f.t);
    composite(ctx,P,a);
    if(f.t<1) GE.raf=requestAnimationFrame(step);
    else {GE.raf=0; GE.fade=null;}
  };
  GE.raf=requestAnimationFrame(step);
}
/* ---------- 疊圖 ---------- */
function drawGlobeOverlay(ctx,P,scene,marks,view,quality,lang){
  const S=P.S, proj=P.proj;
  if(quality!=='low'){
    ctx.save(); ctx.lineWidth=1*S;
    const line=(pts,col)=>{ctx.strokeStyle=col;ctx.beginPath();let pen=false;
      for(const p of pts){if(p.z>0.002){if(pen)ctx.lineTo(p.x,p.y);else{ctx.moveTo(p.x,p.y);pen=true;}}else pen=false;}
      ctx.stroke();};
    for(let la=-60;la<=60;la+=30){const pts=[];for(let lo=-180;lo<=180;lo+=4)pts.push(proj(la,lo));
      line(pts,la===0?'rgba(150,200,255,.26)':'rgba(180,206,242,.10)');}
    for(let lo=-180;lo<180;lo+=30){const pts=[];for(let la=-88;la<=88;la+=4)pts.push(proj(la,lo));
      line(pts,lo===0?'rgba(150,200,255,.24)':'rgba(180,206,242,.10)');}
    ctx.restore();
  }
  const reserved=(view.avoid||[]).slice();
  const pS=proj(scene.subSolar.lat,scene.subSolar.lon), pM=proj(scene.subLunar.lat,scene.subLunar.lon);
  if(pS.z>0)reserved.push({x:pS.x-9*S,y:pS.y-9*S,w:18*S,h:18*S});
  if(pM.z>0)reserved.push({x:pM.x-9*S,y:pM.y-9*S,w:18*S,h:18*S});
  for(const m of marks){const q=proj(m.lat,m.lon);
    if(q.z>0)reserved.push({x:q.x-11*S,y:q.y-11*S,w:56*S,h:22*S});}
  drawCityLabels(ctx,P,view,lang,quality==='low'?0:undefined,reserved,view.sel||[]);
  const spot=(p,col,glyph)=>{
    if(p.z<=0)return;
    ctx.save();
    ctx.beginPath(); ctx.arc(p.x,p.y,7.5*S,0,6.2832);
    ctx.fillStyle='rgba(6,10,18,.6)'; ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=1.3*S; ctx.stroke();
    ctx.fillStyle=col; ctx.font=fnt('400',9.5*S);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(glyph,p.x,p.y+.5*S);
    ctx.restore();
  };
  spot(pS,'#ffd75e','☀'); spot(pM,'#dfe6f5','☾');
  for(const m of marks){
    const p=proj(m.lat,m.lon); if(p.z<=0)continue;
    ctx.save();
    ctx.beginPath(); ctx.arc(p.x,p.y,4.6*S,0,6.2832);
    ctx.fillStyle=m.col;
    if(quality!=='low'){ctx.shadowColor=m.col;ctx.shadowBlur=11*S;}   /* 陰影模糊在拖曳時太貴 */
    ctx.fill(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(p.x,p.y,9.5*S,0,6.2832);
    ctx.strokeStyle=m.col; ctx.globalAlpha=.55; ctx.lineWidth=1.2*S; ctx.stroke(); ctx.globalAlpha=1;
    ctx.font=fnt('700',11.5*S); ctx.textAlign='left'; ctx.textBaseline='middle';
    const tx=p.x+14*S, ty=p.y-S, wd=ctx.measureText(m.label).width;
    ctx.fillStyle='rgba(5,8,16,.78)';
    ctx.beginPath(); ctx.roundRect(tx-4*S,ty-8.5*S,wd+8*S,17*S,5*S); ctx.fill();
    ctx.fillStyle=m.col; ctx.fillText(m.label,tx,ty);
    ctx.restore();
  }
}
function drawCityLabels(ctx,P,view,lang,cap,reserved,skip){
  GLOBE_LABELS.length=0;
  if(!view.labels)return;
  const S=P.S, z=view.zoom;
  let mr=z<1.25?0:(z<2.0?1:2);
  if(cap!==undefined) mr=Math.min(mr,cap);
  const cand=[];
  for(let i=0;i<CITIES.length;i++){
    const c=CITIES[i]; if(c[5]>mr)continue;
    if(skip&&skip.indexOf(i)>=0)continue;
    const p=P.proj(c[2],c[3]); if(p.z<=0.07)continue;
    if(p.x<-30||p.x>P.W+30||p.y<-20||p.y>P.H+20)continue;
    cand.push({p,i,r:c[5]});
  }
  cand.sort((a,b)=>a.r-b.r||b.p.z-a.p.z);
  ctx.save();
  ctx.font=fnt('500',10.5*S); ctx.textBaseline='middle'; ctx.textAlign='left';
  const boxes=(reserved||[]).slice(), gap=2*S;
  for(const it of cand){
    if(GLOBE_LABELS.length>=72)break;
    const c=CITIES[it.i], txt=lang==='en'?c[1]:c[0];
    const w=ctx.measureText(txt).width+6*S, h=15*S;
    const bx=it.p.x+7*S, by=it.p.y-h/2;
    let hit=false;
    for(const b of boxes){
      if(bx<b.x+b.w+gap&&bx+w+gap>b.x&&by<b.y+b.h&&by+h>b.y){hit=true;break;}
    }
    if(hit)continue;
    boxes.push({x:bx,y:by,w,h});
    GLOBE_LABELS.push({x:it.p.x,y:it.p.y,bx,by,bw:w,bh:h,ci:it.i});
    ctx.fillStyle='rgba(5,9,17,.62)';
    ctx.beginPath(); ctx.roundRect(bx-3*S,by,w,h,4*S); ctx.fill();
    ctx.fillStyle=c[5]===0?'rgba(233,241,255,.95)':'rgba(206,219,242,.88)';
    ctx.fillText(txt,bx,by+h/2+0.5*S);
    ctx.beginPath(); ctx.arc(it.p.x,it.p.y,2*S,0,6.2832);
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fill();
  }
  ctx.restore();
}
function pickCityLabel(px,py,S){
  for(const l of GLOBE_LABELS){
    if(px>=l.bx-5*S&&px<=l.bx+l.bw+3*S&&py>=l.by-2*S&&py<=l.by+l.bh+2*S)return l.ci;
    if(Math.hypot(px-l.x,py-l.y)<9*S)return l.ci;
  }
  return -1;
}

/* ============================================================
   天空顏色 / 受光球體
   ============================================================ */
const SKYK=[
 [ 60,[ 26, 88,190],[128,176,230]],[ 20,[ 30, 96,200],[140,186,236]],
 [  6,[ 40, 94,178],[184,200,222]],[  1,[ 46, 82,150],[228,178,126]],
 [ -1,[ 40, 64,126],[234,142, 82]],[ -4,[ 32, 50,104],[208, 98, 60]],
 [ -8,[ 22, 36, 80],[142, 64, 64]],[-12,[ 14, 24, 58],[ 64, 46, 84]],
 [-15,[ 10, 16, 42],[ 32, 30, 62]],[-18,[  7, 11, 30],[ 18, 22, 46]],
 [-90,[  4,  6, 16],[  9, 12, 27]]];
function skyCols(alt){
  if(alt>=SKYK[0][0])return [SKYK[0][1],SKYK[0][2]];
  for(let i=0;i<SKYK.length-1;i++){
    const a=SKYK[i],b=SKYK[i+1];
    if(alt<=a[0]&&alt>=b[0]){const t=(a[0]-alt)/(a[0]-b[0]);return [lerp3(a[1],b[1],t),lerp3(a[2],b[2],t)];}
  }
  return [SKYK[10][1],SKYK[10][2]];
}
function litSphere(ctx,cx,cy,R,L,cLit,cDark,stroke,lw){
  const p=Math.hypot(L.x,L.y);
  ctx.beginPath(); ctx.arc(cx,cy,R,0,6.2832); ctx.fillStyle=cDark; ctx.fill();
  if(p<1e-6){ if(L.z>0){ctx.fillStyle=cLit;ctx.fill();} }
  else{
    const ang=atan2(-L.y/p,L.x/p), e=-L.z;
    ctx.beginPath();
    ctx.ellipse(cx,cy,R,R,ang,-PI/2,PI/2,false);
    if(e>=0) ctx.ellipse(cx,cy,R*e,R,ang,PI/2,-PI/2,true);
    else     ctx.ellipse(cx,cy,-R*e,R,ang,PI/2,3*PI/2,false);
    ctx.closePath(); ctx.fillStyle=cLit; ctx.fill();
  }
  if(stroke){ctx.beginPath();ctx.arc(cx,cy,R,0,6.2832);ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}
}

/* ============================================================
   月面視圖（天頂朝上，可縮放／平移）
   opt.zoom 放大倍率、opt.ox/oy 以基準半徑為單位的平移量
   ============================================================ */
const MOON_LON0=-101.997070, MOON_LON1=101.997070, MOON_LSPAN=MOON_LON1-MOON_LON0;
const MOON_FILL=0.42, MOON_CY=0.50;    /* 月面半徑佔畫布比例、圓心高度 */
function moonGeom(cv,ob,opt){
  const W=cv.width,H=cv.height;
  const S=clamp(W/(cv.clientWidth||W),1,3), small=(cv.clientWidth||W)<200;
  /* 方位環與其標籤必須留在畫布內，反推月面半徑上限 */
  const edge=Math.min(W*0.5,H*MOON_CY,H*(1-MOON_CY));
  const rmax=Math.max(Math.min(W,H)*0.30,(edge-(small?15:20)*S)/1.03);
  let base=Math.min(Math.min(W,H)*MOON_FILL,rmax);
  base*=(opt.trueSize?(ob.angDiam/31.08):1);
  const z=opt.zoom||1;
  return {W,H,S,small,base,R:base*z,z,
    cx:W/2+(opt.ox||0)*base, cy:H*MOON_CY+(opt.oy||0)*base};
}
function renderMoon(cv,ob,scene,opt){
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  const W=cv.width,H=cv.height; if(!W||!H)return;
  const S=scaleOf(cv), small=(cv.clientWidth||W)<200;
  const [ct,cb]=skyCols(ob.sunAlt);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,rgbs(ct)); g.addColorStop(1,rgbs(cb));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const G=moonGeom(cv,ob,opt), R=G.R, cx=G.cx, cy=G.cy;
  const nf=clamp((-ob.sunAlt-9)/9,0,1);
  if(nf>0.02){
    ctx.save();
    for(const s of STARS){
      const sx=s[0]*W, sy=s[1]*H;
      if(Math.hypot(sx-cx,sy-cy)<R*1.5)continue;
      ctx.globalAlpha=nf*s[2]*0.85; ctx.fillStyle='#fff';
      const r=s[2]*1.15*S; ctx.fillRect(sx,sy,r,r);
    }
    ctx.restore();
  }
  const below=ob.alt<0;
  if(!below&&ob.k>0.03&&G.z<2.2){
    const gr=ctx.createRadialGradient(cx,cy,R*0.82,cx,cy,R*(2.0+1.5*nf));
    const a=(0.10+0.19*nf)*ob.k*clamp(1-ob.airmass/14,0.15,1);
    gr.addColorStop(0,'rgba(215,226,255,'+a.toFixed(3)+')');
    gr.addColorStop(1,'rgba(215,226,255,0)');
    ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
  }
  const x0=Math.max(0,flr(cx-R-2)), x1=Math.min(W,Math.ceil(cx+R+2));
  const y0=Math.max(0,flr(cy-R-2)), y1=Math.min(H,Math.ceil(cy+R+2));
  if(x1>x0&&y1>y0&&TEX.moon){
    const im=ctx.getImageData(x0,y0,x1-x0,y1-y0), px=im.data, bw=x1-x0;
    const tw=TEX.moon.w, th=TEX.moon.h, td=TEX.moon.d;
    const L=ob.L, Xc=ob.Xc, Yc=ob.Yc, Zc=ob.Zc;
    let er,eg,eb2,dim;
    if(below){er=eg=eb2=1; dim=0.42;}
    else{const X=clamp(ob.airmass,1,18);
      er=pow(10,-0.4*0.10*(X-1)); eg=pow(10,-0.4*0.17*(X-1)); eb2=pow(10,-0.4*0.30*(X-1)); dim=1;}
    const df=clamp((ob.sunAlt+5)/13,0,1);
    const wash=[cb[0]*0.55+ct[0]*0.45,cb[1]*0.55+ct[1]*0.45,cb[2]*0.55+ct[2]*0.45];
    const earthshine=0.075*pow(1-ob.k,1.2);
    const invR=1/R;
    for(let y=y0;y<y1;y++){
      const ny=(cy-y+0.5)*invR;
      for(let x=x0;x<x1;x++){
        const nx=(x-cx+0.5)*invR, r2=nx*nx+ny*ny;
        if(r2>1.06)continue;
        const cov=clamp((1-sqrt(r2))*R+0.5,0,1); if(cov<=0.002)continue;
        const nz=sqrt(Math.max(0,1-Math.min(r2,1)));
        const bx=nx*Xc.x+ny*Xc.y+nz*Xc.z;
        const by=nx*Yc.x+ny*Yc.y+nz*Yc.z;
        const bz=nx*Zc.x+ny*Zc.y+nz*Zc.z;
        const lat=asin(clamp(bz,-1,1))*R2D, lon=atan2(by,bx)*R2D;
        let u=(lon-MOON_LON0)/MOON_LSPAN*(tw-1), v=(0.5-lat/180)*(th-1);
        u=clamp(u,0,tw-1.002); v=clamp(v,0,th-1.002);
        const ix=u|0, iy=v|0, fx=u-ix, fy=v-iy, i00=(iy*tw+ix)*4;
        const alb=(td[i00]*(1-fx)+td[i00+4]*fx)*(1-fy)+(td[i00+tw*4]*(1-fx)+td[i00+tw*4+4]*fx)*fy;
        const mu0=clamp(nx*L.x+ny*L.y+nz*L.z,0,1);
        let lit=2*mu0/(mu0+nz+0.0018); if(lit>1.42)lit=1.42;
        lit*=smooth(0,0.035,mu0);
        const b=alb*(lit+earthshine)/255*dim;
        let cr=b*er, cg=b*0.972*eg, cbb=b*0.925*eb2;
        if(below){cr*=0.62;cg*=0.66;cbb*=0.78;}
        let R8=clamp(cr*258,0,255), G8=clamp(cg*258,0,255), B8=clamp(cbb*258,0,255);
        if(df>0){const m=df*0.30;R8=R8*(1-m)+wash[0]*m;G8=G8*(1-m)+wash[1]*m;B8=B8*(1-m)+wash[2]*m;}
        const o=((y-y0)*bw+(x-x0))*4;
        px[o]=px[o]*(1-cov)+R8*cov;
        px[o+1]=px[o+1]*(1-cov)+G8*cov;
        px[o+2]=px[o+2]*(1-cov)+B8*cov;
      }
    }
    ctx.putImageData(im,x0,y0);
  }
  if(opt.ring!==false&&G.z<1.6){
    const rr=R*1.03+2*S;
    ctx.save();
    ctx.strokeStyle='rgba(200,214,240,.17)'; ctx.lineWidth=1*S;
    ctx.setLineDash([2*S,5*S]); ctx.beginPath(); ctx.arc(cx,cy,rr,0,6.2832); ctx.stroke();
    ctx.setLineDash([]);
    const tick=(ang,col,lab,ln)=>{
      const a=ang*D2R, ux=sin(a), uy=-cos(a);
      ctx.strokeStyle=col; ctx.lineWidth=1.7*S; ctx.beginPath();
      ctx.moveTo(cx+ux*(rr-S),cy+uy*(rr-S)); ctx.lineTo(cx+ux*(rr+ln*0.85*S),cy+uy*(rr+ln*0.85*S)); ctx.stroke();
      ctx.fillStyle=col; ctx.font=fnt('600',(small?9:10.5)*S);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const d2=rr+(small?9:12)*S;
      ctx.fillText(lab,cx+ux*d2,cy+uy*d2);
    };
    tick(0,'rgba(152,172,208,.8)','Z',5);
    tick(ob.poleAng,'rgba(120,190,255,.92)','N',7);
    tick(ob.limbAng,'rgba(255,214,110,.95)','☉',7);
    ctx.restore();
  }
  ctx.save();
  const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.72);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.30)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); ctx.restore();
}

/* ============================================================
   天空全景條
   ============================================================ */
function renderSkyStrip(cv,ob,scene,lang){
  const ctx=cv.getContext('2d'); const W=cv.width,H=cv.height; if(!W||!H)return;
  const S=scaleOf(cv), A0=-14,A1=92;
  const ax=az=>az/360*W, ay=al=>H-(al-A0)/(A1-A0)*H;
  const [ct,cb]=skyCols(ob.sunAlt), hz=ay(0);
  const g=ctx.createLinearGradient(0,0,0,hz);
  g.addColorStop(0,rgbs(ct)); g.addColorStop(1,rgbs(cb));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,hz);
  const sx=ax(ob.sunAz), sy=ay(clamp(ob.sunAlt,-13,91));
  const gr=ctx.createRadialGradient(sx,sy,0,sx,sy,W*0.30);
  const ga=clamp((ob.sunAlt+12)/24,0,1);
  gr.addColorStop(0,'rgba(255,226,150,'+(0.42*ga).toFixed(3)+')');
  gr.addColorStop(1,'rgba(255,200,120,0)');
  ctx.fillStyle=gr; ctx.fillRect(0,0,W,hz);
  if(ob.sunAlt<-9){
    ctx.save();
    for(const s of STARS){ctx.globalAlpha=s[2]*0.5;ctx.fillStyle='#e8eefb';ctx.fillRect(s[0]*W,s[1]*hz,S,S);}
    ctx.restore();
  }
  ctx.fillStyle='#090c14'; ctx.fillRect(0,hz,W,H-hz);
  ctx.strokeStyle='rgba(160,180,215,.45)'; ctx.lineWidth=1*S;
  ctx.beginPath(); ctx.moveTo(0,hz); ctx.lineTo(W,hz); ctx.stroke();
  ctx.save(); ctx.setLineDash([2*S,4*S]); ctx.strokeStyle='rgba(160,180,215,.16)'; ctx.lineWidth=1*S;
  for(const a of [30,60]){ctx.beginPath();ctx.moveTo(0,ay(a));ctx.lineTo(W,ay(a));ctx.stroke();}
  for(let az=45;az<360;az+=45){ctx.beginPath();ctx.moveTo(ax(az),0);ctx.lineTo(ax(az),hz);ctx.stroke();}
  ctx.restore();
  ctx.font=fnt('400',9.5*S); ctx.textBaseline='bottom'; ctx.textAlign='center';
  ctx.fillStyle='rgba(186,200,226,.78)';
  const NM=lang==='en'?['N','E','S','W','N']:['北','東','南','西','北'];
  [0,90,180,270,360].forEach((az,i)=>ctx.fillText(NM[i],clamp(ax(az),10*S,W-10*S),H-2*S));
  ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(186,200,226,.45)';
  ctx.fillText('60°',3*S,ay(60)); ctx.fillText('30°',3*S,ay(30));
  if(ob.sunAlt>-13){
    ctx.save(); ctx.beginPath(); ctx.arc(sx,sy,4.4*S,0,6.2832);
    ctx.fillStyle=ob.sunAlt>0?'#ffe07a':'#e89050';
    ctx.shadowColor='#ffd75e'; ctx.shadowBlur=10*S; ctx.fill(); ctx.restore();
  }
  const mx=ax(ob.az), my=ay(clamp(ob.alt,-13,91));
  const dx=sx-mx, dy=sy-my, dl=Math.hypot(dx,dy)||1;
  const lz=2*ob.k-1, ip=sqrt(Math.max(0,1-lz*lz));
  litSphere(ctx,mx,my,5.6*S,{x:dx/dl*ip,y:-dy/dl*ip,z:lz},
    ob.alt>0?'#eef2fb':'#93a0bb','rgba(24,30,46,.92)','rgba(190,204,232,.55)',1*S);
  if(ob.alt<0){ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#090c14';ctx.fillRect(0,hz,W,H-hz);ctx.restore();}
}

/* ============================================================
   日–地–月 幾何示意
   ============================================================ */
function renderGeo(cv,scene,obs,lang){
  const ctx=cv.getContext('2d'); const W=cv.width,H=cv.height; if(!W||!H)return;
  const S=scaleOf(cv);
  const gbg=ctx.createLinearGradient(0,0,0,H);
  gbg.addColorStop(0,'#050811'); gbg.addColorStop(1,'#080c18');
  ctx.fillStyle=gbg; ctx.fillRect(0,0,W,H);
  const EL=28*D2R;
  const Cv=V(0,-cos(EL),sin(EL)), Rv=V(-1,0,0), Uv=V(0,sin(EL),cos(EL));
  const cx=W*0.60, cy=H*0.52, orb=Math.min(W*0.31,H*0.40);
  const pr=p=>({x:cx+orb*dot(p,Rv),y:cy-orb*dot(p,Uv),z:dot(p,Cv)});
  const dl=(scene.moon.lon-scene.sun.lon)*D2R, be=scene.moon.lat*D2R;
  const mdir=V(cos(be)*cos(dl),cos(be)*sin(dl),sin(be));
  const sg=ctx.createLinearGradient(0,0,W*0.42,0);
  sg.addColorStop(0,'rgba(255,208,110,.26)'); sg.addColorStop(1,'rgba(255,208,110,0)');
  ctx.fillStyle=sg; ctx.fillRect(0,0,W*0.42,H);
  ctx.save();
  const sgr=ctx.createRadialGradient(-6*S,H/2,2,-6*S,H/2,H*0.62);
  sgr.addColorStop(0,'#fff0c0'); sgr.addColorStop(.35,'#ffca52'); sgr.addColorStop(1,'rgba(255,190,60,0)');
  ctx.fillStyle=sgr; ctx.beginPath(); ctx.arc(-6*S,H/2,H*0.62,0,6.2832); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle='rgba(255,214,120,.26)'; ctx.lineWidth=1*S; ctx.setLineDash([5*S,5*S]);
  for(let i=0;i<5;i++){const y=H*(0.16+i*0.17);ctx.beginPath();ctx.moveTo(W*0.10,y);ctx.lineTo(W*0.34,y);ctx.stroke();}
  ctx.restore();
  ctx.fillStyle='#ffd77a'; ctx.font=fnt('600',11*S);
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(lang==='en'?'SUN →':'太陽 →',9*S,9*S);
  ctx.save(); ctx.strokeStyle='rgba(150,175,220,.26)'; ctx.lineWidth=1*S; ctx.setLineDash([3*S,4*S]);
  ctx.beginPath();
  for(let a=0;a<=360;a+=3){const p=pr(V(cos(a*D2R),sin(a*D2R),0));if(a===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
  ctx.stroke(); ctx.restore();
  const mp=pr(mdir);
  ctx.save(); ctx.lineWidth=1*S; ctx.setLineDash([4*S,3*S]);
  ctx.strokeStyle='rgba(150,175,220,.45)';
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(mp.x,mp.y); ctx.stroke();
  ctx.strokeStyle='rgba(255,214,120,.45)';
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-orb*1.02,cy); ctx.stroke(); ctx.restore();
  const a1=atan2(mp.y-cy,mp.x-cx);
  ctx.save(); ctx.strokeStyle='rgba(138,168,255,.55)'; ctx.lineWidth=1.4*S;
  ctx.beginPath(); ctx.arc(cx,cy,orb*0.30,PI,a1,a1>0); ctx.stroke(); ctx.restore();
  const Re=Math.max(13*S,Math.min(W,H)*0.088);
  const Ls={x:dot(V(1,0,0),Rv),y:dot(V(1,0,0),Uv),z:dot(V(1,0,0),Cv)};
  litSphere(ctx,cx,cy,Re,Ls,'#2f74c4','#0d1b30','rgba(130,170,230,.5)',1*S);
  const eps=scene.eps*D2R, sl=scene.sun.lon*D2R;
  const npole=V(sin(eps)*sin(sl),sin(eps)*cos(sl),cos(eps));
  const pa=pr(mul(npole,Re/orb*1.45)), pb=pr(mul(npole,-Re/orb*1.45));
  ctx.save(); ctx.strokeStyle='rgba(190,210,245,.5)'; ctx.lineWidth=1*S; ctx.setLineDash([3*S,3*S]);
  ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); ctx.restore();
  for(const o of obs){
    const e=rotEq2Ecl(unit(o.ob.basis.pos),scene.eps);
    const cs=cos(-sl), sn=sin(-sl);
    const q=pr(mul(V(e.x*cs-e.y*sn,e.x*sn+e.y*cs,e.z),Re/orb));
    ctx.save();
    if(q.z<=0)ctx.globalAlpha=.3;
    ctx.beginPath(); ctx.arc(q.x,q.y,3.4*S,0,6.2832);
    ctx.fillStyle=o.col; ctx.shadowColor=o.col; ctx.shadowBlur=q.z>0?9*S:0; ctx.fill(); ctx.shadowBlur=0;
    ctx.font=fnt('700',10*S); ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText(o.label,q.x,q.y-5*S);
    ctx.restore();
  }
  const mToS=unit(sub(V(scene.sun.r,0,0),mul(mdir,scene.moon.r)));
  const Lm={x:dot(mToS,Rv),y:dot(mToS,Uv),z:dot(mToS,Cv)};
  const Rm=Math.max(6.5*S,Math.min(W,H)*0.042);
  ctx.save(); ctx.shadowColor='rgba(220,230,255,.5)'; ctx.shadowBlur=10*S;
  litSphere(ctx,mp.x,mp.y,Rm,Lm,'#e9eefb','#141a2a','rgba(200,214,240,.55)',1*S);
  ctx.restore();
  ctx.font=fnt('400',10*S); ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillStyle='rgba(184,200,228,.88)';
  const L1=lang==='en'?'elongation':'日月距角',L2=lang==='en'?'phase angle':'相位角',
        L3=lang==='en'?'illuminated':'照明率';
  ctx.fillText(L1+'  '+scene.elongEcl.toFixed(1)+'°',W-8*S,7*S);
  ctx.fillText(L2+'  '+scene.phase.toFixed(1)+'°',W-8*S,21*S);
  ctx.fillText(L3+'  '+(scene.k*100).toFixed(1)+'%',W-8*S,35*S);
  ctx.textAlign='left'; ctx.textBaseline='bottom'; ctx.fillStyle='rgba(122,138,166,.85)';
  ctx.fillText(lang==='en'?'not to scale':'非等比例',9*S,H-6*S);
}
