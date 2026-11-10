'use strict';
// Guitar Studio 1.11 — logica dell'app. I contenuti didattici sono in data.js.
const APP_VERSION='1.11';
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
const parentOf={lezioni:'studio',teoria:'studio',accordi:'studio',percorso:'studio',esercizi:'studio',accordatore:'strumenti',metronomo:'strumenti'};
function show(name){
  if(!$(name)||!$(name).classList.contains('view'))name='home';
  if(name!=='metronomo')stopMetro();
  if(name!=='accordatore')stopTuner();
  stopInlineMetronome();
  views.forEach(v=>v.classList.toggle('active',v.id===name));
  const tab=parentOf[name]||name;
  document.querySelectorAll('.nav-item').forEach(b=>{const on=b.dataset.go===tab;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  window.scrollTo(0,0);
}
function go(name){if(location.hash==='#'+name)show(name);else location.hash=name}
window.addEventListener('hashchange',()=>show(location.hash.slice(1)||'home'));
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){e.preventDefault();go(b.dataset.go)}});

/* ---------- Tema chiaro/scuro ---------- */
function effectiveTheme(){const t=document.documentElement.dataset.theme;return t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
function paintThemeBtn(){const dark=effectiveTheme()==='dark';$('themeBtn').innerHTML=ico(dark?'sun':'moon');$('themeBtn').setAttribute('aria-label',dark?'Passa al tema chiaro':'Passa al tema scuro')}
$('themeBtn').addEventListener('click',()=>{const next=effectiveTheme()==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem(KEY_THEME,next)}catch(e){}paintThemeBtn()});
paintThemeBtn();

/* ---------- Finestra di dettaglio ---------- */
const dialogHistory=[];
function openDialog(eyebrow,html,{keepCurrent=false,chords=[],bpm=0}={}){
  stopInlineMetronome();
  const dialog=$('lessonDialog');
  if(dialog.open&&keepCurrent)dialogHistory.push({eyebrow:$('dialogEyebrow').textContent,html:$('lessonContent').innerHTML});
  else if(!dialog.open)dialogHistory.length=0;
  $('dialogEyebrow').textContent=eyebrow;
  $('lessonContent').innerHTML=html;
  if(chords.length)$('lessonContent').insertAdjacentHTML('beforeend',`<div class="lesson-chord-links"><h3>Apri gli accordi citati</h3><div class="btn-row">${chords.map(n=>{const c=chordByName(n);return c?`<button type="button" class="btn small secondary" data-open-chord="${esc(c.name)}">${esc(chordLabel(c))}</button>`:''}).join('')}</div></div>`);
  if(bpm)$('lessonContent').insertAdjacentHTML('beforeend',inlineMetronomeMarkup('lesson',bpm));
  bindInteractiveContent($('lessonContent'));
  if(!dialog.open)dialog.showModal();
}
function closeDialogLayer(){
  stopInlineMetronome();
  if(dialogHistory.length){const previous=dialogHistory.pop();$('dialogEyebrow').textContent=previous.eyebrow;$('lessonContent').innerHTML=previous.html;bindInteractiveContent($('lessonContent'));return}
  $('lessonDialog').close();
}
$('closeLesson').addEventListener('click',closeDialogLayer);
$('lessonDialog').addEventListener('click',e=>{if(e.target===$('lessonDialog'))closeDialogLayer()});

/* ---------- Lezioni ed esercizi ---------- */
function rowButton(num,title,sub){const b=document.createElement('button');b.className='row';b.innerHTML=`<span class="row-ico">${num}</span><span class="row-body"><b>${title}</b><small>${sub}</small></span>${ico('next','chev')}`;return b}
lessons.forEach(l=>{const b=rowButton(l.n,l.title,`${l.sub} · ${l.time}`);b.addEventListener('click',()=>openDialog('Lezione',`<h2>${l.n} · ${l.title}</h2><p class="muted">${l.sub} · ${l.time}</p>${l.body}`,{chords:lessonChordRefs[l.n]||[],bpm:l.bpm||(l.body.toLowerCase().includes('metronomo')?60:0)}));$('lessonList').appendChild(b)});
exerciseData.forEach(ex=>{const b=rowButton(ex.n,ex.title,ex.level);b.addEventListener('click',()=>openDialog('Esercizio',`<h2>${ex.n} · ${ex.title}</h2><p class="muted">${ex.level}</p><p>${ex.body}</p><div class="exercise"><b>Sequenza da provare</b><p class="exercise-pattern">${ex.pattern}</p><h3>Procedura</h3><ol><li>Prepara la posizione e suona lentamente una volta per prendere confidenza.</li><li>Ripeti la sequenza per quattro cicli, controllando che ogni movimento sia preciso.</li><li>Fai una breve pausa, poi riparti e confronta la regolarità del suono.</li><li>Concludi con un ciclo lento e pulito, senza accelerare per finire prima.</li></ol><p><b>Obiettivo:</b> completare tre cicli consecutivi senza fermarti e senza tensione.</p></div>`,{chords:ex.chords||[],bpm:ex.bpm||0}));$('exerciseList').appendChild(b)});

/* ---------- Accordi ---------- */
const NOTE_INT=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const NOTE_IT=['DO','DO♯','RE','RE♯','MI','FA','FA♯','SOL','SOL♯','LA','LA♯','SI'];
const OPEN=[40,45,50,55,59,64]; // accordatura standard E A D G B e
const chordByName=n=>chordData.find(c=>c.name.toLowerCase()===String(n).trim().toLowerCase());
const chordLabel=c=>`${c.desc.replace(/\s+·\s+barrè$/,'')} (${c.name})`;
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
function renderChords(filter='tutti'){
  const host=$('chordGrid');host.innerHTML='';
  chordData.filter(c=>filter==='tutti'||c.type===filter).forEach(ch=>{
    const card=document.createElement('button');card.className='chord-card';
    card.innerHTML=`<div class="chord-card-head"><div><h3>${esc(chordLabel(ch))}</h3><small>${esc(ch.desc)}</small></div></div>${chordSVG(ch)}<div class="chord-strings"><span>6ª</span><span>5ª</span><span>4ª</span><span>3ª</span><span>2ª</span><span>1ª</span></div>`;
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

function inlineMetronomeMarkup(id,bpm=60){
  const value=Math.max(40,Math.min(220,Number(bpm)||60));
  return `<div class="inline-metronome" data-inline-metro="${esc(id)}" data-bpm="${value}"><div class="inline-metro-head"><b>Prova con il metronomo</b><span class="inline-bpm"><button type="button" class="round-btn" data-inline-step="-5" aria-label="Diminuisci il tempo">−</button><output>${value} BPM</output><button type="button" class="round-btn" data-inline-step="5" aria-label="Aumenta il tempo">+</button></span></div><div class="inline-beats" aria-hidden="true">${[0,1,2,3].map((_,i)=>`<i class="${i===0?'accent':''}"></i>`).join('')}</div><button type="button" class="btn small full" data-inline-toggle>${ico('play')}<span>Avvia</span></button><p class="small-text muted" data-inline-status aria-live="polite">Regola il tempo e avvia quando sei pronto.</p></div>`;
}
function bindInteractiveContent(root){
  root.querySelectorAll('[data-open-chord]').forEach(button=>button.addEventListener('click',()=>{const chord=chordByName(button.dataset.openChord);if(chord)openChordDetail(chord,true)}));
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
  const tick=()=>{if(!inlineMetro.running)return;while(inlineMetro.next<ctx.currentTime+.12){clickSound(ctx,inlineMetro.next,inlineMetro.index%4===0?2:0);inlineMetro.queue.push({t:inlineMetro.next,i:inlineMetro.index%4});inlineMetro.next+=60/(Number(box.dataset.bpm)||60);inlineMetro.index++}inlineMetro.timer=setTimeout(tick,25)};
  const frame=()=>{if(!inlineMetro.running)return;let last=null;while(inlineMetro.queue.length&&inlineMetro.queue[0].t<=ctx.currentTime)last=inlineMetro.queue.shift();if(last&&inlineMetro.box===box)box.querySelectorAll('.inline-beats i').forEach((el,i)=>el.classList.toggle('on',i===last.i));inlineMetro.raf=requestAnimationFrame(frame)};
  tick();frame();
}
function stopInlineMetronome(){if(!inlineMetro?.running)return;inlineMetro.running=false;clearTimeout(inlineMetro.timer);cancelAnimationFrame(inlineMetro.raf);if(inlineMetro.box){inlineMetro.box.querySelectorAll('.inline-beats i').forEach(x=>x.classList.remove('on'));inlineMetro.box.querySelector('[data-inline-toggle]').innerHTML=`${ico('play')}<span>Avvia</span>`;inlineMetro.box.querySelector('[data-inline-status]').textContent='Metronomo fermato.'}inlineMetro.box=null;inlineMetro.queue=[]}

/* ---------- Percorso accordi ---------- */
function renderChordPath(){
  stopInlineMetronome();
  const done=loadJSON(KEY_PATH,[]);
  $('pathProgressText').textContent=`${done.length} di ${chordPathStages.length} tappe completate`;
  $('pathProgressBar').style.width=`${done.length/chordPathStages.length*100}%`;
  const host=$('chordPath');host.innerHTML='';
  chordPathStages.forEach((st,i)=>{
    const card=document.createElement('article');card.className='path-stage';
    card.innerHTML=`<div class="path-stage-head"><span class="path-stage-number">${i+1}</span><div class="path-stage-title"><span class="eyebrow">${st.level} · ${st.time}</span><h2>${st.title}</h2></div><label class="path-complete"><input type="checkbox" ${done.includes(i)?'checked':''} aria-label="Tappa ${i+1} completata"><span>Completata</span></label></div>
     <p>${st.goal}</p>
     <div class="path-chords"><span class="path-label">Accordi da studiare</span><div class="path-chord-buttons">${st.chords.map(n=>`<button class="path-chord-btn" data-chord="${n}">${chordLabelByName(n)}</button>`).join('')}</div></div>
     <div class="path-pairs"><span class="path-label">Cambi da allenare</span><div>${st.pairs.map(p=>`<span class="path-pair">${chordLabelByName(p[0])} <b>↔</b> ${chordLabelByName(p[1])}</span>`).join('')}</div></div>
     <div class="path-drill"><b>Mini-sessione guidata</b><p>${st.drill}</p>${st.practice?`<ol class="path-practice">${st.practice.map(x=>`<li>${x}</li>`).join('')}</ol>`:''}</div>${st.bpm?inlineMetronomeMarkup(`path-${i}`,st.bpm):''}`;
    card.querySelector('input').addEventListener('change',e=>{const next=loadJSON(KEY_PATH,[]).filter(x=>x!==i);if(e.target.checked)next.push(i);saveJSON(KEY_PATH,next);renderChordPath()});
    card.querySelectorAll('[data-chord]').forEach(b=>b.addEventListener('click',()=>{const c=chordByName(b.dataset.chord);if(c)openChordDetail(c)}));
    bindInteractiveContent(card);
    host.appendChild(card);
  });
}
renderChordPath();

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
  const data={app:'guitar-studio',version:APP_VERSION,date:new Date().toISOString(),sessions,pathDone:loadJSON(KEY_PATH,[]),weeklyGoal};
  download(`guitar-studio-backup-${isoLocal()}.json`,JSON.stringify(data,null,1),'application/json');
  $('backupMsg').textContent='Backup salvato nei download del dispositivo.';
});
$('backupImport').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{
    const d=JSON.parse(await f.text());
    if(d.app!=='guitar-studio'||!Array.isArray(d.sessions))throw new Error('formato');
    if(!confirm(`Ripristinare il backup? Verranno sostituiti i dati attuali (${sessions.length} sessioni) con quelli del file (${d.sessions.length} sessioni).`))return;
    sessions=d.sessions.filter(s=>s&&s.date&&Number.isFinite(Number(s.duration))).map(s=>({id:s.id||Date.now()+Math.random(),date:String(s.date),duration:Number(s.duration),activity:String(s.activity||'Studio libero'),notes:String(s.notes||'')}));
    saveJSON(KEY_SESSIONS,sessions);saveJSON(KEY_PATH,Array.isArray(d.pathDone)?d.pathDone:[]);
    if(d.weeklyGoal){weeklyGoal=Number(d.weeklyGoal)||60;saveJSON(KEY_GOAL,weeklyGoal)}
    renderDiary();renderChordPath();$('backupMsg').textContent='Backup ripristinato.';
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
function clickSound(ctx,time,level){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.value=[850,1000,1200][level];
  const peak=[.1,.16,.24][level];
  g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(peak,time+.004);g.gain.exponentialRampToValueAtTime(.0001,time+.065);
  o.connect(g);g.connect(ctx.destination);o.start(time);o.stop(time+.07);
}
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

/* ---------- Accordatore (autocorrelazione normalizzata + mediana) ---------- */
const guitarStrings=[{n:'E2',f:82.4069},{n:'A2',f:110},{n:'D3',f:146.832},{n:'G3',f:195.998},{n:'B3',f:246.942},{n:'E4',f:329.628}];
const tuner={running:false,starting:false,token:0,stream:null,ctx:null,raf:null,recent:[],lastHit:0,frame:0};
(function buildPins(){
  const ns='http://www.w3.org/2000/svg',host=$('tunerPins');
  const visualOrder=[2,3,1,4,0,5];
  for(let pos=0;pos<visualOrder.length;pos++){
    const i=visualOrder[pos],side=pos%2===0?-1:1,y=42+Math.floor(pos/2)*43,x=170+side*57;
    const g=document.createElementNS(ns,'g');g.setAttribute('class','tuner-pin');
    g.dataset.stringIndex=i;
    const mk=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text)e.textContent=text;return e};
    const names=['MI (E)','LA (A)','RE (D)','SOL (G)','SI (B)','MI (E)'];
    g.append(mk('line',{x1:170+side*32,y1:y,x2:x,y2:y}),mk('circle',{cx:x,cy:y,r:15}),mk('text',{x,y:y+3,'text-anchor':'middle','font-size':'7'},names[i]));
    host.appendChild(g);
  }
})();
function highlightTunerString(index){
  document.querySelectorAll('.tuner-pin').forEach(p=>p.classList.toggle('selected',Number(p.dataset.stringIndex)===index));
  $('headstockCaption').textContent=index>=0?`Meccanica evidenziata: ${['MI (E) grave','LA (A)','RE (D)','SOL (G)','SI (B)','MI (E) cantino'][index]}`:'Suona una corda per evidenziarne la meccanica';
}
function detectPitch(buf,sr){
  let rms=0;for(let i=0;i<buf.length;i++)rms+=buf[i]*buf[i];rms=Math.sqrt(rms/buf.length);if(rms<.01)return -1;
  const minLag=Math.floor(sr/400),maxLag=Math.min(Math.floor(sr/70),Math.floor(buf.length/2)),W=buf.length-maxLag-2;
  const nsdf=new Float32Array(maxLag+2);
  for(let lag=minLag-1;lag<=maxLag+1;lag++){let acf=0,m=0;for(let i=0;i<W;i+=2){const a=buf[i],b=buf[i+lag];acf+=a*b;m+=a*a+b*b}nsdf[lag]=m?2*acf/m:0}
  const peaks=[];let top=0;
  for(let lag=minLag;lag<=maxLag;lag++){if(nsdf[lag]>.5&&nsdf[lag]>nsdf[lag-1]&&nsdf[lag]>=nsdf[lag+1]){peaks.push(lag);if(nsdf[lag]>top)top=nsdf[lag]}}
  // Il primo picco abbastanza alto evita gli errori d'ottava verso il basso.
  const lag=peaks.find(l=>nsdf[l]>=.9*top);if(lag===undefined)return -1;
  const y1=nsdf[lag-1],y2=nsdf[lag],y3=nsdf[lag+1],den=y1-2*y2+y3,shift=den?.5*(y1-y3)/den:0;
  return sr/(lag+shift);
}
const nearestString=f=>guitarStrings.reduce((b,s)=>Math.abs(Math.log2(f/s.f))<Math.abs(Math.log2(f/b.f))?s:b,guitarStrings[0]);
function tunerIdle(){
  $('noteName').textContent='—';$('frequency').textContent='-- Hz';$('cents').textContent='0 cent';$('stringName').textContent='Suona una corda';
  $('needle').style.transform='rotate(0deg)';$('needle').classList.remove('ok');highlightTunerString(-1);
}
async function startTuner(){
  if(tuner.running||tuner.starting){stopTuner();return}
  if(!AudioCtor){$('tunerStatus').textContent='Audio non disponibile in questo browser.';return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$('tunerStatus').textContent='Microfono non disponibile: apri l’app da Safari usando l’indirizzo HTTPS.';return}
  const token=++tuner.token;
  let ctx=null,stream=null;
  tuner.starting=true;
  $('tunerStart').textContent='Annulla';$('tunerStatus').textContent='Attendo il permesso del microfono…';
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
    const src=ctx.createMediaStreamSource(stream),an=ctx.createAnalyser();an.fftSize=4096;src.connect(an);
    // Collega l’analizzatore a un’uscita muta: alcuni Safari aggiornano i campioni solo con un grafo attivo.
    const silent=ctx.createGain();silent.gain.value=0;an.connect(silent);silent.connect(ctx.destination);
    const buf=new Float32Array(an.fftSize),byteBuf=new Uint8Array(an.fftSize);tuner.starting=false;tuner.running=true;tuner.recent=[];tuner.lastHit=performance.now();
    $('tunerStart').textContent='Ferma accordatore';$('tunerStatus').textContent='Ascolto in corso…';
    const loop=()=>{
      if(!tuner.running)return;
      if((tuner.frame++&1)===0){
        if(an.getFloatTimeDomainData)an.getFloatTimeDomainData(buf);else{an.getByteTimeDomainData(byteBuf);for(let i=0;i<byteBuf.length;i++)buf[i]=(byteBuf[i]-128)/128}
        const f=detectPitch(buf,ctx.sampleRate);
        if(f>60&&f<400){
          tuner.lastHit=performance.now();tuner.recent.push(f);if(tuner.recent.length>5)tuner.recent.shift();
          const med=tuner.recent.slice().sort((a,b)=>a-b)[Math.floor(tuner.recent.length/2)];
          const st=nearestString(med),cents=1200*Math.log2(med/st.f);
          const noteIdx=Math.round(12*Math.log2(med/440)+69)%12;$('noteName').textContent=`${NOTE_IT[noteIdx]} (${NOTE_INT[noteIdx]})`;$('frequency').textContent=med.toFixed(1)+' Hz';
          $('cents').textContent=(cents>0?'+':'')+cents.toFixed(0)+' cent';$('stringName').textContent='Corda '+['MI (E)','LA (A)','RE (D)','SOL (G)','SI (B)','MI (E)'][guitarStrings.indexOf(st)];highlightTunerString(guitarStrings.indexOf(st));
          $('needle').style.transform=`rotate(${Math.max(-42,Math.min(42,cents*1.25))}deg)`;$('needle').classList.toggle('ok',Math.abs(cents)<5);
          $('tunerStatus').textContent=Math.abs(cents)<5?'Accordata ✓':cents<0?'Troppo bassa · tendi leggermente':'Troppo alta · allenta leggermente';
        }else if(performance.now()-tuner.lastHit>700){tuner.recent=[];tunerIdle();$('tunerStatus').textContent='Ascolto in corso…'}
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
    $('tunerStatus').textContent=messages[err.name]||'Non riesco ad avviare l’accordatore. Tocca Avvia e consenti il microfono.';
  }
}
function stopTuner(){
  if(!tuner.running&&!tuner.starting&&!tuner.stream&&!tuner.ctx)return;
  tuner.token++;tuner.running=false;tuner.starting=false;cancelAnimationFrame(tuner.raf);
  if(tuner.stream)tuner.stream.getTracks().forEach(t=>t.stop());tuner.stream=null;
  if(tuner.ctx){tuner.ctx.close();tuner.ctx=null}
  $('tunerStart').textContent='Avvia microfono';$('tunerStatus').textContent='Accordatore fermo';tunerIdle();
}
$('tunerStart').addEventListener('click',startTuner);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTuner();stopMetro()}});

/* ---------- Installazione e aggiornamenti PWA ---------- */
$('appVersion').textContent=APP_VERSION;
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
  updateBtn.disabled=true;setUpdateLabel('Controllo…');updateBtn.disabled=true;
  try{
    if(updateBtn.dataset.ready==='true'&&appRegistration.waiting){waitingForUpdate=true;appRegistration.waiting.postMessage({type:'SKIP_WAITING'});setUpdateLabel('Installazione…');updateBtn.disabled=true;return}
    await appRegistration.update();
    if(appRegistration.waiting){updateBtn.dataset.ready='true';setUpdateLabel('Aggiornamento pronto · Riavvia')}
    else setUpdateLabel('Guitar Studio è aggiornato ✓');
  }catch(err){setUpdateLabel(navigator.onLine?'Errore aggiornamento':'Sei offline')}
});

show(location.hash.slice(1)||'home');
