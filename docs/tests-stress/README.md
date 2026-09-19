# Food Arena — stress test locale isolato

**Archivio della versione precedente al mandato.** Questi risultati descrivono il flusso iniziale senza escrow. Per la versione con Avalanche vincolante vedere `docs/tests-budget-contract`, `docs/tests-budget-sql` e `docs/tests-budget-integration`; non usare questo script come verifica del nuovo checkout.

Esito del 19 settembre 2026: **PASS**. Endpoint `http://localhost:5173/api/passo`, solo richieste con `demo: true`, nessun `arena`, nessuna attestazione blockchain e nessuna modifica ai sorgenti del checkout. Login tramite il normale `/signin-with-chatgpt` locale. Nessun header di autenticazione o IP contraffatto, cookie ruotato per aggirare limiti o accesso diretto al database live.

## Prova HTTP

Run `STRESS_2026-09-19T10-58-18-982Z`: 50 richieste HTTP, comprese verifica e pulizia iniziale, in 1.050 ms, picco 12 simultanee. Latenza mediana 69 ms, P95 118 ms, massimo 119 ms su questa macchina e questo server locale. Sono prove di correttezza concorrente con burst brevi, non una misura della capacità di produzione.

| Caso | Esito osservato |
|---|---|
| Tre richieste attive per sessione | 1 iniziale + 4 parallele: 2 nuove, 2 rifiuti 429; totale attive 3 |
| Ultima porzione | 3 offerte concorrenti: 1 creata, 2 rifiutate; stock 1, disponibile 0 |
| Doppia accettazione | 12 POST simultanei sulla stessa offerta: 1 successo, 11 rifiuti; una scelta |
| Doppio ritiro | 12 POST simultanei: 1 successo, 11 rifiuti; stock 0, richiesta `collected` |
| Proprietà richiesta | Accettazione da sessione estranea: 403 |
| Codice ritiro | Assente nel GET gestore e anonimo, presente per proprietario sulla scelta accettata |
| Limite IP orario | Non raggiunto; nessun aggiramento |

Pulizia verificata con letture successive: menu STRESS non più fra quelli attivi; richieste della run esclusivamente demo, una `collected` e due `cancelled`. Gli oggetti precedenti alla run sono stati lasciati invariati.

## Scadenze in SQLite RAM

`clock-race.py` legge ed estrae lo SQL attuale della route e usa la migrazione reale in un database `:memory:`. Sono passate quattro prove:

1. Accettazione con orario applicativo vecchio dopo riassegnazione dello stock: zero aggiornamenti, disponibile 0.
2. Ritiro dopo la scadenza, con porzione già riservata ad altri: zero aggiornamenti, stock invariato 1.
3. Conteggio atomico con due richieste esistenti e dodici INSERT: una sola creazione, totale 3.
4. Due offerte di locali diversi per la stessa richiesta: una accettata, l'altra cancellata.

Entrambe le prove usano lo stesso SHA-256 del sorgente: `75f78add8a5e2dbbb598e8d213a507f061d6f5be7940501d32366168453ca1c7`. Il sorgente è rimasto invariato durante la run HTTP. Nessun nuovo difetto rilevato nei casi richiesti; non è stato testato il nuovo flusso `arena:true` né Fuji.

## Ripetere

La run HTTP crea al massimo cinque tentativi di richiesta demo, può consumare la quota IP e rispetta un eventuale 429. Non eseguirla se si vuole evitare nuova occupazione della quota. Se il gestore autenticato ha un locale reale (`demo !== 1`), lo script si ferma.

```powershell
node docs/tests-stress/stress.cjs
node docs/tests-stress/verify-cleanup.cjs
python docs/tests-stress/clock-race.py
```

Report: `stress-result.json` e `clock-race-result.json`. Cookie e codici ritiro non vengono salvati in chiaro nei report.
