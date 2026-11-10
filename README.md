# Guitar Studio PWA 2.1.0

Applicazione statica per lo studio della chitarra. Dopo il primo caricamento, le funzioni principali sono disponibili offline.

## Funzioni
- Lezioni, teoria musicale, archivio accordi e percorso progressivo.
- Accordatore con microfono e metronomo con misure 2/4, 3/4, 4/4 e 6/8.
- Diario di studio, obiettivo settimanale ed esportazione/ripristino dei dati.
- Tema chiaro e scuro, backup locale e controllo aggiornamenti.
- La voce Canzoni resta nei menu e mostra “Work in progress”.
- **Sfide** (novità 2.0): quattro giochi guidati dal microfono, con Allenatore, livelli, missione del giorno e collegamento al Diario.
- Percorso progressivo: 23 lezioni, 12 tappe accordi e 24 esercizi, dalle basi al consolidamento.
- Teoria ampliata: note, alterazioni, tastiera, scale, tonalità, triadi, ritmo e metodo di studio.

## Pubblicazione
Estrai lo ZIP e pubblica il contenuto della cartella su un hosting HTTPS statico, per esempio Netlify o GitHub Pages. Le istruzioni passo passo sono in `ISTRUZIONI_PUBBLICAZIONE_HTTPS.txt`.

La cache del service worker per questa versione è `guitar-studio-v2-1-0`.

## Dati e privacy
Il diario e i progressi vengono salvati nel browser del dispositivo. Usa “Salva backup” prima di cambiare indirizzo del sito, browser o dispositivo; usa “Ripristina backup” per recuperare i dati.


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

- **Autostrada** (stile Guitar Hero): le note scendono su sei corsie, una per corda, con il numero del tasto. Brani di difficoltà crescente (elenco nella versione 2.1.0). Due modi: *A tempo* (giudizi Perfetto/Bene/Presto/Tardi, serie, stelle) e *Aspetta me* (il brano si ferma finché suoni la nota giusta). Velocità 60%, 80%, 100%.
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
