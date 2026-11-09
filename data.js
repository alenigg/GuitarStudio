// Guitar Studio — contenuti didattici (lezioni, accordi, esercizi).
'use strict';
const lessons = [
 {n:'01',title:'Conoscere la chitarra',sub:'Parti dallo strumento',time:'15 min',body:`<p>La chitarra acustica è composta da cassa armonica, manico, tastiera, capotasto, ponte e corde. La cassa amplifica la vibrazione delle corde.</p><h3>Le sei corde</h3><p>Dalla più spessa alla più sottile: MI (E), LA (A), RE (D), SOL (G), SI (B), MI (E). La corda più spessa è la sesta; la più sottile è la prima.</p><h3>La tastiera</h3><p>I tasti sono gli spazi tra le barrette metalliche. Premendo una corda in uno spazio, la nota diventa più acuta man mano che ci si avvicina alla cassa.</p><div class="exercise"><b>Esercizio · 3 minuti</b><p>Nomina le sei corde a voce, dalla sesta alla prima e viceversa. Poi pizzicale una alla volta ascoltando la differenza di altezza.</p></div>`},
 {n:'02',title:'Postura e posizione delle mani',sub:'Comfort e controllo',time:'15 min',body:`<p>Siediti con la schiena rilassata e la chitarra stabile sulla coscia. Evita di incurvare eccessivamente le spalle o piegare il polso sinistro.</p><h3>Mano sinistra</h3><p>Pollice dietro il manico, indicativamente al centro. Le dita premono con la punta, arcuate, poco dietro il ferretto del tasto.</p><h3>Mano destra</h3><p>Mantieni il polso morbido. Se suoni con le dita, assegna indice, medio e anulare alle corde acute e usa il pollice per i bassi.</p><div class="exercise"><b>Esercizio · 4 minuti</b><p>Appoggia e solleva ogni dito sulla tastiera senza stringere il manico. Cerca movimenti piccoli e indipendenti.</p></div>`},
 {n:'03',title:'Cromatismo 1–2–3–4',sub:'Coordinazione e indipendenza',time:'15 min',body:`<p>Il cromatismo è un esercizio tecnico: le dita si muovono in sequenza su tasti consecutivi, una per volta.</p><h3>Sequenza</h3><ol><li>Indice sul 1° tasto.</li><li>Medio sul 2° tasto.</li><li>Anulare sul 3° tasto.</li><li>Mignolo sul 4° tasto.</li></ol><p>Ripeti la sequenza su ogni corda, dalla sesta alla prima. Poi torna indietro con 4–3–2–1.</p><div class="exercise"><b>Pratica · 5 minuti</b><p>Parti lentamente, una nota per battito a 60 BPM. Ogni nota deve essere pulita e avere volume uniforme. Aumenta la velocità solo quando il movimento è rilassato.</p></div>`},
 {n:'04',title:'Primi accordi aperti',sub:'Costruire forme pulite',time:'15–20 min',body:`<p>Un accordo è un insieme di note suonate contemporaneamente. Nei diagrammi, X indica una corda da non suonare, 0 una corda a vuoto e i numeri identificano le dita.</p><h3>Accordi di partenza</h3><p>MI minore (Em), LA minore (Am), DO maggiore (C), SOL maggiore (G), RE maggiore (D), MI maggiore (E), LA maggiore (A), RE minore (Dm).</p><p>Forma l'accordo lentamente, pizzica le corde una alla volta e correggi quelle che ronzano o risultano mute.</p><div class="exercise"><b>Pratica · 5 minuti</b><p>Forma Em, solleva la mano, rilassala e ricrea la posizione. Ripeti 5 volte. Poi prova lo stesso con Am.</p></div>`},
 {n:'05',title:'Cambi di accordo',sub:'Fluidità e precisione',time:'15–20 min',body:`<p>Per cambiare accordo in modo fluido, individua le dita che si spostano di poco e quelle che possono restare vicine alla tastiera.</p><h3>Metodo</h3><ol><li>Forma il primo accordo e controlla ogni corda.</li><li>Prepara lentamente la forma successiva.</li><li>Rilascia la pressione senza allontanare troppo le dita.</li><li>Ripeti mantenendo un ritmo regolare.</li></ol><div class="exercise"><b>Pratica · Em ↔ Am</b><p>Alterna i due accordi per un minuto senza metronomo. Poi ripeti a 60 BPM, un cambio ogni quattro battiti.</p></div>`},
 {n:'06',title:'Ritmica e pennata',sub:'Il movimento della mano destra',time:'15 min',body:`<p>La pennata verso il basso attraversa le corde dall'alto verso il basso; quella verso l'alto risale dalle corde acute verso quelle gravi. Il movimento nasce dal polso rilassato.</p><h3>Primo pattern</h3><p>Conta 1 – 2 – 3 – 4. Esegui una pennata verso il basso su ogni numero, mantenendo distanza e intensità regolari.</p><div class="exercise"><b>Pratica · 5 minuti</b><p>Imposta il metronomo a 60 BPM. Suona quattro pennate in giù su Em, poi ripeti su Am.</p></div>`},
 {n:'07',title:'Introduzione al barrè',sub:'Preparare la mano',time:'15 min',body:`<p>Nel barrè l'indice preme più corde contemporaneamente. La pressione va distribuita con precisione: non è necessario stringere con tutta la forza.</p><h3>Preparazione</h3><p>Prova prima un mini-barrè su due corde al primo tasto. Posiziona l'indice vicino al ferretto e verifica le corde separatamente.</p><p>Il FA maggiore (F) è una forma completa: indice al primo tasto su tutte le corde, medio al secondo tasto sulla terza corda, anulare e mignolo al terzo tasto sulla quinta e quarta corda.</p><div class="exercise"><b>Pratica · 3 minuti</b><p>Prova il barrè senza le altre dita e controlla una corda alla volta. Fermati se senti dolore o tensione eccessiva.</p></div>`}
];
const chordData=[
 {name:'Em',type:'Minori',frets:[0,2,2,0,0,0],fingers:[0,2,3,0,0,0],base:1,desc:'MI minore'},
 {name:'Am',type:'Minori',frets:[-1,0,2,2,1,0],fingers:[0,0,2,3,1,0],base:1,desc:'LA minore'},
 {name:'C',type:'Maggiori',frets:[-1,3,2,0,1,0],fingers:[0,3,2,0,1,0],base:1,desc:'DO maggiore'},
 {name:'G',type:'Maggiori',frets:[3,2,0,0,0,3],fingers:[2,1,0,0,0,3],base:1,desc:'SOL maggiore'},
 {name:'D',type:'Maggiori',frets:[-1,-1,0,2,3,2],fingers:[0,0,0,1,3,2],base:1,desc:'RE maggiore'},
 {name:'E',type:'Maggiori',frets:[0,2,2,1,0,0],fingers:[0,2,3,1,0,0],base:1,desc:'MI maggiore'},
 {name:'A',type:'Maggiori',frets:[-1,0,2,2,2,0],fingers:[0,0,1,2,3,0],base:1,desc:'LA maggiore'},
 {name:'Dm',type:'Minori',frets:[-1,-1,0,2,3,1],fingers:[0,0,0,2,3,1],base:1,desc:'RE minore'},
 {name:'F',type:'Maggiori',frets:[1,3,3,2,1,1],fingers:[1,3,4,2,1,1],base:1,desc:'FA maggiore · barrè'},
 {name:'A7',type:'Settima',frets:[-1,0,2,0,2,0],fingers:[0,0,2,0,3,0],base:1,desc:'LA settima'},
 {name:'D7',type:'Settima',frets:[-1,-1,0,2,1,2],fingers:[0,0,0,2,1,3],base:1,desc:'RE settima'},
 {name:'E7',type:'Settima',frets:[0,2,0,1,0,0],fingers:[0,2,0,1,0,0],base:1,desc:'MI settima'}
];
const chordPathStages=[
 {title:'Le fondamenta',level:'Principiante',time:'3–4 sessioni',goal:'Impara a posizionare le dita senza tensione e a far suonare ogni corda in modo nitido.',
  chords:['Em','Am','E','A'],pairs:[['Em','Am'],['E','A']],
  drill:'Per ogni accordo: forma la posizione, pizzica le corde una alla volta e correggi eventuali ronzii. Poi alterna la coppia indicata per un minuto, senza metronomo. Quando il movimento è fluido, prova a 50 BPM.'},
 {title:'I primi cambi completi',level:'Principiante · intermedio',time:'4–6 sessioni',goal:'Aggiungi le forme più usate e impara a preparare in anticipo le dita del cambio.',
  chords:['C','G','D','Dm'],pairs:[['C','G'],['G','D'],['D','Dm']],
  drill:'Dedica un minuto a ogni coppia. Parti con un cambio ogni quattro battiti a 50–60 BPM. Cerca un movimento economico: alcune dita possono restare vicine alla tastiera e non devono volare via.'},
 {title:'Colori e accordi di settima',level:'Intermedio',time:'3–5 sessioni',goal:'Introduci un suono più ricco e sviluppa precisione nei cambi con corde a vuoto.',
  chords:['A7','D7','E7'],pairs:[['A','A7'],['D','D7'],['E','E7']],
  drill:'Confronta ogni accordo maggiore con la sua settima. Ascolta la differenza, poi alternali lentamente per 8 volte. Mantieni le dita vicine alla tastiera e verifica che le corde non previste non vengano toccate.'},
 {title:'Il barrè: primo traguardo',level:'Intermedio · tecnica',time:'Da consolidare gradualmente',goal:'Affronta F maggiore senza forzare il polso. La qualità del barrè conta più della velocità.',
  chords:['F'],pairs:[['C','F'],['F','G']],
  drill:'Inizia con il mini-barrè o con una versione semplificata di F, se necessario. Premi vicino al tasto, usa il peso naturale del braccio senza stringere eccessivamente. Suona le corde una per volta. Interrompi se senti dolore: la pressione deve essere sostenibile.'}
];
const exerciseData=[
 {n:'01',title:'Cromatismo 1–2–3–4',level:'Base · 5 minuti',body:'Suona indice, medio, anulare e mignolo sui tasti 1, 2, 3 e 4. Procedi su tutte le corde dalla sesta alla prima, poi torna indietro. Una nota per battito, iniziando a 50–60 BPM.' ,pattern:'1 – 2 – 3 – 4  |  4 – 3 – 2 – 1'},
 {n:'02',title:'Cromatismo 1–3–2–4',level:'Coordinazione · 4 minuti',body:'Sul gruppo di quattro tasti usa indice, anulare, medio e mignolo. Mantieni le dita vicine alla tastiera e non sollevare inutilmente quelle che non stanno suonando.',pattern:'1 – 3 – 2 – 4'},
 {n:'03',title:'Ragno tra le corde',level:'Indipendenza · 5 minuti',body:'Suona 1–2–3–4 sulla sesta corda, poi sposta una sola posizione per volta sulle corde successive. Quando arrivi alla prima corda, torna indietro. Cerca di non anticipare il dito successivo.',pattern:'6ª → 5ª → 4ª → 3ª → 2ª → 1ª'},
 {n:'04',title:'Plettrata alternata',level:'Mano destra · 3 minuti',body:'Su una corda sola alterna pennata in giù e in su. Parti lentamente con il metronomo a 60 BPM, una nota per battito. Il movimento deve essere piccolo e regolare.',pattern:'↓ ↑ ↓ ↑  |  ↓ ↑ ↓ ↑'},
 {n:'05',title:'Arpeggio P–i–m–a',level:'Dita · 5 minuti',body:'Su un accordo semplice come C o Am, usa il pollice sulle corde basse, indice sulla terza, medio sulla seconda e anulare sulla prima. Ripeti senza accelerare.',pattern:'Pollice – indice – medio – anulare'},
 {n:'06',title:'Cambio Em ↔ Am',level:'Accordi · 4 minuti',body:'Forma Em, controlla il suono, poi passa ad Am. Alterna lentamente e cerca di preparare le dita prima di appoggiarle. Quando il cambio è pulito, usa il metronomo a 60 BPM.',pattern:'Em | Am | Em | Am'}
];

// ---- Accordi aggiuntivi (v1.8) ----
// frets: -1 = corda muta, 0 = vuota; ordine dalla 6ª (MI grave) alla 1ª (mi cantino).
chordData.push(
 {name:'Bm',type:'Minori',frets:[-1,2,4,4,3,2],fingers:[0,1,3,4,2,1],base:1,desc:'SI minore · barrè'},
 {name:'F#m',type:'Minori',frets:[2,4,4,2,2,2],fingers:[1,3,4,1,1,1],base:1,desc:'FA♯ minore · barrè'},
 {name:'B',type:'Maggiori',frets:[-1,2,4,4,4,2],fingers:[0,1,3,3,3,1],base:1,desc:'SI maggiore · barrè'},
 {name:'Bb',type:'Maggiori',frets:[-1,1,3,3,3,1],fingers:[0,1,3,3,3,1],base:1,desc:'SI♭ maggiore · barrè'},
 {name:'G7',type:'Settima',frets:[3,2,0,0,0,1],fingers:[3,2,0,0,0,1],base:1,desc:'SOL settima'},
 {name:'C7',type:'Settima',frets:[-1,3,2,3,1,0],fingers:[0,3,2,4,1,0],base:1,desc:'DO settima'},
 {name:'B7',type:'Settima',frets:[-1,2,1,2,0,2],fingers:[0,2,1,3,0,4],base:1,desc:'SI settima'},
 {name:'Cmaj7',type:'Settima',frets:[-1,3,2,0,0,0],fingers:[0,3,2,0,0,0],base:1,desc:'DO settima maggiore'},
 {name:'Fmaj7',type:'Settima',frets:[-1,-1,3,2,1,0],fingers:[0,0,3,2,1,0],base:1,desc:'FA settima maggiore'},
 {name:'Am7',type:'Settima',frets:[-1,0,2,0,1,0],fingers:[0,0,2,0,1,0],base:1,desc:'LA minore settima'},
 {name:'Em7',type:'Settima',frets:[0,2,0,0,0,0],fingers:[0,2,0,0,0,0],base:1,desc:'MI minore settima'},
 {name:'Dm7',type:'Settima',frets:[-1,-1,0,2,1,1],fingers:[0,0,0,2,1,1],base:1,desc:'RE minore settima'},
 {name:'Asus2',type:'Altri',frets:[-1,0,2,2,0,0],fingers:[0,0,1,2,0,0],base:1,desc:'LA sospeso 2'},
 {name:'Asus4',type:'Altri',frets:[-1,0,2,2,3,0],fingers:[0,0,1,2,3,0],base:1,desc:'LA sospeso 4'},
 {name:'Dsus2',type:'Altri',frets:[-1,-1,0,2,3,0],fingers:[0,0,0,1,3,0],base:1,desc:'RE sospeso 2'},
 {name:'Dsus4',type:'Altri',frets:[-1,-1,0,2,3,3],fingers:[0,0,0,1,3,4],base:1,desc:'RE sospeso 4'},
 {name:'Cadd9',type:'Altri',frets:[-1,3,2,0,3,3],fingers:[0,2,1,0,3,4],base:1,desc:'DO add 9'}
);
