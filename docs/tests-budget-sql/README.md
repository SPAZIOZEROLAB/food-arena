# Invarianti SQLite del budget Food Arena

Test locali delle query che collegano prenotazione, inventario e mandato. Nessun RPC, wallet, secret o database remoto richiesto. Lo script crea soltanto database SQLite in memoria e scrive il resoconto `sqlite-results.json` in questa cartella.

## Esecuzione

Prerequisiti: Node.js **22.13 o successivo**, dipendenze del progetto installate con `npm ci`. L'esecuzione documentata è stata verificata con Node **24.14.1**.

Dalla radice del repository:

```sh
node docs/tests-budget-sql/verify-sqlite.cjs
```

La posizione prevista è `docs/tests-budget-sql/`: lo script risale di due cartelle per trovare il progetto. È disponibile anche un percorso esplicito, relativo alla cartella corrente:

```sh
node docs/tests-budget-sql/verify-sqlite.cjs ./
```

Un'asserzione fallita produce un codice di uscita diverso da zero. Solo un'esecuzione interamente riuscita aggiorna `sqlite-results.json`: controllare sempre codice di uscita, data `runAt` e hash dei sorgenti; un risultato di una precedente esecuzione non dimostra il successo di quella corrente.

## Cosa viene eseguito

Lo script usa il parser TypeScript del progetto per estrarre le query dai sorgenti correnti `app/budget-server.ts` e `app/api/passo/route.ts`. Esegue quelle query in transazioni SQLite locali, su uno schema ridotto che conserva i campi e i vincoli necessari agli scenari:

1. Fallimento di una riserva: tutte le offerte precedenti vengono annullate; l'ultima porzione presa da un altro cliente non viene riattivata.
2. Errore iniettato nel secondo inserimento: il mandato con firma nulla viola `NOT NULL` e la transazione annulla anche l'offerta.
3. Pubblicazione duplicata: rimane una sola coppia offerta/mandato, senza mandato orfano.
4. Due riconciliazioni basate su letture precedenti: lo stock diminuisce una sola volta.
5. Stock insufficiente: `changes()>0` impedisce di registrare il ritiro, anche dopo un'altra scrittura riuscita.
6. Riconciliazioni obsolete dopo il completamento: gli stati `collected/settled` non regrediscono.

Il JSON contiene esiti, evidenze numeriche, versione Node e hash SHA-256 dei quattro file osservati. I controlli su inserimento dei dati demo e polling della pagina sono **ispezioni del sorgente**, elencate separatamente come `readOnlyChecks`; non sono test di esecuzione del browser.

## Limiti

I batch di riconciliazione vengono eseguiti in sequenza, conservando i dati che due chiamanti avrebbero letto prima del primo commit. Questo verifica le precondizioni SQL e il mancato doppio decremento; non è uno stress test multiprocesso.

Nessuna esecuzione di Cloudflare D1, Worker, contratto Solidity o interfaccia browser. Le transazioni SQLite modellano l'atomicità richiesta a `db.batch`, ma non misurano il servizio D1. Il test non prova il ritiro fisico del pasto, la disponibilità della rete o la sicurezza complessiva del prodotto. Non modifica i sorgenti applicativi.
