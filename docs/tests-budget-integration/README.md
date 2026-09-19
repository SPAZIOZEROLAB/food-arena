# Mandato Fuji: integrazione con il percorso dell’ordine

19 settembre 2026: **40 controlli PASS**, Worker locale e contratto reale su Avalanche Fuji. Massimo **12 richieste HTTP simultanee**. Tutti gli ordini, i locali e i fondi di questa verifica sono di prova.

Una richiesta da 10 euro genera tre offerte firmate. Dodici tentativi concorrenti di scelta producono una sola scelta; il codice rimane nascosto durante la riserva. Solo dopo l’hold confermato compare il codice del cliente. Sessione estranea e codice errato non muovono fondi. Il burst di conferme del ritiro produce un solo evento di regolamento, un solo addebito di commissione e un solo decremento delle quantità. I successivi tentativi e la riconciliazione ripetuta non duplicano l’operazione.

Sono verificati anche: bytecode del contratto, corrispondenza dei termini firmati, saldo riservato/speso/credito, assenza di ordini onchain per le offerte non scelte e un solo job persistente per ogni operazione. L’inventario viene letto dal database locale in sola lettura.

Il file `integration-result.json` contiene gli esiti e le transazioni. Cookie, firme e codice di ritiro sono oscurati. Queste sono prove mirate di concorrenza e correttezza; non misurano la capacità commerciale del servizio.

## Ripetere

Con Node 22.13 o successivo, dipendenze del progetto installate, Worker su localhost:5173, migrazioni applicate e `FUJI_PRIVATE_KEY` dedicata al test configurata, usare:

```sh
node docs/tests-budget-integration/integration-test.mjs --run --manifest app/budget-proof.json --sqlite PERCORSO_DEL_DATABASE_D1_LOCALE.sqlite
```

Lo script senza `--run` non esegue richieste. Con `--run` crea una richiesta demo e due transazioni Fuji: occorrono budget e gas di prova. Rispetta i limiti applicativi. Usa esclusivamente la rete 43113 e localhost:5173; non legge chiavi private. I test di scadenza del contratto e del database sono documentati nelle cartelle adiacenti.
