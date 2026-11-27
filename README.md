# Guitar Studio PWA 3.2.0

Applicazione statica per lo studio della chitarra. Dopo il primo caricamento, le funzioni principali sono disponibili offline.

## Funzioni
- Lezioni, teoria musicale, archivio accordi e percorso progressivo.
- Accordatore con microfono e metronomo con misure 2/4, 3/4, 4/4 e 6/8.
- Diario di studio, obiettivo settimanale ed esportazione/ripristino dei dati.
- Tema chiaro e scuro, backup locale e controllo aggiornamenti.
- La voce Canzoni resta nei menu e mostra “Work in progress”.
- **Sfide** (novità 2.0): quattro giochi guidati dal microfono, con Allenatore, livelli, missione del giorno e collegamento al Diario.
- Percorso progressivo: 23 lezioni, 12 tappe accordi e 32 esercizi, dalle basi al consolidamento.
- Teoria ampliata: note, alterazioni, tastiera, scale, tonalità, triadi, ritmo e metodo di studio.

## Pubblicazione
Estrai lo ZIP e pubblica il contenuto della cartella su un hosting HTTPS statico, per esempio Netlify o GitHub Pages. Le istruzioni passo passo sono in `ISTRUZIONI_PUBBLICAZIONE_HTTPS.txt`.

La cache del service worker per questa versione è `guitar-studio-v3-2-0`.

## Dati e privacy
Il diario e i progressi vengono salvati nel browser del dispositivo. Usa “Salva backup” prima di cambiare indirizzo del sito, browser o dispositivo; usa “Ripristina backup” per recuperare i dati.


## Novità 3.2.0 — nuovo accordatore

L'accordatore è stato rifatto, prendendo spunto da GuitarTuna.
- **Riconosce davvero le note**: prima una corda suonata piano, o che si stava smorzando, veniva ignorata (soglia di volume fissa troppo alta per il microfono del telefono) e nei passaggi tra una corda e l'altra comparivano note sbagliate. Ora la soglia si adatta al rumore della stanza, un filtro toglie il ronzio di rete, e un controllo sulle armoniche evita gli errori d'ottava e le note "fantasma" create da altre corde che vibrano.
- **Lettura stabile**: la nota deve ripetersi prima di essere mostrata, la lancetta si muove morbida e l'ultima lettura resta visibile (attenuata) mentre la corda si spegne, invece di azzerarsi.
- **Automatico o manuale**: in automatico riconosce da solo la corda; toccando una meccanica accordi solo quella corda (utile se è molto scordata). Tocca «Automatico» per tornare.
- **Corde accordate in verde**: una corda tenuta entro ±5 cent per mezzo secondo diventa verde con la spunta; con tutte e sei compare «Tutte le corde sono accordate».
- **Quadrante nuovo**: scala da −50 a +50 cent con la zona verde al centro, nota da accordare grande al centro, nota sentita e frequenza sotto. Indicazioni chiare: «tendi ↑» o «allenta ↓».

## Novità 3.1.1 — correzioni grafiche

- **Accordatore**: il quadrante è di nuovo un arco con la lancetta, centrato sotto la nota e allineato alle scritte «calante / accordata / crescente». Dalla 2.0 una regola grafica delle Sfide lo trasformava in una barra piatta, allineata a sinistra sugli schermi larghi.
- **Sfide**: nelle pagine «Prova il microfono» e calibrazione non compare più due volte il pulsante «← Sfide».

## Novità 3.1.0 — ritmica illustrata, suoni del metronomo, finestre più comode

- **Metronomo**: quattro suoni a scelta (Legno, Bip, Campanaccio, Bacchette) e cursore del volume. Ogni suono arriva al massimo pulito, senza distorsione; il volume riduce soltanto. Toccando un suono o spostando il volume senti un'anteprima. Suono e volume restano salvati e valgono anche per il metronomo di lezioni, esercizi e Sfide. Il Bip è il più penetrante, le Bacchette il più discreto.
- **Esercizi con la ritmica disegnata** (18 esercizi): una casella per ogni suddivisione con pennate in giù e in su, movimenti a vuoto, pause, accenti, basso, dita e swing, più la legenda dei simboli usati. È subito sopra il metronomo dell'esercizio e, quando lo avvii, il battito in corso si illumina.
- **Finestre** (lezioni, esercizi, schede accordo): la riga con la X resta fissa in alto, quindi puoi chiudere anche dal fondo della pagina. Aprendo una scheda accordo da un esercizio parti dall'alto e, chiudendola, torni al punto dell'esercizio in cui eri.
- **Accordi**: con il filtro «Tutti» l'ordine è per nota (DO, DO♯, RE…), e per ogni nota maggiore, minore, settime, varianti e power chord. Gli altri filtri restano come prima.
- **Accordatore**: rimosso il riquadro in fondo con le note delle corde (la stessa informazione è nel sottotitolo della pagina).

## Novità 3.0.0 — nuova navigazione, metronomo più forte, giri classici

- **Barra in basso**: Home, Esercizi, Accordi, Accordatore e Metronomo, cioè le pagine che si usano mentre si suona, a un tocco da ovunque. Studio, Strumenti, Sfide, Canzoni e Diario si aprono dalla Home.
- **Home**: Sfide è ora un riquadro come Studio, Strumenti, Canzoni e Diario, senza l'etichetta «Novità». Le funzioni future useranno lo stesso riquadro. Rimossa la sezione «Accesso rapido».
- **Metronomo**: nuovo click tipo woodblock, con l'energia tra 2 e 4 kHz (la zona che l'orecchio e gli altoparlanti dei telefoni rendono meglio). Il campione arriva quasi al fondo scala (−0,4 dBFS sull'accento) senza mai superarlo, quindi senza distorsione. L'accento si riconosce dall'altezza più acuta. Lo stesso click è usato dal metronomo delle lezioni e delle Sfide.
- **8 nuovi esercizi sui giri classici** (25–32): blues a 12 battute in LA (A), shuffle boogie, blues in MI (E) con quick change, blues minore, giro di DO (I–vi–IV–V), cadenza andalusa, II–V–I jazz, giro del Canone di Pachelbel. Ognuno ha lo schema delle battute.
- **Esercizi illustrati**: dove un esercizio cita degli accordi, i diagrammi (gli stessi della pagina Accordi) sono dentro l'esercizio; toccandoli si apre la scheda con l'ascolto. Gli esercizi di tecnica hanno una tablatura con dita o direzione della pennata.
- **Aggiornamenti più affidabili**: durante l'installazione di una nuova versione l'app scarica sempre i file dalla rete. Prima poteva capitare (per qualche minuto dopo una pubblicazione) che la nuova versione partisse con alcuni file della precedente.

## Novità 2.3.0 — schermo sempre acceso

Nella schermata iniziale la nuova scheda **Schermo** ha la casella «Tieni lo schermo acceso mentre usi l'app», attiva di default: lo schermo non si spegne più dopo qualche secondo di inattività mentre suoni. L'app usa il Screen Wake Lock del browser e lo richiede di nuovo da sola quando torni all'app dopo averla lasciata in secondo piano.
- iPhone: funziona in Safari da iOS 16.4; se l'app è aggiunta alla schermata Home serve iOS 18.4 o successivo.
- Se il telefono è in risparmio energetico, il sistema può rifiutare la richiesta: la scheda lo segnala e l'app riprova al tocco successivo.
- Disattiva la casella se vuoi risparmiare batteria. La scelta resta salvata su questo dispositivo (non fa parte del backup).

## Novità 2.2.2 — power chord di RE

Aggiunto RE power chord (D5) alla pagina Accordi, con la stessa forma di SI5 e DO5 (fondamentale sulla 5ª corda, 5° tasto). Ora i power chord sulle sette note naturali sono tutti presenti: DO5, RE5, MI5, FA5, SOL5, LA5, SI5.

## Novità 2.2.1 — accordi in ordine di scala

Nella pagina Accordi, ogni famiglia (maggiori, minori, settime, sospesi e add, power chord) segue ora l'ordine della scala: DO, RE, MI, FA, SOL, LA, SI. Le alterazioni stanno tra le note vicine (FA♯ minore dopo FA minore, SI♭ prima di SI). Con il filtro «Tutti» le famiglie compaiono una dopo l'altra, nello stesso ordine dei filtri.

## Novità 2.2.0 — giri blues e esercizi per ogni livello

Autostrada ora ha 18 brani, raggruppati per categoria (Primi passi, Blues e rock, Melodie e classici, Tecnica) e ordinati dal più facile al più difficile.
- **Blues a 12 battute in MI (E)** (MI, LA, SI sui bassi) e **Blues minore in LA (Am)** (Am, Dm, F, E): i due giri che ogni chitarrista incontra presto.
- **Basso “walking” in LA (A)**: otto note a battuta che camminano sull'accordo, sulle 12 battute del blues.
- **Pentatonica di MI minore (Em)**: la scala del rock in posizione aperta, su e giù per tutte le corde.
- **Tecnica**: *Ragno cromatico* (un dito per tasto, dal 5° all'8°, su tutte le corde), *Scala di SOL (G) maggiore* in 2ª posizione, *Salta-corde* per allenare la mira.
- Pagina Sfide: spaziatura uniforme tra le schede (14 px) e margini finali sistemati.
- Nota sulle fonti: le sequenze sono scritte da zero con gli schemi tradizionali del blues (nessun dato copiato da raccolte con licenze restrittive, es. GPL o uso personale).

## Novità 2.1.0 — repertorio più da chitarristi

Nuovo repertorio per Autostrada (12 brani, in tre livelli di difficoltà). Via le filastrocche (Fra Martino, Jingle Bells); al loro posto:
- **Blues a 12 battute in LA (A)**: il boogie sui bassi, con la vera struttura delle 12 battute (LA, RE, MI).
- **Scala blues di LA (A)** con la «nota blu» RE♯ (D♯), 5ª posizione.
- **Canone di Pachelbel**: il basso di otto note e la frase principale della melodia (brano del Seicento, di pubblico dominio).
- **Arpeggi su LA minore (Am), DO (C), RE (D), FA (F)**: un giro d'accordi suonato nota per nota.
- **Andaluso**: frase originale in stile flamenco sul modo frigio.
- **Ruggine**: riff hard rock originale (già presente), insieme a Corde a vuoto, Tre note sulla 1ª corda, Inno alla gioia e Scala di DO (C).
- Riconoscimento più affidabile quando ripeti la stessa nota o suoni note basse mentre altre corde risuonano ancora; sensibilità predefinita del microfono più alta.
- Nuovi brani originali o di pubblico dominio: nessuna canzone moderna protetta da diritti d'autore.

## Novità 2.0.0 — Sfide

La chitarra diventa il controller. L'app ascolta il microfono, riconosce note e accordi e ti guida mentre suoni. L'audio viene analizzato sul dispositivo e subito scartato: non viene registrato né inviato.

- **Autostrada** (stile Guitar Hero): le note scendono su sei corsie, una per corda, con il numero del tasto. Brani di difficoltà crescente (elenco nelle versioni 2.1.0 e 2.2.0). Due modi: *A tempo* (giudizi Perfetto/Bene/Presto/Tardi, serie, stelle) e *Aspetta me* (il brano si ferma finché suoni la nota giusta). Velocità 60%, 80%, 100%.
- **Caccia alla nota**: nota e corda a caso, da trovare sulla tastiera il più in fretta possibile; 4 livelli, suggerimento con tastiera illustrata.
- **Eco**: ascolta una melodia e ripetila; ad ogni giro si aggiunge una nota (allena l'orecchio).
- **Cambi lampo**: quanti cambi di accordo in 30, 60 o 90 secondi; il riconoscimento usa il cromagramma dell'audio.
- **Allenatore**: a fine partita analizza tempismo (tendi ad anticipare o ritardare?), corda più debole, note scambiate e intonazione (suggerisce l'accordatore). Tiene traccia delle note che sbagli di più e prepara «Allena i punti deboli», un brano su misura.
- **Livelli e missione del giorno**: XP, titoli da Principiante a Leggenda, una missione ogni giorno, record per ogni livello.
- **Microfono**: prova dal vivo (nota e cent), calibrazione del ritardo con lampi visivi, regolazione della sensibilità, click del metronomo opzionale (consigliato con le cuffie).
- Ogni gioco funziona anche senza chitarra, toccando lo schermo. «Aggiungi al Diario» registra i minuti giocati.
- Il backup comprende anche i progressi delle Sfide.
- Nuovo file `.nojekyll` per GitHub Pages: copia anche questo file nel repository (i caricamenti dal browser tendono a ignorare i file che iniziano con il punto).
- Nuovi file: `engine.js` (analisi audio) e `game.js` (giochi). Nel menu in basso «Sfide» prende il posto di «Canzoni», che resta raggiungibile dalla home.

Nota: il riconoscimento è stato collaudato con suoni sintetici e con la simulazione del microfono, non con ogni tipo di chitarra e di telefono. Se non riconosce le note, usa «Prova il microfono» e regola la sensibilità; se i giudizi sembrano sempre in anticipo o in ritardo, esegui la calibrazione. Le melodie sono trascritte a mano: per Jingle Bells verifica a orecchio.

## Novità 1.12.2

- Corretto il pulsante «Controlla aggiornamenti»: se i nuovi file sono ancora in download mostra «Scarico l'aggiornamento…» invece di «è aggiornato» e poi propone il riavvio; senza connessione indica «Sei offline».

## Novità 1.12.1

- Lezioni da 16 a 23: accordatura, schemi di pennata, valzer in 3/4, settime e add9, capodastro, giri di accordi, costruzione di una sessione di studio.
- Esercizi da 18 a 24 (con tablatura della scala di DO e metronomo in 3/4); corretti gli esercizi 03 e 12.
- Percorso accordi: 12 tappe con esercizi pratici specifici, nuovi accordi (Fm, Gm, Bm7, G/B, Esus4, versione semplificata di FA); corrette le diteggiature di F5 e G5.
- Lezioni, esercizi e tappe del percorso si segnano come completati con lo stesso pulsante; i progressi sono inclusi nel backup.
- Nomenclatura uniforme: note e accordi sempre in italiano con la sigla internazionale tra parentesi (es. MI minore (Em)); rimossa la colonna «Pronuncia» dalla teoria.
- Lessico unificato in tutti i menu (tempo/BPM, plettrata e pennata, smorzamento, sezione Accordi, capodastro, tasti con numeri ordinali).
- Teoria musicale ampliata a 11 schede con 10 illustrazioni: tastiera di pianoforte, parti della chitarra, tastiera con le note, circolo delle quinte, diagrammi d'accordo, misure, valori delle note, pentagramma e tablatura.
- Il metronomo nelle schede si ferma anche con Esc e supporta le battute in 3/4.
- Import backup: le date non valide vengono scartate.

## Novità 1.11.1

- Percorso accordi riorganizzato in righe compatte apribili, come l'elenco delle lezioni.
- Tabella delle note musicali corretta: sette righe complete.

## Novità 1.11

- Schede accordo apribili direttamente dalle lezioni.
- Metronomo integrato e regolabile nelle attività didattiche.
- Lezioni progressive aggiuntive ed esercizi più guidati nel percorso accordi.
- Nomi delle note presentati in italiano con la sigla internazionale tra parentesi.
- Disposizione delle meccaniche dell'accordatore corretta e corde etichettate.
