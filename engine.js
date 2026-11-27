'use strict';
// Guitar Studio — motore di analisi audio (calcolo puro, senza accesso a DOM o microfono).
// Contiene: rilevamento dell'altezza, rilevamento degli attacchi (onset), tracciamento delle note,
// cromagramma e riconoscimento degli accordi. Usato da game.js e collaudabile in Node.
(function(root){
  const NOTE_IT=['DO','DO♯','RE','RE♯','MI','FA','FA♯','SOL','SOL♯','LA','LA♯','SI'];
  const NOTE_INT=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const OPEN=[40,45,50,55,59,64];                  // MI (E) LA (A) RE (D) SOL (G) SI (B) MI (E): dalla 6ª alla 1ª corda
  const midiToFreq=m=>440*Math.pow(2,(m-69)/12);
  const freqToMidi=f=>69+12*Math.log2(f/440);
  const noteName=m=>{const pc=((Math.round(m)%12)+12)%12;return{it:NOTE_IT[pc],intl:NOTE_INT[pc],label:`${NOTE_IT[pc]} (${NOTE_INT[pc]})`,pc,midi:Math.round(m)}};
  const pcLabel=pc=>`${NOTE_IT[pc]} (${NOTE_INT[pc]})`;
  const stringNote=(str,fret)=>OPEN[6-str]+fret;   // str: 1 = più acuta … 6 = più grave

  /* ---------- Altezza (NSDF, come l'accordatore ma con gamma estesa fino a ~1000 Hz) ---------- */
  function pitch(buf,sr,minHz=75,maxHz=1000){
    const n=buf.length;let e=0;for(let i=0;i<n;i++)e+=buf[i]*buf[i];const rms=Math.sqrt(e/n);
    const minLag=Math.max(2,Math.floor(sr/maxHz)),maxLag=Math.min(Math.floor(sr/minHz),Math.floor(n/2)),W=n-maxLag-2;
    if(W<64)return{f:-1,clarity:0,rms};
    const nsdf=new Float32Array(maxLag+2);
    for(let lag=minLag-1;lag<=maxLag+1;lag++){let acf=0,m=0;for(let i=0;i<W;i+=2){const a=buf[i],b=buf[i+lag];acf+=a*b;m+=a*a+b*b}nsdf[lag]=m?2*acf/m:0}
    let top=0;const peaks=[];
    for(let lag=minLag;lag<=maxLag;lag++){if(nsdf[lag]>.5&&nsdf[lag]>nsdf[lag-1]&&nsdf[lag]>=nsdf[lag+1]){peaks.push(lag);if(nsdf[lag]>top)top=nsdf[lag]}}
    const lag=peaks.find(l=>nsdf[l]>=.9*top);
    if(lag===undefined)return{f:-1,clarity:0,rms};
    const y1=nsdf[lag-1],y2=nsdf[lag],y3=nsdf[lag+1],den=y1-2*y2+y3,shift=den?.5*(y1-y3)/den:0;
    return{f:sr/(lag+shift),clarity:y2,rms};
  }
  // Ampiezza spettrale a una frequenza (Goertzel con finestra di Hann)
  function mag(buf,sr,f){const n=buf.length;let re=0,im=0;const w=2*Math.PI*f/sr;for(let i=0;i<n;i++){const h=.5-.5*Math.cos(2*Math.PI*i/(n-1));re+=buf[i]*h*Math.cos(w*i);im-=buf[i]*h*Math.sin(w*i)}return Math.hypot(re,im)}
  // Altezza con controllo dell'ottava: se manca energia alla fondamentale trovata (ma c'è alla sua doppia), era un errore d'ottava in giù.
  function pitchChecked(buf,sr,minHz,maxHz){
    const p=pitch(buf,sr,minHz,maxHz);
    if(p.f>0&&p.f*2<(maxHz||1000)){const a=mag(buf,sr,p.f),b=mag(buf,sr,p.f*2),c=mag(buf,sr,p.f*1.5);if(a<.3*b&&a<.5*c+1e-9||a<.2*b){p.f*=2}}
    return p;
  }
  const rmsLast=(buf,count)=>{const n=Math.min(count,buf.length);let e=0;for(let i=buf.length-n;i<buf.length;i++)e+=buf[i]*buf[i];return Math.sqrt(e/n)};
  // Energia delle alte frequenze (differenza prima): cresce di colpo quando una corda viene pizzicata, anche se la nota precedente suona ancora.
  const hfLast=(buf,count)=>{const n=Math.min(count,buf.length-1);let e=0;for(let i=buf.length-n;i<buf.length;i++){const d=buf[i]-buf[i-1];e+=d*d}return Math.sqrt(e/n)};

  /* ---------- Tracciamento delle note: attacco + altezza stabile ---------- */
  // frame(t, rms, f, clarity) viene chiamato a ogni analisi (~60 volte al secondo).
  // Produce eventi {type:'onset'|'note'|'noise', t, ...}. t è il tempo (secondi) dell'attacco.
  class NoteTracker{
    constructor(opt={}){this.thr=opt.threshold||.012;this.ratio=opt.ratio||1.3;this.settle=opt.settle||.042;this.refractory=opt.refractory||.14;this.fluxMin=opt.fluxMin||2.6;this.reset()}
    reset(){this.hist=[];this.lastOnset=-9;this.cur=null;this.mutedUntil=-1}
    mute(until){this.mutedUntil=Math.max(this.mutedUntil,until);this.cur=null}
    frame(t,rms,f,clarity,flux=0,tOnset){
      const ev=[];
      const recent=this.hist.filter(h=>t-h.t<=.06);const prev=recent.length?recent.reduce((a,h)=>a+h.rms,0)/recent.length:0;
      this.hist.push({t,rms});if(this.hist.length>20)this.hist.shift();
      if(t<this.mutedUntil)return ev;
      const rise=rms>prev*this.ratio+.004&&(prev<this.thr*.7||rms>prev*2.2),fluxRise=flux>this.fluxMin;
      if(rms>this.thr&&(rise||fluxRise)&&t-this.lastOnset>this.refractory){
        const to=tOnset===undefined?t:tOnset;
        this.lastOnset=t;this.cur={t:to,tStart:t,pitches:[],done:false};ev.push({type:'onset',t:to,rms});
      }
      const c=this.cur;
      if(c&&!c.done){
        if(t-c.tStart>=this.settle&&f>0&&clarity>=.8&&rms>this.thr*.6){
          c.pitches.push({f,t});const n=c.pitches.length;
          if(n>=2){const a=c.pitches[n-1],b=c.pitches[n-2];
            if(Math.abs(1200*Math.log2(a.f/b.f))<60){
              const fm=Math.sqrt(a.f*b.f),m=freqToMidi(fm),mid=Math.round(m);
              c.done=true;ev.push({type:'note',t:c.t,tDetected:t,f:fm,midi:mid,cents:(m-mid)*100,clarity:Math.min(a.clarity,b.clarity),rms});
            }}
        }
        if(!c.done&&t-c.tStart>.45){c.done=true;ev.push({type:'noise',t:c.t})}
      }
      return ev;
    }
  }

  /* ---------- Altezza di una nota nuova che si sovrappone a corde ancora in vibrazione ----------
     Si confronta lo spettro DOPO l'attacco con quello PRIMA: restano solo i picchi nuovi. */
  const hannCache={};
  function spectrum(buf,sr){
    const n=buf.length;if(!hannCache[n]){hannCache[n]=new Float32Array(n);for(let i=0;i<n;i++)hannCache[n][i]=.5-.5*Math.cos(2*Math.PI*i/(n-1))}
    const re=new Float64Array(n),im=new Float64Array(n),w=hannCache[n];for(let i=0;i<n;i++)re[i]=buf[i]*w[i];fft(re,im);
    const mag=new Float64Array(n/2);for(let k=0;k<n/2;k++)mag[k]=Math.hypot(re[k],im[k]);return mag}
  function diffPitch(after,before,sr){
    const A=spectrum(after,sr),B=spectrum(before,sr),n=after.length,df=sr/n,half=A.length;
    const D=new Float64Array(half);let mx=0;
    for(let k=1;k<half;k++){D[k]=Math.max(0,A[k]-B[k]);if(k*df>=70&&k*df<=2500&&D[k]>mx)mx=D[k]}
    if(mx<=0)return null;
    const peaks=[];
    for(let k=Math.ceil(70/df);k<Math.min(half-2,Math.floor(2500/df));k++){
      // picchi dello spettro "dopo" (forma non alterata), tenuti solo se l'energia è nuova rispetto a "prima"
      if(A[k]>A[k-1]&&A[k]>=A[k+1]&&D[k]>=.06*mx&&D[k]>=.35*A[k]){const y1=A[k-1],y2=A[k],y3=A[k+1],den=y1-2*y2+y3,sh=den?.5*(y1-y3)/den:0;peaks.push({f:(k+sh)*df,a:D[k]})}}
    if(!peaks.length)return null;
    const W=[1,.8,.62,.5,.4];let best=null,total=peaks.reduce((a,p)=>a+p.a,0);
    for(let m=40;m<=88;m++){const f0=midiToFreq(m);let sc=0,fund=null;
      for(let h=1;h<=5;h++){const tgt=f0*h;if(tgt>2500)break;let bp=null;
        for(const p of peaks){const c=Math.abs(1200*Math.log2(p.f/tgt));if(c<38&&(!bp||p.a>bp.a))bp=p}
        if(bp){sc+=W[h-1]*bp.a;if(h===1)fund=bp}}
      if(!best||sc>best.sc*1.02)best={m,sc,f0,fund}}
    if(!best||best.sc<.4*total)return null;
    // frequenza precisa: media delle armoniche trovate, ricondotte alla fondamentale
    let num=0,den=0;for(let h=1;h<=5;h++){const tgt=best.f0*h;let bp=null;for(const p of peaks){const c=Math.abs(1200*Math.log2(p.f/tgt));if(c<38&&(!bp||p.a>bp.a))bp=p}if(bp){num+=bp.a*bp.f/h;den+=bp.a}}
    const f=den?num/den:best.f0;return{f,midi:Math.round(freqToMidi(f)),cents:(freqToMidi(f)-Math.round(freqToMidi(f)))*100,score:best.sc/total};
  }

  /* ---------- Analizzatore a flusso continuo ----------
     Riceve i campioni del microfono (blocchi di qualsiasi lunghezza), li analizza ogni 512 campioni
     con una finestra di 2048 e produce gli eventi del NoteTracker. Misura anche il "flusso" delle alte
     frequenze: l'attacco di una corda pizzicata si sente subito, anche se un'altra corda sta ancora suonando. */
  class Analyzer{
    constructor(sr,opt={}){this.sr=sr;this.hop=512;this.size=2048;this.win=new Float32Array(this.size);this.fill=0;this.n=0;this.pend=new Float32Array(this.hop);this.np=0;this.tracker=new NoteTracker(opt);this.last={rms:0,f:-1,clarity:0};this.H=new Float32Array(16384);this.pending=[]}
    reset(){this.win.fill(0);this.H.fill(0);this.fill=0;this.n=0;this.np=0;this.pending=[];this.tracker.reset()}
    seg(from,len){const base=this.n-this.H.length,o=new Float32Array(len);for(let i=0;i<len;i++){const j=from+i-base;o[i]=j>=0&&j<this.H.length?this.H[j]:0}return o}
    get time(){return this.n/this.sr}
    push(chunk){const ev=[];let i=0;
      while(i<chunk.length){const take=Math.min(this.hop-this.np,chunk.length-i);this.pend.set(chunk.subarray(i,i+take),this.np);this.np+=take;i+=take;
        if(this.np===this.hop){this.np=0;this.win.copyWithin(0,this.hop);this.win.set(this.pend,this.size-this.hop);this.H.copyWithin(0,this.hop);this.H.set(this.pend,this.H.length-this.hop);this.n+=this.hop;this.fill=Math.min(this.size,this.fill+this.hop);
          if(this.fill>=this.size)this._step(ev)}}
      return ev}
    _step(ev){
      const w=this.win,sr=this.sr,B=256,nb=this.size/B,e=new Float64Array(nb);
      for(let k=0;k<nb;k++){let a=0;for(let j=k*B+1;j<(k+1)*B;j++){const d=w[j]-w[j-1];a+=d*d}e[k]=Math.sqrt(a/(B-1))}
      // flusso: blocchi nuovi (gli ultimi 2) rispetto alla media dei 3 precedenti
      let flux=0,kBest=nb-1;
      for(let k=nb-2;k<nb;k++){const base=(e[k-1]+e[k-2]+e[k-3])/3;const fl=e[k]>this.tracker.thr*.3?e[k]/(base+this.tracker.thr*.08):0;if(fl>flux){flux=fl;kBest=k}}
      const p=pitchChecked(w,sr),rms=rmsLast(w,512),t=this.time-.002;
      const tOn=t-(nb-1-kBest+.5)*B/sr;
      this.last={rms,f:p.f,clarity:p.clarity,flux};
      this.tracker.frame(t,rms,p.f,p.clarity,flux,tOn).forEach(x=>{
        if(x.type==='onset'){
          const onS=Math.round(x.t*sr),prevRms=rmsLast(this.seg(onS-384-1024,1024),1024);
          x.ringing=prevRms>.3*x.rms;
          this.curRinging=x.ringing;
          if(x.ringing)this.pending.push({onS,t:x.t,rms:x.rms});
          ev.push(x);
        }else if(x.type==='note'&&this.curRinging){const q=this.pending.find(p=>p.t===x.t);if(q)q.blind=x}   // l'altezza si ricava dal confronto prima/dopo (più sotto); questa è la riserva
        else ev.push(x);
      });
      // note sovrapposte a corde ancora in vibrazione: confronto spettrale 85 ms dopo l'attacco
      while(this.pending.length&&this.n>=this.pending[0].onS+4096+96){
        const q=this.pending.shift(),after=this.seg(q.onS-96,4096),before=this.seg(q.onS-96-4096-64,4096),r=diffPitch(after,before,sr);
        if(r&&this.tracker.cur&&this.tracker.cur.t===q.t)this.tracker.cur.done=true;
        if(r)ev.push({type:'note',t:q.t,tDetected:this.time,f:r.f,midi:r.midi,cents:r.cents,clarity:Math.min(1,r.score*2),rms:q.rms,ringing:true});
        else if(q.blind)ev.push(Object.assign({},q.blind,{ringing:true,repeat:true}));   // stessa nota ripetuta: prima e dopo coincidono
        else ev.push({type:'noise',t:q.t});
      }
    }
  }

  /* ---------- FFT e cromagramma (per riconoscere gli accordi) ---------- */
  function fft(re,im){
    const n=re.length;
    for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
    for(let len=2;len<=n;len<<=1){
      const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);
      for(let i=0;i<n;i+=len){let cr=1,ci=0;
        for(let k=0;k<len/2;k++){
          const a=i+k,b=i+k+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
          const ncr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=ncr;
        }}
    }
  }
  const hann={};
  function chroma(buf,sr){
    const n=buf.length;if(!hann[n]){hann[n]=new Float32Array(n);for(let i=0;i<n;i++)hann[n][i]=.5-.5*Math.cos(2*Math.PI*i/(n-1))}
    const re=new Float64Array(n),im=new Float64Array(n),w=hann[n];for(let i=0;i<n;i++)re[i]=buf[i]*w[i];
    fft(re,im);
    const half=n/2,mag=new Float64Array(half);let mx=0;
    const lo=Math.ceil(70*n/sr),hi=Math.min(half-2,Math.floor(1400*n/sr));
    for(let k=lo-1;k<=hi+1;k++){mag[k]=Math.hypot(re[k],im[k])}
    for(let k=lo;k<=hi;k++)if(mag[k]>mx)mx=mag[k];
    const ch=new Float64Array(12);let total=0;
    if(mx<=0)return{chroma:ch,total:0,peak:0};
    for(let k=lo;k<=hi;k++){
      const m=mag[k];if(m<mx*.08||m<mag[k-1]||m<=mag[k+1])continue;      // solo picchi locali non trascurabili
      const y1=mag[k-1],y2=m,y3=mag[k+1],den=y1-2*y2+y3,shift=den?.5*(y1-y3)/den:0;
      const f=(k+shift)*sr/n,pcf=freqToMidi(f);
      const pc=((Math.round(pcf)%12)+12)%12,dev=Math.abs(pcf-Math.round(pcf));
      if(dev>.4)continue;
      const wgt=m*(1-dev)*(f<1000?1:.5);
      ch[pc]+=wgt;total+=wgt;
    }
    return{chroma:ch,total,peak:mx};
  }
  // Un accordo è descritto dai suoi pitch class (dalle note realmente suonate).
  function chordPcsFromChord(ch){return[...new Set(ch.frets.map((f,i)=>f<0?null:(OPEN[i]+f)%12).filter(v=>v!==null))]}
  function chordScore(ch12,total,pcs){
    if(!total)return 0;
    let inside=0,present=0;pcs.forEach(pc=>{inside+=ch12[pc];if(ch12[pc]>.06*total)present++});
    const cover=present/pcs.length;
    return(inside/total)*cover*cover;
  }
  // Sceglie tra l'insieme di accordi del gioco: riconosciuto se è il migliore e supera la soglia.
  function recognizeChord(ch12,total,candidates,targetName,minScore=.5){
    const scores=candidates.map(c=>({name:c.name,score:chordScore(ch12,total,c.pcs)}));
    scores.sort((a,b)=>b.score-a.score);
    const target=scores.find(s=>s.name===targetName);
    return{ok:!!target&&target.score>=minScore&&target===scores[0],target:target?target.score:0,best:scores[0],scores};
  }

  /* ---------- Accordatore: altezza robusta di una corda singola ----------
     1) dimezza la frequenza di campionamento (filtro 1-2-1) per ridurre i calcoli;
     2) NSDF (metodo McLeod): per ogni lobo positivo si prende il massimo, poi il primo che arriva all'86% del più alto;
     3) controllo d'ottava sullo spettro: se il microfono del telefono "perde" la fondamentale, il periodo trovato
        può essere metà (o un terzo) di quello vero. Si cercano allora le armoniche che solo la nota più grave avrebbe
        (dispari rispetto a quella trovata): se ce ne sono, la nota vera è un'ottava (o una dodicesima) sotto;
     4) affinamento parabolico sul picco dell'NSDF alla nota scelta.
     Restituisce {f, clarity, rms} con f=-1 se non c'è una nota chiara. Nessuna soglia di volume fissa:
     il controllo del volume (rispetto al rumore di fondo) è compito di chi chiama. */
  function tunerPitch(input,srIn,opt={}){
    const minHz=opt.minHz||58,maxHz=opt.maxHz||1050;
    const n2=input.length>>1,x=new Float32Array(n2);let mean=0;for(let i=0;i<input.length;i++)mean+=input[i];mean/=input.length;
    for(let i=0;i<n2;i++){const j=2*i;x[i]=(input[j>0?j-1:0]+2*input[j]+input[j+1])/4-mean}
    const sr=srIn/2;
    // passa-alto (Butterworth del 4° ordine, 62 Hz): toglie ronzio di rete e rombi che coprirebbero il MI (E) grave
    for(let pass=0;pass<2;pass++){const w0=2*Math.PI*62/sr,al=Math.sin(w0)/(2*Math.SQRT1_2),cs=Math.cos(w0),a0=1+al;
      const b0=(1+cs)/2/a0,b1=-(1+cs)/a0,b2=b0,a1=-2*cs/a0,a2=(1-al)/a0;let x1=0,x2=0,y1=0,y2=0;
      for(let i=0;i<n2;i++){const v=x[i],y=b0*v+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=v;y2=y1;y1=y;x[i]=y}}
    let e=0;for(let i=n2>>2;i<n2;i++)e+=x[i]*x[i];const rms=Math.sqrt(e/(n2-(n2>>2)));
    if(rms<1e-5)return{f:-1,clarity:0,rms};
    // NSDF sugli ultimi campioni (≈85 ms): risponde in fretta e resta preciso
    const nW=Math.min(n2,Math.round(sr*.09)),off=n2-nW,maxLag=Math.min(Math.floor(sr/minHz),Math.floor(nW/2)),W=nW-maxLag-1;
    const nsdf=new Float32Array(maxLag+2);
    for(let lag=0;lag<=maxLag+1;lag++){let acf=0,m=0;for(let i=off;i<off+W;i++){const a=x[i],b=x[i+lag];acf+=a*b;m+=a*a+b*b}nsdf[lag]=m?2*acf/m:0}
    const minLag=Math.max(2,Math.floor(sr/maxHz));const peaks=[];let l=1;
    while(l<=maxLag&&nsdf[l]>0)l++;                       // salta il primo lobo (attorno al ritardo zero)
    let pos=false,best=-1;
    for(;l<=maxLag;l++){const v=nsdf[l];if(v>0){if(!pos){pos=true;best=l}else if(v>nsdf[best])best=l}else if(pos){pos=false;if(best>=minLag)peaks.push(best)}}
    if(pos&&best>=minLag&&best<maxLag)peaks.push(best);
    if(!peaks.length)return{f:-1,clarity:0,rms};
    const top=Math.max(...peaks.map(p=>nsdf[p]));
    const lag0=peaks.find(p=>nsdf[p]>=.86*top);
    const refine=L=>{const a=Math.max(1,Math.round(L*.97)-1),b=Math.min(maxLag,Math.round(L*1.03)+1);let k=a;for(let i=a;i<=b;i++)if(nsdf[i]>nsdf[k])k=i;
      const y1=nsdf[k-1],y2=nsdf[k],y3=nsdf[k+1],den=y1-2*y2+y3,sh=den&&k>0&&k<=maxLag?.5*(y1-y3)/den:0;return{lag:k+sh,v:y2}};
    let r=refine(lag0),f=sr/r.lag,clarity=r.v;
    // spettro (finestra di Hann su tutto il blocco, zero-padding ×2) ridotto ai suoi picchi
    let N=1;while(N*2<=n2)N*=2;const NF=N*2,re=new Float64Array(NF),im=new Float64Array(NF);
    for(let i=0;i<N;i++)re[i]=x[n2-N+i]*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));fft(re,im);
    const df=sr/NF,half=NF/2,mg=new Float64Array(half);for(let k=0;k<half;k++)mg[k]=Math.hypot(re[k],im[k]);
    const lo=Math.max(2,Math.floor(50/df)),hi=Math.min(half-2,Math.ceil(2100/df));let mmax=0;const band=[],sp=[];
    for(let k=lo;k<=hi;k++){band.push(mg[k]);if(mg[k]>mmax)mmax=mg[k];
      if(mg[k]>mg[k-1]&&mg[k]>=mg[k+1]){const y1=mg[k-1],y2=mg[k],y3=mg[k+1],den=y1-2*y2+y3,sh=den?.5*(y1-y3)/den:0;sp.push({f:(k+sh)*df,a:y2})}}
    band.sort((a,b)=>a-b);const floor=band[band.length>>1]||0;
    // ampiezza del picco più forte vicino a fr (entro ±35 cent o ±1,2 bin, il più largo dei due)
    const M=fr=>{const tol=Math.max(fr*.0204,1.2*df*2);let v=0;for(const q of sp)if(Math.abs(q.f-fr)<=tol&&q.a>v)v=q.a;return v};
    // una nota vera ha armoniche consecutive (1ª e 2ª, 2ª e 3ª o 3ª e 4ª), oppure una fondamentale dominante.
    // Due corde che suonano insieme hanno un "periodo comune" più grave, ma senza armoniche consecutive.
    const thr=Math.max(.08*mmax,4*floor),has=fr=>fr<2000&&M(fr)>thr;
    const valid=fr=>{const p=[0,1,2,3,4].map(h=>h&&has(h*fr));return(p[1]&&p[2])||(p[2]&&p[3])||(p[3]&&p[4])||M(fr)>=.5*mmax};
    const hsum=fr=>{let t=0;for(let h=1;h<=6&&h*fr<2000;h++)t+=M(h*fr);return t};
    if(!opt.noOctave){
      let moved=false;
      // 3a) il periodo trovato è troppo corto (fondamentale persa dal microfono): la nota vera è più grave
      for(const k of [3,2]){const g=f/k;if(g<minHz||sr/g>maxLag)continue;
        const rk=refine(sr/g);if(rk.v<.5||!valid(g))continue;
        const ev=[];for(let m=1;m*g<1800;m++){if(m%k)ev.push(M(m*g))}
        ev.sort((a,b)=>b-a);const strong=ev[0]||0,second=ev[1]||0;
        if(strong>4*floor&&(strong>.3*mmax||(strong>.12*mmax&&second>.08*mmax))){r=rk;f=sr/rk.lag;clarity=Math.max(clarity,rk.v);moved=true;break}}
      // 3b) il periodo trovato è troppo lungo (periodo comune di due corde): si sale alla nota che ha armoniche vere
      if(!moved&&!valid(f)){let bestK=null;
        for(let k=2;k<=5;k++){const fk=f*k;if(fk>maxHz)break;const rk=refine(sr/fk);if(rk.v<.6||!valid(sr/rk.lag))continue;
          const sc=hsum(sr/rk.lag);if(!bestK||sc>bestK.sc)bestK={rk,sc}}
        if(bestK){r=bestK.rk;f=sr/r.lag;clarity=r.v}else clarity*=.8}
    }
    // 3c) indizio dall'app (corda scelta o appena riconosciuta): se la lettura è un'ottava o una dodicesima
    //     sotto quella corda e la corda ha davvero energia, vale la corda (es. MI cantino = 3ª armonica del LA)
    if(opt.hint&&!opt.noOctave){for(const k of [2,3]){const fk=f*k;if(Math.abs(1200*Math.log2(fk/opt.hint))>80)continue;
      const rk=refine(sr/fk);if(rk.v>=.6&&M(sr/rk.lag)>=.25*mmax){r=rk;f=sr/rk.lag;clarity=Math.max(clarity*.98,rk.v);break}}}
    if(f>maxHz||f<minHz)return{f:-1,clarity:0,rms};
    return{f,clarity,rms};
  }

  root.GSEngine={NOTE_IT,NOTE_INT,OPEN,midiToFreq,freqToMidi,noteName,pcLabel,stringNote,pitch,mag,pitchChecked,rmsLast,hfLast,NoteTracker,Analyzer,diffPitch,tunerPitch,fft,chroma,chordPcsFromChord,chordScore,recognizeChord};
  if(typeof module!=='undefined')module.exports=root.GSEngine;
})(typeof window!=='undefined'?window:globalThis);
