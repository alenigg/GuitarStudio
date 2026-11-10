# Guitar Studio PWA 1.12.2

Applicazione statica per lo studio della chitarra. Dopo il primo caricamento, le funzioni principali sono disponibili offline.

## Funzioni
- Lezioni, teoria musicale, archivio accordi e percorso progressivo.
- Accordatore con microfono e metronomo con misure 2/4, 3/4, 4/4 e 6/8.
- Diario di studio, obiettivo settimanale ed esportazione/ripristino dei dati.
- Tema chiaro e scuro, backup locale e controllo aggiornamenti.
- La voce Canzoni resta nei menu e mostra “Work in progress”.
- Percorso progressivo: 23 lezioni, 12 tappe accordi e 24 esercizi, dalle basi al consolidamento.
- Teoria ampliata: note, alterazioni, tastiera, scale, tonalità, triadi, ritmo e metodo di studio.

## Pubblicazione
Estrai lo ZIP e pubblica il contenuto della cartella su un hosting HTTPS statico, per esempio Netlify o GitHub Pages. Le istruzioni passo passo sono in `ISTRUZIONI_PUBBLICAZIONE_HTTPS.txt`.

La cache del service worker per questa versione è `guitar-studio-v1-12-2`.

## Dati e privacy
Il diario e i progressi vengono salvati nel browser del dispositivo. Usa “Salva backup” prima di cambiare indirizzo del sito, browser o dispositivo; usa “Ripristina backup” per recuperare i dati.


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
