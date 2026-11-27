'use strict';
// Guitar Studio 3.2.0 — logica dell'app. I contenuti didattici sono in data.js.
const APP_VERSION='3.2.0';
const $=id=>document.getElementById(id);
const AudioCtor=window.AudioContext||window.webkitAudioContext;
const pad2=n=>String(n).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=(n,c='')=>`<svg class="ico ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ---------- Archivio locale (a prova di dati corrotti o storage bloccato) ---------- */
function loadJSON(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch(e){return fallback}}
function saveJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true}catch(e){return false}}
const KEY_SESSIONS='guitarStudioSessionsV1',KEY_PATH='guitar-studio-chord-path-v1',KEY_GOAL='guitarStudioGoalV1',KEY_THEME='guitarStudioTheme';
function isoLocal(d=new Date()){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`}

/* ---------- Audio condiviso ---------- */
let sharedCtx=null;
async function getCtx(){
  if(!AudioCtor)return null;
  if(!sharedCtx||sharedCtx.state==='closed')sharedCtx=new AudioCtor();
  if(sharedCtx.state==='suspended'){try{await sharedCtx.resume()}catch(e){}}
  return sharedCtx;
}
function pluckTone(ctx,midi,start,duration=2.2,velocity=.13,pan=0){
  const f0=440*Math.pow(2,(midi-69)/12);
  const out=ctx.createGain();
  out.gain.setValueAtTime(.0001,start);
  out.gain.exponentialRampToValueAtTime(velocity,start+.008);
  out.gain.exponentialRampToValueAtTime(velocity*.34,start+.12);
  out.gain.exponentialRampToValueAtTime(.0001,start+duration);
  let dest=ctx.destination;
  if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;p.connect(ctx.destination);dest=p}
  out.connect(dest);
  [1,2,3,4,5].forEach((h,i)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='sine';o.frequency.value=f0*h;g.gain.value=[1,.42,.2,.09,.035][i];
    o.connect(g);g.connect(out);o.start(start);o.stop(start+duration+.03);
  });
  const nb=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.025),ctx.sampleRate),d=nb.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const n=ctx.createBufferSource(),ng=ctx.createGain();n.buffer=nb;
  ng.gain.setValueAtTime(.0001,start);ng.gain.exponentialRampToValueAtTime(.018,start+.002);ng.gain.exponentialRampToValueAtTime(.0001,start+.025);
  n.connect(ng);ng.connect(out);n.start(start);n.stop(start+.03);
}

/* ---------- Navigazione (con cronologia: il tasto indietro di Android funziona) ---------- */
const views=[...document.querySelectorAll('.view')];
function show(name){
  if(!$(name)||!$(name).classList.contains('view'))name='home';
  if(name==='gioco'&&!(window.GSGame&&GSGame.ready())){name='sfide';history.replaceState(null,'','#sfide')}
  if(name!=='metronomo')stopMetro();
  if(name!=='accordatore')stopTuner();
  stopInlineMetronome();
  views.forEach(v=>v.classList.toggle('active',v.id===name));
  // Barra in basso: si illumina la voce della pagina aperta (Home, Esercizi, Accordi, Accordatore, Metronomo)
  document.querySelectorAll('.nav-item').forEach(b=>{const on=b.dataset.go===name;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  window.scrollTo(0,0);
  if(window.GSGame)GSGame.onView(name);
}
function go(name){if(location.hash==='#'+name)show(name);else location.hash=name}
window.addEventListener('hashchange',()=>show(location.hash.slice(1)||'home'));
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){e.preventDefault();go(b.dataset.go)}});

/* ---------- Tema chiaro/scuro ---------- */
function effectiveTheme(){const t=document.documentElement.dataset.theme;return t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
function paintThemeBtn(){const dark=effectiveTheme()==='dark';$('themeBtn').innerHTML=ico(dark?'sun':'moon');$('themeBtn').setAttribute('aria-label',dark?'Passa al tema chiaro':'Passa al tema scuro')}
$('themeBtn').addEventListener('click',()=>{const next=effectiveTheme()==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem(KEY_THEME,next)}catch(e){}paintThemeBtn()});
paintThemeBtn();

/* ---------- Schermo sempre acceso (Screen Wake Lock) ---------- */
// Su iPhone: Safari dal 16.4; app aggiunta alla Home dal 18.4. Il blocco cade quando la pagina va in secondo piano
// e va richiesto di nuovo al ritorno; se il telefono è in risparmio energetico la richiesta può essere rifiutata.
const KEY_AWAKE='guitarStudioKeepAwakeV1';
let keepAwake=loadJSON(KEY_AWAKE,true)!==false,wakeLock=null,wakeBusy=false,wakeFailed=false,wakeRetryAt=0;
const wakeSupported=()=>!!(navigator.wakeLock&&typeof navigator.wakeLock.request==='function');
function paintWake(){
  const cb=$('keepAwake'),msg=$('wakeMsg');if(!cb||!msg)return;
  cb.checked=keepAwake;
  msg.textContent=!wakeSupported()?'Questo browser non supporta la funzione: lo schermo segue le impostazioni del telefono. Su iPhone serve iOS 16.4, oppure iOS 18.4 se l’app è aggiunta alla schermata Home.'
    :!keepAwake?'Disattivato: lo schermo si spegne come da impostazioni del telefono.'
    :wakeLock?'Attivo: lo schermo resta acceso finché l’app è aperta e in primo piano.'
    :wakeFailed?'Il telefono non lo permette in questo momento (forse è attivo il risparmio energetico). Riprovo appena tocchi lo schermo.'
    :'Si attiva appena tocchi lo schermo.';
}
async function wakeAcquire(){
  if(!keepAwake||!wakeSupported()||wakeLock||wakeBusy||document.visibilityState!=='visible'||Date.now()<wakeRetryAt)return;
  wakeBusy=true;
  try{
    const sentinel=await navigator.wakeLock.request('screen');
    if(!keepAwake||document.visibilityState!=='visible'){sentinel.release().catch(()=>{})}
    else{wakeLock=sentinel;wakeFailed=false;sentinel.addEventListener('release',()=>{if(wakeLock===sentinel){wakeLock=null;paintWake()}})}
  }catch(e){wakeLock=null;wakeFailed=true;wakeRetryAt=Date.now()+3000}
  wakeBusy=false;paintWake();
}
function wakeRelease(){const s=wakeLock;wakeLock=null;if(s)s.release().catch(()=>{});paintWake()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wakeAcquire()});
window.addEventListener('pageshow',()=>{wakeAcquire()});
['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(!wakeLock)wakeAcquire()},{passive:true}));
$('keepAwake').addEventListener('change',e=>{keepAwake=e.target.checked;saveJSON(KEY_AWAKE,keepAwake);wakeFailed=false;wakeRetryAt=0;if(keepAwake)wakeAcquire();else wakeRelease();paintWake()});
paintWake();wakeAcquire();

/* ---------- Finestra di dettaglio ---------- */
const dialogHistory=[];
function openDialog(eyebrow,html,{keepCurrent=false,chords=[],bpm=0,beats=4,doneKey=''}={}){
  stopInlineMetronome();
  const dialog=$('lessonDialog');
  if(dialog.open&&keepCurrent)dialogHistory.push({eyebrow:$('dialogEyebrow').textContent,html:$('lessonContent').innerHTML,top:dialog.scrollTop});
  else if(!dialog.open)dialogHistory.length=0;
  $('dialogEyebrow').textContent=eyebrow;
  $('lessonContent').innerHTML=html;
  if(chords.length)$('lessonContent').insertAdjacentHTML('beforeend',`<div class="lesson-chord-links"><h3>Apri gli accordi citati</h3><div class="btn-row">${chords.map(n=>{const c=chordByName(n);return c?`<button type="button" class="btn small secondary" data-open-chord="${esc(c.name)}">${esc(chordLabel(c))}</button>`:''}).join('')}</div></div>`);
  if(bpm)$('lessonContent').insertAdjacentHTML('beforeend',inlineMetronomeMarkup('lesson',bpm,beats));
  if(doneKey)$('lessonContent').insertAdjacentHTML('beforeend',`<button type="button" class="btn full done-toggle" data-done-key="${esc(doneKey)}"></button>`);
  bindInteractiveContent($('lessonContent'));
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
}
function closeDialogLayer(){
  stopInlineMetronome();
  if(dialogHistory.length){const previous=dialogHistory.pop();$('dialogEyebrow').textContent=previous.eyebrow;$('lessonContent').innerHTML=previous.html;bindInteractiveContent($('lessonContent'));$('lessonDialog').scrollTop=previous.top||0;return}
  $('lessonDialog').close();
}
$('closeLesson').addEventListener('click',closeDialogLayer);
$('lessonDialog').addEventListener('close',()=>{stopInlineMetronome();dialogHistory.length=0});
$('lessonDialog').addEventListener('scroll',()=>document.querySelector('.dialog-head').classList.toggle('scrolled',$('lessonDialog').scrollTop>4),{passive:true});
$('lessonDialog').addEventListener('click',e=>{if(e.target===$('lessonDialog'))closeDialogLayer()});

/* ---------- Lezioni ed esercizi ---------- */
const KEY_DONE='guitarStudioDoneV1';
function isDone(k){if(k[0]==='p')return loadJSON(KEY_PATH,[]).includes(Number(k.slice(1)));return loadJSON(KEY_DONE,[]).includes(k)}
function toggleDone(k){const store=k[0]==='p'?KEY_PATH:KEY_DONE,val=k[0]==='p'?Number(k.slice(1)):k;const a=loadJSON(store,[]);const i=a.indexOf(val);if(i>=0)a.splice(i,1);else a.push(val);saveJSON(store,a)}
function refreshDoneMarks(){document.querySelectorAll('[data-done-row]').forEach(r=>r.classList.toggle('is-done',isDone(r.dataset.doneRow)));const t=document.getElementById('doneCount');if(t){const pp=chordPathStages.filter((_,i)=>isDone('p'+i)).length;const ph=document.getElementById('pathProgressText');if(ph)ph.textContent=`${pp} di ${chordPathStages.length} tappe completate`;const pb=document.getElementById('pathProgressBar');if(pb)pb.style.width=`${pp/chordPathStages.length*100}%`;const ls=document.getElementById('lessonCountSub');if(ls)ls.textContent=`Percorso didattico, ${lessons.length} lezioni`;const l=lessons.filter(x=>isDone('l'+x.n)).length,e=exerciseData.filter(x=>isDone('e'+x.n)).length;t.textContent=`${l}/${lessons.length} lezioni · ${e}/${exerciseData.length} esercizi`}}
function rowButton(num,title,sub,key){const b=document.createElement('button');b.className='row';if(key)b.dataset.doneRow=key;b.innerHTML=`<span class="row-ico">${num}</span><span class="row-body"><b>${title}</b><small>${sub}</small></span>${ico('next','chev')}`;return b}
lessons.forEach(l=>{const b=rowButton(l.n,l.title,`${l.sub} · ${l.time}`,'l'+l.n);b.addEventListener('click',()=>openDialog('Lezione',`<h2>${l.n} · ${l.title}</h2><p class="muted">${l.sub} · ${l.time}</p>${l.body}`,{chords:lessonChordRefs[l.n]||[],bpm:l.bpm!==undefined?l.bpm:(l.body.toLowerCase().includes('metronomo')?60:0),beats:l.beats||4,doneKey:'l'+l.n}));$('lessonList').appendChild(b)});
function exerciseChordStrip(names){
  const list=names.map(chordByName).filter(Boolean);if(!list.length)return '';
  return `<div class="ex-chords"><h3>Accordi usati</h3><div class="ex-chord-grid">${list.map(c=>`<button type="button" class="ex-chord" data-open-chord="${esc(c.name)}" aria-label="Apri la scheda di ${esc(chordLabel(c))}"><b>${esc(chordLabel(c))}</b>${chordSVG(c)}</button>`).join('')}</div><p class="small-text muted">Tocca un diagramma per ascoltare l'accordo e vederne le note.</p></div>`;
}
function exerciseGrid(ex){
  if(!ex.grid)return '';
  const cell=n=>n.split(' · ').map(x=>{const c=chordByName(x);return c?`<span title="${esc(chordLabel(c))}">${esc(c.intl||intlName(c))}</span>`:esc(x)}).join(' · ');
  let bar=0;
  return `<div class="ex-grid-wrap"><h3>Schema del giro</h3><div class="ex-grid">${ex.grid.map(row=>`<div class="ex-grid-row">${row.map(n=>`<div class="ex-bar"><small>${++bar}</small>${cell(n)}</div>`).join('')}</div>`).join('')}</div>${ex.gridNote?`<p class="small-text muted">${esc(ex.gridNote)}</p>`:''}</div>`;
}
// Ritmica illustrata: una casella per suddivisione, raggruppate per battito.
// Simboli: D/U pennata giù/su, d/u movimento a vuoto, - pausa, . la nota continua, B basso, P/i/m/a dita; ">" = accento.
const RH_SYM={D:['↓','Pennata in giù'],U:['↑','Pennata in su'],d:['↓','Movimento a vuoto (non tocca le corde)'],u:['↑','Movimento a vuoto (non tocca le corde)'],'-':['<svg class="rest-ico" viewBox="0 0 12 26" aria-hidden="true"><path d="M4 1l6 7.5-3.6 4.2L10.5 18c-3.4-1.6-5.6-.4-3.3 6.5C2.5 21 2.8 16.4 6.6 17L1.8 11 5.6 7z" fill="currentColor"/></svg>','Pausa'],'.':['–','La nota continua a suonare'],B:['●','Nota di basso'],P:['P','Pollice'],i:['i','Indice'],m:['m','Medio'],a:['a','Anulare']};
function rhythmCounts(beats,sub){const out=[];for(let b=1;b<=beats;b++){if(sub===1)out.push(String(b));else if(sub===2)out.push(String(b),'e');else out.push(String(b),'·','e')}return out}
function rhythmBlock(r){
  const tokens=r.cells.trim().split(/\s+/),counts=rhythmCounts(r.beats,r.sub),used=new Set();let accent=false;
  let html=`<div class="rhythm${r.over?' has-over':''}${tokens.some(t=>t.endsWith('>'))?' has-acc':''}" data-beats="${r.beats}">${r.title?`<p class="tab-title">${esc(r.title)}</p>`:''}<div class="rh-bar">`;
  for(let b=0;b<r.beats;b++){
    html+=`<div class="rh-beat" data-beat="${b}">`;
    for(let k=0;k<r.sub;k++){
      const idx=b*r.sub+k,tok=tokens[idx]||'.',acc=tok.endsWith('>'),key=acc?tok.slice(0,-1):tok,sym=RH_SYM[key]||[key,''];
      if(acc)accent=true;if(sym[1])used.add(key==='u'?'d':key);
      const cls=key==='d'||key==='u'?'ghost':key==='-'?'rest':key==='.'?'hold':/[PimaB]/.test(key)?'finger':'';
      const over=r.over&&r.over[idx]?chordByName(r.over[idx]):null;
      html+=`<div class="rh-cell ${cls}${acc?' accent':''}${k===0?' on-beat':''}"><span class="rh-over">${over?esc(over.intl||intlName(over)):''}</span><span class="rh-acc">${acc?'&gt;':''}</span><span class="rh-sym">${sym[0]}</span><span class="rh-count">${counts[idx]}</span></div>`;
    }
    html+='</div>';
  }
  html+='</div>';
  const leg=Object.keys(RH_SYM).filter(k=>used.has(k)&&(k!=='.'||r.sub>1)).map(k=>`<span><b class="${k==='d'?'ghost':k==='.'?'hold':''}">${RH_SYM[k][0]}</b> ${RH_SYM[k][1]}</span>`);
  if(accent)leg.push('<span><b>&gt;</b> Accento: più forte</span>');
  if(r.swing)leg.push('<span>Swing: ogni battito è diviso in tre; la prima nota ne occupa due, la seconda una</span>');
  return html+(leg.length?`<p class="rh-legend">${leg.join('')}</p>`:'')+'</div>';
}
function exerciseRhythm(ex){
  if(!ex.rhythm)return '';
  return `<div class="rhythm-wrap"><h3>Ritmica</h3>${ex.rhythm.map(rhythmBlock).join('')}<p class="small-text muted">Con il metronomo qui sotto avviato, il battito in corso si illumina.</p></div>`;
}
function exerciseTabs(ex){
  const tabs=ex.tabs||(ex.tab?[{title:'',lines:ex.tab}]:[]);
  return tabs.map(t=>`${t.title?`<p class="tab-title">${esc(t.title)}</p>`:''}<pre class="tab-block" aria-label="Tablatura">${esc(t.lines.join('\n'))}</pre>`).join('');
}
exerciseData.forEach(ex=>{const b=rowButton(ex.n,ex.title,ex.level,'e'+ex.n);b.addEventListener('click',()=>openDialog('Esercizio',`<h2>${ex.n} · ${ex.title}</h2><p class="muted">${ex.level}</p><p>${ex.body}</p>${exerciseChordStrip(ex.chords||[])}${exerciseGrid(ex)}<div class="exercise"><b>Sequenza da provare</b><p class="exercise-pattern">${ex.pattern}</p>${exerciseTabs(ex)}<h3>Procedura</h3><ol><li>Prepara la posizione e suona lentamente una volta per prendere confidenza.</li><li>Ripeti la sequenza per quattro cicli, controllando che ogni movimento sia preciso.</li><li>Fai una breve pausa, poi riparti e confronta la regolarità del suono.</li><li>Concludi con un ciclo lento e pulito, senza accelerare per finire prima.</li></ol><p><b>Obiettivo:</b> completare tre cicli consecutivi senza fermarti e senza tensione.</p></div>${exerciseRhythm(ex)}`,{bpm:ex.bpm||0,beats:ex.beats||4,doneKey:'e'+ex.n}));$('exerciseList').appendChild(b)});

/* ---------- Accordi ---------- */
const NOTE_INT=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const NOTE_IT=['DO','DO♯','RE','RE♯','MI','FA','FA♯','SOL','SOL♯','LA','LA♯','SI'];
const OPEN=[40,45,50,55,59,64]; // accordatura standard E A D G B e
const chordByName=n=>chordData.find(c=>c.name.toLowerCase()===String(n).trim().toLowerCase());
const intlName=c=>c.intl||c.name.replace(/#/g,'♯').replace(/^([A-G])b/,'$1♭');
const chordLabel=c=>`${c.desc.replace(/\s+·\s+barrè$/,'')} (${intlName(c)})`;
const chordExtra=c=>c.type==='Power'?'Power chord':c.desc.includes('barrè')?'Barrè':c.type==='Settima'?'Accordo di settima':c.type==='Altri'?'Variante':c.type==='Minori'?'Accordo minore':'Accordo maggiore';
const chordLabelByName=n=>{const c=chordByName(n);return c?chordLabel(c):String(n)};
function chordNotes(ch){
  return ch.frets.map((f,i)=>f<0?null:OPEN[i]+f).filter(n=>n!==null).map(midi=>({midi,intl:NOTE_INT[midi%12],italian:NOTE_IT[midi%12],octave:Math.floor(midi/12)-1}));
}
function chordSVG(ch){
  const x0=24,xg=28,y0=35,yg=25,w=190,h=150,base=ch.base||1;
  let s=`<svg class="chord-diagram" viewBox="0 0 ${w} ${h}" role="img" aria-label="Diagramma: ${esc(chordLabel(ch))}">`;
  for(let i=0;i<6;i++){const x=x0+i*xg;s+=`<line class="cd-string" x1="${x}" y1="${y0}" x2="${x}" y2="${y0+4*yg}" style="stroke-width:${i===0?2.6:1.4}"/>`;
    const f=ch.frets[i];if(f<=0)s+=`<text class="chord-open" x="${x}" y="22" text-anchor="middle">${f<0?'×':'○'}</text>`}
  if(base>1)s+=`<text class="chord-fret-label" x="5" y="${y0+14}">${base}°</text>`;
  for(let j=0;j<=4;j++){const y=y0+j*yg;s+=`<line class="${j===0?'cd-nut':'cd-line'}" x1="${x0}" y1="${y}" x2="${x0+5*xg}" y2="${y}"/>`}
  ch.frets.forEach((f,i)=>{if(f>0){const x=x0+i*xg,y=y0+(f-base+.5)*yg;s+=`<circle class="cd-dot" cx="${x}" cy="${y}" r="9"/><text class="cd-num" x="${x}" y="${y+4}" text-anchor="middle">${ch.fingers[i]||''}</text>`}});
  return s+'</svg>';
}
// Ordine: per famiglia (come i filtri), poi per fondamentale lungo la scala DO, RE, MI, FA, SOL, LA, SI
// (le alterazioni stanno tra le note vicine: FA♯ dopo FA, SI♭ prima di SI); a parità di nota resta l'ordine dei dati.
const CHORD_FAMILIES=['Maggiori','Minori','Settima','Altri','Power'];
const chordRootPc=c=>{const m=/^([A-G])([#b]?)/.exec(c.name);return {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)};
const chordsOrdered=chordData.map((c,i)=>[c,i]).sort((a,b)=>CHORD_FAMILIES.indexOf(a[0].type)-CHORD_FAMILIES.indexOf(b[0].type)||chordRootPc(a[0])-chordRootPc(b[0])||a[1]-b[1]).map(x=>x[0]);
// Filtro «Tutti»: ordine per nota (DO, DO♯, RE…), e per ogni nota maggiore, minore, settime, varianti, power chord.
const chordsByNote=chordData.map((c,i)=>[c,i]).sort((a,b)=>((chordRootPc(a[0])+12)%12)-((chordRootPc(b[0])+12)%12)||CHORD_FAMILIES.indexOf(a[0].type)-CHORD_FAMILIES.indexOf(b[0].type)||a[1]-b[1]).map(x=>x[0]);
function renderChords(filter='tutti'){
  const host=$('chordGrid');host.innerHTML='';
  (filter==='tutti'?chordsByNote:chordsOrdered.filter(c=>c.type===filter)).forEach(ch=>{
    const card=document.createElement('button');card.className='chord-card';
    card.innerHTML=`<div class="chord-card-head"><div><h3>${esc(chordLabel(ch))}</h3><small>${esc(chordExtra(ch))}</small></div></div>${chordSVG(ch)}<div class="chord-strings"><span>6ª</span><span>5ª</span><span>4ª</span><span>3ª</span><span>2ª</span><span>1ª</span></div>`;
    card.addEventListener('click',()=>openChordDetail(ch));host.appendChild(card);
  });
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderChords(b.dataset.filter)}));
renderChords();
async function playChord(ch,arpeggio=false){
  const ctx=await getCtx();if(!ctx){alert('Audio non disponibile su questo dispositivo.');return}
  const now=ctx.currentTime+.03;
  chordNotes(ch).forEach((n,i)=>pluckTone(ctx,n.midi,now+(arpeggio?i*.115:i*.012),2.0,.105,(i-2.5)*.11));
}
function openChordDetail(ch,keepCurrent=false){
  const notes=chordNotes(ch);
  openDialog('Scheda accordo',`<h2>${esc(chordLabel(ch))}</h2>
   <div class="chord-detail-diagram">${chordSVG(ch)}</div>
   <h3>Note dell'accordo</h3>
   <div class="chord-note-list">${notes.map(n=>`<span class="chord-note"><b>${n.italian} (${n.intl})</b><small>ottava ${n.octave}</small></span>`).join('')}</div>
   <p>Dalla corda più grave alla più acuta: <b>${notes.map(n=>`${n.italian} (${n.intl})`).join(' · ')}</b>. Le note possono ripetersi su ottave diverse.</p>
   <div class="chord-audio-actions"><button class="btn" id="playChord">${ico('play')}<span>Ascolta accordo</span></button><button class="btn secondary" id="playArpeggio"><span>Ascolta arpeggio</span></button></div>
   <p class="small-text muted">Suono sintetizzato per riconoscere l'armonia: non è una registrazione di chitarra reale.</p>`,{keepCurrent});
  $('playChord').addEventListener('click',()=>playChord(ch,false));
  $('playArpeggio').addEventListener('click',()=>playChord(ch,true));
}

function inlineMetronomeMarkup(id,bpm=60,beats=4){
  const value=Math.max(40,Math.min(220,Number(bpm)||60));
  return `<div class="inline-metronome" data-inline-metro="${esc(id)}" data-bpm="${value}" data-beats="${beats}"><div class="inline-metro-head"><b>Prova con il metronomo</b><span class="inline-bpm"><button type="button" class="round-btn" data-inline-step="-5" aria-label="Diminuisci il tempo">−</button><output>${value} BPM</output><button type="button" class="round-btn" data-inline-step="5" aria-label="Aumenta il tempo">+</button></span></div><div class="inline-beats" aria-hidden="true">${Array.from({length:beats},(_,i)=>i).map((_,i)=>`<i class="${i===0?'accent':''}"></i>`).join('')}</div><button type="button" class="btn small full" data-inline-toggle>${ico('play')}<span>Avvia</span></button><p class="small-text muted" data-inline-status aria-live="polite">Regola il tempo e avvia quando sei pronto.</p></div>`;
}
function bindInteractiveContent(root){
  root.querySelectorAll('[data-open-chord]').forEach(button=>button.addEventListener('click',()=>{const chord=chordByName(button.dataset.openChord);if(chord)openChordDetail(chord,true)}));
  root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{$('lessonDialog').close();dialogHistory.length=0;go(b.dataset.go)}));
  root.querySelectorAll('[data-done-key]').forEach(b=>{const k=b.dataset.doneKey;const paint=()=>{const d=isDone(k);b.classList.toggle('secondary',d);b.innerHTML=d?`${ico('check')}<span>Completata · tocca per annullare</span>`:'<span>Segna come completata</span>'};paint();b.addEventListener('click',()=>{toggleDone(k);paint();refreshDoneMarks()})});
  root.querySelectorAll('.inline-metronome').forEach(box=>{
    box.querySelectorAll('[data-inline-step]').forEach(button=>button.addEventListener('click',()=>{
      const bpm=Math.max(40,Math.min(220,(Number(box.dataset.bpm)||60)+Number(button.dataset.inlineStep)));
      box.dataset.bpm=bpm;box.querySelector('output').textContent=`${bpm} BPM`;
    }));
    box.querySelector('[data-inline-toggle]').addEventListener('click',()=>toggleInlineMetronome(box));
  });
}
const inlineMetro={running:false,box:null,ctx:null,timer:null,raf:null,next:0,index:0,queue:[]};
async function toggleInlineMetronome(box){
  if(inlineMetro.running){stopInlineMetronome();return}
  const ctx=await getCtx();if(!ctx){box.querySelector('[data-inline-status]').textContent='Audio non disponibile in questo browser.';return}
  inlineMetro.running=true;inlineMetro.box=box;inlineMetro.ctx=ctx;inlineMetro.index=0;inlineMetro.queue=[];inlineMetro.next=ctx.currentTime+.05;
  box.querySelector('[data-inline-toggle]').innerHTML=`${ico('pause')}<span>Ferma</span>`;box.querySelector('[data-inline-status]').textContent='Metronomo attivo';
  const tick=()=>{if(!inlineMetro.running)return;while(inlineMetro.next<ctx.currentTime+.12){clickSound(ctx,inlineMetro.next,inlineMetro.index%(Number(box.dataset.beats)||4)===0?2:0);inlineMetro.queue.push({t:inlineMetro.next,i:inlineMetro.index%(Number(box.dataset.beats)||4)});inlineMetro.next+=60/(Number(box.dataset.bpm)||60);inlineMetro.index++}inlineMetro.timer=setTimeout(tick,25)};
  const frame=()=>{if(!inlineMetro.running)return;let last=null;while(inlineMetro.queue.length&&inlineMetro.queue[0].t<=ctx.currentTime)last=inlineMetro.queue.shift();if(last&&inlineMetro.box===box){box.querySelectorAll('.inline-beats i').forEach((el,i)=>el.classList.toggle('on',i===last.i));$('lessonContent').querySelectorAll(`.rhythm[data-beats="${Number(box.dataset.beats)||4}"] .rh-beat`).forEach(el=>el.classList.toggle('now',Number(el.dataset.beat)===last.i))}inlineMetro.raf=requestAnimationFrame(frame)};
  tick();frame();
}
function stopInlineMetronome(){if(!inlineMetro?.running)return;inlineMetro.running=false;clearTimeout(inlineMetro.timer);cancelAnimationFrame(inlineMetro.raf);document.querySelectorAll('.rh-beat.now').forEach(x=>x.classList.remove('now'));if(inlineMetro.box){inlineMetro.box.querySelectorAll('.inline-beats i').forEach(x=>x.classList.remove('on'));inlineMetro.box.querySelector('[data-inline-toggle]').innerHTML=`${ico('play')}<span>Avvia</span>`;inlineMetro.box.querySelector('[data-inline-status]').textContent='Metronomo fermato.'}inlineMetro.box=null;inlineMetro.queue=[]}

/* ---------- Percorso accordi ---------- */
function renderChordPath(){
  stopInlineMetronome();
  const done=loadJSON(KEY_PATH,[]);
  $('pathProgressText').textContent=`${done.length} di ${chordPathStages.length} tappe completate`;
  $('pathProgressBar').style.width=`${done.length/chordPathStages.length*100}%`;
  const host=$('chordPath');host.innerHTML='';
  chordPathStages.forEach((st,i)=>{
    const button=rowButton(String(i+1).padStart(2,'0'),esc(st.title),esc(st.goal),'p'+i);
    button.classList.add('path-row');
    button.addEventListener('click',()=>{
      const pairs=st.pairs.map(p=>`<span class="path-pair">${esc(chordLabelByName(p[0]))} <b>↔</b> ${esc(chordLabelByName(p[1]))}</span>`).join('');
      const practice=st.practice?`<h3>Pratica guidata</h3><ol class="path-practice">${st.practice.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:'';
      openDialog('Percorso accordi',`<h2>Tappa ${i+1} · ${esc(st.title)}</h2><p class="muted">${esc(st.level)} · ${esc(st.time)}</p><p>${esc(st.goal)}</p><div class="path-pairs"><span class="path-label">Cambi da allenare</span><div>${pairs}</div></div><div class="path-drill"><b>Obiettivo della sessione</b><p>${esc(st.drill)}</p></div>${practice}`,{chords:st.chords,bpm:st.bpm||0,doneKey:'p'+i});
    });
    const card=button;
    host.appendChild(card);
  });
}
renderChordPath();refreshDoneMarks();

/* ---------- Diario ---------- */
let sessions=loadJSON(KEY_SESSIONS,[]);if(!Array.isArray(sessions))sessions=[];
let weeklyGoal=Number(loadJSON(KEY_GOAL,60))||60;
$('sessionDate').value=isoLocal();
function saveSessions(){saveJSON(KEY_SESSIONS,sessions);renderDiary()}
$('sessionForm').addEventListener('submit',e=>{
  e.preventDefault();
  sessions.unshift({id:Date.now(),date:$('sessionDate').value,duration:Number($('sessionDuration').value),activity:$('sessionActivity').value,notes:$('sessionNotes').value.trim()});
  sessions.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  $('sessionNotes').value='';saveSessions();
});
function mondayISO(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return isoLocal(d)}
function streakDays(){
  const days=new Set(sessions.map(s=>s.date));const d=new Date();d.setHours(12,0,0,0);
  if(!days.has(isoLocal(d)))d.setDate(d.getDate()-1); // oggi non ancora registrato: la serie resta viva fino a ieri
  let n=0;while(days.has(isoLocal(d))){n++;d.setDate(d.getDate()-1)}return n;
}
function renderDiary(){
  const total=sessions.reduce((a,s)=>a+s.duration,0),mon=mondayISO();
  const week=sessions.filter(s=>s.date>=mon).reduce((a,s)=>a+s.duration,0);
  $('totalMinutes').textContent=total;$('sessionCount').textContent=sessions.length;$('weekMinutes').textContent=week;$('streakDays').textContent=streakDays();
  $('goalDone').textContent=week;$('goalTarget').textContent=weeklyGoal;$('goalInput').value=weeklyGoal;
  $('goalBar').style.width=Math.min(100,week/weeklyGoal*100)+'%';
  const host=$('diaryEntries');host.innerHTML='';
  if(!sessions.length){host.innerHTML='<div class="empty-state">Ancora nessuna sessione registrata.<br>La tua prima pratica può iniziare oggi.</div>';return}
  sessions.forEach(s=>{
    const row=document.createElement('div');row.className='diary-entry';
    const dt=new Date(s.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
    row.innerHTML=`<div><b>${esc(s.activity)}</b><small>${esc(dt)}${s.notes?' · '+esc(s.notes):''}</small></div><div class="entry-right"><strong>${s.duration} min</strong><button class="delete-entry" aria-label="Elimina sessione">${ico('close')}</button></div>`;
    row.querySelector('button').addEventListener('click',()=>{if(confirm('Eliminare questa sessione?')){sessions=sessions.filter(x=>x.id!==s.id);saveSessions()}});
    host.appendChild(row);
  });
}
$('goalInput').addEventListener('change',()=>{const v=Math.max(10,Math.min(2000,Number($('goalInput').value)||60));weeklyGoal=v;saveJSON(KEY_GOAL,v);renderDiary()});
renderDiary();
$('exportDiary').addEventListener('click',()=>{
  const csvCell=v=>{let t=String(v??'');if(/^[=+\-@]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
  const rows=[['Data','Durata minuti','Attività','Note'],...sessions.map(s=>[s.date,s.duration,s.activity,s.notes])];
  download('diario-guitar-studio.csv','﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8;');
});
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

/* ---------- Backup completo ---------- */
$('backupExport').addEventListener('click',()=>{
  const data={app:'guitar-studio',version:APP_VERSION,date:new Date().toISOString(),sessions,pathDone:loadJSON(KEY_PATH,[]),done:loadJSON(KEY_DONE,[]),weeklyGoal,game:loadJSON('guitarStudioGameV1',null)};
  download(`guitar-studio-backup-${isoLocal()}.json`,JSON.stringify(data,null,1),'application/json');
  $('backupMsg').textContent='Backup salvato nei download del dispositivo.';
});
$('backupImport').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{
    const d=JSON.parse(await f.text());
    if(d.app!=='guitar-studio'||!Array.isArray(d.sessions))throw new Error('formato');
    if(!confirm(`Ripristinare il backup? Verranno sostituiti i dati attuali (${sessions.length} sessioni) con quelli del file (${d.sessions.length} sessioni).`))return;
    sessions=d.sessions.filter(s=>s&&/^\d{4}-\d{2}-\d{2}$/.test(String(s.date))&&!isNaN(new Date(s.date+'T12:00:00'))&&Number.isFinite(Number(s.duration))).map(s=>({id:s.id||Date.now()+Math.random(),date:String(s.date),duration:Number(s.duration),activity:String(s.activity||'Studio libero'),notes:String(s.notes||'')}));
    saveJSON(KEY_SESSIONS,sessions);saveJSON(KEY_PATH,Array.isArray(d.pathDone)?d.pathDone:[]);
    if(Array.isArray(d.done))saveJSON(KEY_DONE,d.done.map(String));
    if(d.weeklyGoal){weeklyGoal=Number(d.weeklyGoal)||60;saveJSON(KEY_GOAL,weeklyGoal)}
    if(d.game&&typeof d.game==='object'&&!Array.isArray(d.game)){saveJSON('guitarStudioGameV1',d.game);if(window.GSGame)GSGame.test.G=Object.assign({xp:0,best:{},weak:{},missions:{},minutes:{},logged:{},plays:0},d.game)}
    renderDiary();renderChordPath();refreshDoneMarks();$('backupMsg').textContent='Backup ripristinato.';
  }catch(err){$('backupMsg').textContent='File non valido: scegli un backup creato da Guitar Studio.'}
});

/* ---------- Metronomo (programmato sull'orologio di Web Audio) ---------- */
const metro={running:false,timer:null,raf:null,next:0,i:0,queue:[],n:4};
const bpm=()=>Number($('bpmRange').value);
function setBpm(v){$('bpmRange').value=Math.max(40,Math.min(220,v));$('bpmValue').textContent=$('bpmRange').value}
$('bpmRange').addEventListener('input',()=>setBpm(bpm()));
$('bpmDown').addEventListener('click',()=>setBpm(bpm()-1));
$('bpmUp').addEventListener('click',()=>setBpm(bpm()+1));
document.querySelectorAll('[data-bpm]').forEach(b=>b.addEventListener('click',()=>setBpm(Number(b.dataset.bpm))));
function metroCfg(){const v=$('beats').value;return v==='6'?{n:6,div:3,level:i=>i===0?2:i===3?1:0}:{n:Number(v),div:1,level:i=>i===0?2:0}}
function renderLights(){const c=metroCfg();$('beatLights').innerHTML=Array.from({length:c.n},(_,i)=>`<i class="${c.level(i)===2?'accent':''}"></i>`).join('')}
$('beats').addEventListener('change',()=>{renderLights();metro.i=0});
renderLights();
// Suoni del metronomo (3.1). Ogni suono è calcolato una volta sola e normalizzato: picco del campione a −0,4 dBFS
// (accento) e −0,9 dBFS (battiti normali), quindi alla massima intensità senza distorsione digitale.
// Il volume scelto dall'utente riduce soltanto (100% = massimo pulito). Vale anche per lezioni, esercizi e Sfide.
const KEY_METRO='guitarStudioMetroSoundV1';
const CLICK_PEAK=[.90,.92,.955];
function resonator(x,sr,f,q){const bw=f/q,r=Math.exp(-Math.PI*bw/sr),c=2*r*Math.cos(2*Math.PI*f/sr),r2=r*r;let y1=0,y2=0;return x.map(v=>{const y=(1-r)*v+c*y1-r2*y2;y2=y1;y1=y;return y})}
const CLICK_SOUNDS={
  legno:{label:'Legno',len:.07,make(sr,len,lv,rnd){const f=[2000,2350,2900][lv],d=new Float32Array(len);
    for(let i=0;i<len;i++){const t=i/sr;d[i]=Math.exp(-t/.014)*(Math.sin(2*Math.PI*f*t)+.5*Math.sin(2*Math.PI*f*1.51*t))+.45*Math.exp(-t/.022)*Math.sin(2*Math.PI*f*.5*t)+.5*Math.exp(-t/.0009)*rnd()}return d}},
  bip:{label:'Bip',len:.06,make(sr,len,lv){const f=[1400,1650,2100][lv],d=new Float32Array(len);
    for(let i=0;i<len;i++){const t=i/sr,env=t<.025?1:Math.exp(-(t-.025)/.008);d[i]=env*(Math.sin(2*Math.PI*f*t)+Math.sin(2*Math.PI*3*f*t)/3+Math.sin(2*Math.PI*5*f*t)/5)}return d}},
  campanaccio:{label:'Campanaccio',len:.085,make(sr,len,lv){const k=[1,1.06,1.22][lv],f1=560*k,f2=835*k,d=new Float32Array(len);
    const sq=(f,t)=>Math.sin(2*Math.PI*f*t)+Math.sin(2*Math.PI*3*f*t)/3+Math.sin(2*Math.PI*5*f*t)/5;
    for(let i=0;i<len;i++){const t=i/sr;d[i]=(Math.exp(-t/.006)*.6+Math.exp(-t/.032))*(sq(f1,t)+.8*sq(f2,t))}return d}},
  bacchette:{label:'Bacchette',len:.045,make(sr,len,lv,rnd){const f=[2500,2900,3500][lv],n=new Float32Array(len);
    for(let i=0;i<len;i++)n[i]=rnd()*Math.exp(-i/sr/.004);
    const a=resonator(n,sr,f,14),b=resonator(n,sr,f*1.47,10),d=new Float32Array(len);
    for(let i=0;i<len;i++)d[i]=a[i]+.7*b[i]+.25*n[i];return d}}
};
let metroPrefs=Object.assign({sound:'legno',volume:100},loadJSON(KEY_METRO,{}));
if(!CLICK_SOUNDS[metroPrefs.sound])metroPrefs.sound='legno';
metroPrefs.volume=Math.max(0,Math.min(100,Number(metroPrefs.volume)));if(!Number.isFinite(metroPrefs.volume))metroPrefs.volume=100;
const clickCache=new WeakMap();
function clickBuffers(ctx,sound=metroPrefs.sound){
  let byCtx=clickCache.get(ctx);if(!byCtx){byCtx={};clickCache.set(ctx,byCtx)}
  if(byCtx[sound])return byCtx[sound];
  const spec=CLICK_SOUNDS[sound],sr=ctx.sampleRate,len=Math.floor(sr*spec.len);
  byCtx[sound]=CLICK_PEAK.map((peak,lv)=>{
    let seed=9871+lv;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/1073741823.5-1};
    const raw=spec.make(sr,len,lv,rnd),buf=ctx.createBuffer(1,len,sr),d=buf.getChannelData(0);let max=0;
    for(let i=0;i<len;i++){let v=raw[i]*Math.min(1,i/(sr*.0004));if(i>len-sr*.004)v*=(len-i)/(sr*.004);d[i]=v;if(Math.abs(v)>max)max=Math.abs(v)}
    for(let i=0;i<len;i++)d[i]*=peak/max;
    return buf;
  });
  return byCtx[sound];
}
const volumeGain=()=>Math.pow(metroPrefs.volume/100,2); // curva quadratica: il cursore segue meglio la sensazione di volume
function clickSound(ctx,time,level,sound){
  const g=volumeGain();if(g<=0)return;
  const src=ctx.createBufferSource(),bufs=clickBuffers(ctx,sound||metroPrefs.sound);src.buffer=bufs[level]||bufs[0];
  if(g>=1)src.connect(ctx.destination);else{const v=ctx.createGain();v.gain.value=g;src.connect(v);v.connect(ctx.destination)}
  src.start(time);
}
function paintMetroPrefs(){
  document.querySelectorAll('[data-sound]').forEach(b=>{const on=b.dataset.sound===metroPrefs.sound;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
  $('metroVol').value=metroPrefs.volume;$('metroVolOut').textContent=metroPrefs.volume+'%';
}
async function previewClick(){if(metro.running||inlineMetro.running)return;const ctx=await getCtx();if(!ctx)return;const t=ctx.currentTime+.03;clickSound(ctx,t,2);clickSound(ctx,t+.35,0)}
document.querySelectorAll('[data-sound]').forEach(b=>b.addEventListener('click',()=>{metroPrefs.sound=b.dataset.sound;saveJSON(KEY_METRO,metroPrefs);paintMetroPrefs();previewClick()}));
$('metroVol').addEventListener('input',e=>{metroPrefs.volume=Number(e.target.value);$('metroVolOut').textContent=metroPrefs.volume+'%'});
$('metroVol').addEventListener('change',()=>{saveJSON(KEY_METRO,metroPrefs);previewClick()});
paintMetroPrefs();
function metroTick(){
  const ctx=metro.ctx,c=metroCfg();
  while(metro.next<ctx.currentTime+.12){
    const idx=metro.i%c.n,lv=c.level(idx);
    clickSound(ctx,metro.next,lv);metro.queue.push({t:metro.next,idx});
    metro.next+=60/bpm()/c.div;metro.i++;
  }
}
function metroFrame(){
  if(!metro.running)return;
  let last=null;while(metro.queue.length&&metro.queue[0].t<=metro.ctx.currentTime)last=metro.queue.shift();
  if(last)document.querySelectorAll('#beatLights i').forEach((el,i)=>el.classList.toggle('on',i===last.idx));
  metro.raf=requestAnimationFrame(metroFrame);
}
async function startMetro(){
  const ctx=await getCtx();if(!ctx){alert('Audio non disponibile su questo dispositivo.');return}
  metro.ctx=ctx;metro.running=true;metro.i=0;metro.queue=[];metro.next=ctx.currentTime+.06;
  metro.timer=setInterval(metroTick,25);metroTick();metroFrame();
  $('metroToggle').innerHTML=`${ico('pause')}<span>Ferma</span>`;
}
function stopMetro(){
  if(!metro.running)return;metro.running=false;clearInterval(metro.timer);cancelAnimationFrame(metro.raf);metro.queue=[];
  $('metroToggle').innerHTML=`${ico('play')}<span>Avvia</span>`;document.querySelectorAll('#beatLights i').forEach(x=>x.classList.remove('on'));
}
$('metroToggle').addEventListener('click',()=>metro.running?stopMetro():startMetro());

/* ---------- Accordatore (ispirato a GuitarTuna) ----------
   Analisi: GSEngine.tunerPitch (NSDF + controllo delle armoniche, vedi engine.js).
   Modalità automatica: riconosce la corda più vicina alla nota suonata, con isteresi.
   Modalità manuale: tocchi una meccanica e l'accordatore misura solo rispetto a quella corda.
   Una corda tenuta entro ±5 cent per mezzo secondo viene segnata come accordata (meccanica verde). */
const guitarStrings=[
  {n:'E2',f:82.4069,it:'MI',intl:'E',label:'6ª corda · MI grave'},{n:'A2',f:110,it:'LA',intl:'A',label:'5ª corda · LA'},
  {n:'D3',f:146.832,it:'RE',intl:'D',label:'4ª corda · RE'},{n:'G3',f:195.998,it:'SOL',intl:'G',label:'3ª corda · SOL'},
  {n:'B3',f:246.942,it:'SI',intl:'B',label:'2ª corda · SI'},{n:'E4',f:329.628,it:'MI',intl:'E',label:'1ª corda · MI cantino'}];
const TUNE_OK=5,TUNE_HOLD=500,HOLD_MS=1600;
const tuner={running:false,starting:false,token:0,stream:null,ctx:null,raf:null,frame:0,
  manual:-1,locked:-1,lockedAt:0,recent:[],shown:null,lastHit:0,noise:0,okSince:0,tuned:new Set(),pending:null,pendingN:0};
(function buildPins(){
  const ns='http://www.w3.org/2000/svg',host=$('tunerPins');
  const visualOrder=[2,3,1,4,0,5];
  for(let pos=0;pos<visualOrder.length;pos++){
    const i=visualOrder[pos],side=pos%2===0?-1:1,y=42+Math.floor(pos/2)*43,x=170+side*57;
    const g=document.createElementNS(ns,'g');g.setAttribute('class','tuner-pin');
    g.dataset.stringIndex=i;g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',`Accorda la ${guitarStrings[i].label} (${guitarStrings[i].intl})`);
    const mk=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text)e.textContent=text;return e};
    g.append(mk('line',{x1:170+side*32,y1:y,x2:x,y2:y}),mk('circle',{cx:x,cy:y,r:15}),mk('text',{x,y:y+3,'text-anchor':'middle','font-size':'7'},`${guitarStrings[i].it} (${guitarStrings[i].intl})`),
      mk('text',{class:'check',x:x+side*24,y:y+4,'text-anchor':'middle'},'✓'),mk('rect',{class:'hit',x:x-24,y:y-21,width:48,height:42}));
    const pick=()=>selectTunerString(i);
    g.addEventListener('click',pick);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}});
    host.appendChild(g);
  }
})();
function paintPins(active){
  document.querySelectorAll('.tuner-pin').forEach(p=>{const i=Number(p.dataset.stringIndex);
    p.classList.toggle('selected',i===active);p.classList.toggle('locked',i===tuner.manual);p.classList.toggle('tuned',tuner.tuned.has(i));
    p.setAttribute('aria-pressed',String(i===tuner.manual))});
  const n=tuner.tuned.size;
  $('headstockCaption').textContent=n===6?'Tutte le corde sono accordate ✓':n?`Corde accordate: ${n} su 6`:'Le corde accordate diventano verdi';
}
function paintMode(){
  const auto=tuner.manual<0;$('tunerAuto').classList.toggle('active',auto);$('tunerAuto').setAttribute('aria-pressed',String(auto));
  $('tunerModeHint').textContent=auto?'Riconosce da solo la corda che suoni':`Solo ${guitarStrings[tuner.manual].label} · tocca Automatico per tornare`;
}
function selectTunerString(i){
  tuner.manual=tuner.manual===i?-1:i;tuner.locked=tuner.manual;tuner.shown=null;tuner.recent=[];tuner.okSince=0;
  paintMode();
  if(tuner.manual>=0)showTarget(tuner.manual);else if(!tuner.running||performance.now()-tuner.lastHit>HOLD_MS)tunerIdle();
  paintPins(tuner.manual);
  if(!tuner.running&&!tuner.starting)startTuner();
}
$('tunerAuto').addEventListener('click',()=>{if(tuner.manual>=0)selectTunerString(tuner.manual)});
function showTarget(i){const s=guitarStrings[i];$('noteName').innerHTML=`${s.it}<small>(${s.intl})</small>`;$('stringName').textContent=`${s.label} · ${s.f.toFixed(1)} Hz`}
function setNeedle(cents){const a=Math.max(-60,Math.min(60,cents*1.2));$('needle').setAttribute('transform',`rotate(${a.toFixed(2)} 150 150)`)}
function setStatus(text,cls){const el=$('tunerStatus');el.textContent=text;el.className='tuner-status'+(cls?' '+cls:'')}
function tunerIdle(){
  const panel=$('tunerPanel');panel.classList.remove('in-tune','stale');
  if(tuner.manual>=0)showTarget(tuner.manual);else{$('noteName').textContent='—';$('stringName').textContent='Suona una corda'}
  $('frequency').textContent='Nota sentita: —';$('cents').textContent='— cent';setNeedle(0);paintPins(tuner.manual);
}
const centsTo=(f,ref)=>1200*Math.log2(f/ref);
function chooseString(f){
  if(tuner.manual>=0)return tuner.manual;
  let best=0;for(let i=1;i<6;i++)if(Math.abs(centsTo(f,guitarStrings[i].f))<Math.abs(centsTo(f,guitarStrings[best].f)))best=i;
  // isteresi: resta sulla corda appena riconosciuta finché la nota non è chiaramente più vicina a un'altra
  const L=tuner.locked;if(L>=0&&L!==best&&performance.now()-tuner.lockedAt<HOLD_MS&&Math.abs(centsTo(f,guitarStrings[L].f))<Math.abs(centsTo(f,guitarStrings[best].f))+60)return L;
  return best;
}
function tunerReading(f,now){
  // nuova nota: deve ripetersi per 3 analisi prima di sostituire quella mostrata (niente salti per un rumore)
  if(tuner.recent.length&&Math.abs(centsTo(f,tuner.recent[tuner.recent.length-1]))>70){
    if(tuner.pending&&Math.abs(centsTo(f,tuner.pending))<70)tuner.pendingN++;else{tuner.pending=f;tuner.pendingN=1}
    if(tuner.pendingN<3&&now-tuner.lastHit<400)return;
    tuner.recent=[];tuner.shown=null;tuner.okSince=0;
  }
  tuner.pending=null;tuner.pendingN=0;tuner.lastHit=now;
  tuner.recent.push(f);if(tuner.recent.length>5)tuner.recent.shift();
  const med=tuner.recent.slice().sort((a,b)=>a-b)[tuner.recent.length>>1];
  const si=chooseString(med),st=guitarStrings[si];
  if(si!==tuner.locked){tuner.shown=null;tuner.okSince=0}
  tuner.locked=si;tuner.lockedAt=now;
  const raw=centsTo(med,st.f);
  tuner.shown=tuner.shown===null?raw:tuner.shown+.35*(raw-tuner.shown);
  const c=tuner.shown,heard=Math.round(12*Math.log2(med/440)+69),pc=((heard%12)+12)%12,oct=Math.floor(heard/12)-1;
  showTarget(si);
  $('frequency').textContent=`Nota sentita: ${NOTE_IT[pc]} (${NOTE_INT[pc]}${oct}) · ${med.toFixed(1)} Hz`;
  const semi=Math.round(c/100);$('cents').textContent=Math.abs(c)>=100?`${semi>0?'+':'−'}${Math.abs(semi)} ${Math.abs(semi)===1?'semitono':'semitoni'}`:(c>0?'+':'')+Math.round(c)+' cent';
  setNeedle(c);
  const ok=Math.abs(c)<=TUNE_OK,panel=$('tunerPanel');panel.classList.toggle('in-tune',ok);panel.classList.remove('stale');
  if(ok){if(!tuner.okSince)tuner.okSince=now;if(now-tuner.okSince>=TUNE_HOLD&&!tuner.tuned.has(si)){tuner.tuned.add(si)}}else tuner.okSince=0;
  paintPins(si);
  if(ok)setStatus(tuner.tuned.size===6?'Accordata ✓ · tutte le corde pronte':'Accordata ✓','ok');
  else if(c<-50)setStatus('Molto calante · tendi la corda ↑','low');
  else if(c<0)setStatus('Calante · tendi leggermente ↑','low');
  else if(c>50)setStatus('Molto crescente · allenta la corda ↓','high');
  else setStatus('Crescente · allenta leggermente ↓','high');
}
async function startTuner(){
  if(tuner.running||tuner.starting){stopTuner();return}
  if(!AudioCtor){setStatus('Audio non disponibile in questo browser.');return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setStatus('Microfono non disponibile: apri l’app da Safari usando l’indirizzo HTTPS.');return}
  const token=++tuner.token;
  let ctx=null,stream=null;
  tuner.starting=true;
  $('tunerStart').textContent='Annulla';setStatus('Attendo il permesso del microfono…');
  try{
    // Safari su iOS richiede che resume() parta direttamente dal tocco, prima del dialogo del microfono.
    ctx=new AudioCtor();tuner.ctx=ctx;
    const resumePromise=Promise.resolve(ctx.resume());
    const streamPromise=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    stream=await streamPromise;
    if(token!==tuner.token){stream.getTracks().forEach(track=>track.stop());return}
    tuner.stream=stream;
    await resumePromise;
    if(ctx.state==='suspended')await ctx.resume();
    if(ctx.state!=='running')throw new Error('audio-suspended');
    const src=ctx.createMediaStreamSource(stream),an=ctx.createAnalyser();an.fftSize=8192;src.connect(an);
    // Collega l’analizzatore a un’uscita muta: alcuni Safari aggiornano i campioni solo con un grafo attivo.
    const silent=ctx.createGain();silent.gain.value=0;an.connect(silent);silent.connect(ctx.destination);
    const buf=new Float32Array(an.fftSize),byteBuf=new Uint8Array(an.fftSize);
    tuner.starting=false;tuner.running=true;tuner.recent=[];tuner.shown=null;tuner.lastHit=0;tuner.noise=0;tuner.okSince=0;
    $('tunerStart').textContent='Ferma accordatore';setStatus('Ascolto… pizzica una corda');
    const loop=()=>{
      if(!tuner.running)return;
      if((tuner.frame++&1)===0){
        if(an.getFloatTimeDomainData)an.getFloatTimeDomainData(buf);else{an.getByteTimeDomainData(byteBuf);for(let i=0;i<byteBuf.length;i++)buf[i]=(byteBuf[i]-128)/128}
        const now=performance.now();
        const hintIdx=tuner.manual>=0?tuner.manual:(tuner.locked>=0&&now-tuner.lockedAt<HOLD_MS?tuner.locked:-1);
        const p=GSEngine.tunerPitch(buf,ctx.sampleRate,{hint:hintIdx>=0?guitarStrings[hintIdx].f:0,maxHz:700});
        // rumore di fondo: scende subito, sale piano (così una corda che suona a lungo non diventa "rumore")
        tuner.noise=!tuner.noise?p.rms:p.rms<tuner.noise?tuner.noise*.8+p.rms*.2:tuner.noise*.997+p.rms*.003;
        const loud=p.rms>Math.max(.0008,tuner.noise*2.2)||(tuner.lastHit&&now-tuner.lastHit<300&&p.rms>.0006);
        if(p.f>0&&p.clarity>=.82&&loud&&p.f>=60&&p.f<=700)tunerReading(p.f,now);
        else if(tuner.lastHit&&now-tuner.lastHit>HOLD_MS){tuner.lastHit=0;tuner.recent=[];tuner.shown=null;tuner.okSince=0;tunerIdle();
          setStatus(tuner.tuned.size===6?'Tutte le corde sono accordate ✓':'Ascolto… pizzica una corda',tuner.tuned.size===6?'ok':'')}
        else if(tuner.lastHit&&now-tuner.lastHit>350){$('tunerPanel').classList.add('stale');tuner.okSince=0}
      }
      tuner.raf=requestAnimationFrame(loop);
    };loop();
  }catch(err){
    if(token!==tuner.token)return;
    if(stream)stream.getTracks().forEach(track=>track.stop());
    tuner.stream=null;tuner.starting=false;
    if(ctx&&tuner.ctx===ctx){try{ctx.close()}catch(e){}tuner.ctx=null}
    $('tunerStart').textContent='Avvia microfono';
    const messages={NotAllowedError:'Permesso microfono negato: abilitalo nelle impostazioni di Safari per questo sito.',NotFoundError:'Non è stato trovato un microfono disponibile.',NotReadableError:'Il microfono è occupato da un’altra app. Chiudila e riprova.',SecurityError:'Il microfono richiede una connessione HTTPS.'};
    setStatus(messages[err.name]||'Non riesco ad avviare l’accordatore. Tocca Avvia e consenti il microfono.');
  }
}
function stopTuner(){
  if(!tuner.running&&!tuner.starting&&!tuner.stream&&!tuner.ctx)return;
  tuner.token++;tuner.running=false;tuner.starting=false;cancelAnimationFrame(tuner.raf);
  if(tuner.stream)tuner.stream.getTracks().forEach(t=>t.stop());tuner.stream=null;
  if(tuner.ctx){tuner.ctx.close();tuner.ctx=null}
  tuner.lastHit=0;tuner.recent=[];tuner.shown=null;
  $('tunerStart').textContent='Avvia microfono';setStatus(tuner.tuned.size===6?'Tutte le corde sono accordate ✓':'Accordatore fermo',tuner.tuned.size===6?'ok':'');tunerIdle();
}
$('tunerStart').addEventListener('click',()=>{if(!tuner.running&&!tuner.starting)tuner.tuned.clear();startTuner()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTuner();stopMetro();if(window.GSGame)GSGame.interrupt()}});

/* ---------- Installazione e aggiornamenti PWA ---------- */
$('appVersion').textContent=APP_VERSION;refreshDoneMarks();
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')});
let appRegistration=null,waitingForUpdate=false;
const updateBtn=$('updateBtn'),setUpdateLabel=t=>{updateBtn.querySelector('span').textContent=t;updateBtn.disabled=false};
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',async()=>{
    try{
      appRegistration=await navigator.serviceWorker.register('./sw.js');
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(waitingForUpdate){waitingForUpdate=false;setUpdateLabel('Aggiornato ✓');setTimeout(()=>location.reload(),500)}});
      const markReady=()=>{updateBtn.dataset.ready='true';setUpdateLabel('Aggiornamento pronto · Riavvia')};
      if(appRegistration.waiting&&navigator.serviceWorker.controller)markReady();
      appRegistration.addEventListener('updatefound',()=>{const w=appRegistration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)markReady()})});
    }catch(err){console.warn('Service worker non disponibile',err)}
  });
}
updateBtn.addEventListener('click',async()=>{
  if(!appRegistration){setUpdateLabel('Aggiornamenti non disponibili qui');return}
  if(!navigator.onLine){setUpdateLabel('Sei offline');return}
  updateBtn.disabled=true;setUpdateLabel('Controllo…');updateBtn.disabled=true;
  try{
    if(updateBtn.dataset.ready==='true'&&appRegistration.waiting){waitingForUpdate=true;appRegistration.waiting.postMessage({type:'SKIP_WAITING'});setUpdateLabel('Installazione…');updateBtn.disabled=true;return}
    await appRegistration.update();
    const installing=appRegistration.installing;
    if(installing&&!['installed','activated','redundant'].includes(installing.state)){
      setUpdateLabel('Scarico l\'aggiornamento…');updateBtn.disabled=true;
      await new Promise(done=>{const check=()=>{if(['installed','activated','redundant'].includes(installing.state)){installing.removeEventListener('statechange',check);done()}};installing.addEventListener('statechange',check);check()});
    }
    if(appRegistration.waiting){updateBtn.dataset.ready='true';setUpdateLabel('Aggiornamento pronto · Riavvia')}
    else setUpdateLabel('Guitar Studio è aggiornato ✓');
  }catch(err){setUpdateLabel(navigator.onLine?'Errore aggiornamento':'Sei offline')}
});

show(location.hash.slice(1)||'home');
