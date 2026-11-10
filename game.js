'use strict';
// Guitar Studio 2.0 — Sfide: giochi guidati dal microfono. Usa engine.js (analisi audio) e le funzioni di app.js.
(function(){
const E=window.GSEngine;
const KEY_GAME='guitarStudioGameV1',KEY_GSET='guitarStudioGameSettingsV1';
const NOTE_BTN=E.NOTE_IT.map((n,i)=>`${n} (${E.NOTE_INT[i]})`);
const STR_NAME=['','1ª','2ª','3ª','4ª','5ª','6ª'];
const STR_NOTE=['','MI (E)','SI (B)','SOL (G)','RE (D)','LA (A)','MI (E)'];
const STR_COLOR=['','#3d7fc9','#4f9d69','#d8b923','#e8943a','#d1495b','#8a5cc2'];   // 1ª … 6ª
const nameOf=m=>E.noteName(m).label;
const posText=(str,fret)=>`${STR_NAME[str]} corda${fret?`, tasto ${fret}`:' a vuoto'}`;
const stage=$('gameStage'),hub=$('sfideHub');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const median=a=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

/* ---------- Dati salvati ---------- */
let G=Object.assign({xp:0,best:{},weak:{},missions:{},minutes:{},logged:{},plays:0},loadJSON(KEY_GAME,{}));
if(!G||typeof G!=='object'||Array.isArray(G))G={xp:0,best:{},weak:{},missions:{},minutes:{},logged:{},plays:0};
['best','weak','missions','minutes','logged'].forEach(k=>{if(!G[k]||typeof G[k]!=='object')G[k]={}});
G.xp=Number(G.xp)||0;
let S=Object.assign({offset:0,sens:1,click:false},loadJSON(KEY_GSET,{}));
S.offset=clamp(Number(S.offset)||0,-400,600);S.sens=clamp(Number(S.sens)||1,.5,2.5);S.click=!!S.click;
const saveG=()=>saveJSON(KEY_GAME,G),saveS=()=>saveJSON(KEY_GSET,S);
const TITLES=[[0,'Principiante'],[100,'Apprendista'],[300,'Plettro di latta'],[700,'Plettro d’argento'],[1400,'Chitarrista'],[2500,'Rocker'],[4000,'Virtuoso'],[6500,'Leggenda']];
function levelInfo(xp=G.xp){let i=0;while(i+1<TITLES.length&&xp>=TITLES[i+1][0])i++;const nx=TITLES[i+1];return{n:i+1,title:TITLES[i][1],pct:nx?(xp-TITLES[i][0])/(nx[0]-TITLES[i][0]):1,next:nx?nx[0]-xp:0}}
function addXP(n){const before=levelInfo().n;G.xp+=Math.max(0,Math.round(n));saveG();const after=levelInfo();return after.n>before?after:null}
function addMinutes(sec){if(sec<5)return;const d=isoLocal();G.minutes[d]=(G.minutes[d]||0)+sec/60;saveG()}

/* ---------- Missione del giorno ---------- */
const MISSIONS=[
  {id:'auto2',text:'Completa un livello di Autostrada con almeno 2 stelle',test:r=>r.game==='auto'&&r.stars>=2},
  {id:'caccia7',text:'Trova almeno 7 note su 10 in Caccia alla nota',test:r=>r.game==='caccia'&&r.found>=7},
  {id:'eco5',text:'Arriva a una sequenza di 5 note in Eco',test:r=>r.game==='eco'&&r.maxLen>=5},
  {id:'cambi6',text:'Fai almeno 6 cambi di accordo in 60 secondi',test:r=>r.game==='cambi'&&r.changes>=6},
  {id:'auto3',text:'Ottieni 3 stelle in un livello di Autostrada',test:r=>r.game==='auto'&&r.stars>=3},
  {id:'min10',text:'Gioca per 10 minuti nelle Sfide',test:()=>(G.minutes[isoLocal()]||0)>=10}
];
function todayMission(){const d=new Date();const idx=(d.getFullYear()*372+d.getMonth()*31+d.getDate())%MISSIONS.length;return MISSIONS[idx]}
function checkMission(r){const m=todayMission(),k=isoLocal();if(G.missions[k])return false;if(m.test(r)){G.missions[k]=true;saveG();return true}return false}

/* ---------- Audio e microfono ---------- */
const GA={ctx:null,
  async ensure(){ // da chiamare dentro un gesto dell’utente (iOS)
    if(!AudioCtor)throw new Error('audio');
    if(!this.ctx||this.ctx.state==='closed')this.ctx=new AudioCtor();
    if(this.ctx.state==='suspended'){try{await this.ctx.resume()}catch(e){}}
    return this.ctx},
  async fresh(){Mic.stop();this.close();return this.ensure()},   // nuova sessione audio per ogni partita
  close(){if(this.ctx){try{this.ctx.close()}catch(e){}this.ctx=null}}};
const Mic={running:false,starting:false,stream:null,proc:null,src:null,an:null,subs:new Set(),level:0,clockOff:0,gateUntil:0,lastEv:0,injected:false,
  async start(){
    if(this.running)return;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw Object.assign(new Error('unsupported'),{name:'Unsupported'});
    const ctx=await GA.ensure();this.starting=true;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      if(ctx.state==='suspended')await ctx.resume();
      this.stream=stream;this.an=new E.Analyzer(ctx.sampleRate,{threshold:.008/S.sens});
      this.src=ctx.createMediaStreamSource(stream);
      this.proc=ctx.createScriptProcessor(1024,1,1);
      this.proc.onaudioprocess=e=>this.feed(e.inputBuffer.getChannelData(0),ctx.currentTime);
      this.src.connect(this.proc);const silent=ctx.createGain();silent.gain.value=0;this.proc.connect(silent);silent.connect(ctx.destination);
      this.running=true;
    }finally{this.starting=false}
  },
  // Elabora un blocco di campioni; tc = tempo dell’AudioContext al momento della consegna.
  feed(chunk,tc){
    const an=this.an;if(!an)return;
    const evs=an.push(chunk);
    const endT=an.time+an.np/an.sr;this.clockOff=tc-endT;
    let e=0;for(let i=0;i<chunk.length;i+=8)e+=chunk[i]*chunk[i];this.level=Math.max(Math.sqrt(e/(chunk.length/8)),this.level*.9);
    evs.forEach(ev=>{
      ev.tc=ev.t+this.clockOff-S.offset/1000;
      if(ev.tc<this.gateUntil)return;
      this.lastEv=tc;this.subs.forEach(fn=>fn(ev));
    });
  },
  // Non ascoltare mentre l’app suona (altrimenti sente se stessa)
  gate(untilCtxTime){this.gateUntil=Math.max(this.gateUntil,untilCtxTime);if(this.an)this.an.tracker.mute(untilCtxTime-this.clockOff)},
  on(fn){this.subs.add(fn)},off(fn){this.subs.delete(fn)},
  recent(len=8192){return this.an?this.an.seg(this.an.n-len,len):null},
  stop(){
    this.running=false;this.subs.clear();
    if(this.proc){this.proc.onaudioprocess=null;try{this.proc.disconnect()}catch(e){}this.proc=null}
    if(this.src){try{this.src.disconnect()}catch(e){}this.src=null}
    if(this.stream){this.stream.getTracks().forEach(t=>t.stop());this.stream=null}
    this.an=null;this.level=0;this.gateUntil=0;
  }};
const MIC_ERR={NotAllowedError:'Permesso negato: abilita il microfono nelle impostazioni del browser per questo sito.',NotFoundError:'Non trovo nessun microfono.',NotReadableError:'Il microfono è occupato da un’altra app.',SecurityError:'Il microfono richiede una connessione HTTPS.',Unsupported:'Questo browser non permette di usare il microfono.'};
async function tryMic(){try{await Mic.start();return{ok:true}}catch(err){Mic.stop();return{ok:false,msg:MIC_ERR[err.name]||'Non riesco ad attivare il microfono.'}}}

// Suona note dell’app e silenzia il microfono per la durata
function playNotes(list,gap=.55,vel=.14){
  const ctx=GA.ctx;if(!ctx)return 0;const t0=ctx.currentTime+.08;
  list.forEach((m,i)=>pluckTone(ctx,m,t0+i*gap,1.6,vel,0));
  const end=t0+(list.length-1)*gap+.9;Mic.gate(end+.25);return end;
}

/* ---------- Scena e stato corrente ---------- */
let cur=null;      // partita in corso: {stop(), interrupt()}
function setCur(g){if(cur&&cur.stop)cur.stop();cur=g}
function leave(){if(cur){const c=cur;cur=null;try{c.stop&&c.stop()}catch(e){}}Mic.stop();GA.close()}
const html=(el,s)=>{el.innerHTML=s};
const sc=s=>stage.querySelector(s);
function bindBtns(root,map){Object.entries(map).forEach(([sel,fn])=>{root.querySelectorAll(sel).forEach(b=>b.addEventListener('click',fn))})}
function stars(n){return '★'.repeat(n)+'☆'.repeat(3-n)}
function fmtPct(x){return Math.round(x*100)+'%'}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
function micBlock(state){ // pannello “come giocare”: microfono sì/no
  return `<div class="mic-choice" id="micChoice"><p class="small-text muted" id="micMsg">${state||'Suona la chitarra vicino al telefono. Meglio in una stanza silenziosa; con le cuffie il gioco non sente i suoni dell’app.'}</p></div>`}
function backToHub(){go('sfide')}

/* ---------- Brani di Autostrada ----------
   Ogni nota è [corda, tasto, durata in battiti]. Melodie di pubblico dominio o originali.
   Corda 1 = la più acuta (MI cantino), 6 = la più grave. */
const mkNotes=list=>{let b=0;return list.map(([s,f,d=1])=>{const n={beat:b,str:s,fret:f,midi:E.stringNote(s,f)};b+=d;return n})};
const E4=[1,0],F4=[1,1],G4=[1,3],A4=[1,5],D4=[2,3],C4=[2,1],B3=[2,0],G3=[3,0];
const n=(p,d=1)=>[p[0],p[1],d];
const SONGS=[
  {id:'a1',name:'Corde a vuoto',sub:'Le sei corde dalla più grave alla più acuta e ritorno',bpm:60,level:'Facile',
   notes:mkNotes([[6,0],[5,0],[4,0],[3,0],[2,0],[1,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]])},
  {id:'a2',name:'Tre note sulla 1ª corda',sub:'MI (E), FA (F) e SOL (G): tasti 0, 1 e 3',bpm:66,level:'Facile',
   notes:mkNotes([[1,0],[1,1],[1,3],[1,1],[1,0],[1,0],[1,1],[1,1],[1,3],[1,3],[1,1],[1,0],[1,3],[1,1],[1,0,2]])},
  {id:'a3',name:'Inno alla gioia',sub:'Beethoven · prima frase, sulle prime due corde',bpm:84,level:'Facile',
   notes:mkNotes([n(E4),n(E4),n(F4),n(G4),n(G4),n(F4),n(E4),n(D4),n(C4),n(C4),n(D4),n(E4),n(E4,1.5),n(D4,.5),n(D4,2),
                  n(E4),n(E4),n(F4),n(G4),n(G4),n(F4),n(E4),n(D4),n(C4),n(C4),n(D4),n(E4),n(D4,1.5),n(C4,.5),n(C4,2)])},
  {id:'a9',name:'Blues a 12 battute in LA (A)',sub:'Il boogie dei bluesman: LA (A), RE (D) e MI (E) sui bassi',bpm:92,level:'Medio',
   notes:mkNotes((()=>{const A=[[5,0],[4,2],[5,0],[4,4]],D=[[4,0],[3,2],[4,0],[3,4]],Em=[[6,0],[5,2],[6,0],[5,4]];
     const bars=[A,A,A,A,D,D,A,A,Em,D,A,Em];const out=[];bars.forEach((b,i)=>b.forEach((x,j)=>out.push([x[0],x[1],(i===11&&j===3)?2:1])));return out})())},
  {id:'a10',name:'Scala blues di LA (A)',sub:'La scala dei solisti, con la “nota blu” RE♯ (D♯) · 5ª posizione',bpm:76,level:'Medio',
   notes:mkNotes([[6,5],[6,8],[5,5],[5,6],[5,7],[4,5],[4,7],[3,5],[4,7],[4,5],[5,7],[5,6],[5,5],[6,8],[6,5,2]])},
  {id:'a11',name:'Canone di Pachelbel · basso',sub:'Il celebre giro di otto note, sui bassi · RE (D) LA (A) SI (B) FA♯ (F♯) SOL (G)',bpm:72,level:'Medio',
   notes:mkNotes((()=>{const b=[[4,0],[5,0],[5,2],[6,2],[6,3],[4,0],[6,3],[5,0]];const out=[];for(let r=0;r<3;r++)b.forEach((x,j)=>out.push([x[0],x[1],(r===2&&j===7)?2:1]));return out})())},
  {id:'a14',name:'Arpeggi: LA minore, DO, RE, FA',sub:'Un giro d’accordi suonato nota per nota (Am · C · D · F)',bpm:84,level:'Medio',
   notes:mkNotes([[5,0],[4,2],[3,2],[2,1],[3,2],[4,2],  [5,3],[4,2],[3,0],[2,1],[3,0],[4,2],  [4,0],[3,2],[2,3],[1,2],[2,3],[3,2],  [4,3],[3,2],[2,1],[1,1],[2,1],[3,2],  [5,0,2]])},
  {id:'a6',name:'Scala di DO (C)',sub:'In prima posizione, salendo e scendendo',bpm:72,level:'Medio',
   notes:mkNotes([[5,3],[4,0],[4,2],[4,3],[3,0],[3,2],[2,0],[2,1],[2,0],[3,2],[3,0],[4,3],[4,2],[4,0],[5,3,2]])},
  {id:'a12',name:'Canone di Pachelbel · melodia',sub:'La frase più famosa, in RE maggiore (D) · passa da una corda all’altra',bpm:66,level:'Difficile',
   notes:mkNotes((()=>{const m=[[1,2],[1,0],[2,3],[2,2],[2,0],[3,2],[2,0],[2,2]];const out=[];for(let r=0;r<3;r++)m.forEach((x,j)=>out.push([x[0],x[1],(r===2&&j===7)?2:1]));return out})())},
  {id:'a13',name:'Andaluso',sub:'Frase originale in stile flamenco · modo frigio sulla 1ª corda',bpm:78,level:'Difficile',
   notes:mkNotes([[1,0],[1,1],[1,3],[1,5],[1,3],[1,1],[1,0,2],  [1,5],[1,3],[1,1],[1,0],[1,1],[1,0],[2,3],[1,0,2],  [1,0],[1,1],[1,3],[1,5],[1,8],[1,5],[1,3],[1,1],[1,0,3]])},
  {id:'a8',name:'Ruggine',sub:'Riff originale hard rock sui bassi · 6ª e 5ª corda',bpm:84,level:'Difficile',
   notes:mkNotes([[6,0],[6,0],[6,3],[6,0],[5,2],[5,0],[6,3],[6,5],[6,0],[6,0],[6,3],[6,0],[5,2],[5,3],[5,2],[6,0,2],
                  [6,0],[6,0],[6,3],[6,5],[5,0],[5,2],[5,3],[5,2],[6,3],[6,0,3]])},
  {id:'a7',name:'Arpeggio di LA minore (Am)',sub:'Cinque corde, un tasto alla volta',bpm:76,level:'Medio',hidden:true,
   notes:mkNotes([[5,0],[4,2],[3,2],[2,1],[1,0],[2,1],[3,2],[4,2],[5,0],[4,2],[3,2],[2,1],[1,0],[2,1],[3,2],[4,2],[5,0,2]])}
];
const songById=id=>SONGS.find(s=>s.id===id);
const levelColor=l=>l==='Facile'?'good':l==='Medio'?'mid':'hard';

/* ---------- Tastiera con note evidenziate (SVG) ---------- */
function fretboardSVG(marks=[],frets=12){
  const w=330,h=130,x0=26,y0=14,fw=(w-x0-6)/frets,sg=(h-2*y0)/5;let s=`<svg class="fretboard" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tastiera della chitarra">`;
  for(let f=0;f<=frets;f++)s+=`<line class="fb-fret${f===0?' nut':''}" x1="${x0+f*fw}" y1="${y0}" x2="${x0+f*fw}" y2="${y0+5*sg}"/>`;
  [3,5,7,9,12].forEach(f=>{if(f<=frets)s+=`<text class="fb-mark" x="${x0+(f-.5)*fw}" y="${h-2}" text-anchor="middle">${f}</text>`});
  for(let i=1;i<=6;i++){const y=y0+(i-1)*sg;s+=`<line class="fb-string" y1="${y}" y2="${y}" x1="${x0}" x2="${x0+frets*fw}" style="stroke-width:${.8+(i-1)*.35}"/><text class="fb-str" x="6" y="${y+4}">${i}</text>`}
  marks.forEach(m=>{const y=y0+(m.str-1)*sg,x=m.fret===0?x0-8:x0+(m.fret-.5)*fw;s+=`<circle class="fb-dot ${m.cls||''}" cx="${x}" cy="${y}" r="7.5" style="fill:${m.color||STR_COLOR[m.str]}"/>${m.label?`<text class="fb-lab" x="${x}" y="${y+3.5}" text-anchor="middle">${m.label}</text>`:''}`});
  return s+'</svg>';
}

/* ---------- Punti deboli (memoria tra le partite) ---------- */
function weakKey(str,fret){return str+'.'+fret}
function recordNote(str,fret,hit){const k=weakKey(str,fret),w=G.weak[k]||(G.weak[k]={h:0,m:0});if(hit)w.h++;else w.m++;if(w.h+w.m>40){w.h=Math.round(w.h/2);w.m=Math.round(w.m/2)}}
function weakList(){
  return Object.entries(G.weak).map(([k,w])=>{const[s,f]=k.split('.').map(Number);return{str:s,fret:f,h:w.h,m:w.m,rate:w.m/(w.h+w.m),tot:w.h+w.m}})
    .filter(x=>x.tot>=2&&x.m>=1&&STR_NAME[x.str]).sort((a,b)=>b.rate-a.rate||b.m-a.m||b.tot-a.tot);
}
function weakSong(){
  const wl=weakList().slice(0,5);if(wl.length<2)return null;
  const pool=[];wl.forEach((w,i)=>{for(let k=0;k<Math.max(2,5-i);k++)pool.push(w)});
  const seq=[];let last=null;
  while(seq.length<18){const w=pick(pool);if(last&&w===last&&Math.random()<.7)continue;seq.push([w.str,w.fret,1]);last=w}
  return{id:'weak',name:'Allenamento sui punti deboli',sub:'Le note che sbagli più spesso, ripetute con calma',bpm:60,level:'Su misura',notes:mkNotes(seq)};
}

/* ---------- L’Allenatore: analisi di una partita ---------- */
function coachAnalysis(st){
  const tips=[];const isHit=t=>t.state==='hit'&&(st.mode!=='wait'||t.tries===0);const hits=st.targets.filter(isHit),all=st.targets.length;
  const acc=all?hits.length/all:0;
  // tempismo
  if(st.mode==='tempo'&&hits.length>=5){
    const dts=hits.map(t=>t.dt*1000),m=mean(dts),sd=Math.sqrt(mean(dts.map(d=>(d-m)*(d-m))));
    if(m>40)tips.push({ico:'⏱',t:`Tendi ad arrivare in ritardo di circa ${Math.round(m)} ms. Prova a preparare il dito sul tasto prima del battito.`});
    else if(m<-40)tips.push({ico:'⏱',t:`Tendi ad anticipare di circa ${Math.round(-m)} ms. Aspetta il battito: la nota cade quando tocca la linea.`});
    else if(sd>95)tips.push({ico:'⏱',t:'Il tempo è irregolare: alcune note arrivano presto, altre tardi. Allenati con il metronomo a velocità ridotta.'});
    else tips.push({ico:'⏱',t:'Il tempo è molto preciso: puoi provare una velocità maggiore.'});
  }
  // corda più debole
  const per={};st.targets.forEach(t=>{const p=per[t.str]||(per[t.str]={h:0,n:0});p.n++;if(isHit(t))p.h++});
  const weakStr=Object.entries(per).filter(([,p])=>p.n>=3&&p.h/p.n<.7).sort((a,b)=>a[1].h/a[1].n-b[1].h/b[1].n)[0];
  if(weakStr){const[s,p]=weakStr;tips.push({ico:'🎯',t:`La ${STR_NAME[s]} corda è il tuo punto debole: ${p.h} note su ${p.n}. Prima di riprovare suonala da sola, piano.`})}
  // note scambiate
  const conf={};st.targets.forEach(t=>{if(t.state==='miss'&&t.played!=null){const k=E.pcLabel(t.midi%12)+'|'+E.pcLabel(t.played%12);conf[k]=(conf[k]||0)+1}});
  const top=Object.entries(conf).sort((a,b)=>b[1]-a[1])[0];
  if(top&&top[1]>=1){const[a,b]=top[0].split('|');tips.push({ico:'🎼',t:`Hai suonato ${b} al posto di ${a}${top[1]>1?` (${top[1]} volte)`:''}: controlla il tasto indicato.`})}
  // intonazione
  const cents=hits.map(t=>t.cents).filter(c=>c!=null);
  if(cents.length>=5){const mc=median(cents);if(Math.abs(mc)>22)tips.push({ico:'🎚',t:`Le note risultano mediamente ${Math.abs(Math.round(mc))} cent ${mc<0?'basse':'alte'}: accorda la chitarra con l’Accordatore.`,link:'accordatore',linkText:'Apri l’accordatore'})}
  if(!tips.length)tips.push({ico:'👍',t:acc>=.9?'Ottima partita! Passa al livello successivo.':'Continua così: ripeti il livello per consolidare le note.'});
  return{acc,tips:tips.slice(0,4)};
}

/* =====================================================================
   AUTOSTRADA — note che scendono su sei corsie (le sei corde)
   ===================================================================== */
const opts0={mode:'tempo',speed:1,tap:false};
function autoPicker(){
  const ws=weakSong();
  html(stage,`<div class="page-heading"><p class="eyebrow">Sfide · Autostrada</p><h1>Autostrada</h1><p class="lede">Le note scendono su sei corsie, una per corda. Suonale quando toccano la linea: il microfono ti ascolta.</p></div>
  <div class="rows">${SONGS.filter(s=>!s.hidden).map(s=>{const b=G.best[s.id];return`<button class="row song-row" data-song="${s.id}"><span class="row-ico"><svg class="ico"><use href="#i-music"/></svg></span><span class="row-body"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span><span class="lvl ${levelColor(s.level)}">${s.level}</span><span class="stars">${stars(b?b.stars:0)}</span></button>`}).join('')}
  ${ws?`<button class="row song-row" data-song="weak"><span class="row-ico"><svg class="ico"><use href="#i-game"/></svg></span><span class="row-body"><b>Allena i punti deboli</b><small>Un percorso su misura con le note che sbagli di più</small></span><span class="lvl mid">Su misura</span></button>`:''}</div>
  <p class="small-text muted">Melodie di pubblico dominio o originali. Le stelle si guadagnano con la precisione: 1★ da metà delle note giuste, 2★ dal 75%, 3★ dal 92%.</p>`);
  stage.querySelectorAll('[data-song]').forEach(b=>b.addEventListener('click',()=>{const s=b.dataset.song==='weak'?weakSong():songById(b.dataset.song);if(s)autoSetup(s)}));
}
function autoSetup(song,msg){
  const o=opts0;const best=G.best[song.id];
  const names=song.notes.slice(0,8).map(t=>nameOf(t.midi)).join(' · ');
  html(stage,`<button class="back" id="bkLevels"><svg class="ico"><use href="#i-back"/></svg>Livelli</button>
  <div class="page-heading"><p class="eyebrow">Autostrada · ${song.level}</p><h1>${esc(song.name)}</h1><p class="lede">${esc(song.sub)}</p></div>
  <div class="card"><p class="small-text muted">${song.notes.length} note · ${song.bpm} battiti al minuto${best?` · record ${stars(best.stars)} ${best.score} punti`:''}</p><p class="small-text">${names}${song.notes.length>8?' …':''}</p>
  <div class="control-block"><span class="eyebrow">Modo</span><div class="seg" role="group" aria-label="Modo di gioco">
    <button class="chip ${o.mode==='tempo'?'active':''}" data-mode="tempo" aria-pressed="${o.mode==='tempo'}">A tempo</button>
    <button class="chip ${o.mode==='wait'?'active':''}" data-mode="wait" aria-pressed="${o.mode==='wait'}">Aspetta me</button></div>
  <p class="small-text muted" id="modeHelp">${o.mode==='tempo'?'Suona ogni nota nel momento in cui tocca la linea.':'Il brano si ferma finché non suoni la nota giusta: ideale per imparare le posizioni.'}</p></div>
  <div class="control-block" id="speedBlock" ${o.mode==='wait'?'hidden':''}><span class="eyebrow">Velocità</span><div class="seg" role="group" aria-label="Velocità">
    ${[[.6,'Lenta 60%'],[.8,'80%'],[1,'Normale']].map(([v,l])=>`<button class="chip ${o.speed===v?'active':''}" data-speed="${v}" aria-pressed="${o.speed===v}">${l}</button>`).join('')}</div></div>
  ${micBlock(msg)}
  <div class="btn-row"><button class="btn" id="goPlay"><svg class="ico"><use href="#i-play"/></svg><span>Gioca con il microfono</span></button>
  <button class="btn secondary" id="goListen"><svg class="ico"><use href="#i-music"/></svg><span>Ascolta il brano</span></button></div>
  <p class="small-text muted"><button class="text-btn" id="goTap" type="button">Senza chitarra: gioca toccando le corsie</button></p></div>`);
  sc('#bkLevels').addEventListener('click',autoPicker);
  stage.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{o.mode=b.dataset.mode;autoSetup(song,msg)}));
  stage.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{o.speed=Number(b.dataset.speed);autoSetup(song,msg)}));
  sc('#goPlay').addEventListener('click',()=>autoPlay(song,{mode:o.mode,speed:o.speed,tap:false}));
  sc('#goTap').addEventListener('click',()=>autoPlay(song,{mode:o.mode,speed:o.speed,tap:true}));
  sc('#goListen').addEventListener('click',async e=>{
    const btn=e.currentTarget;btn.disabled=true;
    try{const ctx=await GA.ensure(),spb=60/song.bpm;const t0=ctx.currentTime+.1;
      song.notes.forEach(t=>pluckTone(ctx,t.midi,t0+t.beat*spb,1.4,.14,0));
      const total=song.notes[song.notes.length-1].beat*spb+1.2;setTimeout(()=>{btn.disabled=false},total*1000)}catch(err){btn.disabled=false}
  });
}

async function autoPlay(song,opts){
  let ctx;try{ctx=await GA.fresh()}catch(e){autoSetup(song,'Audio non disponibile su questo dispositivo.');return}
  if(!opts.tap){const r=await tryMic();if(!r.ok){autoSetup(song,r.msg+' Puoi comunque giocare toccando le corsie.');return}}
  const spb=60/(song.bpm*opts.speed),wait=opts.mode==='wait';
  const targets=song.notes.map((t,i)=>({i,str:t.str,fret:t.fret,midi:t.midi,time:t.beat*spb,state:'pending',dt:0,tries:0,recorded:false}));
  const g={targets,songTime:wait?-1.6:-4*spb,t0:0,lastNow:ctx.currentTime,paused:false,over:false,score:0,combo:0,maxCombo:0,active:0,fx:[],judge:[],hintShown:false,waitSince:0,nextClick:0,raf:0,lastReal:performance.now()};
  g.t0=ctx.currentTime-g.songTime;
  html(stage,`<div class="game-hud"><div><small>Punti</small><b id="hScore">0</b></div><div><small>Serie</small><b id="hCombo">0</b></div><div><small>Precisione</small><b id="hAcc">—</b></div>
    <button class="icon-btn" id="hPause" aria-label="Pausa"><svg class="ico"><use href="#i-pause"/></svg></button><button class="icon-btn" id="hQuit" aria-label="Esci"><svg class="ico"><use href="#i-close"/></svg></button></div>
  <div class="progress thin"><span id="hProg"></span></div>
  <canvas id="autoCanvas" class="auto-canvas" aria-label="Autostrada: le note scendono verso la linea"></canvas>
  <div class="auto-info" id="autoInfo" aria-live="polite"></div>
  <div class="pause-card hidden" id="pauseCard"><b>In pausa</b><div class="btn-row"><button class="btn" id="pResume">Riprendi</button><button class="btn secondary" id="pQuit">Esci</button></div></div>`);
  const cv=sc('#autoCanvas'),cx=cv.getContext('2d');let W=300,H=400;
  const resize=()=>{const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;cv.width=Math.round(W*d);cv.height=Math.round(H*d);cx.setTransform(d,0,0,d,0,0)};
  resize();const onResize=()=>resize();window.addEventListener('resize',onResize);
  const LA=2.0,hitY=()=>H*.8,topY=()=>H*.03,yOf=t=>hitY()-(t-g.songTime)/LA*(hitY()-topY());
  const laneOf=str=>6-str,laneW=()=>W/6;
  const say=(text,color)=>g.judge.push({text,color,t:performance.now()});
  const first=()=>g.targets.find(t=>t.state==='pending');
  function applyHit(t,dt,cents,label,pts,color){
    t.state='hit';t.dt=dt;t.cents=cents;g.combo++;g.maxCombo=Math.max(g.maxCombo,g.combo);
    const mult=Math.min(4,1+Math.floor(g.combo/8));g.score+=pts*mult;
    g.fx.push({lane:laneOf(t.str),t:performance.now(),color:STR_COLOR[t.str]});say(label,color);
    if(!t.recorded){recordNote(t.str,t.fret,t.tries===0);t.recorded=true}
  }
  function applyMiss(t,played,label){
    t.state='miss';t.played=played;g.combo=0;say(label,'#c0392b');
    if(!t.recorded){recordNote(t.str,t.fret,false);t.recorded=true}
  }
  function onEv(ev){
    if(g.over||g.paused||ev.type!=='note'||ev.midi<38||ev.midi>81)return;
    if(wait){
      const t=first();if(!t||t.time-g.songTime>.7)return;
      if(ev.midi%12===t.midi%12){applyHit(t,0,ev.cents,t.tries?'Giusta!':'Perfetto!',t.tries?50:100,'#2e8b57');t.dt=0;g.waitSince=0;g.hintShown=false}
      else{t.tries++;t.played=ev.midi;g.combo=0;say(`Hai suonato ${nameOf(ev.midi)}`,'#c0392b');if(!t.recorded){recordNote(t.str,t.fret,false);t.recorded=true}}
      return;
    }
    const rel=ev.tc-g.t0;let best=null,near=null;
    for(const t of g.targets){if(t.state!=='pending')continue;const dt=rel-t.time;if(dt<-.32)break;if(dt>.32)continue;
      if(t.midi%12===ev.midi%12){if(!best||Math.abs(dt)<Math.abs(best.dt))best={t,dt}}else if(!near||Math.abs(dt)<Math.abs(near.dt))near={t,dt}}
    if(best){const a=Math.abs(best.dt);const j=a<=.09?['Perfetto!',100,'#2e8b57']:a<=.18?['Bene',70,'#b8860b']:[best.dt<0?'Presto':'Tardi',40,'#8a6d3b'];applyHit(best.t,best.dt,ev.cents,j[0],j[1],j[2])}
    else if(near&&Math.abs(near.dt)<.22){applyMiss(near.t,ev.midi,`Stonata: ${nameOf(ev.midi)}`)}
  }
  function tapLane(str){ // senza microfono: toccare la corsia = suonare quella corda
    if(g.over||g.paused)return;
    if(wait){const t=first();if(!t||t.time-g.songTime>.7)return;if(t.str===str){applyHit(t,0,null,'Perfetto!',100,'#2e8b57');g.waitSince=0;g.hintShown=false}else{t.tries++;g.combo=0;say('Altra corda','#c0392b')}return}
    let best=null;for(const t of g.targets){if(t.state!=='pending'||t.str!==str)continue;const dt=ctx.currentTime-g.t0-t.time;if(dt<-.32)break;if(dt>.32)continue;if(!best||Math.abs(dt)<Math.abs(best.dt))best={t,dt}}
    if(best){const a=Math.abs(best.dt);const j=a<=.09?['Perfetto!',100,'#2e8b57']:a<=.18?['Bene',70,'#b8860b']:[best.dt<0?'Presto':'Tardi',40,'#8a6d3b'];applyHit(best.t,best.dt,null,j[0],j[1],j[2])}else{g.combo=0;say('Fuori tempo','#c0392b')}
  }
  if(!opts.tap)Mic.on(onEv);
  cv.addEventListener('pointerdown',e=>{if(!opts.tap)return;const r=cv.getBoundingClientRect();const lane=clamp(Math.floor((e.clientX-r.left)/(r.width/6)),0,5);tapLane(6-lane)});

  const info=sc('#autoInfo');let lastInfo='';
  function updateInfo(){
    const t=first();let s;
    if(!t)s='Fine del brano';
    else s=`Prossima: <b>${nameOf(t.midi)}</b> · ${posText(t.str,t.fret)}`;
    if(wait&&g.hintShown&&t)s+=`<div class="fb-wrap">${fretboardSVG([{str:t.str,fret:t.fret,label:t.fret}],Math.max(5,t.fret))}</div>`;
    if(s!==lastInfo){info.innerHTML=s;lastInfo=s}
  }
  function finish(){
    if(g.over)return;g.over=true;cancelAnimationFrame(g.raf);Mic.off(onEv);window.removeEventListener('resize',onResize);addMinutes(g.active);
    const res=coachAnalysis({targets:g.targets,mode:wait?'wait':'tempo'});
    const hits=g.targets.filter(t=>t.state==='hit'&&(!wait||t.tries===0)).length;const acc=hits/g.targets.length;
    const st=acc>=.92?3:acc>=.75?2:acc>=.5?1:0;
    if(wait){res.acc=acc}
    const prev=G.best[song.id];let record=false;
    if(song.id!=='weak'){if(!prev||g.score>prev.score||st>prev.stars){G.best[song.id]={stars:Math.max(st,prev?prev.stars:0),score:Math.max(g.score,prev?prev.score:0),acc:Math.max(acc,prev?prev.acc:0)};record=!prev||g.score>prev.score}}
    G.plays++;const up=addXP(Math.round(g.score/25)+st*8);const mis=checkMission({game:'auto',stars:st});if(mis)addXP(40);saveG();
    autoResults(song,opts,g,{acc,st,record,tips:res.tips,up,mis,wait});
  }
  cur={stop(){if(!g.over){g.over=true;cancelAnimationFrame(g.raf);Mic.off(onEv);window.removeEventListener('resize',onResize);addMinutes(g.active)}},
       interrupt(){this.stop();autoSetup(song,'Partita interrotta: l’app è passata in secondo piano.')}};
  const quit=()=>{cur.stop();autoSetup(song)};
  const togglePause=()=>{
    if(g.over)return;g.paused=!g.paused;const now=ctx.currentTime;
    if(g.paused){g.pausedAt=now}else{g.t0+=now-g.pausedAt;g.lastNow=now}
    sc('#pauseCard').classList.toggle('hidden',!g.paused);
  };
  sc('#hPause').addEventListener('click',togglePause);sc('#pResume').addEventListener('click',togglePause);sc('#hQuit').addEventListener('click',quit);sc('#pQuit').addEventListener('click',quit);
  const hScore=sc('#hScore'),hCombo=sc('#hCombo'),hAcc=sc('#hAcc'),hProg=sc('#hProg');
  const lastT=g.targets[g.targets.length-1].time,col=()=>({bg:css('--surface2'),ink:css('--ink'),muted:css('--muted'),line:css('--line2'),accent:css('--accent')});
  const LEVELDARK={3:true};
  let C=col();let frameN=0;

  function draw(){
    if((frameN++%120)===0)C=col();
    const lw=laneW(),hy=hitY(),ty=topY();
    cx.clearRect(0,0,W,H);cx.fillStyle=C.bg;cx.fillRect(0,0,W,H);
    for(let l=0;l<6;l++){const str=6-l;cx.fillStyle=STR_COLOR[str]+'14';cx.fillRect(l*lw,0,lw,H)}
    cx.strokeStyle=C.line;cx.lineWidth=1;
    for(let l=0;l<=6;l++){cx.beginPath();cx.moveTo(l*lw,0);cx.lineTo(l*lw,H);cx.stroke()}
    if(!wait){cx.strokeStyle=C.line;cx.globalAlpha=.55;const b0=Math.floor(g.songTime/spb),b1=Math.ceil((g.songTime+LA)/spb);
      for(let b=b0;b<=b1;b++){const y=yOf(b*spb);if(y<ty||y>hy)continue;cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke()}cx.globalAlpha=1}
    // linea di battuta
    cx.fillStyle=C.accent;cx.globalAlpha=.9;cx.fillRect(0,hy-2,W,4);cx.globalAlpha=1;
    // note
    for(const t of g.targets){
      const y=yOf(t.time);if(y<-30||y>H+30)continue;if(t.state==='hit'&&g.songTime-t.time>.12)continue;
      const lane=laneOf(t.str),x=lane*lw+lw*.1,w=lw*.8,h=32;
      cx.globalAlpha=t.state==='miss'?.3:1;
      if(t.state==='hit'){cx.globalAlpha=Math.max(0,1-(g.songTime-t.time)/.12)}
      cx.fillStyle=t.state==='miss'?'#888':STR_COLOR[t.str];
      rr(cx,x,y-h/2,w,h,9);cx.fill();cx.strokeStyle='rgba(0,0,0,.35)';cx.lineWidth=1.5;cx.stroke();
      cx.fillStyle=t.str===3?'#1d1d1b':'#fff';cx.font='700 16px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(String(t.fret),x+w/2,y+1);
      cx.globalAlpha=1;
    }
    // effetti
    const nowp=performance.now();
    g.fx=g.fx.filter(f=>nowp-f.t<420);
    g.fx.forEach(f=>{const k=(nowp-f.t)/420;cx.strokeStyle=f.color;cx.globalAlpha=1-k;cx.lineWidth=4;cx.beginPath();cx.arc(f.lane*lw+lw/2,hy,lw*(.3+.5*k),0,7);cx.stroke();cx.globalAlpha=1});
    // etichette corde
    cx.textAlign='center';cx.textBaseline='middle';
    for(let l=0;l<6;l++){const str=6-l;cx.fillStyle=STR_COLOR[str];cx.beginPath();cx.arc(l*lw+lw/2,H*.92,Math.min(16,lw*.34),0,7);cx.fill();cx.fillStyle=str===3?'#1d1d1b':'#fff';cx.font='700 13px system-ui,sans-serif';cx.fillText(String(str),l*lw+lw/2,H*.92+1)}
    // in attesa
    const nt=first();
    if(wait&&nt&&g.songTime>=nt.time-.001){cx.strokeStyle=STR_COLOR[nt.str];cx.lineWidth=3;cx.globalAlpha=.5+.5*Math.sin(nowp/180);cx.strokeRect(laneOf(nt.str)*lw+3,hy-34,lw-6,68);cx.globalAlpha=1}
    // giudizi
    g.judge=g.judge.filter(j=>nowp-j.t<800);
    g.judge.slice(-2).forEach((j,i)=>{const k=(nowp-j.t)/800;cx.globalAlpha=1-k;cx.fillStyle=j.color;cx.font='800 22px system-ui,sans-serif';cx.textAlign='center';cx.fillText(j.text,W/2,hy-54-k*30-i*0);cx.globalAlpha=1});
    // conto alla rovescia
    if(g.songTime<-.05){cx.fillStyle=C.ink;cx.globalAlpha=.85;cx.font='800 64px system-ui,sans-serif';cx.textAlign='center';
      const txt=wait?'Pronti…':String(Math.max(1,Math.ceil(-g.songTime/spb-.001)));cx.fillText(txt,W/2,H*.4);cx.globalAlpha=1}
  }
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

  function frame(){
    if(g.over)return;
    const now=ctx.currentTime,real=performance.now();
    if(!g.paused){
      g.active+=(real-g.lastReal)/1000;
      if(wait){
        const dt=Math.min(.1,now-g.lastNow);g.songTime+=dt;
        const nt=first();
        if(nt&&g.songTime>=nt.time){g.songTime=nt.time;if(!g.waitSince)g.waitSince=real;
          if(!g.hintShown&&real-g.waitSince>7000){g.hintShown=true;const e=playNotes([nt.midi],.5,.16)}}
      }else{
        g.songTime=now-g.t0;
        for(const t of g.targets){if(t.state==='pending'&&g.songTime-t.time>.46)applyMiss(t,null,'Mancata');if(t.time>g.songTime)break}
        if(S.click){const b=Math.max(0,Math.ceil((now+.0-g.t0)/spb));let k=g.nextClick||Math.ceil((g.songTime-spb)/spb);
          while(g.t0+k*spb<now+.15){const at=g.t0+k*spb;if(at>=now-.01&&k>=-4){clickSound(ctx,at,k%4===0?2:0);Mic.gate(at+.12)}k++}g.nextClick=k}
      }
      if(g.songTime>lastT+(wait?0:1.1)&&!first())return finish();
    }
    g.lastNow=now;g.lastReal=real;
    draw();
    const done=g.targets.filter(t=>t.state!=='pending').length,hit=g.targets.filter(t=>t.state==='hit').length;
    hScore.textContent=g.score;hCombo.textContent=g.combo;hAcc.textContent=done?Math.round(hit/done*100)+'%':'—';hProg.style.width=Math.round(done/g.targets.length*100)+'%';
    updateInfo();
    g.raf=requestAnimationFrame(frame);
  }
  frame();
  window.__gsAuto=g;   // per i collaudi
  window.__gsAutoEv=onEv;
}

function autoResults(song,opts,g,r){
  const hits=g.targets.filter(t=>t.state==='hit').length;
  html(stage,`<div class="page-heading result-head"><p class="eyebrow">${esc(song.name)} · ${r.wait?'Aspetta me':'A tempo'}</p><div class="big-stars" aria-label="${r.st} stelle su 3">${stars(r.st)}</div><h1>${r.st===3?'Fantastico!':r.st===2?'Molto bene!':r.st===1?'Ci siamo!':'Riprova con calma'}</h1>
  <p class="lede">${Math.round(r.acc*100)}% di note giuste${r.record?' · nuovo record!':''}</p></div>
  <div class="stats-strip"><div><strong>${g.score}</strong><span>punti</span></div><div><strong>${hits}/${g.targets.length}</strong><span>note giuste</span></div><div><strong>${g.maxCombo}</strong><span>serie migliore</span></div></div>
  ${r.up?`<div class="card level-up">🎉 Nuovo livello: <b>${r.up.title}</b></div>`:''}${r.mis?`<div class="card level-up">✅ Missione del giorno completata · +40 XP</div>`:''}
  <section class="card coach"><h2>Il consiglio dell’Allenatore</h2><ul class="coach-list">${r.tips.map(t=>`<li><span aria-hidden="true">${t.ico}</span><div>${esc(t.t)}${t.link?` <button class="text-btn" data-lk="${t.link}" type="button">${t.linkText}</button>`:''}</div></li>`).join('')}</ul></section>
  <div class="btn-row"><button class="btn" id="rAgain">Riprova</button>${weakSong()?`<button class="btn secondary" id="rWeak">Allena i punti deboli</button>`:''}<button class="btn secondary" id="rLevels">Altri livelli</button></div>`);
  sc('#rAgain').addEventListener('click',()=>autoSetup(song));
  const w=sc('#rWeak');if(w)w.addEventListener('click',()=>autoSetup(weakSong()));
  sc('#rLevels').addEventListener('click',autoPicker);
  stage.querySelectorAll('[data-lk]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.lk)));
  Mic.stop();
}

/* =====================================================================
   CACCIA ALLA NOTA — trova la nota sulla corda indicata, il più in fretta possibile
   ===================================================================== */
const CACCIA_LV={facile:{name:'Facile',sub:'Tasti 0–3 · corda indicata',max:3,any:false},medio:{name:'Medio',sub:'Tasti 0–7 · corda indicata',max:7,any:false},esperto:{name:'Esperto',sub:'Tasti 0–12 · corda indicata',max:12,any:false},libera:{name:'Libera',sub:'Tasti 0–12 · su qualunque corda',max:12,any:true}};
let cLv='facile';
function cacciaSetup(msg){
  html(stage,`<div class="page-heading"><p class="eyebrow">Sfide · Caccia alla nota</p><h1>Caccia alla nota</h1><p class="lede">Ti dico una nota e una corda: trovala sulla tastiera e suonala. Più sei veloce, più punti fai.</p></div>
  <div class="card"><span class="eyebrow">Livello</span><div class="seg wrap">${Object.entries(CACCIA_LV).map(([k,v])=>`<button class="chip ${cLv===k?'active':''}" data-lv="${k}" aria-pressed="${cLv===k}">${v.name}</button>`).join('')}</div>
  <p class="small-text muted">${CACCIA_LV[cLv].sub} · 10 note · 20 secondi per nota${G.best['caccia-'+cLv]?` · record ${G.best['caccia-'+cLv].score} punti`:''}</p>
  ${micBlock(msg)}
  <div class="btn-row"><button class="btn" id="cGo"><svg class="ico"><use href="#i-play"/></svg><span>Gioca con il microfono</span></button></div>
  <p class="small-text muted"><button class="text-btn" id="cTap" type="button">Senza chitarra: rispondi toccando i nomi delle note</button></p></div>`);
  stage.querySelectorAll('[data-lv]').forEach(b=>b.addEventListener('click',()=>{cLv=b.dataset.lv;cacciaSetup(msg)}));
  sc('#cGo').addEventListener('click',()=>cacciaPlay(cLv,false));sc('#cTap').addEventListener('click',()=>cacciaPlay(cLv,true));
}
async function cacciaPlay(lv,tap){
  const L=CACCIA_LV[lv];let ctx;try{ctx=await GA.fresh()}catch(e){cacciaSetup('Audio non disponibile.');return}
  if(!tap){const r=await tryMic();if(!r.ok){cacciaSetup(r.msg+' Puoi rispondere toccando i nomi delle note.');return}}
  // 10 bersagli, tutti con nome diverso dal precedente
  const rounds=[];let lastPc=-1;
  while(rounds.length<10){const str=1+Math.floor(Math.random()*6),fret=Math.floor(Math.random()*(L.max+1)),midi=E.stringNote(str,fret);
    if(midi%12===lastPc||rounds.some(r=>r.str===str&&r.fret===fret))continue;lastPc=midi%12;rounds.push({str,fret,midi,found:false,secs:0,hint:false})}
  const g={i:0,score:0,over:false,t:performance.now(),found:0,hintBtn:false,lock:false,timer:0,active:0};
  const LIMIT=20;
  html(stage,`<div class="game-hud"><div><small>Nota</small><b id="cIdx">1/10</b></div><div><small>Punti</small><b id="cScore">0</b></div><div><small>Tempo</small><b id="cTime">20</b></div>
    <button class="icon-btn" id="cQuit" aria-label="Esci"><svg class="ico"><use href="#i-close"/></svg></button></div>
  <div class="progress thin"><span id="cBar"></span></div>
  <div class="target-card" id="cTarget" aria-live="polite"></div>
  <div class="fb-wrap" id="cBoard" hidden></div>
  <div class="feedback" id="cFeed" aria-live="polite"></div>
  <div class="btn-row"><button class="btn secondary small" id="cHint" hidden>Suggerimento (metà punti)</button><button class="btn secondary small" id="cSkip">Salta</button></div>
  ${tap?`<div class="note-pad">${NOTE_BTN.map((n,i)=>`<button class="chip" data-pc="${i}">${n}</button>`).join('')}</div>`:''}`);
  const cur0=()=>rounds[g.i];
  function showRound(){
    const r=cur0();g.t=performance.now();g.hintBtn=false;g.lock=false;
    sc('#cIdx').textContent=`${g.i+1}/10`;sc('#cBoard').hidden=true;sc('#cHint').hidden=true;sc('#cFeed').textContent='';
    sc('#cTarget').innerHTML=`<small>Suona</small><b>${nameOf(r.midi)}</b><span class="chip active">${L.any?'su qualunque corda':`sulla ${STR_NAME[r.str]} corda (${STR_NOTE[r.str]})`}</span>`;
    sc('#cTarget').classList.remove('ok');
  }
  function resolve(found,why){
    const r=cur0();if(g.lock)return;g.lock=true;r.found=found;r.secs=(performance.now()-g.t)/1000;
    recordNote(r.str,r.fret,found&&!r.hint);
    if(found){g.found++;const pts=Math.max(20,Math.round(100-r.secs*4))*(r.hint?.5:1);g.score+=Math.round(pts);sc('#cFeed').innerHTML=`<b class="okc">Giusto! +${Math.round(pts)}</b>`;sc('#cTarget').classList.add('ok')}
    else{sc('#cFeed').innerHTML=`<b class="badc">${why||'Saltata'}</b>`}
    sc('#cBoard').hidden=false;sc('#cBoard').innerHTML=fretboardSVG([{str:r.str,fret:r.fret,label:r.fret}],Math.max(5,r.fret))+`<p class="small-text muted">${nameOf(r.midi)}: ${posText(r.str,r.fret)}</p>`;
    sc('#cScore').textContent=g.score;
    clearTimeout(g.next);g.next=setTimeout(()=>{if(g.over)return;g.i++;if(g.i>=rounds.length)finish();else showRound()},found?900:1700);
  }
  function onEv(ev){
    if(g.over||g.lock||ev.type!=='note'||ev.midi<38||ev.midi>84)return;
    const r=cur0();
    if(ev.midi%12===r.midi%12)resolve(true);
    else sc('#cFeed').innerHTML=`<span class="muted">Hai suonato ${nameOf(ev.midi)}: ancora un tentativo</span>`;
  }
  if(!tap)Mic.on(onEv);
  stage.querySelectorAll('[data-pc]').forEach(b=>b.addEventListener('click',()=>{if(g.lock)return;const pc=Number(b.dataset.pc);if(pc===cur0().midi%12)resolve(true);else sc('#cFeed').innerHTML=`<span class="muted">Non è ${NOTE_BTN[pc]}: riprova</span>`}));
  sc('#cSkip').addEventListener('click',()=>resolve(false,'Saltata'));
  sc('#cHint').addEventListener('click',()=>{const r=cur0();r.hint=true;sc('#cBoard').hidden=false;sc('#cBoard').innerHTML=fretboardSVG([{str:r.str,fret:r.fret,label:r.fret}],Math.max(5,r.fret))+`<p class="small-text muted">${posText(r.str,r.fret)}</p>`;sc('#cHint').hidden=true});
  function finish(){
    if(g.over)return;g.over=true;clearTimeout(g.next);clearInterval(g.timer);Mic.off(onEv);addMinutes(g.active);
    const found=g.found,key='caccia-'+lv,prev=G.best[key];const record=!prev||g.score>prev.score;if(record)G.best[key]={score:g.score,found};
    G.plays++;const up=addXP(Math.round(g.score/20)+found*2);const mis=checkMission({game:'caccia',found});if(mis)addXP(40);saveG();
    const avg=mean(rounds.filter(r=>r.found).map(r=>r.secs));
    const slow=rounds.filter(r=>r.found).sort((a,b)=>b.secs-a.secs)[0];
    const missed=rounds.filter(r=>!r.found);const tips=[];
    if(missed.length)tips.push({ico:'🎼',t:`Da ripassare: ${missed.map(r=>`${nameOf(r.midi)} (${STR_NAME[r.str]} corda, tasto ${r.fret})`).join(' · ')}.`});
    if(slow&&slow.secs>10)tips.push({ico:'🐢',t:`Hai impiegato ${Math.round(slow.secs)} secondi per ${nameOf(slow.midi)}: studia i nomi delle note sulla ${STR_NAME[slow.str]} corda.`});
    if(found>=9&&avg<6)tips.push({ico:'⚡',t:'Sei velocissimo: passa al livello successivo.'});
    if(!tips.length)tips.push({ico:'👍',t:'Buon lavoro! Ripeti il livello per accorciare i tempi.'});
    html(stage,`<div class="page-heading result-head"><p class="eyebrow">Caccia alla nota · ${L.name}</p><div class="big-num">${found}/10</div><h1>${found>=9?'Occhio da falco!':found>=6?'Molto bene!':'Si migliora giocando'}</h1><p class="lede">${g.score} punti${record?' · nuovo record!':''}${found?` · tempo medio ${avg.toFixed(1)} s`:''}</p></div>
    ${up?`<div class="card level-up">🎉 Nuovo livello: <b>${up.title}</b></div>`:''}${mis?`<div class="card level-up">✅ Missione del giorno completata · +40 XP</div>`:''}
    <section class="card coach"><h2>Il consiglio dell’Allenatore</h2><ul class="coach-list">${tips.map(t=>`<li><span aria-hidden="true">${t.ico}</span><div>${esc(t.t)}</div></li>`).join('')}</ul></section>
    <div class="btn-row"><button class="btn" id="rAgain">Rigioca</button><button class="btn secondary" id="rBack">Cambia livello</button></div>`);
    sc('#rAgain').addEventListener('click',()=>cacciaPlay(lv,tap));sc('#rBack').addEventListener('click',()=>cacciaSetup());Mic.stop();
  }
  g.timer=setInterval(()=>{
    if(g.over)return;g.active+=.25;
    const el=(performance.now()-g.t)/1000;
    if(!g.lock){const left=Math.max(0,LIMIT-el);sc('#cTime').textContent=Math.ceil(left);sc('#cBar').style.width=Math.round(left/LIMIT*100)+'%';
      if(el>8&&!g.hintBtn&&!cur0().hint){g.hintBtn=true;sc('#cHint').hidden=false}
      if(left<=0)resolve(false,'Tempo scaduto')}
  },250);
  cur={stop(){if(!g.over){g.over=true;clearTimeout(g.next);clearInterval(g.timer);Mic.off(onEv);addMinutes(g.active)}},interrupt(){this.stop();cacciaSetup('Partita interrotta: l’app è passata in secondo piano.')}};
  sc('#cQuit').addEventListener('click',()=>{cur.stop();cacciaSetup()});
  showRound();window.__gsCaccia={g,rounds,onEv,resolve};
}

/* =====================================================================
   ECO — ascolta la sequenza e ripetila (allenamento dell’orecchio)
   ===================================================================== */
const ECO_LV={facile:{name:'Facile',sub:'3 note: MI (E), SI (B), SOL (G) a vuoto',pool:[64,59,55]},
  medio:{name:'Medio',sub:'Le sei corde a vuoto',pool:[40,45,50,55,59,64]},
  difficile:{name:'Difficile',sub:'Scala di DO (C) in prima posizione',pool:[48,50,52,53,55,57,59,60]}};
let eLv='facile';
function ecoSetup(msg){
  html(stage,`<div class="page-heading"><p class="eyebrow">Sfide · Eco</p><h1>Eco</h1><p class="lede">Ascolta una breve melodia e ripetila con la chitarra. Ad ogni giro si aggiunge una nota: fin dove arrivi?</p></div>
  <div class="card"><span class="eyebrow">Livello</span><div class="seg wrap">${Object.entries(ECO_LV).map(([k,v])=>`<button class="chip ${eLv===k?'active':''}" data-lv="${k}" aria-pressed="${eLv===k}">${v.name}</button>`).join('')}</div>
  <p class="small-text muted">${ECO_LV[eLv].sub} · 3 vite${G.best['eco-'+eLv]?` · record: ${G.best['eco-'+eLv].len} note`:''}</p>
  ${micBlock(msg||'Consiglio: usa le cuffie per ascoltare la melodia, così il microfono sente solo la tua chitarra.')}
  <div class="btn-row"><button class="btn" id="eGo"><svg class="ico"><use href="#i-play"/></svg><span>Gioca con il microfono</span></button></div>
  <p class="small-text muted"><button class="text-btn" id="eTap" type="button">Senza chitarra: rispondi toccando le note</button></p></div>`);
  stage.querySelectorAll('[data-lv]').forEach(b=>b.addEventListener('click',()=>{eLv=b.dataset.lv;ecoSetup(msg)}));
  sc('#eGo').addEventListener('click',()=>ecoPlay(eLv,false));sc('#eTap').addEventListener('click',()=>ecoPlay(eLv,true));
}
async function ecoPlay(lv,tap){
  const L=ECO_LV[lv];let ctx;try{ctx=await GA.fresh()}catch(e){ecoSetup('Audio non disponibile.');return}
  if(!tap){const r=await tryMic();if(!r.ok){ecoSetup(r.msg+' Puoi rispondere toccando le note.');return}}
  const g={seq:[],idx:0,lives:3,score:0,phase:'idle',over:false,maxLen:0,active:0,timers:[],listenAt:0};
  const pcs=[...new Set(L.pool.map(m=>m%12))];
  html(stage,`<div class="game-hud"><div><small>Lunghezza</small><b id="eLen">0</b></div><div><small>Punti</small><b id="eScore">0</b></div><div><small>Vite</small><b id="eLives">❤❤❤</b></div>
    <button class="icon-btn" id="eQuit" aria-label="Esci"><svg class="ico"><use href="#i-close"/></svg></button></div>
  <div class="target-card" id="eStatus" aria-live="polite"></div>
  <div class="echo-dots" id="eDots" aria-hidden="true"></div>
  <div class="feedback" id="eFeed" aria-live="polite"></div>
  <div class="btn-row"><button class="btn secondary small" id="eAgain" hidden>Riascolta</button></div>
  ${tap?`<div class="note-pad">${pcs.map(pc=>`<button class="chip" data-pc="${pc}">${NOTE_BTN[pc]}</button>`).join('')}</div>`:''}`);
  const lives=()=>'❤'.repeat(g.lives)+'♡'.repeat(3-g.lives);
  function drawDots(shown){sc('#eDots').innerHTML=g.seq.map((m,i)=>`<span class="dot ${i<g.idx?'done':''}">${i<g.idx||shown?`${E.noteName(m).it}<small>(${E.noteName(m).intl})</small>`:'?'}</span>`).join('');sc('#eLen').textContent=g.seq.length;sc('#eLives').textContent=lives();sc('#eScore').textContent=g.score}
  function later(fn,ms){const id=setTimeout(()=>{if(!g.over)fn()},ms);g.timers.push(id)}
  function nextRound(add=true){
    if(add){let m;do{m=pick(L.pool)}while(g.seq.length>=2&&g.seq[g.seq.length-1]===m&&g.seq[g.seq.length-2]===m);g.seq.push(m)}
    g.idx=0;g.phase='listen';sc('#eAgain').hidden=true;sc('#eFeed').textContent='';
    sc('#eStatus').innerHTML=`<small>Ascolta…</small><b>🎧</b>`;drawDots(false);
    const gap=.62,end=playNotes(g.seq,gap);const ms=Math.max(200,(end-ctx.currentTime)*1000);
    // evidenzia le note mentre suonano
    g.seq.forEach((m,i)=>later(()=>{const d=sc('#eDots').children[i];if(d){d.classList.add('lit');setTimeout(()=>d.classList.remove('lit'),380)}},80+i*gap*1000));
    later(()=>{g.phase='play';g.listenAt=ctx.currentTime;sc('#eStatus').innerHTML=`<small>Tocca a te</small><b>🎸</b>`;sc('#eAgain').hidden=false},ms+300);
  }
  function good(m){
    g.idx++;g.score+=10*g.seq.length;drawDots(false);
    if(g.idx>=g.seq.length){g.maxLen=Math.max(g.maxLen,g.seq.length);g.phase='between';sc('#eFeed').innerHTML='<b class="okc">Perfetto!</b>';sc('#eAgain').hidden=true;later(()=>nextRound(true),1100)}
  }
  function bad(m){
    g.phase='between';g.lives--;sc('#eAgain').hidden=true;
    sc('#eFeed').innerHTML=`<b class="badc">${m!=null?`Hai suonato ${nameOf(m)}`:'Non era questa'}</b> · era ${nameOf(g.seq[g.idx])}`;
    sc('#eLives').textContent=lives();
    if(g.lives<=0){g.maxLen=Math.max(g.maxLen,g.seq.length-1);later(finish,1500)}else{drawDots(true);later(()=>nextRound(false),2000)}
  }
  function onEv(ev){if(g.over||g.phase!=='play'||ev.type!=='note'||ev.midi<38||ev.midi>81)return;if(ev.tc<g.listenAt)return;
    if(ev.midi%12===g.seq[g.idx]%12)good(ev.midi);else bad(ev.midi)}
  if(!tap)Mic.on(onEv);
  stage.querySelectorAll('[data-pc]').forEach(b=>b.addEventListener('click',async()=>{if(g.phase!=='play')return;const pc=Number(b.dataset.pc);const m=L.pool.find(x=>x%12===pc);pluckTone(ctx,m,ctx.currentTime+.02,1.2,.14,0);if(pc===g.seq[g.idx]%12)good(m);else bad(m)}));
  sc('#eAgain').addEventListener('click',()=>{if(g.phase==='play')nextRound(false)});
  function finish(){
    if(g.over)return;g.over=true;g.timers.forEach(clearTimeout);Mic.off(onEv);addMinutes(g.active);
    const len=g.maxLen,key='eco-'+lv,prev=G.best[key];const record=len>0&&(!prev||len>prev.len);if(record)G.best[key]={len,score:g.score};
    G.plays++;const up=addXP(Math.round(g.score/8)+len*4);const mis=checkMission({game:'eco',maxLen:len});if(mis)addXP(40);saveG();
    const tips=[len<4?{ico:'👂',t:'Prova a cantare o fischiare la melodia prima di suonarla: l’orecchio si allena così.'}:len<8?{ico:'👂',t:'Ottimo orecchio! Per andare oltre, raggruppa le note a due a due e ripetile mentalmente.'}:{ico:'🏆',t:'Memoria e orecchio eccellenti: prova il livello successivo.'}];
    html(stage,`<div class="page-heading result-head"><p class="eyebrow">Eco · ${L.name}</p><div class="big-num">${len}</div><h1>${len>=8?'Orecchio d’oro!':len>=4?'Molto bene!':'Si migliora giocando'}</h1><p class="lede">sequenza più lunga ripetuta · ${g.score} punti${record?' · nuovo record!':''}</p></div>
    ${up?`<div class="card level-up">🎉 Nuovo livello: <b>${up.title}</b></div>`:''}${mis?`<div class="card level-up">✅ Missione del giorno completata · +40 XP</div>`:''}
    <section class="card coach"><h2>Il consiglio dell’Allenatore</h2><ul class="coach-list">${tips.map(t=>`<li><span aria-hidden="true">${t.ico}</span><div>${esc(t.t)}</div></li>`).join('')}</ul></section>
    <div class="btn-row"><button class="btn" id="rAgain">Rigioca</button><button class="btn secondary" id="rBack">Cambia livello</button></div>`);
    sc('#rAgain').addEventListener('click',()=>ecoPlay(lv,tap));sc('#rBack').addEventListener('click',()=>ecoSetup());Mic.stop();
  }
  g.start=performance.now();
  const act=setInterval(()=>{if(g.over)clearInterval(act);else g.active+=1},1000);
  cur={stop(){if(!g.over){g.over=true;g.timers.forEach(clearTimeout);Mic.off(onEv);addMinutes(g.active)}clearInterval(act)},interrupt(){this.stop();ecoSetup('Partita interrotta: l’app è passata in secondo piano.')}};
  sc('#eQuit').addEventListener('click',()=>{cur.stop();ecoSetup()});
  nextRound(true);window.__gsEco={g,onEv};
}

/* =====================================================================
   CAMBI LAMPO — quanti cambi di accordo riesci a fare in 60 secondi?
   ===================================================================== */
const CAMBI_SETS=[{k:'em-am',name:'',chords:['Em','Am']},{k:'c-g',name:'',chords:['C','G']},{k:'g-c-d',name:'',chords:['G','C','D']},
  {k:'a-d-e',name:'',chords:['A','D','E']},{k:'am-dm-e-c',name:'',chords:['Am','Dm','E','C']},{k:'c-f-g-am',name:'',chords:['C','Fmini','G','Am']}];
CAMBI_SETS.forEach(s=>{s.name=s.chords.map(n=>{const c=chordByName(n);return c?chordLabel(c):n}).join(' – ')});
let cbSet='em-am',cbSecs=60;
function cambiSetup(msg){
  html(stage,`<div class="page-heading"><p class="eyebrow">Sfide · Cambi lampo</p><h1>Cambi lampo</h1><p class="lede">Ti mostro un accordo, tu lo suoni: appena lo riconosco passo al successivo. Quanti cambi fai nel tempo?</p></div>
  <div class="card"><span class="eyebrow">Accordi</span><div class="rows compact">${CAMBI_SETS.map(s=>`<button class="row ${cbSet===s.k?'sel':''}" data-set="${s.k}" aria-pressed="${cbSet===s.k}"><span class="row-body"><b>${esc(s.name)}</b>${G.best['cambi-'+s.k]?`<small>record ${G.best['cambi-'+s.k].changes} cambi</small>`:''}</span><span class="chev">${cbSet===s.k?'✓':''}</span></button>`).join('')}</div>
  <span class="eyebrow">Durata</span><div class="seg">${[30,60,90].map(v=>`<button class="chip ${cbSecs===v?'active':''}" data-secs="${v}" aria-pressed="${cbSecs===v}">${v} secondi</button>`).join('')}</div>
  ${micBlock(msg||'Suona l’accordo con tutte le corde, lasciandolo risuonare un istante. Il riconoscimento funziona meglio in un ambiente silenzioso.')}
  <div class="btn-row"><button class="btn" id="bGo"><svg class="ico"><use href="#i-play"/></svg><span>Gioca con il microfono</span></button></div>
  <p class="small-text muted"><button class="text-btn" id="bTap" type="button">Senza chitarra: tocca “Fatto” quando hai cambiato</button></p></div>`);
  stage.querySelectorAll('[data-set]').forEach(b=>b.addEventListener('click',()=>{cbSet=b.dataset.set;cambiSetup(msg)}));
  stage.querySelectorAll('[data-secs]').forEach(b=>b.addEventListener('click',()=>{cbSecs=Number(b.dataset.secs);cambiSetup(msg)}));
  sc('#bGo').addEventListener('click',()=>cambiPlay(false));sc('#bTap').addEventListener('click',()=>cambiPlay(true));
}
async function cambiPlay(tap){
  const set=CAMBI_SETS.find(s=>s.k===cbSet),secs=cbSecs;let ctx;try{ctx=await GA.fresh()}catch(e){cambiSetup('Audio non disponibile.');return}
  if(!tap){const r=await tryMic();if(!r.ok){cambiSetup(r.msg+' Puoi giocare toccando “Fatto”.');return}}
  const chords=set.chords.map(chordByName).filter(Boolean);
  const cands=chords.map(c=>({name:c.name,pcs:E.chordPcsFromChord(c)}));
  const g={over:false,changes:0,score:0,target:null,since:0,start:0,end:0,lockUntil:0,onsetAt:-9,ok:0,lastPoll:0,raf:0,times:[],trans:[],prev:null,started:false,active:0};
  html(stage,`<div class="game-hud"><div><small>Cambi</small><b id="bCh">0</b></div><div><small>Punti</small><b id="bSc">0</b></div><div><small>Tempo</small><b id="bTm">${secs}</b></div>
    <button class="icon-btn" id="bQuit" aria-label="Esci"><svg class="ico"><use href="#i-close"/></svg></button></div>
  <div class="progress thin"><span id="bBar" style="width:100%"></span></div>
  <div class="chord-stage" id="bChord" aria-live="polite"></div>
  <div class="feedback" id="bFeed" aria-live="polite"></div>
  <div class="btn-row"><button class="btn" id="bDone" ${tap?'':'hidden'}>Fatto ✓</button><button class="btn secondary small" id="bSkip" hidden>Salta</button></div>`);
  function setTarget(){
    let c;do{c=pick(chords)}while(chords.length>1&&g.target&&c.name===g.target.name);
    g.target=c;g.since=ctx.currentTime;g.ok=0;sc('#bSkip').hidden=true;
    sc('#bChord').innerHTML=`<h2>${esc(chordLabel(c))}</h2>${chordSVG(c)}`;
  }
  function success(skipped){
    const now=ctx.currentTime,took=now-g.since;
    if(!skipped){g.changes++;g.score+=100+Math.max(0,Math.round(60-took*8));if(g.prev)g.trans.push({from:g.prev.name,to:g.target.name,secs:took});g.times.push({name:g.target.name,secs:took});sc('#bFeed').innerHTML=`<b class="okc">${esc(chordLabel(g.target))} ✓ · ${took.toFixed(1)} s</b>`}
    else sc('#bFeed').innerHTML='<span class="muted">Saltato</span>';
    g.prev=g.target;g.lockUntil=now+.9;g.onsetAt=-9;
    sc('#bCh').textContent=g.changes;sc('#bSc').textContent=g.score;setTarget();
  }
  function onEv(ev){if(ev.type==='onset'&&ev.tc>=g.lockUntil-.2)g.onsetAt=ev.tc}
  if(!tap)Mic.on(onEv);
  function poll(now){
    if(tap||now-g.lastPoll<.1||now<g.lockUntil)return;g.lastPoll=now;
    const an=Mic.an;if(!an||g.onsetAt<0||now-g.onsetAt<.24||now-g.onsetAt>2.5){g.ok=0;return}
    const seg=Mic.recent(8192),ch=E.chroma(seg,an.sr);
    const r=E.recognizeChord(ch.chroma,ch.total,cands,g.target.name,.42);
    if(r.ok){g.ok++;if(g.ok>=2)success(false)}else g.ok=0;
  }
  function begin(){g.started=true;g.start=ctx.currentTime;g.end=g.start+secs;g.lockUntil=0;setTarget();sc('#bFeed').textContent='';}
  // conto alla rovescia 3-2-1
  let cd=3;sc('#bChord').innerHTML=`<div class="count">${cd}</div>`;const cdT=setInterval(()=>{cd--;if(cd>0)sc('#bChord').innerHTML=`<div class="count">${cd}</div>`;else{clearInterval(cdT);begin()}},800);
  g.cdT=cdT;
  function frame(){
    if(g.over)return;const now=ctx.currentTime;
    if(g.started){
      g.active=now-g.start;const left=Math.max(0,g.end-now);sc('#bTm').textContent=Math.ceil(left);sc('#bBar').style.width=(left/secs*100)+'%';
      poll(now);if(now-g.since>5)sc('#bSkip').hidden=false;
      if(left<=0)return finish();
    }
    g.raf=requestAnimationFrame(frame);
  }
  function finish(){
    if(g.over)return;g.over=true;cancelAnimationFrame(g.raf);clearInterval(cdT);Mic.off(onEv);addMinutes(g.active);
    const ch=g.changes,key='cambi-'+cbSet,prev=G.best[key];const record=ch>0&&(!prev||ch>prev.changes);if(record)G.best[key]={changes:ch,score:g.score,secs};
    G.plays++;const up=addXP(Math.round(g.score/10)+ch*3);const mis=checkMission({game:'cambi',changes:ch});if(mis)addXP(40);saveG();
    const tips=[];const slow=g.trans.slice().sort((a,b)=>b.secs-a.secs)[0];
    if(slow&&slow.secs>3)tips.push({ico:'🐢',t:`Il cambio più lento è ${chordLabel(chordByName(slow.from))} → ${chordLabel(chordByName(slow.to))} (${slow.secs.toFixed(1)} s). Allenalo da solo, lentamente, cercando di muovere tutte le dita insieme.`});
    if(ch<4)tips.push({ico:'💡',t:'Prima di suonare, pensa alla forma del prossimo accordo e portaci le dita in un solo movimento.'});
    else tips.push({ico:'⚡',t:`${ch} cambi in ${secs} secondi: ${(secs/ch).toFixed(1)} s a cambio. Prova a superarti!`});
    html(stage,`<div class="page-heading result-head"><p class="eyebrow">Cambi lampo · ${esc(set.name)}</p><div class="big-num">${ch}</div><h1>${ch>=12?'Mani di fata!':ch>=6?'Molto bene!':'Si migliora giocando'}</h1><p class="lede">cambi in ${secs} secondi · ${g.score} punti${record?' · nuovo record!':''}</p></div>
    ${up?`<div class="card level-up">🎉 Nuovo livello: <b>${up.title}</b></div>`:''}${mis?`<div class="card level-up">✅ Missione del giorno completata · +40 XP</div>`:''}
    <section class="card coach"><h2>Il consiglio dell’Allenatore</h2><ul class="coach-list">${tips.map(t=>`<li><span aria-hidden="true">${t.ico}</span><div>${esc(t.t)}</div></li>`).join('')}</ul></section>
    <div class="btn-row"><button class="btn" id="rAgain">Rigioca</button><button class="btn secondary" id="rBack">Cambia accordi</button></div>`);
    sc('#rAgain').addEventListener('click',()=>cambiPlay(tap));sc('#rBack').addEventListener('click',()=>cambiSetup());Mic.stop();
  }
  sc('#bDone').addEventListener('click',()=>{if(g.started)success(false)});
  sc('#bSkip').addEventListener('click',()=>{if(g.started)success(true)});
  cur={stop(){if(!g.over){g.over=true;cancelAnimationFrame(g.raf);clearInterval(cdT);Mic.off(onEv);addMinutes(g.active)}},interrupt(){this.stop();cambiSetup('Partita interrotta: l’app è passata in secondo piano.')}};
  sc('#bQuit').addEventListener('click',()=>{cur.stop();cambiSetup()});
  frame();window.__gsCambi={g,success};
}

/* =====================================================================
   PROVA DEL MICROFONO e CALIBRAZIONE
   ===================================================================== */
async function micTest(){
  let ctx;try{ctx=await GA.fresh()}catch(e){return}
  html(stage,`<button class="back" id="bkHub"><svg class="ico"><use href="#i-back"/></svg>Sfide</button>
  <div class="page-heading"><p class="eyebrow">Sfide · Microfono</p><h1>Prova il microfono</h1><p class="lede">Suona una corda: qui sotto vedi che nota sente il telefono.</p></div>
  <div class="card mic-test"><div class="mt-note" id="mtNote" aria-live="polite">—</div><div class="mt-sub" id="mtSub">Sto attivando il microfono…</div>
  <div class="meter" aria-hidden="true"><span id="mtLevel"></span></div>
  <div class="tune-bar" aria-hidden="true"><i></i><b id="mtNeedle"></b></div><p class="small-text muted" id="mtHelp"></p>
  <div class="btn-row"><button class="btn secondary" id="mtCalib">Calibra il ritardo</button></div></div>`);
  sc('#bkHub').addEventListener('click',backToHub);sc('#mtCalib').addEventListener('click',()=>calibrate());
  const r=await tryMic();
  if(!r.ok){sc('#mtSub').textContent=r.msg;return}
  sc('#mtSub').textContent='Ascolto… suona una corda';
  let raf=0,over=false,lastNote=0,silentSince=performance.now();
  const onEv=ev=>{if(ev.type==='note'){lastNote=performance.now();const n=E.noteName(ev.midi);sc('#mtNote').textContent=n.label;sc('#mtSub').textContent=`${ev.f.toFixed(1)} Hz · ${ev.cents>0?'+':''}${Math.round(ev.cents)} cent`;sc('#mtNeedle').style.left=(50+clamp(ev.cents,-50,50))+'%'}};
  Mic.on(onEv);
  const loop=()=>{if(over)return;
    const lv=clamp(Mic.level*9,0,1);sc('#mtLevel').style.width=Math.round(lv*100)+'%';
    if(Mic.level>.01)silentSince=performance.now();
    if(performance.now()-silentSince>5000)sc('#mtHelp').textContent='Non sento nulla: avvicina il telefono alla chitarra (circa 30 cm dalla buca) e controlla che il microfono non sia coperto.';
    else if(performance.now()-lastNote>3000&&Mic.level>.02)sc('#mtHelp').textContent='Sento un suono ma non riconosco una nota: suona una corda sola e lascia risuonare.';
    else sc('#mtHelp').textContent='';
    raf=requestAnimationFrame(loop)};loop();
  cur={stop(){over=true;cancelAnimationFrame(raf);Mic.off(onEv)},interrupt(){this.stop();Mic.stop();backToHub()}};
}
async function calibrate(){
  let ctx;try{ctx=await GA.fresh()}catch(e){return}
  if(cur)cur.stop();
  html(stage,`<button class="back" id="bkHub"><svg class="ico"><use href="#i-back"/></svg>Sfide</button>
  <div class="page-heading"><p class="eyebrow">Sfide · Calibrazione</p><h1>Calibra il ritardo</h1><p class="lede">Ogni telefono ha un piccolo ritardo tra il suono e l’analisi. Suona una corda a vuoto <b>nell’istante in cui il cerchio si accende</b>: bastano 8 note.</p></div>
  <div class="card calib"><div class="flash" id="cbFlash" aria-hidden="true"></div><p class="calib-count" id="cbCount">Pronti?</p><p class="small-text muted" id="cbMsg"></p>
  <div class="btn-row"><button class="btn" id="cbStart">Inizia</button><button class="btn secondary" id="cbReset">Azzera (${S.offset} ms)</button></div></div>`);
  sc('#bkHub').addEventListener('click',backToHub);
  sc('#cbReset').addEventListener('click',()=>{S.offset=0;saveS();sc('#cbReset').textContent='Azzera (0 ms)';sc('#cbMsg').textContent='Ritardo azzerato.'});
  let over=false,raf=0;cur={stop(){over=true;cancelAnimationFrame(raf)},interrupt(){this.stop();Mic.stop();backToHub()}};
  sc('#cbStart').addEventListener('click',async()=>{
    sc('#cbStart').disabled=true;const r=await tryMic();if(!r.ok){sc('#cbMsg').textContent=r.msg;sc('#cbStart').disabled=false;return}
    const N=8,t0=ctx.currentTime+2.2,flashes=Array.from({length:N},(_,i)=>t0+i*1.1),raw=[];
    const onEv=ev=>{if(ev.type==='onset')raw.push(ev.tc+S.offset/1000)};Mic.on(onEv);
    const f=sc('#cbFlash');
    const loop=()=>{if(over)return;const now=ctx.currentTime;
      const k=flashes.findIndex(t=>now>=t&&now<t+.16);f.classList.toggle('on',k>=0);
      const done=flashes.filter(t=>now>=t).length;sc('#cbCount').textContent=now<t0?'Preparati…':`${Math.min(N,done)} / ${N}`;
      if(now>flashes[N-1]+1.0){Mic.off(onEv);return result()}
      raf=requestAnimationFrame(loop)};
    function result(){
      const d=[];flashes.forEach(t=>{let best=null;raw.forEach(r=>{const x=r-t;if(Math.abs(x)<.55&&(best===null||Math.abs(x)<Math.abs(best)))best=x});if(best!==null)d.push(best)});
      f.classList.remove('on');
      if(d.length<4){sc('#cbCount').textContent='Non ho sentito abbastanza note';sc('#cbMsg').textContent='Suona una corda a vuoto a ogni lampo, con decisione, e riprova.';sc('#cbStart').disabled=false;return}
      const med=Math.round(clamp(median(d)*1000,-300,500));
      sc('#cbCount').textContent=`Ritardo misurato: ${med} ms`;sc('#cbMsg').innerHTML=`Su ${d.length} note, valore mediano. <button class="text-btn" id="cbSave" type="button">Salva</button>`;
      sc('#cbSave').addEventListener('click',()=>{S.offset=med;saveS();sc('#cbMsg').textContent='Calibrazione salvata ✓';sc('#cbReset').textContent=`Azzera (${med} ms)`});
      sc('#cbStart').disabled=false;sc('#cbStart').textContent='Ripeti';
    }
    loop();
  });
}

/* =====================================================================
   HOME DELLE SFIDE
   ===================================================================== */
const GAMES=[
  {id:'auto',name:'Autostrada',ico:'music',small:()=>{const vis=SONGS.filter(s=>!s.hidden),n=vis.reduce((a,s)=>a+(G.best[s.id]?G.best[s.id].stars:0),0);return`Note che scendono, stile Guitar Hero · ${n}/${vis.length*3} ★`},open:()=>{autoPicker()}},
  {id:'caccia',name:'Caccia alla nota',ico:'game',small:()=>'Trova la nota sulla tastiera, più veloce che puoi',open:()=>cacciaSetup()},
  {id:'eco',name:'Eco',ico:'tuner',small:()=>'Ascolta la melodia e ripetila: allena l’orecchio',open:()=>ecoSetup()},
  {id:'cambi',name:'Cambi lampo',ico:'chords',small:()=>'Quanti cambi di accordo in 60 secondi?',open:()=>cambiSetup()}
];
let stageReady=false;
function openGame(id){stageReady=true;const gm=GAMES.find(x=>x.id===id);go('gioco');setCur(null);Mic.stop();gm.open()}
function renderHub(){
  const L=levelInfo(),m=todayMission(),today=isoLocal(),done=!!G.missions[today],wl=weakList().slice(0,4);
  const mins=Math.round(G.minutes[today]||0),unlogged=(G.minutes[today]||0)-(G.logged[today]||0);
  html(hub,`<section class="card level-card"><div class="lv-badge" aria-hidden="true">${L.n}</div><div class="lv-body"><b>${esc(L.title)}</b><small>${G.xp} XP${L.next?` · ancora ${L.next} al prossimo livello`:' · livello massimo'}</small><div class="progress thin"><span style="width:${Math.round(L.pct*100)}%"></span></div></div></section>
  <section class="card mission ${done?'done':''}"><span class="eyebrow">Missione di oggi</span><p><b>${done?'✅ ':''}${esc(m.text)}</b></p><small class="muted">${done?'Completata: +40 XP. Torna domani per una nuova missione.':'Completala per ottenere 40 XP.'}</small></section>
  <h2 class="section-title">Giochi</h2>
  <div class="rows">${GAMES.map(x=>`<button class="row game-row" data-game="${x.id}"><span class="row-ico"><svg class="ico"><use href="#i-${x.ico}"/></svg></span><span class="row-body"><b>${x.name}</b><small>${esc(x.small())}</small></span><svg class="ico chev"><use href="#i-next"/></svg></button>`).join('')}</div>
  <section class="card coach"><h2>Il tuo Allenatore</h2>
  ${wl.length?`<p class="small-text muted">Le note che sbagli più spesso, in base alle ultime partite:</p><ul class="weak-list">${wl.map(w=>`<li><b>${nameOf(E.stringNote(w.str,w.fret))}</b> <span class="muted">${posText(w.str,w.fret)}</span><em>${Math.round((1-w.rate)*100)}% giuste</em></li>`).join('')}</ul>${wl.length>=2?'<button class="btn small" id="hubWeak">Allena i punti deboli</button>':''}`
  :`<p class="small-text muted">Gioca Autostrada o Caccia alla nota: l’Allenatore tiene traccia delle note che ti riescono meno e prepara un allenamento su misura.</p>`}</section>
  <section class="card"><h2>Microfono e impostazioni</h2>
  <div class="btn-row"><button class="btn secondary small" id="hubMic">Prova il microfono</button><button class="btn secondary small" id="hubCal">Calibra il ritardo</button></div>
  <label class="field slider-field">Sensibilità del microfono<input type="range" id="setSens" min="0.5" max="2.5" step="0.1" value="${S.sens}"><span class="small-text muted" id="sensVal">${S.sens<.9?'bassa (stanza rumorosa)':S.sens>1.4?'alta (suono debole)':'normale'}</span></label>
  <label class="check-field"><input type="checkbox" id="setClick" ${S.click?'checked':''}> <span>Click del metronomo in Autostrada <small class="muted">(consigliato solo con le cuffie)</small></span></label>
  <p class="small-text muted">Ritardo del microfono: ${S.offset} ms. L’app non registra e non invia nulla: l’audio viene analizzato sul dispositivo e subito scartato.</p></section>
  <section class="card"><h2>Diario</h2><p class="small-text muted">Oggi hai dedicato ${mins} ${mins===1?'minuto':'minuti'} alle Sfide.</p>
  <button class="btn secondary small" id="hubDiary" ${unlogged<.5?'disabled':''}>${unlogged<.5?(G.logged[today]?'Già nel Diario ✓':'Nessun minuto da aggiungere'):`Aggiungi ${Math.max(1,Math.round(unlogged))} min al Diario`}</button></section>`);
  hub.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>openGame(b.dataset.game)));
  const w=$('hubWeak');if(w)w.addEventListener('click',()=>{openGame('auto');const s=weakSong();if(s)autoSetup(s)});
  $('hubMic').addEventListener('click',()=>{stageReady=true;go('gioco');micTest()});
  $('hubCal').addEventListener('click',()=>{stageReady=true;go('gioco');calibrate()});
  $('setSens').addEventListener('input',e=>{S.sens=Number(e.target.value);saveS();$('sensVal').textContent=S.sens<.9?'bassa (stanza rumorosa)':S.sens>1.4?'alta (suono debole)':'normale'});
  $('setClick').addEventListener('change',e=>{S.click=e.target.checked;saveS()});
  $('hubDiary').addEventListener('click',()=>{
    const min=Math.max(1,Math.round(unlogged));
    sessions.unshift({id:Date.now(),date:today,duration:min,activity:'Tecnica',notes:'Sfide: Autostrada, Caccia alla nota, Eco, Cambi lampo'});
    sessions.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);G.logged[today]=G.minutes[today];saveG();saveSessions();renderHub();
  });
}

/* ---------- Collegamento con l’app ---------- */
function onView(name){
  if(name!=='gioco'){stageReady=false;if(cur){leave()}else{Mic.stop();GA.close()}}
  if(name==='sfide')renderHub();
}
function interrupt(){const c=cur;if(c&&c.interrupt){Mic.stop();c.interrupt()}else Mic.stop()}
window.GSGame={onView,ready:()=>stageReady,interrupt,
  test:{Mic,GA,get G(){return G},set G(v){G=v},S,SONGS,levelInfo,weakList,weakSong,coachAnalysis,openGame,autoSetup,autoPlay,cacciaPlay,ecoPlay,cambiPlay,get cur(){return cur},micTest,calibrate,renderHub,todayMission,MISSIONS,addMinutes}};
if(location.hash==='#sfide')renderHub();
})();
